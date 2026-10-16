// アイスもりもり：ゲームの進行。雛形の形（init / step / render / setState / snapshot、STATES の表）を保つ。
//
// 流れ：タイトル →（はじめから）はじまりの会話 → 朝：屋台が着く・日の見出し・源さんの電話 → 営業（Shift）
//   → 結果 → 夜の電話と学習ログ → 改造ショップ → 保存 → 次の日。6 日目のあとはエンディング、それからエンドレス営業。
import * as THREE from 'three';
import { events } from '../core/events.js';
import { createStore } from '../core/save.js';
import { t } from '../core/i18n.js';
import { World } from './World.js';
import { CameraRig } from './CameraRig.js';
import { Counter } from './Counter.js';
import { CounterUI } from './ui/CounterUI.js';
import { OrderUI } from './ui/OrderUI.js';
import { StoryUI } from './ui/StoryUI.js';
import { Hints } from './ui/Hints.js';
import { refreshGlyphs } from '../ui/glyphs.js';
import { settings } from '../core/settings.js';
import { addModals, fillResults, fillShop, fillNotebook, fillConfirm } from './ui/Modals.js';
import { Shift } from './Shift.js';
import { DAYS, endlessDay } from './data/days.js';
import { INTRO, MORNING, ENDING, evening, REGULAR_ORDERS, NOTEBOOK } from './data/story.js';
import { RIDDLES } from './data/riddles.js';
import { UPGRADES, upgradeEffects } from './data/upgrades.js';
import { ROBOT_POS, ROBOT_SCALE, ROBOT_BASE_LIFT, COUNTER_Y, STAND, tubCenter } from './layout.js';
import { Robot } from './scene/Robot.js';
import { Customer } from './scene/Customer.js';
import { REGULARS } from './data/characters.js';
import { makeAutoplay } from './dev/autoplay.js';
import { DAY_SONG } from '../audio/songs.js';

// 場所ごとの環境音（ambience.js の層）と、ときどき鳴る音（カモメ・ひぐらし・祭り太鼓）
const AMBIENCE = {
  harbor: { amb: { waves: 0.7, wind: 0.25, crowd: 0.12 }, loops: [['gull', 7, 4]] },
  beach: { amb: { waves: 1, crowd: 0.5, cicada: 0.25 }, loops: [['gull', 9, 5]] },
  park: { amb: { cicada: 1, crowd: 0.35, wind: 0.1 }, loops: [] },
  street: { amb: { crowd: 0.55, cicada: 0.12 }, loops: [['higurashi', 6, 3]] },
  cape: { amb: { wind: 1, waves: 0.8 }, loops: [['gull', 8, 4]] },
  festival: { amb: { crowd: 1, crickets: 0.6, waves: 0.15 }, loops: [['matsuri', 2.0, 0.05]] },
};
import { ease } from '../core/math.js';

export const STATES = {
  title: { title: true, input: 'menu', music: 'title' },
  story: { input: 'actions', music: 'story' },
  arrive: { input: 'actions', music: 'day' },
  play: { hud: true, touch: true, input: 'play', music: 'day' },
  notebook: { hud: true, input: 'menu', modal: 'notebook', duck: true },
  results: { input: 'menu', modal: 'results', music: 'evening' },
  shop: { input: 'menu', modal: 'shop', music: 'evening' },
  confirm: { title: true, input: 'menu', modal: 'confirm' },
  paused: { hud: true, input: 'menu', modal: 'pause', duck: true },
};

const SAVE_DEFAULT = { day: 1, wallet: 0, upgrades: { fan: 0, gyro: 0, bell: 0, aim: 0 }, medals: {}, hearts: 0, best: 0, cleared: false, endless: 0, seed: 1, started: false,
  hints: { scoop: 0, drop: 0, serve: 0, topping: 0, notebook: 0, toss: 0 } };
const ENDLESS_LOCS = ['harbor', 'beach', 'park', 'street', 'cape', 'festival'];

export class Game {
  constructor({ renderer, input, audio, screens, touch, hud }) {
    Object.assign(this, { renderer, input, audio, screens, touch, hud });
    this.save = createStore('ice-morimori.save', SAVE_DEFAULT, 2);
    this.time = 0;
    this.state = 'title';

    this.world = new World(renderer);
    this.scene = this.world.scene;
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 2000);
    this.rig = new CameraRig(this.camera);
    renderer.setScene(this.scene, this.camera);
    renderer.onResize = () => this.rig.refit();

    this.counter = new Counter(this.world, { onEvent: (n, d) => this.onCounter(n, d) });
    this.counter.camera = this.camera;
    const ui = document.getElementById('ui');
    this.cui = new CounterUI(ui, this.counter, {
      onTag: (i, down) => this.onTag(i, down),
      onShelf: () => { if (this.shift?.phase === 'make') this.counter.switchShelf(); },
      onToss: (down) => { this.tossHeld = down; if (down) this.tossTapped = true; },
    });
    this.oui = new OrderUI(ui);
    this.sui = new StoryUI(ui);
    this.hints = new Hints(ui, { refresh: (el) => refreshGlyphs(input, settings, el), device: () => input.device });
    this.sui.onLine = (L) => this._storyLine(L);
    addModals(screens);
    screens.cb.onAction = (act) => this.onAction(act);
    this.shift = null;
    this.tagHeld = false;
    this.notePage = 0;
    this.auto = makeAutoplay(this); // 開発用（__dev.game.auto）

    // 主人公のロボ
    this.robot = new Robot();
    this.robot.root.position.copy(ROBOT_POS);
    this.robot.root.scale.setScalar(ROBOT_SCALE);
    this.scene.add(this.robot.root);
    this._grip = new THREE.Vector3();
    this.robotHead = () => this.robot.headWorld();

    // 常連の注文・台詞（Shift から呼ぶ）
    this.story = {
      orderFor: (id, day) => this._regularOrder(id, day),
      greetFor: (id, day) => this._line(`reg.${id}.d${day.id}.greet`),
      reactFor: (id, day, r) => this._line(`reg.${id}.d${day.id}.${r.stars >= 3 ? 'good' : 'bad'}`) || t('react.' + r.reason).split('|')[0],
    };
  }

  async init() {
    await document.fonts?.ready;
    this.setupDay(DAYS[0]);
    this.rig.cut('title');
    this.refreshTitle();
    this.setState('title');
  }

  reset() {}

  setState(s) {
    const S = STATES[s];
    if (!S) throw new Error('状態がありません: ' + s);
    const prev = this.state;
    this.state = s;
    this.screens.showTitle(!!S.title);
    this.hud.show(!!S.hud);
    this.touch.setVisible(!!S.touch);
    this.input.mode = S.input || 'menu';
    if (!S.modal) this.screens.closeAll();
    else if (!this.screens.isOpen(S.modal)) this.screens.open(S.modal);
    if (S.music) this.audio.music(S.music === 'day' ? DAY_SONG[this.day?.location] || 'harbor' : S.music);
    this.audio.duck(!!S.duck);
    this.cui.show(s === 'play' || s === 'paused' || s === 'notebook');
    if (s !== 'play') { this.hints?.hide(); this.tossHeld = false; this.discardT = 0; }
    this[`enter_${s}`]?.(prev);
    if (prev !== s) events.emit('state', { from: prev, to: s });
  }

  // ---------------------------------------------------------------- タイトル
  refreshTitle() {
    const d = this.save.data;
    const canContinue = d.started && !d.cleared && d.day >= 1;
    this.screens.setContinue(canContinue, () => t('title.continueAt', { n: d.day }));
    const menu = this.screens.title.querySelector('.menu');
    let eb = menu.querySelector('[data-act="endless"]');
    if (!eb) {
      eb = document.createElement('button');
      eb.dataset.act = 'endless';
      menu.querySelector('[data-act="start"]').after(eb);
    }
    eb.textContent = t('title.endless');
    eb.classList.toggle('hidden', !d.cleared);
    const sb = menu.querySelector('[data-act="start"]');
    sb.dataset.i18n = 'title.new';
    sb.textContent = t('title.new');
  }

  enter_title(prev) {
    this.endEnding();
    if (prev && prev !== 'title' && prev !== 'confirm') this.setupDay(DAYS[0]); // タイトルはいつも港の朝
    this.rig.go('title', 1.5);
    this.shift?.dispose(); this.shift = null; this.counter.clear();
    this.oui.hideTalk(); this.oui.hideTicket(); this.oui.hideRating(); this.sui.hide();
    this.refreshTitle();
  }

  /** タイトルの「はじめから」。進み具合があれば確かめる。 */
  start(opts = {}) {
    if (opts.day) { this._devDay(opts.day); return; } // 開発用：__dev.goto('play', { day: 3 })
    const d = this.save.data;
    if (d.started && !d.cleared && this.state === 'title') { fillConfirm(this.screens, t('confirm.reset'), 'resetYes'); this.setState('confirm'); return; }
    this.newGame();
  }

  newGame() {
    const keep = { cleared: this.save.data.cleared, endless: this.save.data.endless };
    this.save.reset();
    Object.assign(this.save.data, keep, { started: true, seed: Math.floor(Math.random() * 1e6) });
    this.save.save();
    this.setupDay(DAYS[0]);
    this.rig.cut('talk');
    this.playStory(INTRO, () => this.arriveDay(DAYS[0]));
  }

  /** 一時停止の「やりなおす」：その日を最初から。 */
  retryDay() {
    if (!this.day) return;
    this.setupDay(this.day);
    this.openShop();
  }

  continueGame() {
    const d = this.save.data;
    const day = DAYS[Math.max(0, Math.min(DAYS.length - 1, d.day - 1))];
    this.arriveDay(day);
  }

  startEndless() {
    const n = this.save.data.endless || 0;
    this.arriveDay(endlessDay(ENDLESS_LOCS[n % ENDLESS_LOCS.length], n));
  }

  /** 開発用：その日の営業から（会話なし）。 */
  _devDay(id) {
    const day = DAYS[id - 1] || DAYS[0];
    this.setupDay(day);
    this.openShop();
  }

  onAction(act) {
    if (act === 'endless') this.startEndless();
    else if (act === 'notebook') { this.screens.closeAll(); this.openNotebook(); }
    else if (act === 'resetYes') { this.screens.closeAll(); this.newGame(); }
    // ノートの「とじる」・確認の「いいえ」：画面だけでなく状態も戻す（data-act="back" だと画面が閉じるだけで、
    // 状態が notebook / confirm のまま残り、タッチのボタンが出ない・確認なしで「はじめから」になる）
    else if (act === 'noteClose') { if (this.state === 'notebook') this.setState('play'); }
    else if (act === 'confirmNo') { if (this.state === 'confirm') this.setState('title'); }
    else if (act === 'resultsNext') this.resultsNext();
    else if (act === 'shopNext') this.shopNext();
    else if (act.startsWith('buy:')) this.buy(act.slice(4));
    else if (act === 'notePrev' || act === 'noteNext' || act.startsWith('note:')) {
      const n = NOTEBOOK.length;
      let p = act === 'notePrev' ? this.notePage - 1 : act === 'noteNext' ? this.notePage + 1 : +act.slice(5);
      // 読めないページは飛ばす
      for (let k = 0; k < n && !this._noteOk(NOTEBOOK[(p + n) % n]); k++) p += act === 'notePrev' ? -1 : 1;
      this.notePage = (p + n) % n;
      fillNotebook(this.screens, this.notePage, (P) => this._noteOk(P));
      this.audio.sfx('page');
    }
  }

  // ---------------------------------------------------------------- 会話
  playStory(lines, done) {
    this.storyDone = done;
    this.setState('story');
    this.sui.show(lines.map((L) => ({ ...L, text: () => t(L.key) })), () => { const f = this.storyDone; this.storyDone = null; f?.(); });
  }

  _storyLine(L) {
    const cast = this.endingCast?.find((c) => c.regular === L.who);
    if (cast) { cast.say(1.5); cast.jump(); cast.wave(1.2); }
    if (L.face) this.robotFace(L.face, 3);
    else if (L.who === 'phone' || L.who === 'gen') this.robotFace('normal', 0.1);
    if (L.who === 'maru') { this.robot.say(1.2); this.audio.sfx('voice', { pitch: 1.6, n: 4 }); }
    else if (L.who !== 'narration') this.audio.sfx('voice', { pitch: L.who === 'mina' ? 1.6 : L.who === 'gen' || L.who === 'phone' ? 0.75 : 1, n: 5 });
  }

  update_story(dt) {
    if (this.endingCast) {
      const sky = new THREE.Vector3(2, 36, 58);
      for (const c of this.endingCast) { c.lookAt(sky); c.update(dt); }
    }
    const input = this.input;
    if (input.pressed('scoop') || input.pressed('confirm') || input.pressed('serve')) this.sui.next();
    this.sui.update(dt);
    if (input.pressed('pause') || input.menu.back) { /* 会話はとばせない（短いので） */ }
  }

  // ---------------------------------------------------------------- 1 日
  /** その日の場面（場所・時間帯・味・トッピング）をととのえる。 */
  setupDay(day) {
    this.shift?.dispose();
    this.shift = null;
    this.day = day;
    this.world.setLocation(day.location);
    this.world.setLook(day.look);
    this.rig.setOverrides(this.world.location?.shots || {});
    // 環境音
    const A = AMBIENCE[day.location] || AMBIENCE.harbor;
    this.audio.setAmbience(A.amb);
    for (const id of this._loops || []) this.audio.stopLoop(id);
    this._loops = A.loops.map(([name, period, jitter]) => { const id = 'amb-' + name; this.audio.loop(id, name, { period, jitter, bus: 'amb', vel: 0.8 }); return id; });
    if (this.world.location) this.world.location.onBurst = () => this.audio.sfx('boom', { vel: 0.7, bus: 'amb' });
    this.counter.setFlavors(day.flavors);
    this.counter.setToppings(day.toppings);
    this.counter.clear();
    this.counter.tubs.refill(this.save.data.seed + day.id);
    this.cui.buildTags();
    this.oui.hideTalk(); this.oui.hideTicket(); this.oui.hideRating();
    const fx = upgradeEffects(this.save.data.upgrades);
    this.fx = fx;
    this.counter.meltRate = day.melt * fx.meltMul;
    this.counter.swingScale = fx.swingScale;
    this.counter.speedScale = fx.speedScale;
    this.counter.aimGuide = fx.aim;
    this.counter.wind = 0;
    this.money = 0;
    this.hud.set({ day: day.id, loc: day.location, guest: 0, guests: day.customers, money: 0, goal: day.goal });
    this._placeCart(0);
  }

  /** 朝：屋台が走って来て止まる → 日の見出し → 源さんの電話 → 開店。 */
  arriveDay(day) {
    this.setupDay(day);
    this.arriveT = 0;
    this._placeCart(-9);
    this.rig.cut('arrive');
    this.sui.card(day, t('card.weather.' + day.look));
    this.setState('arrive');
    this.audio.sfx('bikebell');
  }

  update_arrive(dt) {
    this.arriveT += dt;
    const k = Math.min(1, this.arriveT / 2.6);
    const off = -9 * (1 - ease.outCubic(k));
    this._placeCart(off);
    for (const w of this.world.cart.wheels) w.rotation.z -= dt * (k < 1 ? 10 * (1 - k) + 1 : 0);
    // パラソルがぽんと開く
    const pk = Math.max(0, Math.min(1, (this.arriveT - 2.4) / 0.45));
    this.world.cart.parasol.scale.set(0.15 + 0.85 * ease.outBack(pk), 0.3 + 0.7 * pk, 0.15 + 0.85 * ease.outBack(pk));
    this.robot.speed = k < 1 ? 6 * (1 - k) : 0;
    this.sui.update(dt);
    const skip = this.input.pressed('scoop') || this.input.pressed('confirm');
    if (this.arriveT > 3.2 || (skip && this.arriveT > 0.3)) {
      this._placeCart(0);
      this.world.cart.parasol.scale.set(1, 1, 1);
      this.robot.speed = 0;
      const lines = !this.day.endless ? MORNING[this.day.id] : null;
      this.rig.go('talk', 2);
      if (lines) this.playStory(lines, () => this.openShop());
      else this.openShop();
    }
  }

  /** 屋台・ロボ・塔を、まとめて x だけずらして置く（到着の動き）。 */
  _placeCart(off) {
    this.world.cart.root.position.x = off;
    this.robot.root.position.x = ROBOT_POS.x + off;
    this.counter.tower.root.position.x = STAND.x + off;
    this.counter.dipper.visible = off === 0;
    if (off !== 0) this.counter.dipperPos.x = 0.3 + off;
  }

  /** 開店：お客さんが来はじめる。 */
  openShop() {
    this.shift?.dispose();
    this.shift = new Shift(this, this.day, { seed: this.save.data.seed || 1 });
    this.shift.patienceMul = this.fx?.patienceMul ?? 1;
    this.shift.start();
    this.rig.go('serve', 2.2);
    this.setState('play');
  }

  onEarn(n) {
    this.money += n;
    this.hud.set({ money: this.money });
  }

  /** 最後のお客さんが帰った。 */
  onShiftEnd(shift) {
    const d = this.save.data, day = this.day;
    const st = shift.stats;
    const medal = shift.money >= day.goal;
    d.wallet += shift.money;
    d.hearts += st.hearts;
    d.best = Math.max(d.best, st.best);
    if (medal && !day.endless) d.medals[day.id] = true;
    this.lastResult = { day: day.id, location: day.location, endless: day.endless, money: shift.money, goal: day.goal, stars: st.stars, hearts: st.hearts, tips: st.tips, best: st.best, angry: st.angry, medal, wallet: d.wallet };
    this.save.save();
    // 少し間をおいて結果を出す
    this.resultsT = 1.2;
  }

  enter_results() { fillResults(this.screens, this.lastResult); }

  resultsNext() {
    const day = this.day;
    if (day.endless) { this.save.data.endless = (this.save.data.endless || 0) + 1; this.save.save(); this.openShopMenu(); return; }
    if (day.id >= DAYS.length) {
      // 最終日：エンディング（常連が屋台のまわりに集まって花火を見上げる）
      this.startEnding();
      this.playStory(ENDING, () => {
        this.endEnding();
        this.save.data.cleared = true;
        this.save.data.day = DAYS.length;
        this.save.save();
        this.setState('title');
      });
      return;
    }
    this.rig.go('talk', 1.5);
    this.playStory(evening(day, this.lastResult.medal), () => this.openShopMenu());
  }

  startEnding() {
    this.shift?.dispose();
    this.shift = null;
    this.counter.stop();
    // 屋台の前の参道に並んで、海の上の花火を見上げる（カメラはその少し後ろの低い所）
    const spots = { mina: [1.1, 3.3, 0.1], sota: [2.25, 3.8, -0.1], tanaka: [0.05, 3.95, 0.15], ume: [3.15, 3.25, -0.2], gen: [1.6, 4.4, 0.0] };
    this.endingCast = Object.entries(spots).map(([id, [x, z, ry]]) => {
      const c = new Customer(REGULARS[id].look);
      c.regular = id;
      c.place(x, z, ry);
      c.setMood('happy');
      this.scene.add(c.root);
      return c;
    });
    const loc = this.world.location;
    if (loc) { loc.boost = 1; loc.fireworks = true; }
    this.audio.music('ending');
    this.rig.go('ending', 1.0);
  }

  endEnding() {
    for (const c of this.endingCast || []) { this.scene.remove(c.root); c.dispose(); }
    this.endingCast = null;
    if (this.world.location) this.world.location.boost = 0;
  }

  openShopMenu() {
    const d = this.save.data;
    fillShop(this.screens, { wallet: d.wallet, upgrades: d.upgrades, nextLabel: this.day.endless ? t('shop.next') : null });
    this.setState('shop');
  }

  buy(id) {
    const d = this.save.data, U = UPGRADES[id];
    const lv = d.upgrades[id] || 0;
    if (!U || lv >= U.levels.length || d.wallet < U.levels[lv]) { this.audio.sfx('ui_back'); return; }
    d.wallet -= U.levels[lv];
    d.upgrades[id] = lv + 1;
    this.save.save();
    this.audio.sfx('register');
    fillShop(this.screens, { wallet: d.wallet, upgrades: d.upgrades });
  }

  shopNext() {
    const d = this.save.data;
    if (this.day.endless) { this.startEndless(); return; }
    d.day = Math.min(DAYS.length, this.day.id + 1);
    this.save.save();
    this.arriveDay(DAYS[d.day - 1]);
  }

  // ---------------------------------------------------------------- 常連・ノート
  _line(key) { const s = t(key); return s === key ? null : s; }

  _regularOrder(id, day) {
    const R = REGULAR_ORDERS[id]?.[day.id];
    if (!R) return null;
    const o = { ...R.order };
    o.toppings = (o.toppings || []).filter((x) => day.toppings.includes(x));
    if (o.type === 'riddle') o.scoops = RIDDLES[o.riddle].answer.slice();
    o.scoops = o.scoops || [];
    o.n = o.n || o.scoops.length;
    o.patience = (32 + o.n * 9 + o.toppings.length * 6) * (day.patience || 1) * (this.fx?.patienceMul ?? 1);
    o.line = this._line(`reg.${id}.d${day.id}.order`);
    o.regular = id;
    return o;
  }

  _noteOk(P) {
    const d = this.save.data;
    const cur = this.day?.endless || d.cleared ? 99 : (this.day?.id || d.day);
    const after = this.state === 'results' || this.state === 'shop' || this.state === 'story';
    return P.evening ? cur > P.day || (cur === P.day && after) : cur >= P.day;
  }

  openNotebook() {
    this._hintDone('notebook');
    if (!this._noteOk(NOTEBOOK[this.notePage])) this.notePage = 0;
    fillNotebook(this.screens, this.notePage, (P) => this._noteOk(P));
    this.setState('notebook');
  }

  update_notebook() {
    const input = this.input;
    // ノートの画面がどこかで閉じられていたら、営業にもどる（状態だけ残って操作できなくならないように）
    if (!this.screens.isOpen('notebook')) { this.setState('play'); return; }
    if (input.pressed('notebook') || input.menu.back || input.pressed('pause')) { this.setState('play'); return; }
    if (input.menu.left) this.onAction('notePrev');
    if (input.menu.right) this.onAction('noteNext');
  }
  enter_notebook() { this.audio.sfx('page'); }

  // ---------------------------------------------------------------- 毎フレーム
  enter_play(prev) { this.grace = 0.2; if (prev === 'notebook' || prev === 'paused') return; }
  pauseFromTouch() { if (this.state === 'play') this.setState('paused'); }

  step(dt) {
    const input = this.input;
    this._dt = dt;
    input.update(dt);
    this.time += dt;
    this[`update_${this.state}`]?.(dt);
    // 風（灯台の岬）：ゆっくり強くなったり弱くなったり。塔を横に押す
    const W = this.state === 'play' ? this.day?.wind || 0 : 0;
    this.counter.wind = W * (Math.sin(this.time * 0.9) + 0.5 * Math.sin(this.time * 2.3 + 1) + 0.25 * Math.sin(this.time * 5.1));
    this.counter.update(dt);
    // 塔が高くなったら、カメラを引いて上へ（ケースと塔のてっぺんの両方が入るように）
    const top = this.counter.tower.dropPoint().y + COUNTER_Y;
    const over = this.state === 'play' ? Math.max(0, top - (COUNTER_Y + 0.36)) : 0;
    this.rig.lift = over * 0.42;
    this.rig.pull = over * 1.5;
    this._robot(dt, top);
    this.rig.update(dt);
    this.world.update(dt, this.camera);
    this.cui.update(dt, this.camera);
    this.audio.listen(this.camera);
    this.audio.tick(dt);
    input.endFrame();
  }

  /** ロボの手（ディッシャーを持つ）・視線・表情・胴の高さ。 */
  _robot(dt, top) {
    const r = this.robot, ctr = this.counter, sh = this.shift;
    const g = ctr.dipper;
    g.updateMatrixWorld(true);
    this._grip.copy(g.userData.grip);
    g.localToWorld(this._grip);
    const active = ctr.phase !== 'idle' && !(ctr.phase === 'select' && ctr.shelf === 'top');
    r.reach('L', active && ctr.dipper.visible ? this._grip : null);
    if (ctr.tool && ctr.phase !== 'tfall') { const p = ctr.tool.position.clone(); p.y += 0.05; r.reach('R', p); }
    else if (sh?.phase === 'serve' && sh.servedTower) { const p = sh.servedTower.position.clone(); p.y += 0.06; r.reach('R', p); } // わたす：右手で差し出す
    else r.reach('R', null);
    // 見る所：選ぶ・すくう＝ケース、運ぶ・ねらう・落とす＝塔のてっぺん、話す＝お客さん、会話＝カメラ
    let look = null;
    if (this.state === 'story' || this.state === 'arrive' || this.state === 'title') look = this.camera.position.clone();
    else if (ctr.phase === 'select' && ctr.shelf === 'top' && ctr.tsel) look = this.counter.shelfObj.homes[ctr.tsel].getWorldPosition(new THREE.Vector3());
    else if (ctr.phase === 'select' || ctr.phase === 'scoop') look = tubCenter(ctr.sel, new THREE.Vector3());
    else if (ctr.tool) look = ctr.tool.position.clone();
    else if (ctr.phase === 'carry' || ctr.phase === 'aim' || ctr.phase === 'fall' || ctr.phase === 'settle') look = new THREE.Vector3(STAND.x, top + 0.04, STAND.z);
    else if (sh?.cur && !sh.cur.dummy) { look = new THREE.Vector3(); sh.cur.head.getWorldPosition(look); }
    r.look(look);
    // 表情：ねらう＝真剣、危ない＝はらはら、ふだん＝にこにこ（出来事の表情は少しのあいだ優先）
    this.faceHold = Math.max(0, (this.faceHold || 0) - dt);
    if (!this.faceHold) {
      const d = ctr.tower.danger();
      r.setFace(d > 0.6 ? 'worried' : ctr.phase === 'aim' || ctr.phase === 'taim' || ctr.phase === 'scoop' ? 'focus' : 'normal');
    }
    // 塔が高いと、胴をのばして届かせる
    r.lift = ROBOT_BASE_LIFT + (this.state === 'play' ? Math.max(0, top - (COUNTER_Y + 0.42)) * 0.75 : 0);
    r.update(dt);
  }

  /** 出来事の表情を少しのあいだ出す。 */
  robotFace(name, sec = 1.2) { this.robot.setFace(name); this.faceHold = sec; }

  update_title(dt) {
    if (this.input.menu.back && this.screens.back()) this.audio.sfx('ui_back');
    // マルがこちらへ手をふる
    const r = this.robot, h = r.headWorld();
    const wave = new THREE.Vector3(h.x + 0.28, h.y + 0.12 + Math.sin(this.time * 7) * 0.05, h.z + 0.2 + Math.cos(this.time * 7) * 0.04);
    r.reach('R', wave);
    if (!this.faceHold) this.robotFace(Math.sin(this.time * 0.7) > 0.6 ? 'wink' : 'happy', 0.5);
  }
  update_confirm() {
    if (!this.screens.isOpen('confirm') || this.input.menu.back) this.setState('title');
  }
  update_results(dt) {}
  update_shop() {}

  update_paused() {
    const input = this.input;
    if (input.menu.back || input.menu.start || input.pressed('pause')) {
      if (this.screens.top !== this.screens.modals.pause) { this.screens.back(); this.audio.sfx('ui_back'); }
      else this.setState('play');
    }
  }

  update_play(dt) {
    const input = this.input, ctr = this.counter;
    if (input.pressed('pause') || input.menu.start) { this.setState('paused'); return; }
    if (input.pressed('notebook') && this.day?.id >= 1) { this.openNotebook(); return; }
    this.grace = Math.max(0, (this.grace || 0) - dt);
    this.shift?.update(dt);
    this.oui.update(dt);
    // 最後のお客さんのあと、少しして結果へ
    if (this.resultsT > 0) { this.resultsT -= dt; if (this.resultsT <= 0) { this.resultsT = 0; this.setState('results'); } return; }
    // 話しているあいだは、押すと先へ
    if (this.shift && (this.shift.phase === 'order' || this.shift.phase === 'react') && this.oui.talking && (input.pressed('scoop') || input.pressed('serve'))) { this.oui.skip(); return; }
    this._hint();
    if (this.shift?.phase !== 'make') { if (this.discardT) this._toss(0, true); return; }
    if (input.pressed('serve')) { if (this.shift.serve()) this._hintDone('serve'); return; }
    const m = input.menu;
    if (m.left) ctr.move(-1, 0);
    if (m.right) ctr.move(1, 0);
    if (m.up) ctr.move(0, 1);
    if (m.down) ctr.move(0, -1);
    if (input.pressed('shelf')) ctr.switchShelf();
    if (!this.grace && input.pressed('scoop')) ctr.press();
    // すくっている途中で離したら、そこで止める（名札を押しているときは名札の指で判断）
    if ((ctr.phase === 'scoop' || ctr.phase === 'pour') && !this.tagHeld && !input.down('scoop') && !input.pressed('scoop')) ctr.release();
    this._toss(dt);
  }

  /** すてる（長押し 0.5 秒）：揺れている玉だけ／持っているトッピングだけ／塔ごと。
   *  短く押して離したら「長押しで」と知らせる（すぐ捨てると、うっかりのときに困るので） */
  _toss(dt, off = false) {
    const ctr = this.counter, HOLD = 0.5;
    const held = !off && (this.input.down('discard') || this.tossHeld);
    // 1 コマより短い叩き（キー・マウスのボタン）も「押した」に数える
    const tapped = !off && (this.input.pressed('discard') || this.tossTapped);
    this.tossTapped = false;
    if (held) {
      this.discardT = (this.discardT || 0) + dt;
      if (this.discardT >= HOLD && this.discardT < 50) {
        const what = ctr.discard();
        this.discardT = 50; // 離すまで、次は数えない
        if (!what) this.audio.sfx('ui_back');
      }
    } else {
      // 短く押した（1 コマより短い叩きもふくむ）
      if (!off && (tapped || (this.discardT > 0 && this.discardT < HOLD)) && ctr.canDiscard()) {
        this.cui.pop(t('pop.holdToss'), this._topWorld(), 'hold');
        this.audio.sfx('ui_move');
      }
      this.discardT = 0;
    }
    const p = this.discardT >= 50 ? 0 : Math.min(1, (this.discardT || 0) / HOLD);
    this.cui.setToss(p);
    this.touch.setProgress?.('discard', p);
  }

  _topWorld() {
    const p = this.counter.tower.dropPoint();
    return new THREE.Vector3(this.counter.tower.root.position.x + p.x, COUNTER_Y + p.y + 0.06, this.counter.tower.root.position.z);
  }

  /** 操作のヒント：はじめのうちだけ、その場面で出す（できたら数えて、何回かで出さなくなる）。 */
  _hint() {
    const H = this.save.data.hints, ctr = this.counter, sh = this.shift;
    let want = null;
    if (sh?.phase === 'make' && this.state === 'play') {
      const o = sh.order, n = ctr.tower.count;
      const done = o && n >= o.n;
      if (ctr.phase === 'aim' && H.drop < 3) want = 'drop';
      else if (ctr.phase === 'select' && ctr.shelf === 'ice' && n === 0 && H.scoop < 2) want = 'scoop';
      else if (ctr.phase === 'select' && o?.type === 'riddle' && n === 0 && H.notebook < 2) want = 'notebook';
      else if (ctr.phase === 'select' && done && o.toppings.length && ctr.toppings.length < o.toppings.length && H.topping < 3) want = ctr.shelf === 'ice' ? 'toTopping' : 'topping';
      else if (ctr.phase === 'select' && done && (!o.toppings.length || ctr.toppings.length >= o.toppings.length) && H.serve < 3) want = 'serve';
      else if (ctr.tower.danger() > 0.7 && H.toss < 2) want = 'wobbly';
    }
    if (want) this.hints.show(want); else if (this.hints.key) this.hints.hide();
    this.hints.update(this._dt || 1 / 60);
  }

  /** ヒントの場面をこなした（数える）。 */
  _hintDone(key) {
    const H = this.save.data.hints;
    if (key in H) H[key]++;
  }

  /** 名札を押した・離した（マウス・タッチ）。key は容器の番号か 'top:<id>'。 */
  onTag(key, down) {
    if (this.state !== 'play' || this.shift?.phase !== 'make') return;
    const ctr = this.counter;
    if (down) {
      if (ctr.phase === 'aim' || ctr.phase === 'taim') { ctr.press(); return; }
      const ok = typeof key === 'string' ? ctr.pickTopping(key.slice(4)) : ctr.pick(key);
      if (ok && ctr.press()) this.tagHeld = true;
    } else if (this.tagHeld) {
      this.tagHeld = false;
      ctr.release();
    }
  }

  onCounter(name, d) {
    const a = this.audio, ui = this.cui;
    const topWorld = () => {
      const p = this.counter.tower.dropPoint();
      return new THREE.Vector3(this.counter.tower.root.position.x + p.x, COUNTER_Y + p.y + 0.06, this.counter.tower.root.position.z);
    };
    switch (name) {
      case 'select': a.sfx('ui_move'); break;
      case 'shelf': a.sfx('ui_ok'); break;
      case 'shelfNo': a.sfx('ui_back'); if (d.reason === 'locked') ui.pop(t('pop.locked'), topWorld(), 'miss'); break;
      case 'pourStart': a.loop('pour', d.topping === 'sauce' ? 'squeeze' : 'rattle', { period: d.topping === 'sauce' ? 0.2 : 0.085, jitter: 0.02 }); break;
      case 'pourEnd': a.stopLoop('pour'); if (!d.cancel) this._hintDone('topping'); if (d.sweet) ui.pop(t('pop.nice'), topWorld(), 'nice'); break;
      case 'scoopStart': a.loop('scrape', 'scrape', { period: 0.07, jitter: 0.02 }); break;
      case 'scoopCancel': a.stopLoop('scrape'); break;
      case 'scoopEnd': a.stopLoop('scrape'); if (d.topping) break; this._hintDone('scoop'); a.sfx('pop'); if (d.sweet) ui.pop(t('pop.nice'), this.counter.dipperPos.clone().add(new THREE.Vector3(0, 0.08, 0)), 'nice'); break;
      case 'land': {
        this._hintDone(d.topping ? 'topping' : 'drop');
        const txt = d.grade === 'perfect' ? (d.combo > 1 ? t('pop.perfectCombo', { n: d.combo }) : t('pop.perfect')) : t('pop.' + d.grade);
        ui.pop(txt, topWorld(), d.grade);
        if (d.grade === 'perfect') { this.robotFace(d.combo >= 3 ? 'star' : 'happy', 0.9); if (d.combo >= 3) this.robot.wiggle(0.5); }
        if (d.topping) a.sfx(d.topping === 'cherry' ? 'pip' : 'crunch');
        else a.sfx('plop', { pitch: 1 + Math.min(6, this.counter.tower.count) * 0.04 });
        if (d.grade === 'perfect') a.sfx('sparkle', { pitch: 1 + Math.min(8, d.combo - 1) * 0.06 });
        if (d.grade === 'ok') { this.rig.shake = 0.4; a.sfx('wobble'); }
        if (this.shift?.cur?.setMood && d.grade === 'perfect') { this.shift.flash = 'happy'; this.shift.flashMood = 0.8; }
        break;
      }
      case 'miss': ui.pop(t('pop.miss'), topWorld(), 'miss'); a.sfx('wobble'); this.robotFace('surprised', 1.0); break;
      case 'break': ui.pop(t('pop.break'), topWorld(), 'miss'); a.sfx('creak'); this.rig.shake = 1; this.robotFace('dizzy', 1.6); if (this.shift) { this.shift.flash = 'surprised'; this.shift.flashMood = 1.2; this.shift.stats.fell++; } break;
      case 'splat': a.sfx('splat', { vel: d.where === 'ground' ? 0.8 : 1, minGap: 0.05 }); break;
      case 'poof': a.sfx('pop', { pos: d.pos, minGap: 0.04 }); break;
      case 'discard': a.sfx('robot', { mood: 'sad', n: 2 }); this.robotFace(d.what === 'tower' ? 'sad' : 'think', 0.9); this._hintDone('toss'); break;
    }
  }

  render(dt) { this.renderer.render(dt); }

  snapshot() {
    return { state: this.state, day: this.day?.id, look: this.world.lookId, location: this.world.locationId, shot: this.rig.shot, counter: this.counter.info(), shift: this.shift?.snapshot(), save: { day: this.save.data.day, wallet: this.save.data.wallet, cleared: this.save.data.cleared } };
  }
}
