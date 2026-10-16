// ディッシャー（アイスをすくう道具）：ステンレスの丸いおわん＋持ち手。
// 原点がおわんの中心。持ち手は -Z（ロボの側）へ斜め上にのびる。grip に手を合わせる。
import * as THREE from 'three';
import { metal, paint } from './materials.js';

export function makeDipper() {
  const g = new THREE.Group();
  g.name = 'dipper';
  const steel = metal('#e3e8ec', 0.22);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.034, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), steel);
  bowl.material = steel;
  bowl.name = 'bowl';
  // おわんの内側
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.0325, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#c9d0d6', metalness: 1, roughness: 0.3, side: THREE.BackSide }));
  inner.name = 'bowlInner';
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.05, 8), steel);
  neck.position.set(0, 0.032, -0.02);
  neck.rotation.x = -0.9;
  neck.name = 'neck';
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.09, 4, 10), paint('#ff8fa8', 0.45));
  handle.position.set(0, 0.07, -0.075);
  handle.rotation.x = -1.05;
  handle.name = 'handle';
  g.add(bowl, inner, neck, handle);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // 手で握る所（このグループの座標）
  g.userData.grip = new THREE.Vector3(0, 0.085, -0.1);
  return g;
}
