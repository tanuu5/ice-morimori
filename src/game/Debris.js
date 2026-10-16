// 落ちたアイス：飛んで、天板か地面に当たると「べちゃ」とつぶれ、しばらくして消える。
import * as THREE from 'three';
import { COUNTER_Y, BODY } from './layout.js';

const G = 9.8;

export class Debris {
  constructor(parent) {
    this.parent = parent;
    this.items = [];
    this.onSplat = null; // (pos, where) => void
  }

  /** pieces：[{ view: ScoopMesh, pos, quat, vel, spin }]（ワールドの座標）。
   *  poof：すてたとき。飛ばさずに、少し浮いて「ぽん」と消える（上の玉から順に） */
  add(pieces, { poof = false } = {}) {
    const n = pieces.length;
    pieces.forEach((p, k) => {
      const root = p.view.root;
      this.parent.add(root);
      root.position.copy(p.pos);
      root.quaternion.copy(p.quat);
      this.items.push({ ...p, root, state: poof ? 'poof' : 'fly', t: poof ? -(n - 1 - k) * 0.05 : 0, splatT: 0, s0: root.scale.clone() });
    });
  }

  /** 「ぽん」の煙：白い粒が広がって消える。 */
  _puff(pos, r) {
    if (!this.puffGeo) {
      this.puffGeo = new THREE.SphereGeometry(1, 8, 6);
      this.puffs = [];
    }
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
    const g = new THREE.Group();
    g.position.copy(pos);
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(this.puffGeo, mat);
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, up = (Math.random() - 0.3) * 0.8;
      const dir = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize();
      m.scale.setScalar(r * (0.28 + Math.random() * 0.12));
      g.add(m);
      parts.push({ m, dir, s: m.scale.x });
    }
    this.parent.add(g);
    this.puffs.push({ g, mat, parts, t: 0, r });
  }

  floorAt(x, z) {
    if (x > BODY.x0 && x < BODY.x1 && z > BODY.z0 && z < BODY.z1) return { y: COUNTER_Y, where: 'counter' };
    return { y: 0.002, where: 'ground' };
  }

  update(dt) {
    for (let i = this.puffs?.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      const k = Math.min(1, p.t / 0.38);
      for (const q of p.parts) {
        q.m.position.copy(q.dir).multiplyScalar(p.r * (0.4 + 1.6 * (1 - (1 - k) * (1 - k))));
        q.m.scale.setScalar(q.s * (1 + k * 0.6));
      }
      p.mat.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.parent.remove(p.g); p.mat.dispose(); this.puffs.splice(i, 1); }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      d.t += dt;
      if (d.state === 'poof') {
        if (d.t < 0) continue;
        // 少し浮いて、ふくらんでから縮んで消える
        const k = Math.min(1, d.t / 0.22);
        d.root.position.y += dt * 0.35;
        const sc = k < 0.35 ? 1 + 0.18 * (k / 0.35) : 1.18 * (1 - (k - 0.35) / 0.65);
        d.root.scale.copy(d.s0).multiplyScalar(Math.max(0.001, sc));
        if (k >= 1) {
          this._puff(d.root.position, d.r);
          this.onPoof?.(d.root.position.clone(), d);
          this.parent.remove(d.root); d.view.dispose(); this.items.splice(i, 1);
        }
        continue;
      }
      if (d.state === 'fly') {
        d.vel.y -= G * dt;
        d.root.position.addScaledVector(d.vel, dt);
        d.root.rotateX(d.spin.x * dt); d.root.rotateY(d.spin.y * dt); d.root.rotateZ(d.spin.z * dt);
        const f = this.floorAt(d.root.position.x, d.root.position.z);
        if (d.root.position.y - d.r * 0.5 <= f.y && d.vel.y < 0) {
          d.state = 'splat';
          d.root.position.y = f.y + d.r * 0.18;
          d.root.quaternion.identity();
          d.root.rotation.y = Math.random() * 6;
          d.splatT = 0;
          this.onSplat?.(d.root.position.clone(), f.where, d);
        }
      } else if (d.state === 'splat') {
        d.splatT += dt;
        // つぶれて広がる
        const k = Math.min(1, d.splatT / 0.12);
        d.root.scale.set(1 + 0.7 * k, 1 - 0.68 * k, 1 + 0.7 * k);
        d.view.setMelt(Math.min(1, 0.5 + d.splatT * 0.2));
        if (d.splatT > 3.5) {
          const fade = Math.min(1, (d.splatT - 3.5) / 0.8);
          d.root.scale.y = (1 - 0.68) * (1 - fade) + 0.01;
          if (fade >= 1) { this.parent.remove(d.root); d.view.dispose(); this.items.splice(i, 1); }
        }
      }
    }
  }

  clear() {
    for (const d of this.items) { this.parent.remove(d.root); d.view.dispose(); }
    this.items = [];
    for (const p of this.puffs || []) { this.parent.remove(p.g); p.mat.dispose(); }
    if (this.puffs) this.puffs = [];
  }
}
