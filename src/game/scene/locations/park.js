// ひだまり公園（3 日目・午後）：芝生と土の道、噴水、すべり台、ブランコ、砂場、花壇、丸い木、遊ぶ子ども。奥の丘から海が見える。
import * as THREE from 'three';
import { terrain, grainTexture, colorize, vertexColorMat, crowd, mergeGeometries, matte, paint, roundTreeGeometry,
  bench, vending, signTex, house } from './common.js';
import { Rng } from '../../../core/rng.js';

export function buildPark() {
  const root = new THREE.Group();
  root.name = 'loc-park';
  const rng = new Rng('park');

  // 芝生（土の道は頂点の色で）
  // 模様は白黒のざらつきだけにして、色は頂点で（芝と土の道を塗り分けるため）
  const grass = grainTexture('#ffffff', ['#d9d9d9', '#f2f2f2', '#c8c8c8', '#ffffff'], { repeat: 70, seed: 21, n: 3600 });
  const pathC = new THREE.Color('#e3c99a'), grassC = new THREE.Color('#7fbc63');
  const ground = terrain({
    x0: -90, x1: 90, z0: -70, z1: 90, nx: 140, nz: 120, map: grass,
    heightAt: (x, z) => {
      let y = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 0.25;
      if (z > 34) y -= Math.pow(z - 34, 1.4) * 0.09; // 丘の下（海へ）
      if (z < -30) y += (-30 - z) * 0.08;
      return Math.abs(z) < 3 && Math.abs(x) < 20 ? y * 0.2 : y;
    },
    colorAt: (x, z, c) => {
      // 土の道：屋台の前を横切り、噴水へ曲がる
      const d1 = Math.abs(z - 0.2 - Math.sin(x * 0.08) * 0.6);
      const d2 = Math.hypot(x - 3, z - 11) - 5.2;
      const onPath = Math.min(d1 - 2.0, Math.abs(d2) - 1.0);
      c.copy(grassC).lerp(pathC, THREE.MathUtils.smoothstep(-onPath, -0.4, 0.4));
      c.offsetHSL(0, 0, Math.sin(x * 0.7 + z * 0.3) * 0.02);
    },
  });
  root.add(ground);

  // 噴水（石の水盤・水面・吹き上げる水）
  const fountain = new THREE.Group();
  fountain.position.set(3, 0, 11);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.3, 10, 40), matte('#d8d2c6', 0.8));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.45;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.45, 40), matte('#cfc8ba', 0.8));
  basin.position.y = 0.22;
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.05, 40), new THREE.MeshPhysicalMaterial({ color: '#7fd1e8', roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 16), matte('#d8d2c6', 0.8));
  pillar.position.y = 0.9;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matte('#d8d2c6', 0.8));
  bowl.position.y = 1.75;
  fountain.add(rim, basin, water, pillar, bowl);
  // 吹き上げる水（粒）
  const dropGeo = new THREE.SphereGeometry(0.07, 6, 4);
  const drops = new THREE.InstancedMesh(dropGeo, new THREE.MeshStandardMaterial({ color: '#dff6ff', emissive: '#bfe9ff', emissiveIntensity: 0.3, transparent: true, opacity: 0.85 }), 90);
  drops.userData.ph = Array.from({ length: 90 }, () => [rng.range(0, 1), rng.range(0, 6.28), rng.range(0.6, 1.1)]);
  fountain.add(drops);
  fountain.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  root.add(fountain);

  // すべり台
  const slide = new THREE.Group();
  slide.position.set(-9, 0, 9);
  slide.rotation.y = 0.5;
  const red = paint('#ff6b6b', 0.4), yel = paint('#ffd43b', 0.4), blu = paint('#4dabf7', 0.4);
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), blu);
    p.position.set(x, 1.1, z);
    slide.add(p);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), yel);
  deck.position.y = 2.0;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.7, 4), red);
  roof.position.y = 3.0;
  roof.rotation.y = Math.PI / 4;
  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 3.2), red);
  chute.position.set(0, 1.05, 2.0);
  chute.rotation.x = 0.62;
  for (let i = 0; i < 6; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.12), yel); step.position.set(0, 0.3 + i * 0.3, -0.75 - i * 0.05); slide.add(step); }
  slide.add(deck, roof, chute);
  slide.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(slide);

  // ブランコ（ゆれる）
  const swingSet = new THREE.Group();
  swingSet.position.set(14, 0, 8);
  swingSet.rotation.y = -0.4;
  const frameM = paint('#20c997', 0.5);
  for (const x of [-1.6, 1.6]) for (const z of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), frameM);
    leg.position.set(x, 1.2, z * 0.6);
    leg.rotation.x = z * 0.45;
    swingSet.add(leg);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), frameM);
  top.rotation.z = Math.PI / 2;
  top.position.y = 2.4;
  swingSet.add(top);
  const swings = [];
  for (const x of [-0.7, 0.7]) {
    const s = new THREE.Group();
    s.position.set(x, 2.4, 0);
    for (const dx of [-0.2, 0.2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 4), matte('#adb5bd')); ch.position.set(dx, -0.9, 0); s.add(ch); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), paint('#ffd43b', 0.4));
    seat.position.y = -1.8;
    s.add(seat);
    s.userData.ph = rng.range(0, 6);
    s.userData.dynamic = true;
    swingSet.add(s);
    swings.push(s);
  }
  swingSet.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(swingSet);

  // 砂場
  const sand = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 2.6), matte('#ecd9b0', 1));
  sand.position.set(-15, 0.12, 15);
  const sandRim = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.3, 2.9), matte('#c9b79c', 0.9));
  sandRim.position.set(-15, 0.1, 15);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.22, 12), paint('#ff6b6b'));
  bucket.position.set(-14.4, 0.36, 14.6);
  root.add(sandRim, sand, bucket);

  // 花壇（色の点）
  const flowerParts = [];
  const flowerCols = ['#ff6b9a', '#ffd43b', '#ffffff', '#b197fc', '#ff922b'];
  for (let k = 0; k < 5; k++) {
    const cx = rng.range(-22, 22), cz = rng.range(4, 20);
    if (Math.hypot(cx - 3, cz - 11) < 6 || Math.abs(cx) < 3) continue;
    const bed = new THREE.CylinderGeometry(1.4, 1.5, 0.3, 18);
    bed.translate(cx, 0.15, cz);
    flowerParts.push(colorize(bed, '#a07a5a'));
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, 6.28), r = rng.range(0, 1.25);
      const f = new THREE.SphereGeometry(0.09, 6, 4);
      f.translate(cx + Math.cos(a) * r, 0.36 + rng.range(0, 0.08), cz + Math.sin(a) * r);
      flowerParts.push(colorize(f, rng.pick(flowerCols)));
    }
  }
  if (flowerParts.length) { const fl = new THREE.Mesh(mergeGeometries(flowerParts), vertexColorMat(0.8)); fl.receiveShadow = true; root.add(fl); }

  // 木（丸い）：まわりにたくさん
  const treeParts = [];
  for (let i = 0; i < 70; i++) {
    let x = rng.range(-60, 60), z = rng.range(-40, 32);
    if (Math.abs(z) < 4 && Math.abs(x) < 12) { rng.float(); continue; }
    if (Math.hypot(x - 3, z - 11) < 7 || (z > 3 && z < 22 && Math.abs(x) < 20)) { rng.float(); continue; }
    const g = roundTreeGeometry(rng, rng.range(2.2, 3.4));
    const sc = rng.range(1.1, 1.8);
    g.scale(sc, sc, sc);
    g.translate(x, 0, z);
    treeParts.push(g);
  }
  const trees = new THREE.Mesh(mergeGeometries(treeParts), vertexColorMat(0.85));
  trees.castShadow = true;
  trees.receiveShadow = true;
  trees.name = 'trees';
  root.add(trees);

  // ベンチ、自販機、看板、街灯
  for (const [x, z, ry] of [[-6, 4.5, 0.2], [9, 4.8, -0.3], [-3, -5.5, Math.PI], [6, -5.2, Math.PI]]) {
    const b = bench('#a0703a');
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    root.add(b);
  }
  const vm = vending('#2f9e44');
  vm.position.set(-8.5, 0, -4.2);
  root.add(vm);
  const sign = new THREE.Group();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), new THREE.MeshStandardMaterial({ map: signTex('ひだまり公園', { bg: '#2f9e44', fg: '#ffffff' }), roughness: 0.7 }));
  board.position.y = 1.6;
  for (const x of [-1.4, 1.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), matte('#7a5a44')); p.position.set(x, 0.8, -0.02); sign.add(p); }
  sign.add(board);
  sign.position.set(3.5, 0, -6.5);
  root.add(sign);
  const lampM = new THREE.MeshStandardMaterial({ color: '#fff9db', emissive: '#ffe8a3', emissiveIntensity: 0 });
  for (const [x, z] of [[-12, 3.5], [12, 3.8], [-20, -3], [20, -3.5]]) {
    const L = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), matte('#3b3f45', 0.6));
    p.position.y = 1.7;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lampM);
    lamp.position.y = 3.5;
    L.add(p, lamp);
    L.position.set(x, 0, z);
    root.add(L);
  }
  // 奥の町の屋根と、丘の向こうの海
  for (let i = 0; i < 12; i++) {
    const h = house({ w: rng.range(4, 7), h: rng.range(3, 6), d: 5, wall: rng.pick(['#fff3df', '#e7f5ff', '#fff0f6', '#f8f9fa']), roof: rng.pick(['#e8590c', '#1971c2', '#2f9e44', '#c2255c']), roofType: rng.chance(0.6) ? 'gable' : 'flat', windows: 2 }, rng);
    h.position.set(-50 + i * 9 + rng.range(-1, 1), -1.5, -46 + rng.range(-3, 3));
    h.rotation.y = rng.range(-0.1, 0.1);
    root.add(h);
  }
  // 遊ぶ子どもと、散歩の人
  const people = [];
  for (let i = 0; i < 26; i++) {
    const x = rng.range(-26, 26), z = rng.range(-12, 26);
    if (Math.hypot(x - 0.5, z - 1.5) < 4.5) continue;
    people.push([x, z, z > 4 && z < 22 ? 0.65 : 0.95]);
  }
  const folks = crowd(people, rng);
  root.add(folks);
  const kids = people.map((p, i) => ({ i, base: p, ph: rng.range(0, 6), r: rng.range(0.5, 2.5) })).filter((k) => k.base[2] < 0.8);

  let t = 0;
  const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  return {
    root,
    seaParams: { shoreZ: 80, foam: 0, swell: 0.03, rough: 0.6 },
    seaLevel: -9,
    seaEdge: 62,
    update(dt) {
      t += dt;
      // 噴水の粒：上がって落ちる
      const ph = drops.userData.ph;
      for (let i = 0; i < ph.length; i++) {
        const [o, a, k] = ph[i];
        const u = (t * 0.55 * k + o) % 1;
        const r = u * 1.4;
        const y = 1.9 + Math.sin(u * Math.PI) * 1.6 * k - u * 0.9;
        mm.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
        drops.setMatrixAt(i, mm);
      }
      drops.instanceMatrix.needsUpdate = true;
      for (const s of swings) s.rotation.x = Math.sin(t * 1.9 + s.userData.ph) * 0.6;
      // 子どもが走りまわる
      for (const k of kids) {
        folks.getMatrixAt(k.i, mm); mm.decompose(p, q, sc);
        p.x = k.base[0] + Math.cos(t * 0.8 + k.ph) * k.r;
        p.z = k.base[1] + Math.sin(t * 0.8 + k.ph) * k.r * 0.6;
        p.y = Math.abs(Math.sin(t * 9 + k.ph)) * 0.08;
        mm.compose(p, q, sc); folks.setMatrixAt(k.i, mm);
      }
      folks.instanceMatrix.needsUpdate = true;
    },
    setLook(id) { lampM.emissiveIntensity = id === 'night' ? 2.5 : id === 'evening' || id === 'sunset' ? 0.8 : 0; },
  };
}
