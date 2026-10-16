// みさき灯台（5 日目・夕焼け・風）：がけの上の草原、木の柵、白い灯台、夕日に光る海、風になびく草、ベンチと望遠鏡。
import * as THREE from 'three';
import { terrain, grainTexture, colorize, vertexColorMat, crowd, mergeGeometries, matte, paint, bench, gulls, islands, roundTreeGeometry } from './common.js';
import { Rng } from '../../../core/rng.js';

const CLIFF = 9;       // がけのふち
const SEA_Y = -14;

export function buildCape() {
  const root = new THREE.Group();
  root.name = 'loc-cape';
  const rng = new Rng('cape');

  const tex = grainTexture('#ffffff', ['#dcdcdc', '#efefef', '#cbcbcb'], { repeat: 70, seed: 41, n: 3000 });
  const grassC = new THREE.Color('#8dbb5c'), pathC = new THREE.Color('#d8c19a'), rockC = new THREE.Color('#9a8f86');
  const ground = terrain({
    x0: -90, x1: 90, z0: -70, z1: CLIFF + 1, nx: 140, nz: 90, map: tex,
    heightAt: (x, z) => {
      let y = Math.sin(x * 0.06) * Math.cos(z * 0.09) * 0.4 - Math.max(0, z - 2) * 0.03;
      if (z < -20) y += (-20 - z) * 0.12; // 奥の丘
      return Math.abs(z) < 3 && Math.abs(x) < 10 ? y * 0.15 : y;
    },
    colorAt: (x, z, c) => {
      const onPath = Math.abs(z - 0.3 + Math.sin(x * 0.1) * 0.8) < 2.1 ? 1 : 0;
      c.copy(grassC).lerp(pathC, onPath * 0.85);
      if (z > CLIFF - 0.8) c.lerp(rockC, 0.6);
      c.offsetHSL(0, 0, Math.sin(x * 0.9 + z * 0.4) * 0.025);
    },
  });
  root.add(ground);
  // がけ（岩の壁）
  const cliffParts = [];
  const rock = (x, z, rad, sy) => {
    const r = new THREE.DodecahedronGeometry(rad, 0);
    r.scale(1.3, sy, 1);
    r.translate(x, -rad * sy * 0.92 + rng.range(-0.4, 0.1), z);
    cliffParts.push(colorize(r, rng.pick(['#8c8279', '#a39a91', '#7d736a'])));
  };
  for (let i = 0; i < 46; i++) rock(-60 + i * 2.7 + rng.range(-0.6, 0.6), CLIFF + rng.range(0.8, 2.0), rng.range(2.2, 3.6), rng.range(2.4, 3.6));
  // 海の岩
  for (let i = 0; i < 14; i++) {
    const r = new THREE.DodecahedronGeometry(rng.range(1, 3.2), 0);
    r.translate(rng.range(-50, 50), SEA_Y + rng.range(-0.5, 0.8), rng.range(CLIFF + 6, CLIFF + 30));
    cliffParts.push(colorize(r, '#6f665e'));
  }
  const cliff = new THREE.Mesh(mergeGeometries(cliffParts), vertexColorMat(0.95));
  cliff.receiveShadow = true;
  root.add(cliff);
  // 岬の先：灯台の立つ台地（海へ張り出す）
  const capeGeo = new THREE.CylinderGeometry(9, 11, 2, 28, 1);
  const cp = capeGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); if (y > 0) cp.setY(i, y + Math.sin(cp.getX(i) * 0.5) * 0.15); }
  capeGeo.computeVertexNormals();
  const capeTop = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ map: tex, color: '#8dbb5c', roughness: 0.95 }));
  capeTop.position.set(6, -1.05, 21);
  capeTop.receiveShadow = true;
  root.add(capeTop);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    if (Math.sin(a) < -0.55) continue; // 陸に続く側は岩なし
    rock(6 + Math.cos(a) * 10.5, 21 + Math.sin(a) * 10.5, rng.range(2.4, 3.4), rng.range(2.6, 3.8));
  }
  // 柵（がけのふち）
  const fenceParts = [];
  for (let x = -30; x <= 30; x += 2.2) {
    const post = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    post.translate(x, 0.55 - Math.max(0, CLIFF - 1.6 - 2) * 0.03, CLIFF - 1.6);
    fenceParts.push(colorize(post, '#a07a5a'));
  }
  for (const y of [0.45, 0.9]) {
    const rail = new THREE.BoxGeometry(60, 0.08, 0.06);
    rail.translate(0, y - 0.15, CLIFF - 1.6);
    fenceParts.push(colorize(rail, '#b08a66'));
  }
  const fence = new THREE.Mesh(mergeGeometries(fenceParts), vertexColorMat(0.85));
  fence.castShadow = true;
  root.add(fence);

  // 灯台（白い塔、上に灯室）
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 12, 24), matte('#f8f9fa', 0.7));
  tower.position.y = 6;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.32, 0.6, 24), matte('#e03131', 0.6));
  band.position.y = 9.4;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.25, 24), matte('#343a40', 0.6));
  gallery.position.y = 12.1;
  const lampHouse = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: '#ffd43b', emissiveIntensity: 0.8, roughness: 0.3 }));
  lampHouse.position.y = 12.9;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), matte('#e03131', 0.6));
  dome.position.y = 13.6;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), matte('#7a5a44', 0.7));
  door.position.set(0, 0.8, -1.66);
  door.rotation.y = Math.PI;
  lh.add(tower, band, gallery, lampHouse, dome, door);
  lh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  lh.position.set(6.5, 0, 23);
  root.add(lh);
  // 灯台の光の帯（夕方から回る）
  const beamM = new THREE.MeshBasicMaterial({ color: '#fff3bf', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 40, 16, 1, true), beamM);
  beam.geometry.translate(0, -20, 0);
  beam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.userData.dynamic = true;
  beamPivot.position.set(6.5, 12.9, 23);
  beamPivot.add(beam);
  root.add(beamPivot);

  // 風になびく草（板を何本も。頂点シェーダーで揺らす）
  const bladeGeo = new THREE.PlaneGeometry(0.06, 0.45, 1, 3);
  bladeGeo.translate(0, 0.225, 0);
  const grassM = new THREE.MeshStandardMaterial({ color: '#7fb04f', roughness: 0.9, side: THREE.DoubleSide });
  const windU = { uTime: { value: 0 }, uWind: { value: 1 } };
  grassM.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, windU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float k = position.y / 0.45;
        float s = sin(uTime * 2.6 + wp.x * 0.7 + wp.z * 0.4) * 0.5 + sin(uTime * 4.1 + wp.x * 1.3) * 0.25;
        transformed.x += (0.12 + s * 0.12) * k * k * uWind;
        transformed.z += s * 0.05 * k * k * uWind;`);
  };
  const N = 2600;
  const blades = new THREE.InstancedMesh(bladeGeo, grassM, N);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  let k = 0;
  for (let i = 0; i < N * 2 && k < N; i++) {
    const x = rng.range(-22, 22), z = rng.range(-14, CLIFF - 2);
    if (Math.abs(z - 0.3) < 2.4 && Math.abs(x) < 14) { rng.float(); rng.float(); continue; } // 道と屋台のまわりは草なし
    p.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28));
    sc.set(1, rng.range(0.6, 1.4), 1);
    mm.compose(p, q, sc);
    blades.setMatrixAt(k, mm);
    blades.setColorAt(k, col.set(rng.pick(['#7fb04f', '#8cc15a', '#6c9c44', '#a4c86a'])));
    k++;
  }
  blades.count = k;
  blades.name = 'grass';
  root.add(blades);
  // 野の花
  const fl = [];
  for (let i = 0; i < 160; i++) {
    const x = rng.range(-24, 24), z = rng.range(-16, CLIFF - 2);
    if (Math.abs(z - 0.3) < 2.4 && Math.abs(x) < 14) continue;
    const f = new THREE.SphereGeometry(0.06, 6, 4);
    f.translate(x, 0.32, z);
    fl.push(colorize(f, rng.pick(['#ffffff', '#ffd43b', '#f783ac', '#b197fc'])));
  }
  root.add(new THREE.Mesh(mergeGeometries(fl), vertexColorMat(0.8)));
  // ベンチと望遠鏡（がけの近く）
  const bn = bench('#a0703a');
  bn.position.set(5, 0, CLIFF - 3);
  bn.rotation.y = Math.PI;
  root.add(bn);
  const scope = new THREE.Group();
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 8), matte('#495057', 0.5));
  leg.position.y = 0.55;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.6, 12), paint('#1c7ed6', 0.4));
  tube.rotation.x = Math.PI / 2 - 0.25;
  tube.position.y = 1.2;
  scope.add(leg, tube);
  scope.position.set(9, 0, CLIFF - 2.5);
  root.add(scope);
  // 奥の木と丘
  const treeParts = [];
  for (let i = 0; i < 30; i++) {
    const g = roundTreeGeometry(rng, rng.range(2, 3));
    const s2 = rng.range(1.2, 1.9);
    g.scale(s2, s2, s2);
    g.translate(rng.range(-50, 50), 0, rng.range(-45, -18));
    treeParts.push(g);
  }
  root.add(new THREE.Mesh(mergeGeometries(treeParts), vertexColorMat(0.85)));
  root.add(islands([[-140, 300, 90, 30, 0], [120, 360, 140, 24, 1]]));
  // 灯台を見に来た人（少し）
  const people = [];
  for (let i = 0; i < 9; i++) people.push([rng.range(-14, 16), rng.range(3, CLIFF - 2.5)]);
  root.add(crowd(people.filter(([x, z]) => Math.hypot(x - 1, z - 1) > 3.5), rng));
  const birds = gulls(8, rng, { x0: -25, x1: 25, z0: CLIFF + 5, z1: 40, y0: 2, y1: 8 });
  root.add(birds.root);

  let t = 0;
  return {
    root,
    seaParams: { shoreZ: CLIFF + 2, foam: 0.6, swell: 0.12, rough: 1.1 },
    // 到着・タイトル：屋台のうしろから、海と灯台と夕日の方へ
    shots: {
      arrive: { pos: [-3.4, 1.7, -5.2], target: [2.6, 2.4, 12], fov: 44, hfov: 60 },
      title: { pos: [-2.6, 1.3, -3.8], target: [2.4, 2.6, 12], fov: 46, hfov: 60 },
    },
    seaLevel: SEA_Y,
    seaEdge: CLIFF,
    update(dt) {
      t += dt;
      windU.uTime.value = t;
      birds.update(dt);
      beamPivot.rotation.y = t * 0.6;
    },
    setLook(id) { beamM.opacity = id === 'night' ? 0.32 : id === 'sunset' || id === 'evening' ? 0.12 : 0; },
  };
}
