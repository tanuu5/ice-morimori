// しおかぜ夏まつり（6 日目・夜）：神社の参道に並ぶ屋台、頭の上の提灯、鳥居と石灯籠、浴衣の人の波、海の上の花火。
import * as THREE from 'three';
import { terrain, grainTexture, colorize, vertexColorMat, crowd, mergeGeometries, matte, paint, yatai, lanterns, setGlow, signTex, roundTreeGeometry } from './common.js';
import { Rng } from '../../../core/rng.js';

const STALLS_FRONT = [
  ['たこ焼き', '#e03131'], ['金魚すくい', '#1c7ed6'], ['わたあめ', '#f06595'], ['りんご飴', '#c92a2a'], ['焼きそば', '#e67700'],
  ['かき氷', '#1098ad'], ['ヨーヨー釣り', '#7048e8'], ['お面', '#2f9e44'], ['射的', '#495057'], ['ラムネ', '#1971c2'],
];
const STALLS_BACK = [['焼きとうもろこし', '#e8590c'], ['チョコバナナ', '#862e9c'], ['くじ引き', '#d6336c'], ['いか焼き', '#c2255c'], ['フランクフルト', '#e03131'], ['輪投げ', '#2b8a3e'], ['ベビーカステラ', '#f08c00']];

export function buildFestival() {
  const root = new THREE.Group();
  root.name = 'loc-festival';
  const rng = new Rng('festival');
  const glow = [];

  // 地面：砂利と、まんなかの石畳の参道
  const tex = grainTexture('#ffffff', ['#d6d6d6', '#ececec', '#c4c4c4', '#f6f6f6'], { repeat: 80, seed: 51, n: 4000 });
  const gravel = new THREE.Color('#bdb3a3'), stone = new THREE.Color('#d9d3c7');
  const ground = terrain({
    x0: -90, x1: 90, z0: -60, z1: 60, nx: 140, nz: 100, map: tex,
    heightAt: (x, z) => (z > 30 ? -(z - 30) * 0.3 : 0),
    colorAt: (x, z, c) => {
      const onPath = Math.abs(z - 0.4) < 2.4;
      c.copy(onPath ? stone : gravel);
      if (onPath && ((Math.floor(x / 1.1) + Math.floor(z / 0.9)) & 1)) c.multiplyScalar(0.92);
    },
  });
  root.add(ground);

  // 屋台の列（向かい：-Z を向く／うしろ：+Z を向く）
  STALLS_FRONT.forEach(([name, col], i) => {
    const s = yatai({ sign: name, roof: col, w: 2.6 }, glow);
    s.position.set(-15 + i * 3.1, 0, 7.2);
    s.rotation.y = Math.PI;
    root.add(s);
  });
  STALLS_BACK.forEach(([name, col], i) => {
    const s = yatai({ sign: name, roof: col, w: 2.6 }, glow);
    s.position.set(-12 + i * 3.4 + (i > 3 ? 3 : 0), 0, -6.0);
    root.add(s);
  });
  // 頭の上の提灯（参道を横切るジグザグ）
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(-18 + i * 3.6, 4.0, i % 2 ? -4.5 : 6.2));
  const lan = lanterns(pts, { gap: 0.75, colors: ['#ff6b6b', '#ffe8c2', '#ff6b6b', '#ffd43b'], sag: 0.45, size: 0.17 });
  root.add(lan);
  const lan2 = lanterns([new THREE.Vector3(-18, 3.3, 8.6), new THREE.Vector3(18, 3.3, 8.6)], { gap: 0.6, colors: ['#ff6b6b', '#ffe8c2'], sag: 0.3, size: 0.15 });
  root.add(lan2);
  // 提灯をつるす柱
  for (const P of pts) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.1, 8), matte('#6b4a32', 0.8));
    p.position.set(P.x, 2.05, P.z + (P.z > 0 ? 0.3 : -0.3));
    root.add(p);
  }
  // 鳥居と石灯籠（参道の奥）
  const torii = new THREE.Group();
  const red = paint('#e03131', 0.5);
  for (const x of [-2.4, 2.4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6, 14), red); c.position.set(x, 3, 0); torii.add(c); }
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.45, 0.6), matte('#2b2d31', 0.6));
  kasagi.position.y = 6.2;
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 0.4), red);
  nuki.position.y = 5.2;
  const gakuTex = signTex('潮風神社', { w: 256, h: 96, bg: '#2b2d31', fg: '#ffd43b' });
  const gaku = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), new THREE.MeshStandardMaterial({ map: gakuTex, roughness: 0.6 }));
  gaku.position.set(0, 5.65, 0.22);
  torii.add(kasagi, nuki, gaku);
  torii.position.set(-28, 0, 0.4);
  torii.rotation.y = Math.PI / 2;
  root.add(torii);
  const stoneM = matte('#c9c3b6', 0.9);
  const tToroLight = new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: '#ffb347', emissiveIntensity: 1.5 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 6), stoneM);
    base.position.y = 0.45;
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), tToroLight);
    fire.position.y = 1.15;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 6), stoneM);
    roof.position.y = 1.58;
    g.add(base, fire, roof);
    g.position.set(-22 - Math.floor(i / 2) * 4, 0, i % 2 ? -3.2 : 4.0);
    root.add(g);
  }
  // 奥の神社（小さく）と森
  const shrine = new THREE.Group();
  const hall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 5), matte('#7a4a32', 0.8));
  hall.position.y = 1.75;
  const shRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 4), matte('#2b2d31', 0.7));
  shRoof.position.y = 4.5;
  shRoof.rotation.y = Math.PI / 4;
  shrine.add(hall, shRoof);
  shrine.position.set(-44, 0, 0.4);
  root.add(shrine);
  const treeParts = [];
  for (let i = 0; i < 60; i++) {
    const x = rng.range(-70, 40), back = rng.chance(0.5);
    const z = back ? rng.range(-40, -14) : rng.range(14, 26);
    const g = roundTreeGeometry(rng, rng.range(2.5, 4));
    const s = rng.range(1.4, 2.2);
    g.scale(s, s, s);
    g.translate(x, 0, z);
    treeParts.push(g);
  }
  const trees = new THREE.Mesh(mergeGeometries(treeParts), vertexColorMat(0.9));
  root.add(trees);

  // 浴衣の人の波（ゆっくり歩く）。横にまっすぐ歩くので、道すじ（z）はお客さんの列のうしろ（向かいの屋台の前）と、
  // 屋台を撮るカメラのさらにうしろだけにする（屋台とカメラのあいだを通ると、塔が隠れる）
  const people = [];
  for (let i = 0; i < 52; i++) {
    const px = rng.range(-24, 24), pz = rng.chance(0.55) ? rng.range(5.4, 6.3) : rng.range(-4.4, -2.6);
    people.push([px, pz]);
  }
  const folks = crowd(people, rng);
  root.add(folks);
  const walkers = people.map((p, i) => ({ i, x: p[0], z: p[1], v: rng.range(0.25, 0.6) * rng.sign() }));

  // 花火：海の上で、ときどき開く（光る粒。Bloom で光る）
  const FW = 6, PER = 70;
  const fwGeo = new THREE.SphereGeometry(0.22, 6, 4);
  const shells = [];
  for (let s = 0; s < FW; s++) {
    const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const inst = new THREE.InstancedMesh(fwGeo, m, PER);
    inst.frustumCulled = false;
    inst.visible = false;
    const dirs = Array.from({ length: PER }, () => new THREE.Vector3().randomDirection());
    root.add(inst);
    shells.push({ inst, m, dirs, t: -1, pos: new THREE.Vector3(), color: new THREE.Color(), size: 1 });
  }
  const fwColors = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ffffff', '#ff922b', '#b197fc'];
  let nextFw = 1.5, pendingFw = -1;

  let t = 0;
  const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const api = {
    root,
    seaParams: { shoreZ: 60, foam: 0, swell: 0.05, rough: 0.7 },
    // エンディング：屋台のうしろから、海の上の花火を見上げる
    shots: {
      ending: { pos: [1.7, 1.0, 0.9], target: [1.9, 16, 55], fov: 56, hfov: 66 },
    },
    boost: 0, // 1 にすると花火が増える（エンディング）
    seaLevel: -10,
    seaEdge: 50,
    fireworks: true,
    onBurst: null, // (pos) => void　音を鳴らす
    burst(power = 1) {
      const S = shells.find((s) => s.t < 0) || shells[0];
      S.t = 0;
      S.pos.set(rng.range(-30, 30), rng.range(26, 42), rng.range(70, 110));
      if (api.boost) S.pos.set(rng.range(-14, 20), rng.range(30, 46), rng.range(48, 68));
      S.color.set(rng.pick(fwColors));
      S.size = rng.range(9, 15) * power;
      S.m.color.copy(S.color).multiplyScalar(2.2);
      S.inst.visible = true;
      api.onBurst?.(S.pos);
    },
    update(dt) {
      t += dt;
      for (const w of walkers) {
        w.x += w.v * dt;
        if (w.x > 26) w.x = -26; if (w.x < -26) w.x = 26;
        folks.getMatrixAt(w.i, mm); mm.decompose(p, q, sc);
        p.set(w.x, Math.abs(Math.sin(t * 5 + w.i)) * 0.03, w.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.v > 0 ? Math.PI / 2 : -Math.PI / 2);
        mm.compose(p, q, sc); folks.setMatrixAt(w.i, mm);
      }
      folks.instanceMatrix.needsUpdate = true;
      // 花火（ゲームの時間で：撮影でも同じ結果になるように setTimeout は使わない）
      nextFw -= dt;
      if (pendingFw > 0) { pendingFw -= dt; if (pendingFw <= 0) api.burst(0.8); }
      if (api.fireworks && nextFw <= 0) { api.burst(); nextFw = api.boost ? rng.range(0.45, 1.1) : rng.range(1.2, 3.2); if (rng.chance(api.boost ? 0.5 : 0.25)) pendingFw = 0.25; }
      for (const S of shells) {
        if (S.t < 0) continue;
        S.t += dt;
        const k = S.t / 2.4;
        if (k >= 1) { S.t = -1; S.inst.visible = false; continue; }
        const r = S.size * (1 - Math.pow(1 - Math.min(1, k * 1.6), 3));
        const fall = k * k * 8;
        S.m.opacity = Math.max(0, 1 - k * 1.1);
        const s2 = 1 + (1 - k) * 0.6;
        for (let i = 0; i < PER; i++) {
          const d = S.dirs[i];
          mm.makeScale(s2, s2, s2).setPosition(S.pos.x + d.x * r, S.pos.y + d.y * r - fall, S.pos.z + d.z * r);
          S.inst.setMatrixAt(i, mm);
        }
        S.inst.instanceMatrix.needsUpdate = true;
      }
    },
    setLook(id) {
      const on = id === 'night' ? 1 : 0.4;
      setGlow(glow, on);
      lan.userData.setGlow(on);
      lan2.userData.setGlow(on);
    },
  };
  return api;
}
