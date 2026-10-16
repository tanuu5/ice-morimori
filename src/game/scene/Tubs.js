// ケースの中のアイス：容器ごとに高さの網（盛り上がった表面）を持ち、すくうと溝が残る。
//   tubs.setFlavors(['vanilla', …])   8 つの容器の味（null は空：準備中）
//   tubs.carve(i, u, v, radius, depth)  i 番目の容器の (u, v)（-0.5〜0.5）を削る
//   tubs.refill()                    全部を盛り直す
import * as THREE from 'three';
import { TUB, tubCenter, COUNTER_Y } from '../layout.js';
import { iceMaterial } from './IceCream.js';
import { Rng } from '../../core/rng.js';

const NX = 30, NZ = 24;
const FLOOR = -0.075;   // これ以上は削れない（容器の底の近く）

export class Tubs {
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.name = 'tubs';
    parent.add(this.root);
    this.items = [];
    const floorM = new THREE.MeshStandardMaterial({ color: '#a9b4bd', roughness: 0.35, metalness: 0.7 });
    for (let i = 0; i < TUB.cols * TUB.rows; i++) {
      const w = TUB.w - 0.006, d = TUB.d - 0.006;
      const geo = new THREE.PlaneGeometry(w, d, NX, NZ);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, iceMaterial('vanilla', { tub: true, scale: 18, seed: i * 7.3 }));
      mesh.name = 'tubIce' + i;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      const c = tubCenter(i);
      mesh.position.set(c.x, COUNTER_Y, c.z);
      this.root.add(mesh);
      // 空の容器を見せるための底
      const empty = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorM);
      empty.rotation.x = -Math.PI / 2;
      empty.position.set(c.x, COUNTER_Y + FLOOR - 0.004, c.z);
      empty.name = 'tubFloor' + i;
      this.root.add(empty);
      const h = new Float32Array((NX + 1) * (NZ + 1));
      this.items.push({ i, mesh, geo, h, w, d, flavor: null, stock: 1, dirty: true, center: c });
    }
  }

  setFlavors(list) {
    this.items.forEach((t, i) => {
      const id = list[i] || null;
      t.flavor = id;
      if (id) {
        const old = t.mesh.material;
        t.mesh.material = iceMaterial(id, { tub: true, scale: 18, seed: i * 7.3 + 1 });
        old.dispose();
      }
      t.mesh.visible = !!id;
    });
    this.refill();
  }

  /** 盛り直す（山の形はランダム。ジェラートのように盛り上げて筋を付ける）。 */
  refill(seed = 1) {
    const rng = new Rng(seed * 131 + 7);
    for (const t of this.items) {
      const ph = rng.range(0, 6), ph2 = rng.range(0, 6), lean = rng.range(-0.3, 0.3);
      for (let iz = 0; iz <= NZ; iz++) {
        for (let ix = 0; ix <= NX; ix++) {
          const u = ix / NX - 0.5, v = iz / NZ - 0.5;
          // ふちは低く、中ほどが盛り上がる山
          const edge = Math.min(0.5 - Math.abs(u), 0.5 - Math.abs(v));
          const dome = Math.pow(Math.min(1, edge / 0.22), 0.6);
          let y = -0.012 + dome * (0.026 + 0.008 * Math.cos((u + lean * v) * 5 + ph));
          // ヘラで寄せたような筋
          y += Math.sin((u * 0.6 + v) * 34 + ph2 + Math.sin(u * 9) * 1.4) * 0.0022 * dome;
          y += Math.sin((u - v * 0.4) * 21 + ph) * 0.0018 * dome;
          t.h[iz * (NX + 1) + ix] = y;
        }
      }
      t.stock = 1;
      t.dirty = true;
    }
    this.flush();
  }

  /** (u, v) を中心に、半径 radius（容器の幅に対する割合）、深さ depth（m）だけ丸く削る。 */
  carve(i, u, v, radius, depth) {
    const t = this.items[i];
    if (!t) return;
    const r2 = radius * radius;
    for (let iz = 0; iz <= NZ; iz++) {
      for (let ix = 0; ix <= NX; ix++) {
        const du = ix / NX - 0.5 - u, dv = (iz / NZ - 0.5 - v) * (t.d / t.w);
        const q = (du * du + dv * dv) / r2;
        if (q >= 1) continue;
        const k = iz * (NX + 1) + ix;
        const want = t.h[k] - depth * (1 - q);
        // 削り跡のふちは少し盛り上がる（押し出された分）
        t.h[k] = Math.max(FLOOR, Math.min(t.h[k], want));
      }
    }
    // ふちの盛り上がり
    for (let iz = 0; iz <= NZ; iz++) {
      for (let ix = 0; ix <= NX; ix++) {
        const du = ix / NX - 0.5 - u, dv = (iz / NZ - 0.5 - v) * (t.d / t.w);
        const q = Math.sqrt(du * du + dv * dv) / radius;
        if (q < 1 || q > 1.35) continue;
        t.h[iz * (NX + 1) + ix] += depth * 0.04 * (1 - Math.abs(q - 1.17) / 0.18);
      }
    }
    t.dirty = true;
  }

  /** 表面の高さ（容器の中の u, v）。ディッシャーを表面に沿わせるのに使う。 */
  heightAt(i, u, v) {
    const t = this.items[i];
    const ix = Math.round((u + 0.5) * NX), iz = Math.round((v + 0.5) * NZ);
    const k = Math.max(0, Math.min(NZ, iz)) * (NX + 1) + Math.max(0, Math.min(NX, ix));
    return COUNTER_Y + t.h[k];
  }

  /** u, v（容器の中の割合）の、世界の座標。 */
  worldAt(i, u, v, out = new THREE.Vector3()) {
    const t = this.items[i];
    return out.set(t.center.x + u * t.w, this.heightAt(i, u, v), t.center.z + v * t.d);
  }

  flush() {
    for (const t of this.items) {
      if (!t.dirty) continue;
      const pos = t.geo.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, t.h[k]);
      pos.needsUpdate = true;
      t.geo.computeVertexNormals();
      t.dirty = false;
    }
  }
}
