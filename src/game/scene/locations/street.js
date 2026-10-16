// えきまえ商店街（4 日目・夕方）：歩道に屋台、向かいに小さな店の並び（ひさし・看板・明かり）、電柱と電線、のぼり、
// 通りの奥に駅。夕方なので店の明かりがつきはじめる。
import * as THREE from 'three';
import { terrain, grainTexture, colorize, vertexColorMat, crowd, mergeGeometries, matte, paint,
  pole, wire, vending, shopFront, signTex, setGlow, lanterns } from './common.js';
import { Rng } from '../../../core/rng.js';

export function buildStreet() {
  const root = new THREE.Group();
  root.name = 'loc-street';
  const rng = new Rng('street');
  const glow = [];

  // 地面：歩道（れんが色のタイル）と車道（アスファルト）
  const tex = grainTexture('#ffffff', ['#dcdcdc', '#efefef', '#cfcfcf'], { repeat: 60, seed: 31, n: 2400 });
  const walk = new THREE.Color('#d9a98a'), road = new THREE.Color('#6f7378'), line = new THREE.Color('#f1efe9');
  const ground = terrain({
    x0: -90, x1: 90, z0: -40, z1: 40, nx: 180, nz: 100, map: tex,
    heightAt: (x, z) => (z > 2.6 && z < 8.6 ? -0.12 : 0),
    colorAt: (x, z, c) => {
      if (z > 2.6 && z < 8.6) { c.copy(road); if (Math.abs(z - 5.6) < 0.08 && ((x + 100) % 3) < 1.6) c.copy(line); }
      else { c.copy(walk); if (((Math.floor(x / 0.6) + Math.floor(z / 0.6)) & 1) === 0) c.multiplyScalar(0.9); }
    },
  });
  root.add(ground);
  // 縁石
  for (const z of [2.6, 8.6]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(180, 0.14, 0.22), matte('#cfcac1', 0.9));
    curb.position.set(0, 0.0, z);
    root.add(curb);
  }

  // 向かいの店（-Z を向く）と、うしろの店（+Z を向く）
  const SHOPS = [
    { sign: '八百屋 やまだ', awning: '#2f9e44', goods: ['#ff6b6b', '#ffd43b', '#69db7c', '#ff922b'] },
    { sign: 'パン工房 こむぎ', awning: '#e67700' },
    { sign: '喫茶 しおさい', awning: '#5f3dc4', signBg: '#2b2d31', signFg: '#ffe066' },
    { sign: '本の森', awning: '#1971c2' },
    { sign: 'だがしや', awning: '#e03131', goods: ['#ff6b9a', '#4dabf7', '#ffd43b'] },
    { sign: 'くすり', awning: '#0ca678' },
    { sign: '花屋 ひなた', awning: '#f06595', goods: ['#ff6b9a', '#ffffff', '#ffd43b', '#b197fc'] },
    { sign: '魚屋 うおはち', awning: '#1c7ed6', goods: ['#adb5bd', '#ff8787'] },
    { sign: '金物', awning: '#495057' },
  ];
  const walls = ['#fff3df', '#f1f3f5', '#fff0f6', '#e7f5ff', '#fff9db', '#ebfbee'];
  let x = -26;
  SHOPS.forEach((S, i) => {
    const w = rng.range(4.2, 5.6), h = rng.range(4.2, 5.6);
    const sh = shopFront({ w, h, d: 5, wall: walls[i % walls.length], awning: S.awning, sign: S.sign, signBg: S.signBg, signFg: S.signFg, goods: S.goods }, glow);
    sh.position.set(x + w / 2, 0, 13.4);
    sh.rotation.y = Math.PI;
    root.add(sh);
    x += w + 0.25;
  });
  const BACK = ['たばこ', 'クリーニング', 'おもちゃ', '和菓子 もち月', '理容', 'めがね', '写真館', '酒店'];
  x = -24;
  BACK.forEach((name, i) => {
    const w = rng.range(4.2, 5.4), h = rng.range(4.2, 5.4);
    const sh = shopFront({ w, h, d: 5, wall: walls[(i + 3) % walls.length], awning: rng.pick(['#e03131', '#1971c2', '#2f9e44', '#e67700', '#5f3dc4']), sign: name }, glow);
    sh.position.set(x + w / 2, 0, -7.8);
    root.add(sh);
    x += w + 0.25;
  });

  // 電柱と、通りを横切る電線
  const tops = [];
  for (let i = 0; i < 7; i++) {
    const p = pole();
    p.position.set(-30 + i * 10, 0, 9.4);
    root.add(p);
    tops.push(p.position.clone().add(new THREE.Vector3(0, 6.9, 0)));
  }
  for (let i = 0; i < tops.length - 1; i++) {
    for (const dx of [-0.6, 0, 0.6]) root.add(wire(tops[i].clone().add(new THREE.Vector3(dx, 0, 0)), tops[i + 1].clone().add(new THREE.Vector3(dx, 0, 0)), 0.5 + Math.abs(dx) * 0.2));
    root.add(wire(tops[i].clone().add(new THREE.Vector3(0.3, -0.8, 0)), new THREE.Vector3(tops[i].x + 2, 5.2, -5.5), 0.6));
  }
  // 通りの上の飾り（提灯のひも：夕方から光る）
  const lan = lanterns([new THREE.Vector3(-30, 5.4, 9.2), new THREE.Vector3(-10, 5.1, -5.4), new THREE.Vector3(10, 5.4, 9.2), new THREE.Vector3(30, 5.1, -5.4)], { gap: 1.1, colors: ['#ff6b6b', '#ffffff', '#ffd43b', '#ff8fab'], sag: 0.6, size: 0.14 });
  root.add(lan);
  // のぼり（「夏まつり」）
  const noboriM = new THREE.MeshStandardMaterial({ map: verticalSign('夏まつり 七月三十日', '#e03131', '#ffffff'), side: THREE.DoubleSide, roughness: 0.8 });
  const flags = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6), matte('#e9ecef', 0.6));
    p.position.y = 1.6;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 2.1), noboriM);
    f.position.set(0.3, 1.95, 0);
    g.add(p, f);
    g.position.set(-24 + i * 6.5 + rng.range(-0.5, 0.5), 0, i % 2 ? 9.0 : -2.4);
    g.rotation.y = rng.range(-0.3, 0.3);
    g.userData.f = f;
    g.userData.dynamic = true;
    root.add(g);
    flags.push(g);
  }
  // 駅（通りの奥）
  const station = new THREE.Group();
  const sBody = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 8), matte('#f1e3c8', 0.85));
  sBody.position.y = 3;
  const sRoof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 9), matte('#7a5a44', 0.8));
  sRoof.position.y = 6.25;
  const sSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshStandardMaterial({ map: signTex('しおかぜ駅', { bg: '#1c3f6e', fg: '#ffffff' }), emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.6 }));
  sSign.material.emissiveMap = sSign.material.map;
  glow.push({ m: sSign.material, k: 0.7, base: 0.2 });
  sSign.position.set(0, 5.0, 4.02);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), matte('#ffffff', 0.4));
  clock.position.set(0, 7.6, 1);
  const clockTower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 2.2), matte('#f1e3c8', 0.85));
  clockTower.position.set(0, 7.6, 0);
  station.add(sBody, sRoof, sSign, clockTower, clock);
  station.position.set(-46, 0, 3);
  station.rotation.y = Math.PI / 2;
  root.add(station);
  // 自販機・自転車
  const vm = vending('#e63946');
  vm.position.set(4.6, 0, -4.9);
  root.add(vm);
  glow.push({ m: vm.userData.glow[0], k: 0.6, base: 0.6 }, { m: vm.userData.glow[1], k: 0.3, base: 0.25 });
  for (let i = 0; i < 4; i++) {
    const b = bicycle(rng.pick(['#e03131', '#1971c2', '#ffd43b', '#868e96']));
    b.position.set(-12 + i * 0.75, 0, -4.6);
    b.rotation.y = Math.PI / 2 + rng.range(-0.1, 0.1);
    root.add(b);
  }
  // 通る人
  const people = [];
  for (let i = 0; i < 34; i++) {
    const side = rng.chance(0.5);
    const px = rng.range(-30, 30), pz = side ? rng.range(9.2, 10.6) : rng.range(-4.8, -2.4);
    if (Math.abs(px) < 3 && !side) continue;
    people.push([px, pz]);
  }
  const folks = crowd(people, rng);
  root.add(folks);
  const walkers = people.map((p, i) => ({ i, z: p[1], x: p[0], v: rng.range(0.5, 1.1) * rng.sign() }));

  let t = 0;
  const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  return {
    root,
    sea: false,
    update(dt) {
      t += dt;
      for (const f of flags) f.userData.f.rotation.y = Math.sin(t * 2.1 + f.position.x) * 0.25;
      for (const w of walkers) {
        w.x += w.v * dt;
        if (w.x > 32) w.x = -32; if (w.x < -32) w.x = 32;
        folks.getMatrixAt(w.i, mm); mm.decompose(p, q, sc);
        p.set(w.x, Math.abs(Math.sin(t * 7 + w.i)) * 0.04, w.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.v > 0 ? Math.PI / 2 : -Math.PI / 2);
        mm.compose(p, q, sc); folks.setMatrixAt(w.i, mm);
      }
      folks.instanceMatrix.needsUpdate = true;
    },
    setLook(id) {
      const on = id === 'night' ? 1 : id === 'evening' || id === 'sunset' ? 0.6 : 0;
      setGlow(glow, on);
      lan.userData.setGlow(on);
    },
  };
}

/** 縦長の旗の文字（1 字ずつ縦に）。 */
function verticalSign(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 512);
  g.fillStyle = fg; g.font = '64px "Mochiy Pop One", "Zen Maru Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...text.replace(/ /g, '')];
  const step = 480 / chars.length;
  chars.forEach((ch, i) => g.fillText(ch, 64, 20 + step * (i + 0.5)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bicycle(color) {
  const g = new THREE.Group();
  const m = paint(color, 0.4), dark = matte('#2b2d31', 0.7);
  for (const z of [-0.5, 0.5]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20), dark);
    w.position.set(0, 0.34, z);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), m);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 0.55;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.22), dark);
  seat.position.set(0, 0.85, -0.25);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), m);
  post.position.set(0, 0.65, -0.25);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), matte('#adb5bd', 0.6));
  basket.position.set(0, 0.8, 0.55);
  g.add(bar, seat, post, basket);
  return g;
}
