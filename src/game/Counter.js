// 調理台：ケースのアイス・ディッシャー・塔・落ちたアイスをまとめ、1 段ずつの流れを進める。
//
//   select  ケースの味を選ぶ（ディッシャーが上に浮いている）。press() で scoop へ
//   scoop   押しているあいだ、表面をなぞって玉が育つ（gauge 0→1）。release() で carry へ
//   carry   玉を塔の上へ運ぶ
//   aim     塔の上で左右に揺れる。press() で fall へ
//   fall    落ちる → tower.land()。乗れば settle、外れれば落ちたアイスに
//   settle  少し待って select にもどる
// トッピング（shelf = 'top' に切り替えたとき）：
//   pour    長押しでかける（スプレー・ソース）。release() で終わる
//   tcarry → taim → tfall   さくらんぼ・ウエハースを、玉と同じように揺らして落とす
// トッピングをのせたら、もう玉は足せない（下に埋まってしまうので）。
// 入力は Game が press / release / move / pick / switchShelf で渡す。出来事は onEvent(name, data) で知らせる（音・表示）。
import * as THREE from 'three';
import { Tubs } from './scene/Tubs.js';
import { Tower, PERFECT, GOOD } from './Tower.js';
import { Debris } from './Debris.js';
import { ScoopMesh } from './scene/IceCream.js';
import { makeDipper } from './scene/Dipper.js';
import { ToppingShelf, ToppingDecor, topSpot, makeCherry, makeWafer } from './scene/Toppings.js';
import { FLAVORS } from './data/flavors.js';
import { TOPPINGS } from './data/toppings.js';
import { mergeStatic } from './scene/merge.js';
import { STAND, COUNTER_Y, SCOOP_R, tubCenter, DIPPER_WELL } from './layout.js';
import { clamp, damp, lerp, smoothstep } from '../core/math.js';

export const SWEET = [0.6, 0.84];   // ちょうどいい量のゲージの帯
export const POUR_SWEET = [0.55, 0.85]; // トッピングをかける量の帯

export class Counter {
  constructor(world, { onEvent } = {}) {
    this.world = world;
    this.onEvent = onEvent || (() => {});
    const scene = world.scene;
    this.tubs = new Tubs(world.cart.root);
    this.tower = new Tower(scene);
    this.tower.root.position.copy(STAND);
    this.debris = new Debris(scene);
    this.tower.onBreak = (pieces, at) => {
      this.debris.add(pieces);
      this.combo = 0;
      // トッピングをのせた玉が落ちたら、トッピングもなくなる
      if (this.decor && !this.tower.views.includes(this.decor.scoop)) { this.decor = null; this.toppings = []; this.shelf = 'ice'; }
      this.onEvent('break', { count: pieces.length, at });
    };
    this.debris.onSplat = (pos, where) => this.onEvent('splat', { pos, where });
    this.debris.onPoof = (pos) => this.onEvent('poof', { pos });
    this.dipper = makeDipper();
    scene.add(this.dipper);
    this.shelfObj = new ToppingShelf(world.cart.root);
    // 動かない小物（瓶の中のさくらんぼ・箱のウエハース・容器の底）をまとめる。小さいものは影を落とさない
    // 入れ物ごと（味によって出し入れするので、入れ物をまたいではまとめない）
    for (const h of Object.values(this.shelfObj.homes)) mergeStatic(h);
    for (const t of this.tubs.items) t.mesh.userData.noMerge = true;
    mergeStatic(this.tubs.root);
    this.shelfObj.root.traverse((o) => { if (o.isMesh && !Object.values(this.shelfObj.tools).some((tl) => tl === o || tl.getObjectById?.(o.id))) o.castShadow = false; });
    this.tubs.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.shelf = 'ice';
    this.topList = [];
    this.tsel = null;
    this.toppings = [];
    this.decor = null;
    this.tool = null;          // 手に持っているトッピングの道具
    this.toolPos = new THREE.Vector3();
    // ねらいライト（改造）：落ちる所に光る輪と、上からの光の線
    this.aimGuide = false;
    const ringM = new THREE.MeshBasicMaterial({ color: '#7ff6ff', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.02, 24), ringM);
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.renderOrder = 5;
    this.aimBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 1, 6), ringM);
    this.aimRing.visible = this.aimBeam.visible = false;
    scene.add(this.aimRing, this.aimBeam);
    this.dipperPos = new THREE.Vector3(0.24, COUNTER_Y + 0.14, -0.1);
    this.dipper.position.copy(this.dipperPos);

    this.phase = 'idle';
    this.sel = 0;
    this.flavors = [];
    this.gauge = 0;
    this.ball = null;
    this.ballR = SCOOP_R.ideal;
    this.ballVY = 0;
    this.t = 0;
    this.aimPh = 0;
    this.aimCenter = 0;
    this.combo = 0;
    this.last = null;      // 直前の着地の結果
    this.meltRate = 0.012;
    this.wind = 0;
    this.swingScale = 1;   // ジャイロの改造で小さくなる
    this.speedScale = 1;
    this.camera = null;    // 選ぶ順を画面の位置で決めるため
    this._v = new THREE.Vector3();
  }

  /** 並べる味（8 つ。null は空き）。 */
  setFlavors(list) {
    this.flavors = list.slice(0, 8);
    while (this.flavors.length < 8) this.flavors.push(null);
    this.tubs.setFlavors(this.flavors);
    if (!this.flavors[this.sel]) this.sel = this.flavors.findIndex(Boolean);
  }

  /** 使えるトッピング。 */
  setToppings(list) {
    this.topList = list.slice();
    this.shelfObj.setAvailable(this.topList);
    if (!this.topList.includes(this.tsel)) this.tsel = this.topList[0] || null;
  }

  /** 新しい注文：器を置いて、選ぶところから。 */
  begin(vessel = 'cone') {
    this.tower.reset(vessel);
    this._clearBall();
    this._dropTool();
    this.combo = 0;
    this.shelf = 'ice';
    this.toppings = [];
    this.decor = null;
    this.setPhase('select');
  }

  /** アイス ⇄ トッピング。トッピングをのせたあとは、アイスにはもどれない。 */
  switchShelf(to) {
    if (this.phase !== 'select') return false;
    const want = to || (this.shelf === 'ice' ? 'top' : 'ice');
    if (want === this.shelf) return false;
    if (want === 'top' && (!this.topList.length || !this.tower.count)) { this.onEvent('shelfNo', { reason: this.tower.count ? 'none' : 'empty' }); return false; }
    if (want === 'ice' && this.toppings.length) { this.onEvent('shelfNo', { reason: 'locked' }); return false; }
    this.shelf = want;
    if (want === 'top' && (!this.tsel || this.applied(this.tsel))) this.tsel = this.topList.find((id) => !this.applied(id)) || this.topList[0];
    this.onEvent('shelf', { shelf: want });
    return true;
  }

  applied(id) { return this.toppings.some((x) => x.id === id); }
  get selectedTopping() { return this.shelf === 'top' ? this.tsel : null; }

  /** 調理をやめる（器ごと片づける）。 */
  stop() { this._clearBall(); this.setPhase('idle'); }

  /** 台の上をまっさらに：作りかけの塔・持っている道具・落ちたアイスも片づける（タイトルへ戻る・次の日へ）。 */
  clear() {
    this.stop();
    this._dropTool();
    this.tower.reset(this.tower.vesselType);
    this.debris.clear();
    this.combo = 0;
    this.toppings = [];
    this.decor = null;
    this.shelf = 'ice';
  }

  /** すてられるものがあるか（揺れている玉・持っているトッピング・積んだ塔）。 */
  canDiscard() {
    if (this.phase === 'aim' && this.ball) return 'ball';
    if (this.phase === 'taim' && this.tool) return 'tool';
    if ((this.phase === 'select' || this.phase === 'settle') && this.tower.count) return 'tower';
    return null;
  }

  /** すてる：揺れている玉だけ／持っているトッピングだけ／塔ごと。捨てたものの種類を返す（null なら何もしない）。 */
  discard() {
    const what = this.canDiscard();
    if (what === 'ball') {
      // 揺れている玉だけを「ぽん」と消す。積んである塔はそのまま
      const b = this.ball.root.position;
      const piece = { view: this.ball, pos: b.clone(), quat: this.ball.root.quaternion.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), flavor: this.ball.flavor, r: this.ballR };
      this.world.scene.remove(this.ball.root);
      this.debris.add([piece], { poof: true });
      this.ball = null;
      this.setPhase('settle');
    } else if (what === 'tool') {
      this._dropTool();
      this.setPhase('select');
    } else if (what === 'tower') {
      this.debris.add(this.tower.dumpAll(), { poof: true });
      this._clearBall();
      this.combo = 0;
      this.toppings = [];
      this.decor = null;
      this.shelf = 'ice';
      this.setPhase('select');
    }
    if (what) this.onEvent('discard', { what });
    return what;
  }

  setPhase(p) {
    this.phase = p;
    this.t = 0;
  }

  get busy() { return ['scoop', 'carry', 'fall', 'pour', 'tcarry', 'taim', 'tfall'].includes(this.phase); }
  get selectedFlavor() { return this.flavors[this.sel] || null; }

  // ---------------------------------------------------------------- 入力
  /** dx：画面の右が +1、dy：画面の上が +1。 */
  move(dx, dy) {
    if (this.phase !== 'select') return;
    if (this.shelf === 'top') {
      if (!dx || !this.topList.length) return;
      const order = this._topScreenOrder();
      let k = order.indexOf(this.tsel);
      k = (k + (dx > 0 ? 1 : -1) + order.length) % order.length;
      if (order[k] !== this.tsel) { this.tsel = order[k]; this.onEvent('select', { topping: this.tsel }); }
      return;
    }
    const order = this._screenOrder();
    if (!order.length) return;
    let k = order.findIndex((o) => o.i === this.sel);
    if (k < 0) k = 0;
    if (dx) k = (k + (dx > 0 ? 1 : -1) + order.length) % order.length;
    else if (dy) {
      // 上下：画面で上（下）にあって、横が近いもの
      const cur = order[k];
      let best = null, bd = Infinity;
      for (const o of order) {
        if (o.i === cur.i) continue;
        if (dy > 0 ? o.y <= cur.y + 0.02 : o.y >= cur.y - 0.02) continue;
        const d = Math.abs(o.x - cur.x) + Math.abs(o.y - cur.y) * 0.3;
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) return;
      k = order.indexOf(best);
    }
    if (order[k].i !== this.sel) { this.sel = order[k].i; this.onEvent('select', { i: this.sel, flavor: this.selectedFlavor }); }
  }

  /** トッピングを直接選ぶ（クリック・タップ）。 */
  pickTopping(id) {
    if (this.phase !== 'select' || !this.topList.includes(id)) return false;
    if (this.shelf !== 'top' && !this.switchShelf('top')) return false;
    if (id !== this.tsel) { this.tsel = id; this.onEvent('select', { topping: id }); }
    return true;
  }

  /** 直接選ぶ（クリック・タップ）。 */
  pick(i) {
    if (this.phase !== 'select' || !this.flavors[i]) return false;
    if (this.shelf === 'top' && !this.switchShelf('ice')) return false;
    if (i !== this.sel) { this.sel = i; this.onEvent('select', { i, flavor: this.selectedFlavor }); }
    return true;
  }

  press() {
    if (this.phase === 'select' && this.shelf === 'top') return this._pressTopping();
    if (this.phase === 'taim') {
      this.setPhase('tfall');
      this.ballVY = 0;
      this.onEvent('drop', { topping: this.tsel });
      return true;
    }
    if (this.phase === 'select' && this.selectedFlavor) {
      this.setPhase('scoop');
      this.gauge = 0;
      this.scoopV = (Math.random() - 0.5) * 0.4;
      this.scoopDir = Math.random() < 0.5 ? 1 : -1;
      this.ballSeed = Math.random();
      this._clearBall();
      this.ball = new ScoopMesh(this.selectedFlavor, 0.01, this.ballSeed);
      this.world.scene.add(this.ball.root);
      this.onEvent('scoopStart', { flavor: this.selectedFlavor });
      return true;
    }
    if (this.phase === 'aim') {
      this.setPhase('fall');
      this.ballVY = 0;
      this.onEvent('drop', {});
      return true;
    }
    return false;
  }

  release() {
    if (this.phase === 'pour') { this._endPour(); return; }
    if (this.phase !== 'scoop') return;
    if (this.gauge < 0.12) { // ほとんどすくえていない：やり直し
      this._clearBall();
      this.setPhase('select');
      this.onEvent('scoopCancel', {});
      return;
    }
    const g = this.gauge;
    this.ballR = this._radius(g);
    this.sizeQuality = g >= SWEET[0] && g <= SWEET[1] ? 1 : g < SWEET[0] ? lerp(0.45, 1, smoothstep(0.12, SWEET[0], g)) : lerp(1, 0.55, smoothstep(SWEET[1], 1, g));
    this.lastSize = { g, q: this.sizeQuality, r: this.ballR };
    this.carryFrom = this.dipperPos.clone();
    this.setPhase('carry');
    this.onEvent('scoopEnd', { g, quality: this.sizeQuality, sweet: this.sizeQuality >= 1 });
  }

  _pressTopping() {
    const id = this.tsel;
    if (!id || this.applied(id) || !this.tower.count) { this.onEvent('shelfNo', { reason: 'applied' }); return false; }
    const T = TOPPINGS[id];
    this.tool = this.shelfObj.tools[id];
    this.tool.visible = true;
    this.toolFrom = this.tool.position.clone();
    this.toolPos.copy(this.toolFrom);
    this.gauge = 0;
    if (!this.decor) {
      const items = this.tower.items;
      const view = this.tower.views[items.length - 1];
      this.decor = new ToppingDecor(view);
    }
    if (T.mode === 'hold') { this.setPhase('pour'); this.onEvent('pourStart', { topping: id }); }
    else { this.setPhase('tcarry'); this.onEvent('scoopEnd', { topping: id }); }
    return true;
  }

  _endPour() {
    const g = this.gauge;
    const q = g >= POUR_SWEET[0] && g <= POUR_SWEET[1] ? 1 : g < POUR_SWEET[0] ? lerp(0.35, 1, smoothstep(0.08, POUR_SWEET[0], g)) : lerp(1, 0.6, smoothstep(POUR_SWEET[1], 1.1, g));
    if (g < 0.08) { this.setPhase('select'); this._dropTool(); this.onEvent('pourEnd', { cancel: true }); return; }
    this.toppings.push({ id: this.tsel, q });
    this.onEvent('pourEnd', { topping: this.tsel, q, sweet: q >= 1 });
    this.setPhase('tback');
  }

  /** 道具を置き場へもどす（その場で）。 */
  _dropTool() {
    if (!this.tool) return;
    const id = Object.keys(this.shelfObj.tools).find((k) => this.shelfObj.tools[k] === this.tool);
    this.tool.position.copy(this.tool.userData.home);
    this.tool.rotation.set(0, 0, 0);
    if (id === 'cherry' || id === 'wafer') this.tool.visible = false;
    this.tool = null;
  }

  /** いちばん上の玉のてっぺん（ワールド）と、塔の座標の x。 */
  _topWorld(out = new THREE.Vector3()) {
    const p = this.tower.dropPoint();
    return out.set(this.tower.root.position.x + p.x, this.tower.root.position.y + p.y, this.tower.root.position.z);
  }

  _toppingUpdate(dt) {
    const tw = this.tower, base = tw.root.position;
    const top = this._topWorld(this._v2 || (this._v2 = new THREE.Vector3()));
    const tool = this.tool;
    switch (this.phase) {
      case 'pour': {
        const id = this.tsel;
        this.gauge = Math.min(1.15, this.gauge + dt / 1.25);
        // 道具をてっぺんの上へ、ふる・しぼる
        const k = Math.min(1, this.t / 0.25);
        const above = this._v3 || (this._v3 = new THREE.Vector3());
        above.set(top.x + 0.01, top.y + (id === 'sauce' ? 0.14 : 0.12), top.z);
        this.toolPos.lerpVectors(this.toolFrom, above, smoothstep(0, 1, k));
        if (id === 'sprinkle') {
          tool.rotation.set(0, 0, Math.PI * 0.85 + Math.sin(this.t * 26) * 0.18 * k);
          if (k >= 1 && this.decor) { this._sprAcc = (this._sprAcc || 0) + dt * 75; const n = Math.floor(this._sprAcc); if (n) { this.decor.addSprinkles(n); this._sprAcc -= n; } }
        } else {
          tool.rotation.set(0, 0, Math.PI * k);
          if (k >= 1 && this.decor) this.decor.setSauce(Math.min(1.15, (this.t - 0.25) / 1.2));
        }
        tool.position.copy(this.toolPos);
        break;
      }
      case 'tback': {
        const k = Math.min(1, this.t / 0.3);
        tool.position.lerpVectors(this.toolPos, tool.userData.home, smoothstep(0, 1, k));
        tool.rotation.z *= 1 - k;
        if (k >= 1) { this._dropTool(); this.setPhase('select'); if (this.topList.every((id) => this.applied(id))) this.shelf = 'top'; }
        break;
      }
      case 'tcarry': {
        const k = smoothstep(0, 1, Math.min(1, this.t / 0.3));
        const sw = this.swing();
        const to = this._v3 || (this._v3 = new THREE.Vector3());
        to.set(base.x + this.aimCenter - sw.A * 0.8, top.y + 0.085, base.z);
        this.toolPos.lerpVectors(this.toolFrom, to, k);
        this.toolPos.y += Math.sin(k * Math.PI) * 0.05;
        tool.position.copy(this.toolPos);
        if (k >= 1) { this.setPhase('taim'); this.aimPh = -Math.PI / 2; }
        break;
      }
      case 'taim': {
        const sw = this.swing();
        const A = sw.A * 0.8, v = sw.v * 0.85;
        this.aimCenter = damp(this.aimCenter, top.x - base.x, 1.5, dt);
        this.aimPh += ((Math.PI * v) / (2 * A)) * dt;
        const x = A * (2 / Math.PI) * Math.asin(0.985 * Math.sin(this.aimPh));
        this.toolPos.set(base.x + this.aimCenter + x, top.y + 0.085 + Math.sin(this.t * 4) * 0.003, base.z);
        tool.position.copy(this.toolPos);
        tool.rotation.set(0, 0, Math.sin(this.t * 3) * 0.1);
        break;
      }
      case 'tfall': {
        this.ballVY -= 9.8 * dt;
        tool.position.y += this.ballVY * dt;
        if (tool.position.y <= top.y + 0.004) {
          const items = tw.items;
          const it = items[items.length - 1];
          const r = it ? it.r : 0.05;
          const dx = tool.position.x - top.x;
          const ratio = Math.abs(dx) / (r * 0.85);
          const id = this.tsel;
          if (ratio > 1 || !this.decor) {
            // 外れた：横へ落ちる（見た目だけ。トッピングはなし）
            this.onEvent('miss', { topping: id, ratio });
            this.combo = 0;
            this._dropTool();
            this.setPhase('settle');
          } else {
            const grade = ratio < 0.28 ? 'perfect' : ratio < 0.62 ? 'good' : 'ok';
            const q = grade === 'perfect' ? 1 : grade === 'good' ? 0.85 : 0.6;
            const lx = (grade === 'perfect' ? 0 : dx) * Math.cos(it.phi || 0);
            if (id === 'cherry') this.decor.addCherry(lx); else this.decor.addWafer(lx);
            this.toppings.push({ id, q });
            this.combo = grade === 'perfect' ? this.combo + 1 : 0;
            this.last = { grade, topping: id, combo: this.combo };
            this._dropTool();
            this.tower.nudge((Math.random() - 0.5) * 0.2);
            this.setPhase('settle');
            this.onEvent('land', this.last);
          }
        }
        break;
      }
    }
  }

  _radius(g) { return lerp(SCOOP_R.min, SCOOP_R.max, Math.min(1, g)); }

  _clearBall() {
    if (this.ball) { this.world.scene.remove(this.ball.root); this.ball.dispose(); this.ball = null; }
  }

  /** 画面の左から右に並べたトッピング。 */
  _topScreenOrder() {
    const v = this._v;
    return this.topList.map((id) => { topSpot(id, v); if (this.camera) v.project(this.camera); return { id, x: this.camera ? v.x : -v.x }; }).sort((a, b) => a.x - b.x).map((o) => o.id);
  }

  /** 画面の左から右（同じ高さの段ごと）に並べた、選べるケース。 */
  _screenOrder() {
    const out = [];
    for (let i = 0; i < 8; i++) {
      if (!this.flavors[i]) continue;
      const p = tubCenter(i, this._v);
      if (this.camera) p.project(this.camera);
      out.push({ i, x: this.camera ? p.x : -p.x, y: this.camera ? p.y : p.z });
    }
    // 段（画面の高さ）でまとめてから左→右
    out.sort((a, b) => (Math.abs(a.y - b.y) > 0.05 ? b.y - a.y : a.x - b.x));
    return out;
  }

  // ---------------------------------------------------------------- 毎フレーム
  /** 揺れの幅と速さ（段数が増えるほど大きく・速く）。 */
  swing() {
    const n = this.tower.count;
    return { A: clamp(0.05 + n * 0.005, 0.05, 0.11) * this.swingScale, v: (0.075 + n * 0.017) * this.speedScale };
  }

  update(dt) {
    this.t += dt;
    this._dt = dt;
    const tw = this.tower;
    const top = tw.dropPoint();
    const base = tw.root.position;
    const goal = this._v;
    if (['pour', 'tback', 'tcarry', 'taim', 'tfall'].includes(this.phase)) {
      this._toppingUpdate(dt);
      this._pose(0, 0);
    }
    switch (this.phase) {
      case 'idle':
      case 'select': {
        if (this.phase === 'select' && this.shelf === 'top' && this.tsel) {
          // トッピングを選んでいるあいだ、ディッシャーは水入れへ
          goal.set(DIPPER_WELL.x, COUNTER_Y + 0.115, DIPPER_WELL.z);
        } else if (this.phase === 'select' && this.selectedFlavor) {
          const c = tubCenter(this.sel);
          goal.set(c.x, COUNTER_Y + 0.11 + Math.sin(this.t * 3) * 0.006, c.z);
        } else goal.set(DIPPER_WELL.x, COUNTER_Y + 0.115, DIPPER_WELL.z); // 休むときは水入れに立てる
        this.dipperPos.x = damp(this.dipperPos.x, goal.x, 14, dt);
        this.dipperPos.y = damp(this.dipperPos.y, goal.y, 14, dt);
        this.dipperPos.z = damp(this.dipperPos.z, goal.z, 14, dt);
        this._pose(0, 0);
        break;
      }
      case 'scoop': {
        const hard = FLAVORS[this.selectedFlavor]?.hard ?? 1;
        const T = 1.05 * hard;
        this.gauge = Math.min(1.08, this.gauge + dt / T);
        const g = Math.min(1, this.gauge);
        const u = -0.3 * this.scoopDir + 0.6 * this.scoopDir * smoothstep(0, 1, g);
        const v = this.scoopV;
        const surf = this.tubs.worldAt(this.sel, u, v, goal);
        const r = this._radius(g);
        // 玉は表面の上で育ち、ディッシャーがそれにかぶさる
        const ballY = surf.y + r * 0.45;
        this.dipperPos.set(damp(this.dipperPos.x, surf.x, 30, dt), damp(this.dipperPos.y, ballY + r * 0.42, 30, dt), damp(this.dipperPos.z, surf.z, 30, dt));
        this.tubs.carve(this.sel, u, v, 0.15 + g * 0.06, 0.008 + g * 0.012);
        this.tubs.flush();
        this.ball.mesh.scale.setScalar(r);
        this.ball.r = r;
        this.ball.root.position.set(this.dipperPos.x, ballY, this.dipperPos.z);
        this.ball.mesh.rotation.x += dt * 5 * this.scoopDir;
        this._pose(this.scoopDir * 0.6, 0);
        break;
      }
      case 'carry': {
        const k = smoothstep(0, 1, Math.min(1, this.t / 0.32));
        const sw = this.swing();
        const to = this._tmp(base.x + this.aimCenter - sw.A, base.y + top.y + 0.1 + this.ballR * 1.6, base.z);
        this.dipperPos.lerpVectors(this.carryFrom, to, k);
        this.dipperPos.y += Math.sin(k * Math.PI) * 0.06;
        this._carryBall();
        this._pose(0, -0.3 * (1 - k));
        if (k >= 1) { this.setPhase('aim'); this.aimPh = -Math.PI / 2; }
        break;
      }
      case 'aim': {
        const sw = this.swing();
        // 塔のてっぺんをゆっくり追う（揺れには追いつかない）
        this.aimCenter = damp(this.aimCenter, top.x, 1.5, dt);
        const w = (Math.PI * sw.v) / (2 * sw.A);
        this.aimPh += w * dt;
        const x = sw.A * (2 / Math.PI) * Math.asin(0.985 * Math.sin(this.aimPh));
        this.dipperPos.set(base.x + this.aimCenter + x, base.y + top.y + 0.1 + this.ballR * 1.6 + Math.sin(this.t * 4) * 0.003, base.z);
        this._carryBall();
        this._pose(0, 0);
        break;
      }
      case 'fall': {
        this.ballVY -= 9.8 * dt;
        const b = this.ball.root.position;
        b.y += this.ballVY * dt;
        // 着地：玉の中心が、乗る高さまで下りたら
        const seat = (tw.count === 0 ? tw.V.seat : 0.55) * this.ballR;
        const landY = base.y + top.y + seat;
        this.dipperPos.y = damp(this.dipperPos.y, landY + 0.2, 8, dt);
        this._pose(0, 0.2);
        if (b.y <= landY) {
          const x = b.x - base.x;
          const res = tw.land(this.ball.flavor, this.ballR, x, this.ballVY, this.ballSeed);
          if (res.ok) {
            res.item.sizeQ = this.sizeQuality;
            this._clearBall();
            this.combo = res.grade === 'perfect' ? this.combo + 1 : 0;
            this.last = { ...res, size: this.lastSize, combo: this.combo };
            this.setPhase('settle');
            this.onEvent('land', this.last);
          } else {
            // 外れた：横へ転げ落ちる
            const dir = Math.sign(res.off) || 1;
            const piece = { view: this.ball, pos: b.clone(), quat: this.ball.root.quaternion.clone(), vel: new THREE.Vector3(dir * 0.7, 0.5, 0.15), spin: new THREE.Vector3(2, 1, -dir * 6), flavor: this.ball.flavor, r: this.ballR };
            this.world.scene.remove(this.ball.root);
            this.debris.add([piece]);
            this.ball = null;
            this.combo = 0;
            this.last = { ...res, combo: 0 };
            this.setPhase('settle');
            this.onEvent('miss', this.last);
          }
        }
        break;
      }
      case 'settle': {
        if (this.t > 0.22) { this.setPhase('select'); if (this.toppings.length) this.shelf = 'top'; }
        this._pose(0, 0);
        const c = tubCenter(this.sel);
        this.dipperPos.x = damp(this.dipperPos.x, c.x, 6, dt);
        this.dipperPos.y = damp(this.dipperPos.y, COUNTER_Y + 0.16, 6, dt);
        this.dipperPos.z = damp(this.dipperPos.z, c.z, 6, dt);
        break;
      }
    }
    this.dipper.position.copy(this.dipperPos);
    // ねらいライト
    const aiming = this.aimGuide && (this.phase === 'aim' || this.phase === 'taim');
    this.aimRing.visible = this.aimBeam.visible = aiming;
    if (aiming) {
      const fromX = this.phase === 'aim' ? this.dipperPos.x : this.toolPos.x;
      const fromY = this.phase === 'aim' ? (this.ball ? this.ball.root.position.y : this.dipperPos.y) : this.toolPos.y;
      const topY = base.y + top.y + 0.004;
      // 真ん中に近いほど緑に
      const off = Math.abs(fromX - (base.x + top.x)) / Math.max(0.01, top.r);
      this.aimRing.material.color.set(off < PERFECT ? '#8dff9a' : off < GOOD ? '#7ff6ff' : '#ffb3b3');
      this.aimRing.position.set(fromX, topY, base.z);
      this.aimRing.scale.setScalar(1 + Math.sin(this.t * 10) * 0.1);
      const h = Math.max(0.01, fromY - topY);
      this.aimBeam.scale.set(1, h, 1);
      this.aimBeam.position.set(fromX, topY + h / 2, base.z);
    }
    const resting = this.phase === 'idle' || (this.phase === 'select' && this.shelf === 'top');
    this.restK = damp(this.restK || 0, resting ? 1 : 0, 8, dt);
    this.dipper.rotation.x += (Math.PI * 0.62 - this.dipper.rotation.x) * this.restK * 0.9;
    tw.step(dt, { meltRate: this.meltRate, wind: this.wind, baseAx: this.baseAx || 0 });
    this.debris.update(dt);
  }

  _carryBall() {
    if (!this.ball) return;
    this.ball.root.position.copy(this.dipperPos).add(this._tmp(0, -this.ballR * 0.42, 0));
    this.ball.mesh.scale.setScalar(this.ballR);
  }

  /** ディッシャーの向き（すくうときは進む向きへ倒す）。 */
  _pose(tiltX, tiltZ) {
    const d = this.dipper.rotation, dt = this._dt || 1 / 60;
    d.x = damp(d.x, tiltX * 0.5, 10, dt);
    d.z = damp(d.z, tiltZ, 10, dt);
  }

  _tmp(x, y, z) { return (this.__t || (this.__t = new THREE.Vector3())).set(x, y, z); }

  /** 状態（__dev.state に出す・UI が読む）。 */
  info() {
    const s = this.swing();
    return { phase: this.phase, shelf: this.shelf, sel: this.sel, flavor: this.selectedFlavor, topping: this.tsel, toppings: this.toppings.map((x) => x.id), gauge: +this.gauge.toFixed(2), tiers: this.tower.count, combo: this.combo, danger: +this.tower.danger().toFixed(2), A: +s.A.toFixed(3), v: +s.v.toFixed(3) };
  }
}

export { PERFECT, GOOD };
