// 塔：器（コーン・カップ）の上に積んだアイスの玉。物理は sim/towerPhysics.js、ここは見た目をかぶせる。
//
//   tower.reset('cone')                器を替えて空にする
//   tower.dropPoint()                  いちばん上（次の玉が乗る所）の { x, y, angle, r }（塔の座標）
//   tower.land(flavor, r, x, vy, seed) 落ちてきた玉を受ける → { ok, grade, off, ratio }
//   tower.step(dt, env)                env = { wind, baseAx, meltRate }
//   tower.onBreak = (pieces, at) => …  折れて落ちた玉（ワールドの座標と速度つき）
import * as THREE from 'three';
import { ScoopMesh, makeCone, makeCup } from './scene/IceCream.js';
import { TowerPhysics, PERFECT, GOOD, MISS, BREAK } from './sim/towerPhysics.js';
import { clamp } from '../core/math.js';

const MAKE = { cone: () => makeCone(), cup: () => makeCup() };

export { PERFECT, GOOD, MISS, BREAK };

export class Tower {
  constructor(parent) {
    this.root = new THREE.Group();   // 塔の座標（原点 = コーン立ての根もと、+X = 世界の +X）
    this.root.name = 'tower';
    parent.add(this.root);
    this.phys = new TowerPhysics('cone');
    this.views = [];                 // items と同じ順の見た目
    this.vessel = null;
    this.vesselType = 'cone';
    this.time = 0;
    this.onBreak = null;
    this.reset('cone');
  }

  get count() { return this.phys.count; }
  get items() { return this.phys.items; }
  get V() { return this.phys.V; }

  reset(type = 'cone') {
    for (const v of this.views) { this.root.remove(v.root); v.dispose(); }
    this.views = [];
    if (this.vessel) this.root.remove(this.vessel);
    this.vesselType = type;
    this.phys.reset(type);
    this.vessel = MAKE[type]();
    this.vessel.position.y = this.phys.V.rim;
    this.root.add(this.vessel);
    this.lean = 0;
  }

  /** 器と玉の見た目を、ひとまとめにしてはずす（手渡しのあと、お客さんの手へ移す）。 */
  detachAll() {
    const g = new THREE.Group();
    g.name = 'servedTower';
    if (this.vessel) g.add(this.vessel);
    for (const v of this.views) g.add(v.root);
    this.vessel = null;
    this.views = [];
    this.phys.reset(this.vesselType);
    return g;
  }

  dropPoint() { return this.phys.dropPoint(); }

  land(flavor, r, x, vy = -1.5, seed = Math.random()) {
    const res = this.phys.land(r, x, vy);
    if (!res.ok) return res;
    const view = new ScoopMesh(flavor, r, seed);
    this.root.add(view.root);
    res.item.flavor = flavor;
    res.item.squash = 0.78;
    res.item.squashV = 0;
    this.views.push(view);
    this._place();
    return res;
  }

  step(dt, env = {}) {
    this.time += dt;
    const b = this.phys.step(dt, env);
    if (b >= 0) this._break(b);
    this._place(dt);
  }

  _place(dt = 0) {
    const items = this.phys.items;
    let lean = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], v = this.views[i];
      if (!v) continue;
      // ぽよん（置いた直後のつぶれが戻る）
      if (dt) {
        it.squashV += ((1 - it.squash) * 160 - it.squashV * 9) * dt;
        it.squash += it.squashV * dt;
      }
      const sq = clamp(it.squash ?? 1, 0.6, 1.3);
      v.setMelt(it.melt);
      v.root.position.set(it.cx, it.cy, 0);
      v.root.rotation.z = it.phi;
      v.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      lean = it.phi;
    }
    this.lean = lean;
  }

  _break(i) {
    const fallen = this.phys.breakAt(i);
    const views = this.views.splice(i);
    this.root.updateMatrixWorld(true);
    const dir = Math.sign(fallen[0].phi || fallen[0].th) || 1;
    const base = fallen[0].py;
    const pieces = [];
    fallen.forEach((it, k) => {
      const v = views[k];
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
      v.root.getWorldPosition(pos);
      v.root.getWorldQuaternion(quat);
      this.root.remove(v.root);
      // 倒れる向きに飛ぶ（高いほど速い）。角度が正 = 左（-X ではなく +X が画面の左なので、世界の -X 向き）
      const hgt = it.cy - base;
      const vel = new THREE.Vector3(-dir * (0.5 + hgt * 3.0), 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5);
      pieces.push({ view: v, pos, quat, vel, spin: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, dir * 4), flavor: it.flavor, r: it.r });
    });
    this.onBreak?.(pieces, i);
  }

  /** 塔ごとすてる：玉を全部はずして返す（Debris が「ぽん」と消す）。器は新しく置きなおす。 */
  dumpAll() {
    const items = this.phys.breakAt(0);
    const views = this.views.splice(0);
    this.root.updateMatrixWorld(true);
    const pieces = items.map((it, k) => {
      const v = views[k];
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
      v.root.getWorldPosition(pos);
      v.root.getWorldQuaternion(quat);
      this.root.remove(v.root);
      return { view: v, pos, quat, vel: new THREE.Vector3(), spin: new THREE.Vector3(), flavor: it.flavor, r: it.r };
    });
    this.reset(this.vesselType);
    return pieces;
  }

  summary() { return this.phys.items.map((it) => ({ flavor: it.flavor, r: it.r, grade: it.grade, melt: it.melt })); }
  danger() { return this.phys.danger(); }
  nudge(dw) { this.phys.nudge(dw); }
}
