// 1 日の営業の進行：お客さんが並ぶ → 1 人ずつ来て注文 → 作る → わたす → 反応 → 帰る → 次の人。最後の人のあと閉店。
//
//   phase: arrive（歩いて来る）/ order（注文を話す）/ make（作る）/ serve（わたす）/ react（食べて反応）/ leave / closed
//   shift.serve()  わたす（作っているとき）     shift.update(dt)  毎フレーム
import * as THREE from 'three';
import { Customer } from './scene/Customer.js';
import { randomLook } from './data/looks.js';
import { REGULARS } from './data/characters.js';
import { makeOrder, orderText } from './sim/orders.js';
import { evaluate } from './sim/scoring.js';
import { CUSTOMER_POS, STAND, COUNTER_Y } from './layout.js';
import { Rng } from '../core/rng.js';
import { t } from '../core/i18n.js';
import { damp } from '../core/math.js';

// 行列の位置（屋台の +X 側に、こちらを向いて並ぶ）と、来る所・帰る所
const QUEUE = [[1.25, 2.05], [1.65, 2.75], [2.05, 3.45], [2.45, 4.15]];
const ENTER = [7.5, 3.4];
const EXIT = [-7.5, 2.6];

const IDLE = { update() {}, lookAt() {}, setMood() {}, turnTo() {}, arrived: true, dummy: true };
const pickVariant = (s, rng) => { const v = s.split('|'); return v[Math.floor(rng.float() * v.length)]; };

export class Shift {
  constructor(game, day, { seed = 1 } = {}) {
    this.game = game;
    this.day = day;
    this.rng = new Rng(seed * 977 + day.id * 31);
    this.scene = game.world.scene;
    this.counter = game.counter;
    this.ui = game.oui;
    this.queue = [];      // 並んでいるお客さん（先頭が次）
    this.cur = null;      // カウンターの前の人
    this.gone = [];       // 帰っていく人
    this.served = 0;      // 来た人の数（何人目か）
    this.total = day.customers;
    this.money = 0;
    this.stats = { stars: [], hearts: 0, tips: 0, perfect: 0, fell: 0, best: 0, angry: 0 };
    this.phase = 'arrive';
    this.t = 0;
    this.time = 0;
    this.served = 0;
  }

  start() {
    this.counter.stop();
    this.counter.meltRate = this.day.melt * (this.game.upgrades?.meltMul ?? 1);
    this.counter.wind = 0;
    // 最初に何人か並んでいる
    const first = Math.min(3, this.total);
    for (let i = 0; i < first; i++) this._spawn(i, true);
    this._next();
  }

  _spawn(i, atQueue = false) {
    // served は「カウンターに来た人」（今の人をふくむ）。並んでいる人の後ろが次の番号
    const index = this.served + this.queue.length + 1;
    if (index > this.total) return null;
    const regId = this.day.regulars?.[index];
    const look = regId ? REGULARS[regId].look : randomLook(this.rng);
    const c = new Customer(look);
    c.regular = regId || null;
    c.index = index;
    const q = QUEUE[Math.min(this.queue.length, QUEUE.length - 1)];
    if (atQueue) c.place(q[0], q[1], -Math.PI / 2 - 0.4);
    else { c.place(ENTER[0], ENTER[1], -Math.PI / 2); c.walkTo(q[0], q[1]); }
    this.scene.add(c.root);
    this.queue.push(c);
    return c;
  }

  _next() {
    const c = this.queue.shift();
    if (!c) { this.phase = 'closed'; this.game.onShiftEnd?.(this); return; }
    this.cur = c;
    this.served++;
    c.walkTo(CUSTOMER_POS.x, CUSTOMER_POS.z, 1.25);
    this.phase = 'arrive';
    this.t = 0;
    // 並んでいる人は前へ。足りなければ後ろに 1 人足す
    this.queue.forEach((q, k) => { const p = QUEUE[Math.min(k, QUEUE.length - 1)]; q.walkTo(p[0], p[1], 0.9); });
    if (this.queue.length < 3) this._spawn(this.queue.length);
    this.game.hud.set({ guest: this.served, guests: this.total });
  }

  /** お客さんの呼び名（常連は名前、町の人は体つきから）。 */
  nameOf(c) {
    if (c.regular) return t('name.' + c.regular);
    const L = c.look;
    return t('name.' + (L.body === 'elder' ? (L.fem ? 'grandma' : 'grandpa') : L.body === 'kid' ? 'kid' : L.body === 'teen' ? 'student' : 'guest'));
  }
  colorOf(c) { return c.regular ? REGULARS[c.regular].color : '#7fd6c2'; }

  update(dt) {
    this.t += dt;
    this.time += dt;
    const c = this.cur;
    const towerTop = this._towerTop();
    // 並んでいる人：屋台のほうを見て待つ
    for (const q of this.queue) { if (q.arrived) { q.turnTo(-Math.PI / 2 - 0.5); q.lookAt(towerTop); } q.update(dt); }
    for (let i = this.gone.length - 1; i >= 0; i--) {
      const g = this.gone[i];
      g.update(dt);
      if (g.arrived) { this.scene.remove(g.root); g.dispose(); this.gone.splice(i, 1); }
    }
    if (!c) return;
    switch (this.phase) {
      case 'arrive':
        if (c.arrived) {
          c.turnTo(Math.PI);
          this._order();
        }
        break;
      case 'order':
        c.lookAt(this._robotHead());
        this._patience(dt);
        // 話し終えたら作り始める（少し間をおいて）
        if (!this.ui.talking && this.t > 0.4) { this.phase = 'make'; this.t = 0; this.counter.begin(this.order.vessel); this.game.onMakeStart?.(); }
        break;
      case 'make': {
        c.lookAt(towerTop);
        this._patience(dt);
        const d = this.counter.tower.danger();
        if (this.patience <= 0) { this._angry(); break; }
        // 表情：危ないとはらはら、待ちくたびれるといらいら
        const left = this.patience / this.order.patience;
        const want = d > 0.55 ? 'worried' : left < 0.25 ? 'impatient' : this.flashMood > 0 ? this.flash : this.counter.tower.count >= 5 ? 'excited' : 'neutral';
        this.flashMood = Math.max(0, (this.flashMood || 0) - dt);
        if (c.moodName !== want) c.setMood(want);
        this.ui.setTicket(this.order, this.counter.tower.items.map((x) => x.flavor), this.counter.tower.vesselType);
        break;
      }
      case 'serve': {
        // 塔がお客さんの手へ移る
        const k = Math.min(1, this.t / 0.75);
        const e = k * k * (3 - 2 * k);
        const g = this.servedTower;
        const hand = new THREE.Vector3();
        c.arms[0].grip.getWorldPosition(hand);
        g.position.lerpVectors(this.serveFrom, hand.add(new THREE.Vector3(0, -0.05, 0)), e);
        g.position.y += Math.sin(e * Math.PI) * 0.12;
        if (k >= 1) {
          this.scene.remove(g);
          c.hold(g);
          this.phase = 'react';
          this.t = 0;
          this._react();
        }
        break;
      }
      case 'react':
        c.lookAt(this.t < 1.2 ? this._robotHead() : null);
        if (this.t > 1.0 && this.t < 1.05 && this.result.stars >= 3) c.lick();
        if (this.t > 2.4 && this.t < 2.45 && this.result.stars >= 3) c.lick();
        if (this.t > 3.6 || (this.t > 1.2 && this.game.input.pressed('serve'))) this._leave();
        break;
      case 'leave':
        if (this.t > 0.6) this._next();
        break;
    }
    c.update(dt);
    if (this.phase === 'order' || this.phase === 'make') this.ui.setWait(this.patience / this.order.patience);
  }

  _patience(dt) { this.patience -= dt; }

  _order() {
    const c = this.cur;
    this.order = c.regular && this.game.story?.orderFor ? this.game.story.orderFor(c.regular, this.day, this.rng) || makeOrder(this.day, this.rng, c.index) : makeOrder(this.day, this.rng, c.index);
    if (!c.regular) this.order.patience *= this.patienceMul || 1;
    this.patience = this.order.patience;
    const greet = c.regular && this.game.story?.greetFor ? this.game.story.greetFor(c.regular, this.day) : pickVariant(t('greet.' + (c.look.voice === 'kid' ? 'kid' : 'adult')), this.rng);
    const text = (greet ? greet + ' ' : '') + (this.order.line || orderText(this.order, t, c.look.voice));
    this.ui.talk(this.nameOf(c), text, { color: this.colorOf(c) });
    this.ui.setTicket(this.order, [], null);
    c.say(Math.min(4, text.length / 14));
    c.setMood('neutral');
    this.phase = 'order';
    this.t = 0;
    this.game.audio.sfx('voice', { pitch: c.look.pitch, n: Math.min(8, Math.ceil(text.length / 6)) });
  }

  /** わたす。 */
  serve() {
    if (this.phase !== 'make' || this.counter.busy || this.counter.tower.count === 0) return false;
    const tw = this.counter.tower;
    const items = tw.items;
    const built = {
      vessel: tw.vesselType,
      scoops: items.map((it) => ({ flavor: it.flavor, grade: it.grade, melt: it.melt })),
      sizes: items.map((it) => it.sizeQ ?? 1),
      toppings: this.counter.toppings || [],
      left: this.patience / this.order.patience,
    };
    this.result = evaluate(this.order, built);
    this.result.tiers = items.length;
    // 塔をはずして、お客さんの手へ
    tw.root.updateMatrixWorld(true);
    this.serveFrom = new THREE.Vector3();
    tw.root.getWorldPosition(this.serveFrom);
    const g = tw.detachAll();
    g.position.copy(this.serveFrom);
    this.scene.add(g);
    this.servedTower = g;
    this.counter.stop();
    this.phase = 'serve';
    this.t = 0;
    this.ui.hideTalk();
    this.game.audio.sfx('serve');
    this.game.audio.sfx('robot', { mood: 'happy', n: 3 });
    return true;
  }

  _react() {
    const c = this.cur, r = this.result;
    const mood = r.stars >= 5 ? 'excited' : r.stars >= 4 ? 'happy' : r.stars >= 3 ? 'yum' : r.stars >= 2 ? 'sad' : 'angry';
    c.setMood(mood);
    if (r.stars >= 5) c.jump();
    const say = c.regular && this.game.story?.reactFor ? this.game.story.reactFor(c.regular, this.day, r) : pickVariant(t('react.' + r.reason), this.rng);
    this.ui.talk(this.nameOf(c), say, { color: this.colorOf(c) });
    this.ui.setWait(null);
    c.say(Math.min(3, say.length / 14));
    this.ui.rate(r, '');
    this.ui.hideTicket();
    const earned = r.pay + r.tip;
    this.money += earned;
    this.stats.stars.push(r.stars);
    this.stats.hearts += r.hearts;
    this.stats.tips += r.tip;
    this.stats.best = Math.max(this.stats.best, r.tiers);
    this.game.onEarn?.(earned, r);
    this.game.audio.sfx(r.stars >= 4 ? 'cheer' : r.stars >= 3 ? 'coin' : 'sad');
    if (earned) this.game.audio.sfx('register');
    this.game.robotFace?.(r.stars >= 5 ? 'love' : r.stars >= 4 ? 'happy' : r.stars >= 3 ? 'normal' : 'sad', 2.2);
  }

  _angry() {
    const c = this.cur;
    c.setMood('angry');
    this.ui.talk(this.nameOf(c), pickVariant(t('react.leave'), this.rng), { color: this.colorOf(c) });
    this.ui.setWait(null);
    this.ui.hideTicket();
    c.say(1.2);
    this.counter.stop();
    this.counter.tower.reset(this.counter.tower.vesselType);
    this.stats.stars.push(0);
    this.stats.angry++;
    this.result = { stars: 0 };
    this.phase = 'react';
    this.t = 2.2;
    this.game.audio.sfx('sad');
  }

  _leave() {
    const c = this.cur;
    this.ui.hideTalk();
    c.setMood(this.result?.stars >= 3 ? 'yum' : this.result?.stars ? 'sad' : 'angry');
    c.walkTo(EXIT[0], EXIT[1], 1.05);
    this.gone.push(c);
    // 次の人は少し間をおいてから（そのあいだ cur は何もしない代わり）
    this.cur = IDLE;
    this.phase = 'leave';
    this.t = 0;
  }

  _towerTop() {
    const p = this.counter.tower.dropPoint();
    return new THREE.Vector3(STAND.x + p.x, COUNTER_Y + p.y + 0.05, STAND.z);
  }
  _robotHead() { return this.game.robotHead?.() || new THREE.Vector3(0.24, 1.35, -0.68); }

  dispose() {
    for (const c of [...this.queue, ...this.gone, this.cur]) { if (c && !c.dummy) { this.scene.remove(c.root); c.dispose(); } }
    if (this.servedTower) this.scene.remove(this.servedTower);
    this.queue = []; this.gone = []; this.cur = null;
  }

  snapshot() {
    return { phase: this.phase, guest: this.served, total: this.total, money: this.money, patience: this.order ? +(this.patience / this.order.patience).toFixed(2) : null,
      order: this.order ? { type: this.order.type, n: this.order.n, scoops: this.order.scoops, vessel: this.order.vessel, toppings: this.order.toppings } : null,
      last: this.result ? { stars: this.result.stars, score: this.result.score, reason: this.result.reason } : null };
  }
}
