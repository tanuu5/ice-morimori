// なぎさ海水浴場：白い砂浜、色とりどりのパラソル、海の家、松林、水平線の島。
import * as THREE from 'three';
import { terrain, grainTexture, islands, pineGeometry, beachUmbrella, colorize, vertexColorMat, gulls, crowd, mergeGeometries, matte, paint } from './common.js';
import { Rng } from '../../../core/rng.js';
import { canvasTex, FONT_POP } from '../materials.js';

const SHORE = 13;

export function buildBeach() {
  const root = new THREE.Group();
  root.name = 'loc-beach';
  const rng = new Rng('beach');

  // 砂浜：岸に向かってゆるく下がり、海の下へ
  const sandTex = grainTexture('#ead2a2', ['#d8bb86', '#f6e6c4', '#cfae7c', '#fbf3e0'], { repeat: 60, seed: 3 });
  const dry = new THREE.Color('#ffffff'), wet = new THREE.Color('#c9b08a'), c2 = new THREE.Color();
  const ground = terrain({
    x0: -120, x1: 120, z0: -60, z1: 60, nx: 160, nz: 120, map: sandTex,
    heightAt: (x, z) => {
      let y = 0;
      if (z > SHORE - 5) y -= Math.pow(Math.max(0, z - (SHORE - 5)), 1.25) * 0.045;
      y += Math.sin(x * 0.3) * Math.sin(z * 0.4) * 0.03; // 砂のうねり
      if (z < -14) y += (-14 - z) * 0.05; // 奥（松林）へ向かって少し上がる
      return y;
    },
    colorAt: (x, z, c) => {
      const t = THREE.MathUtils.smoothstep(z, SHORE - 3.5, SHORE + 0.5);
      c.copy(dry).lerp(wet, t);
      if (z < -14) c.lerp(c2.set('#d8d0a0'), THREE.MathUtils.smoothstep(z, -14, -22) * 0.6);
    },
  });
  root.add(ground);

  // 水平線の島と岬
  root.add(islands([[-160, 420, 90, 28, 0], [60, 520, 140, 22, 1], [260, 380, 70, 40, 0], [-330, 300, 60, 55, 1]]));

  // ビーチパラソルとシート（前景には置かない：お客さんの後ろの景色に）
  const umbColors = [['#ff6f91', '#ffffff'], ['#ffd166', '#ffffff'], ['#4fc3f7', '#ffffff'], ['#81c784', '#ffffff'], ['#ff8a65', '#fff3e0'], ['#ba68c8', '#ffffff']];
  const towelGeo = [];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-34, 34);
    const z = rng.range(3.5, 10.5);
    if (Math.abs(x) < 3 && z < 6) { rng.float(); rng.float(); continue; } // 屋台の正面は空ける
    const [a, b] = rng.pick(umbColors);
    const u = beachUmbrella(a, b, rng);
    u.position.set(x, 0, z);
    u.rotation.set(rng.range(-0.1, 0.1), rng.range(0, 6), rng.range(-0.12, 0.12));
    u.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.add(u);
    const tw = new THREE.PlaneGeometry(0.8, 1.6);
    tw.rotateX(-Math.PI / 2);
    tw.rotateY(rng.range(0, Math.PI));
    tw.translate(x + rng.range(-0.8, 0.8), 0.02, z + rng.range(-0.6, 0.6));
    towelGeo.push(colorize(tw, rng.pick(['#ff8fab', '#ffe066', '#74c0fc', '#8ce99a', '#ffffff', '#ffa94d'])));
  }
  const towels = new THREE.Mesh(mergeGeometries(towelGeo), vertexColorMat(0.9));
  towels.receiveShadow = true;
  towels.name = 'towels';
  root.add(towels);

  // 遠くの人（浜と海）
  const people = [];
  for (let i = 0; i < 40; i++) people.push([rng.range(-40, 40), rng.range(4, 12), 0.95]);
  for (let i = 0; i < 18; i++) people.push([rng.range(-30, 30), rng.range(SHORE + 2, SHORE + 12), 0.95]);
  const folks = crowd(people, rng);
  // 海にいる人は胸まで沈める
  const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 40; i < people.length; i++) {
    folks.getMatrixAt(i, mm); mm.decompose(p, q, s); p.y = -0.75; mm.compose(p, q, s); folks.setMatrixAt(i, mm);
  }
  root.add(folks);

  // 浮き輪とビーチボール（浜に転がる小物）
  const ringGeo = [];
  for (let i = 0; i < 6; i++) {
    const t = new THREE.TorusGeometry(0.32, 0.12, 10, 20);
    t.rotateX(-Math.PI / 2);
    t.translate(rng.range(-20, 20), 0.12, rng.range(5, 11));
    ringGeo.push(colorize(t, rng.pick(['#ff6b6b', '#ffd43b', '#4dabf7', '#ff922b'])));
  }
  const rings = new THREE.Mesh(mergeGeometries(ringGeo), vertexColorMat(0.5));
  rings.castShadow = true;
  rings.name = 'rings';
  root.add(rings);

  // 監視台
  const tower = lifeguardTower();
  tower.position.set(-9, 0, 8.5);
  tower.rotation.y = 0.3;
  root.add(tower);

  // 海の家（屋台の後ろ：広いカメラで見える）
  const huts = new THREE.Group();
  huts.name = 'huts';
  const hutColors = ['#ffffff', '#fff1d6', '#e3f6ff'];
  for (let i = 0; i < 5; i++) {
    const h = beachHut(hutColors[i % 3], ['#ff6f91', '#4fc3f7', '#ffd166', '#81c784', '#ff8a65'][i], i);
    h.position.set(-22 + i * 11, 0, -13 + rng.range(-1, 1));
    huts.add(h);
  }
  root.add(huts);

  // 松林（いちばん奥）
  const pineParts = [];
  for (let i = 0; i < 60; i++) {
    const g = pineGeometry(rng);
    const sc = rng.range(1.2, 2.0);
    g.scale(sc, sc, sc);
    g.rotateY(rng.range(0, 6));
    g.translate(rng.range(-70, 70), -0.2 + Math.max(0, 0), rng.range(-30, -19));
    pineParts.push(g);
  }
  const pines = new THREE.Mesh(mergeGeometries(pineParts), vertexColorMat(0.9));
  pines.castShadow = false;
  pines.receiveShadow = true;
  pines.name = 'pines';
  root.add(pines);

  // 帆船（沖）
  const boat = sailboat();
  boat.userData.dynamic = true;
  boat.position.set(28, 0, 80);
  root.add(boat);
  const boat2 = sailboat('#ff8a80');
  boat2.userData.dynamic = true;
  boat2.position.set(-60, 0, 140);
  boat2.scale.setScalar(1.4);
  root.add(boat2);

  const birds = gulls(7, rng, { x0: -30, x1: 30, z0: 14, z1: 40, y0: 6, y1: 12 });
  root.add(birds.root);

  let t = 0;
  return {
    root,
    seaParams: { shoreZ: SHORE, foam: 1, swell: 0.07, rough: 1 },
    seaLevel: -0.06,
    update(dt) {
      t += dt;
      birds.update(dt);
      boat.position.y = Math.sin(t * 0.8) * 0.06;
      boat.rotation.z = Math.sin(t * 0.6) * 0.04;
      boat2.position.y = Math.sin(t * 0.7 + 1) * 0.06;
    },
  };
}

function lifeguardTower() {
  const g = new THREE.Group();
  g.name = 'lifeguard';
  const wood = matte('#f4f1ea', 0.7);
  const red = paint('#f25c54', 0.5);
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), wood);
    leg.position.set(x * 0.9, 1.1, z * 0.9);
    leg.rotation.set(z * 0.1, 0, -x * 0.1);
    g.add(leg);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 1.3), wood);
  deck.position.y = 2.2;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), red);
  seat.position.set(0, 2.5, -0.4);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 4), red);
  roof.position.y = 3.4;
  roof.rotation.y = Math.PI / 4;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), wood);
  pole.position.y = 2.75;
  g.add(deck, seat, roof, pole);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function beachHut(wall, accent, i) {
  const g = new THREE.Group();
  g.name = 'hut' + i;
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 4), matte(wall, 0.8));
  body.position.y = 1.3;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 4.8), paint(accent, 0.6));
  roof.position.y = 2.75;
  roof.rotation.x = -0.08;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.08, 1.6), matte(accent, 0.8));
  awning.position.set(0, 2.2, 2.6);
  awning.rotation.x = 0.25;
  // 看板「海の家」
  const signTex = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.fillStyle = accent; c.fillRect(0, h - 18, w, 18);
    c.fillStyle = '#2d4a6b'; c.font = `76px ${FONT_POP}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(['海の家 なみ', 'かき氷', '焼きそば', 'ラムネ', '貸しボート'][i % 5], w / 2, h / 2 - 6);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }));
  sign.position.set(0, 3.25, 2.05);
  // 開いた正面（暗い中）
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.8), matte('#5b4a3a', 1));
  inside.position.set(0, 1.0, 2.01);
  g.add(body, roof, awning, sign, inside);
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

function sailboat(sailColor = '#ffffff') {
  const g = new THREE.Group();
  g.name = 'sailboat';
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 3.2, 10, 1, false, 0, Math.PI), paint('#ffffff', 0.4));
  hull.rotation.set(0, 0, Math.PI / 2);
  hull.rotation.x = Math.PI;
  hull.position.y = 0.3;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), matte('#dddddd'));
  mast.position.y = 2.4;
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.6, 0, 0, 4.3, 0, 1.8, 0.6, 0], 3));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, matte(sailColor, 0.7, { side: THREE.DoubleSide }));
  g.add(hull, mast, sail);
  return g;
}
