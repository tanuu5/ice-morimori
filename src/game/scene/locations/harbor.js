// しおかぜ港（1 日目・朝）：コンクリートの岸壁、係留の漁船、防波堤の赤い灯台、向かいの島、倉庫と魚の箱と自販機。
import * as THREE from 'three';
import { terrain, grainTexture, islands, colorize, vertexColorMat, gulls, crowd, mergeGeometries, matte, paint,
  house, pole, wire, vending, bench, crates, fishingBoat, smallLighthouse, signTex, pineGeometry } from './common.js';
import { Rng } from '../../../core/rng.js';

const EDGE = 6.5;      // 岸壁のふち（ここから先は海）
const SEA_Y = -1.1;    // 海面の高さ

export function buildHarbor() {
  const root = new THREE.Group();
  root.name = 'loc-harbor';
  const rng = new Rng('harbor');

  // 岸壁（コンクリート）。タイルの目地のある模様
  const conc = grainTexture('#b9b5ad', ['#a9a59d', '#c6c2ba', '#9f9a91', '#d0ccc4'], { repeat: 50, seed: 11, n: 2600 });
  const ground = terrain({
    x0: -80, x1: 80, z0: -60, z1: EDGE, nx: 60, nz: 40, map: conc,
    heightAt: () => 0,
    colorAt: (x, z, c) => {
      c.set('#ffffff');
      // ぬれたしみ（岸壁の近く）と、目地
      const wet = Math.max(0, Math.sin(x * 0.37 + 1.3) * Math.sin(z * 0.53 + 0.4) - 0.35) * (z > 2 ? 1.6 : 0.6);
      c.multiplyScalar(1 - Math.min(0.35, wet));
      if (Math.abs(((x + 200) % 3) - 1.5) < 0.03 || Math.abs(((z + 200) % 3) - 1.5) < 0.03) c.multiplyScalar(0.85);
    },
  });
  root.add(ground);
  // 岸壁の側面（海へ落ちる壁）と縁石
  const wall = new THREE.Mesh(new THREE.BoxGeometry(160, 1.6, 0.5), matte('#bdb8ae', 0.9));
  wall.position.set(0, -0.8, EDGE + 0.25);
  wall.receiveShadow = true;
  const curb = new THREE.Mesh(new THREE.BoxGeometry(160, 0.18, 0.35), matte('#f1efe9', 0.8));
  curb.position.set(0, 0.09, EDGE - 0.1);
  curb.castShadow = curb.receiveShadow = true;
  root.add(wall, curb);
  // 係船柱（黒い柱）
  const bolGeo = [];
  for (let x = -30; x <= 30; x += 4.5) {
    const b = new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10);
    b.translate(x, 0.22, EDGE - 0.45);
    bolGeo.push(colorize(b, '#3b3f45'));
    const top = new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    top.translate(x, 0.44, EDGE - 0.45);
    bolGeo.push(colorize(top, '#3b3f45'));
  }
  // 古タイヤの防舷材（岸壁の海側にぶら下がる）
  for (let x = -28; x <= 28; x += 3.2) {
    const tire = new THREE.TorusGeometry(0.32, 0.13, 8, 16);
    tire.translate(x + 0.8, -0.35, EDGE + 0.62);
    bolGeo.push(colorize(tire, '#2b2d31'));
  }
  // 白い線（荷さばきの区画）
  for (let x = -18; x <= 18; x += 4) {
    const ln = new THREE.PlaneGeometry(0.12, 3.2);
    ln.rotateX(-Math.PI / 2);
    ln.translate(x + 2.5, 0.005, 3.6);
    bolGeo.push(colorize(ln, '#f1efe9'));
  }
  const bollards = new THREE.Mesh(mergeGeometries(bolGeo), vertexColorMat(0.5));
  bollards.castShadow = true;
  root.add(bollards);

  // 漁船（岸壁に係留して、ゆれる）
  const boats = [];
  const trims = ['#e63946', '#1c7ed6', '#2f9e44', '#f08c00', '#e63946'];
  for (let i = 0; i < 5; i++) {
    const b = fishingBoat(trims[i]);
    b.position.set(-12 + i * 6.5 + rng.range(-0.6, 0.6), SEA_Y + 0.25, EDGE + 2.3 + rng.range(0, 1.4));
    b.rotation.y = Math.PI / 2 + rng.range(-0.15, 0.15) + (i % 2 ? Math.PI : 0);
    b.userData.ph = rng.range(0, 6);
    b.userData.dynamic = true;
    root.add(b);
    boats.push(b);
    // もやい綱
    root.add(wire(new THREE.Vector3(b.position.x - 1, 0.4, EDGE - 0.45), new THREE.Vector3(b.position.x - 0.8, SEA_Y + 0.9, b.position.z - 0.6), 0.25, '#c9b79c'));
  }
  // 網の山とロープの輪（岸壁の上）
  for (let i = 0; i < 3; i++) {
    const net = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), matte(['#2f9e44', '#1c7ed6', '#e8590c'][i], 0.95));
    net.scale.set(1.4, 0.45, 1);
    net.position.set(-9 + i * 13 + rng.range(-1, 1), 0, EDGE - 1.6 + rng.range(-0.3, 0.3));
    net.castShadow = true;
    root.add(net);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 20), matte('#c9b79c', 0.8));
    rope.rotation.x = -Math.PI / 2;
    rope.position.set(net.position.x + 1.6, 0.05, net.position.z + 0.3);
    root.add(rope);
  }
  // 沖の防波堤と、先の赤い灯台
  const brk = new THREE.Mesh(new THREE.BoxGeometry(70, 1.6, 3), matte('#cfcac1', 0.9));
  brk.position.set(-8, SEA_Y + 0.6, 42);
  root.add(brk);
  for (let i = 0; i < 24; i++) {
    const tet = new THREE.Mesh(new THREE.TetrahedronGeometry(1.1), matte('#d6d1c8', 0.95));
    tet.position.set(-42 + i * 3 + rng.range(-0.5, 0.5), SEA_Y + 0.2, 44.2 + rng.range(-0.3, 0.3));
    tet.rotation.set(rng.range(0, 6), rng.range(0, 6), rng.range(0, 6));
    root.add(tet);
  }
  const lh1 = smallLighthouse('#e63946');
  lh1.position.set(27, SEA_Y + 1.4, 42);
  const lh2 = smallLighthouse('#ffffff');
  lh2.position.set(-44, SEA_Y + 1.4, 42);
  root.add(lh1, lh2);
  // ブイ
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), paint(i % 2 ? '#ff922b' : '#ffffff', 0.4));
    b.position.set(rng.range(-25, 25), SEA_Y + 0.05, rng.range(14, 34));
    b.userData.ph = rng.range(0, 6);
    b.userData.dynamic = true;
    root.add(b);
    boats.push(b);
  }
  // 湾の向こうの島と、遠くの船
  root.add(islands([[-120, 260, 90, 34, 0], [70, 300, 130, 26, 1], [220, 240, 60, 40, 0], [-260, 180, 50, 50, 1]]));
  const far = fishingBoat('#1c7ed6');
  far.position.set(40, SEA_Y + 0.2, 90);
  far.scale.setScalar(1.3);
  root.add(far);

  // 陸の側（-Z）：倉庫・市場・家並み・電柱
  const wallCols = ['#cfe8e3', '#ffe3d3', '#fff3c4', '#dbe4ff', '#f1f3f5'];
  const roofCols = ['#4f8f8a', '#d9480f', '#e67700', '#4263eb', '#868e96'];
  for (let i = 0; i < 7; i++) {
    const w = rng.range(6, 9), h = rng.range(3.6, 5.2);
    const b = house({ w, h, d: 6, wall: wallCols[i % 5], roof: roofCols[i % 5], roofType: i % 3 === 1 ? 'gable' : 'flat', windows: 3 }, rng);
    b.position.set(-28 + i * 9.2, 0, -12 - rng.range(0, 1.5));
    // 大きな巻き上げ戸
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.55), matte('#9aa5ad', 0.7));
    door.position.set(0, h * 0.28, 3.01);
    b.add(door);
    root.add(b);
  }
  // 市場の看板
  const mkt = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshStandardMaterial({ map: signTex('しおかぜ漁港 朝市', { bg: '#1c7ed6', fg: '#ffffff' }), roughness: 0.7 }));
  mkt.position.set(-1.0, 5.6, -8.9);
  root.add(mkt);
  // 魚の箱・自販機・ベンチ
  for (let i = 0; i < 4; i++) {
    const c = crates(rng, rng.int(4, 6));
    c.position.set(-14 + i * 7 + rng.range(-1, 1), 0, -7.5 + rng.range(-0.5, 0.5));
    c.rotation.y = rng.range(-0.3, 0.3);
    root.add(c);
  }
  const vm = vending('#e63946');
  vm.position.set(-4.2, 0, -8.6);
  const vm2 = vending('#1c7ed6');
  vm2.position.set(-3.1, 0, -8.6);
  root.add(vm, vm2);
  const bn = bench('#c98b5a');
  bn.position.set(4.5, 0, -6.5);
  root.add(bn);
  // 電柱と電線
  const poles = [];
  for (let i = 0; i < 6; i++) {
    const p = pole();
    p.position.set(-30 + i * 12, 0, -4.8);
    root.add(p);
    poles.push(p.position.clone().add(new THREE.Vector3(0, 6.9, 0)));
  }
  for (let i = 0; i < poles.length - 1; i++) {
    for (const dz of [-0.5, 0.5]) root.add(wire(poles[i].clone().add(new THREE.Vector3(-0.6, 0, dz * 0)), poles[i + 1].clone().add(new THREE.Vector3(-0.6, 0, 0)), 0.45));
    root.add(wire(poles[i].clone().add(new THREE.Vector3(0.6, 0, 0)), poles[i + 1].clone().add(new THREE.Vector3(0.6, 0, 0)), 0.5));
  }
  // 奥の山と松
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), matte('#7fae86', 1));
  hill.scale.set(70, 22, 30);
  hill.position.set(0, -2, -55);
  root.add(hill);
  const pineParts = [];
  for (let i = 0; i < 40; i++) {
    const gg = pineGeometry(rng);
    const sc = rng.range(1.4, 2.2);
    gg.scale(sc, sc, sc);
    gg.translate(rng.range(-60, 60), rng.range(2, 8), rng.range(-48, -36));
    pineParts.push(gg);
  }
  const pines = new THREE.Mesh(mergeGeometries(pineParts), vertexColorMat(0.9));
  pines.name = 'pines';
  root.add(pines);
  // 散歩の人（遠く）
  const people = [];
  for (let i = 0; i < 10; i++) people.push([rng.range(-25, 25), rng.range(-6, 4)]);
  root.add(crowd(people.filter(([x, z]) => Math.hypot(x, z - 1) > 4), rng));

  const birds = gulls(9, rng, { x0: -20, x1: 20, z0: 8, z1: 30, y0: 4, y1: 10 });
  root.add(birds.root);

  let t = 0;
  const windows = [];
  root.traverse((o) => { if (o.userData?.windows) windows.push(o.userData.windows); });
  return {
    root,
    seaParams: { shoreZ: EDGE, foam: 0, swell: 0.05, rough: 0.8 },
    seaLevel: SEA_Y,
    seaEdge: EDGE - 0.2,
    update(dt) {
      t += dt;
      birds.update(dt);
      for (const b of boats) {
        b.position.y = (b.userData.base ??= b.position.y) + Math.sin(t * 0.9 + b.userData.ph) * 0.07;
        b.rotation.z = Math.sin(t * 0.7 + b.userData.ph) * 0.03;
      }
    },
    setLook(id) { for (const w of windows) w.emissiveIntensity = id === 'night' ? 1.4 : id === 'evening' || id === 'sunset' ? 0.4 : 0; },
  };
}
