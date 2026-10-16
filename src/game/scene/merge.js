// 動かない部品をまとめる（draw call を減らす）。
//   mergeStatic(group, { keep })  group の下のメッシュのうち、keep に入っているグループの中身と、
//   userData.dynamic / noMerge の付いたもの・InstancedMesh・透明な材質を除いて、材質ごとに 1 つのメッシュにまとめる。
//   まとめたメッシュは group の直下に置く（group から見た位置で頂点を焼き込む）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();

export function mergeStatic(group, { keep = [], minCount = 2 } = {}) {
  const keepSet = new Set(keep);
  group.updateMatrixWorld(true);
  _inv.copy(group.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  const visit = (o) => {
    if (o !== group && (keepSet.has(o) || o.userData.dynamic)) return; // 動く部分の中には入らない
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !o.userData.noMerge && o.visible) {
      const mat = o.material;
      if (!Array.isArray(mat) && !mat.transparent && !o.morphTargetInfluences) {
        const g = o.geometry;
        const sig = mat.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 'i' : 'n');
        if (!buckets.has(sig)) buckets.set(sig, { mat, list: [], cast: false, receive: false });
        const b = buckets.get(sig);
        b.list.push(o);
        b.cast ||= o.castShadow;
        b.receive ||= o.receiveShadow;
      }
    }
    for (const c of o.children) visit(c);
  };
  visit(group);
  let merged = 0;
  for (const b of buckets.values()) {
    if (b.list.length < minCount) continue;
    const geos = [];
    for (const o of b.list) {
      _m.multiplyMatrices(_inv, o.matrixWorld);
      const g = o.geometry.clone();
      g.applyMatrix4(_m);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.name = 'merged:' + (b.mat.name || b.list[0].name || 'part');
    group.add(mesh);
    for (const o of b.list) victims.push(o);
    merged += b.list.length;
  }
  for (const o of victims) o.parent?.remove(o);
  // 中身のなくなったグループを片づける（動く部分＝keep の中には入らない。空でも、あとで物をつける所かもしれない）
  const prune = (o) => {
    if (o !== group && (keepSet.has(o) || o.userData.dynamic)) return;
    for (const c of [...o.children]) prune(c);
    if (o !== group && o.isGroup && !o.children.length && !o.userData.keepEmpty) o.parent?.remove(o);
  };
  prune(group);
  return merged;
}
