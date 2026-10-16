// 場所づくりの共通の部品：地面、遠くの島、木、ビーチパラソル、カモメ、遠くの人など。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte, paint, metal, canvasTex } from '../materials.js';
import { Rng } from '../../../core/rng.js';

/** 砂・土・芝などのざらついた模様（タイル）。 */
export function grainTexture(base, dots, { size = 256, n = 2600, repeat = 40, seed = 7 } = {}) {
  const rng = new Rng(seed);
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = dots[i % dots.length];
      g.globalAlpha = rng.range(0.15, 0.5);
      const r = rng.range(0.6, 1.8);
      g.fillRect(rng.range(0, w), rng.range(0, h), r, r);
    }
    g.globalAlpha = 1;
  }, { repeat: [repeat, repeat] });
}

/**
 * 地面の板。heightAt(x, z) で高さ、colorAt(x, z, c) で頂点の色（THREE.Color に入れる）を決める。
 * 範囲は x0..x1、z0..z1。
 */
export function terrain({ x0, x1, z0, z1, nx = 120, nz = 90, heightAt, colorAt, map, rough = 0.95 }) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt ? heightAt(x, z) : 0);
    c.set('#ffffff');
    colorAt?.(x, z, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: rough }));
  m.receiveShadow = true;
  m.name = 'terrain';
  return m;
}

/** 水平線の島・岬（低い緑の丘）。 */
export function islands(list) {
  const g = new THREE.Group();
  g.name = 'islands';
  const m = matte('#6f9f8a', 1);
  const m2 = matte('#8fb39a', 1);
  for (const [x, z, w, h, k] of list) {
    const geo = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const s = new THREE.Mesh(geo, k ? m2 : m);
    s.scale.set(w, h, w * 0.45);
    s.position.set(x, -0.5, z);
    g.add(s);
  }
  return g;
}

/** 松の木（日本の海辺）。重ねた平たい葉のかたまり。 */
export function pineGeometry(rng) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.09, 0.14, 2.6, 7);
  trunk.translate(0, 1.3, 0);
  trunk.rotateZ(rng.range(-0.18, 0.18));
  parts.push(colorize(trunk, '#7a5a44'));
  const layers = rng.int(3, 4);
  for (let i = 0; i < layers; i++) {
    const r = rng.range(0.7, 1.1) * (1 - i * 0.12);
    const leaf = new THREE.SphereGeometry(r, 9, 6);
    leaf.scale(1, 0.38, 0.9);
    leaf.translate(rng.range(-0.5, 0.5), 2.0 + i * 0.55, rng.range(-0.3, 0.3));
    parts.push(colorize(leaf, i % 2 ? '#3f7a4f' : '#4c8a58'));
  }
  return mergeGeometries(parts);
}

/** 丸い木（公園）。 */
export function roundTreeGeometry(rng, h = 2.4) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.15, h, 7);
  trunk.translate(0, h / 2, 0);
  parts.push(colorize(trunk, '#8a6448'));
  for (let i = 0; i < 4; i++) {
    const r = rng.range(0.7, 1.0);
    const b = new THREE.IcosahedronGeometry(r, 1);
    b.translate(rng.range(-0.5, 0.5), h + rng.range(-0.1, 0.6), rng.range(-0.5, 0.5));
    parts.push(colorize(b, ['#5fa860', '#6bb86a', '#4f9a55'][i % 3]));
  }
  return mergeGeometries(parts);
}

/** ビーチパラソル（色の違う布）。 */
export function beachUmbrella(colA, colB, rng) {
  const g = new THREE.Group();
  const N = 8, R = rng ? rng.range(0.9, 1.15) : 1;
  const parts = { a: [], b: [] };
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.32, 0, Math.cos(a1) * R, 0, Math.sin(a1) * R, Math.cos(a0) * R, 0, Math.sin(a0) * R], 3));
    geo.computeVertexNormals();
    (i % 2 ? parts.b : parts.a).push(geo);
  }
  const ma = matte(colA, 0.8, { side: THREE.DoubleSide }), mb = matte(colB, 0.8, { side: THREE.DoubleSide });
  const ca = new THREE.Mesh(mergeGeometries(parts.a), ma), cb = new THREE.Mesh(mergeGeometries(parts.b), mb);
  ca.position.y = cb.position.y = 1.9;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), matte('#f4f0e8', 0.6));
  pole.position.y = 1.1;
  g.add(ca, cb, pole);
  return g;
}

/** 頂点色を付ける（mergeGeometries で 1 つにまとめる前に）。 */
export function colorize(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

export const vertexColorMat = (rough = 0.85) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough });

/** カモメ（遠くを回る V 字）。update(dt) で羽ばたく。 */
export function gulls(count, rng, area) {
  const g = new THREE.Group();
  g.name = 'gulls';
  g.userData.dynamic = true;
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.5, 0.12, -0.08, -0.45, 0.02, 0.12, 0, 0, 0, 0.5, 0.12, -0.08, 0.45, 0.02, 0.12], 3));
  wing.computeVertexNormals();
  const m = matte('#ffffff', 0.7, { side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < count; i++) {
    const b = new THREE.Mesh(wing, m);
    b.userData = { cx: rng.range(area.x0, area.x1), cz: rng.range(area.z0, area.z1), r: rng.range(4, 12), y: rng.range(area.y0, area.y1), sp: rng.range(0.15, 0.3) * rng.sign(), ph: rng.range(0, 6), flap: rng.range(5, 7) };
    g.add(b);
    birds.push(b);
  }
  let t = 0;
  return {
    root: g,
    update(dt) {
      t += dt;
      for (const b of birds) {
        const u = b.userData;
        const a = u.ph + t * u.sp;
        b.position.set(u.cx + Math.cos(a) * u.r, u.y + Math.sin(t * 0.7 + u.ph) * 0.4, u.cz + Math.sin(a) * u.r);
        b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
        const f = Math.sin(t * u.flap + u.ph);
        b.scale.set(1, 1 + f * 0.9, 1);
      }
    },
  };
}

/** 遠くの人（単純な形をまとめて 1 つの InstancedMesh に）。 */
export function crowd(list, rng) {
  const geo = new THREE.CapsuleGeometry(0.17, 0.75, 4, 8);
  geo.translate(0, 0.55, 0);
  const head = new THREE.SphereGeometry(0.15, 10, 8);
  head.translate(0, 1.18, 0);
  const merged = mergeGeometries([colorize(geo, '#ffffff'), colorize(head, '#ffffff')]);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const inst = new THREE.InstancedMesh(merged, m, list.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  const shirts = ['#ff8a80', '#ffd166', '#80deea', '#a5d6a7', '#ce93d8', '#ffffff', '#90caf9', '#ffab91'];
  list.forEach(([x, z, k = 1], i) => {
    p.set(x, 0, z);
    s.setScalar(k * rng.range(0.85, 1.1));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
    mm.compose(p, q, s);
    inst.setMatrixAt(i, mm);
    inst.setColorAt(i, c.set(rng.pick(shirts)));
  });
  inst.name = 'crowd';
  inst.castShadow = false;
  return inst;
}

export { mergeGeometries, matte, paint, metal };

// ---------------------------------------------------------------- 町の部品
/** 看板の文字のテクスチャ。 */
export function signTex(text, { bg = '#ffffff', fg = '#2d4a6b', w = 512, h = 128, font = '"Mochiy Pop One", "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif', size = 0.62, border = null } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = h * 0.08; g.strokeRect(h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08); }
    g.fillStyle = fg;
    g.font = `${Math.round(h * size)}px ${font}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + h * 0.03, w * 0.92);
  });
}

/** 箱の家（壁・屋根・窓）。窓は夜に光る（userData.windows の材質）。 */
export function house({ w = 4, h = 3, d = 4, wall = '#fff3df', roof = '#e07a5f', roofType = 'flat', windows = 2, floors = 1, glowColor = '#ffd58a' } = {}, rng) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(wall, 0.85));
  body.position.y = h / 2;
  body.receiveShadow = true;
  g.add(body);
  if (roofType === 'gable') {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - 0.2, 0); shape.lineTo(0, h * 0.35); shape.lineTo(w / 2 + 0.2, 0); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false });
    rg.translate(0, 0, -(d + 0.3) / 2);
    const r = new THREE.Mesh(rg, matte(roof, 0.75));
    r.position.y = h;
    g.add(r);
  } else {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.18, d + 0.25), matte(roof, 0.75));
    r.position.y = h + 0.09;
    g.add(r);
  }
  // 窓（前の面 +Z）
  const winM = new THREE.MeshStandardMaterial({ color: '#7fa6c9', roughness: 0.25, metalness: 0.2, emissive: glowColor, emissiveIntensity: 0 });
  g.userData.windows = winM;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < windows; i++) {
      const wx = (i + 0.5) / windows * w - w / 2;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(0.9, w / windows * 0.5), 0.7), winM);
      win.position.set(wx, h * (f + 0.62) / floors, d / 2 + 0.01);
      g.add(win);
    }
  }
  return g;
}

/** 電柱（と横木）。高さ 7m。 */
export function pole() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 7.5, 8), matte('#9aa0a6', 0.8));
  p.position.y = 3.75;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), matte('#6c7177', 0.8));
  bar.position.y = 6.9;
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 10), matte('#7d8287', 0.6));
  tr.position.set(0.25, 6.1, 0);
  g.add(p, bar, tr);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 2 点のあいだに垂れる電線（細い管）。 */
export function wire(a, b, sag = 0.5, color = '#3b3f45') {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4), matte(color, 0.6));
  return m;
}

/** 提灯をひもに並べる（夜に光る）。points の折れ線に沿って、間隔 gap で。 */
export function lanterns(points, { gap = 0.9, colors = ['#ff6b6b', '#ffffff', '#ffd43b'], sag = 0.35, size = 0.16 } = {}) {
  const g = new THREE.Group();
  g.name = 'lanterns';
  const list = [];
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.floor(len / gap));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      list.push({ p, c: colors[(k * 7 + i) % colors.length] });
    }
    g.add(wire(a, b, sag, '#5a4a3a'));
  }
  const geo = new THREE.SphereGeometry(size, 12, 10);
  geo.scale(1, 1.25, 1);
  const byColor = new Map();
  for (const L of list) { if (!byColor.has(L.c)) byColor.set(L.c, []); byColor.get(L.c).push(L.p); }
  const mats = [];
  for (const [c, ps] of byColor) {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.7 });
    mats.push(m);
    const inst = new THREE.InstancedMesh(geo, m, ps.length);
    const mm = new THREE.Matrix4();
    ps.forEach((p, i) => { mm.makeTranslation(p.x, p.y - size, p.z); inst.setMatrixAt(i, mm); });
    g.add(inst);
  }
  g.userData.setGlow = (k) => { for (const m of mats) m.emissiveIntensity = 0.15 + k * 0.85; };
  return g;
}

/** 自動販売機。 */
export function vending(color = '#e63946') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.75), matte(color, 0.5));
  body.position.y = 0.9;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshStandardMaterial({ color: '#dff3ff', emissive: '#bfe6ff', emissiveIntensity: 0.6, roughness: 0.3 }));
  win.position.set(0, 1.25, 0.376);
  // 並んだ缶（色の帯）
  const cans = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.75), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c) => {
    const cols = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#f783ac', '#ffffff'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { c.fillStyle = cols[(i + r * 2) % 6]; c.fillRect(6 + i * 20, 10 + r * 40, 14, 26); }
  }), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.4, transparent: true }));
  cans.position.set(0, 1.25, 0.378);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.05), matte('#2b2d31', 0.6));
  slot.position.set(0, 0.35, 0.39);
  g.add(body, win, cans, slot);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.glow = [win.material, cans.material];
  return g;
}

/** ベンチ。 */
export function bench(color = '#c98b5a') {
  const g = new THREE.Group();
  const wood = matte(color, 0.8), iron = matte('#3b3f45', 0.6);
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.12), wood); s.position.set(0, 0.45, -0.15 + i * 0.14); g.add(s); }
  for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.04), wood); s.position.set(0, 0.62 + i * 0.16, -0.27); g.add(s); }
  for (const x of [-0.7, 0.7]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), iron); l.position.set(x, 0.225, 0); g.add(l); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 魚の箱（積み重ね）。 */
export function crates(rng, n = 6) {
  const parts = [];
  const cols = ['#4dabf7', '#ff6b6b', '#ffd43b', '#69db7c'];
  for (let i = 0; i < n; i++) {
    const b = new THREE.BoxGeometry(0.6, 0.28, 0.42);
    b.translate((i % 3) * 0.62 + rng.range(-0.04, 0.04), 0.14 + Math.floor(i / 3) * 0.29, rng.range(-0.05, 0.05));
    parts.push(colorize(b, rng.pick(cols)));
  }
  const m = new THREE.Mesh(mergeGeometries(parts), vertexColorMat(0.7));
  m.castShadow = true;
  return m;
}

/** 小さな漁船。 */
export function fishingBoat(trim = '#e63946') {
  const g = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.2, 0.0); hullShape.lineTo(1.6, 0.0); hullShape.quadraticCurveTo(2.6, 0.2, 2.8, 0.9); hullShape.lineTo(-2.2, 0.9); hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  hullGeo.translate(0, -0.5, -0.8);
  const hull = new THREE.Mesh(hullGeo, matte('#ffffff', 0.5));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.16, 1.86), matte(trim, 0.5));
  stripe.position.set(0.3, 0.22, 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.0), matte('#f1f3f5', 0.6));
  cabin.position.set(-1.0, 0.85, 0);
  const cabWin = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.3, 0.8), matte('#3b5a78', 0.2));
  cabWin.position.set(-1.0, 1.05, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), matte('#dee2e6'));
  mast.position.set(-1.0, 2.2, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), matte(trim, 0.7, { side: THREE.DoubleSide }));
  flag.position.set(-0.75, 3.1, 0);
  g.add(hull, stripe, cabin, cabWin, mast, flag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 防波堤の灯台（赤か白）。 */
export function smallLighthouse(color = '#e63946') {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.0, 16), matte('#dee2e6', 0.8));
  base.position.y = 0.5;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 5, 16), matte(color, 0.6));
  tower.position.y = 3.5;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 16), matte('#ffffff', 0.6));
  deck.position.y = 6.1;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 12), new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: '#ffe066', emissiveIntensity: 0.5 }));
  lamp.position.y = 6.55;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 12), matte(color, 0.6));
  cap.position.y = 7.15;
  g.add(base, tower, deck, lamp, cap);
  g.userData.lamp = lamp.material;
  return g;
}

/** 店の正面（+Z を向く）：壁・ひさし（縞）・看板・明かりのついたショーウィンドウ。glow は夕方・夜に光らせる材質の配列へ入れる。 */
export function shopFront({ w = 5, h = 4, d = 5, wall = '#fff3df', awning = '#ff6b6b', awning2 = '#ffffff', sign = 'おみせ', signBg = '#ffffff', signFg = '#2d4a6b', goods = null } = {}, glow = []) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(wall, 0.85));
  body.position.y = h / 2;
  body.receiveShadow = true;
  g.add(body);
  // 2 階の窓
  const win2 = new THREE.MeshStandardMaterial({ color: '#8fb0cc', roughness: 0.3, emissive: '#ffd58a', emissiveIntensity: 0 });
  glow.push({ m: win2, k: 0.9 });
  for (let i = 0; i < 2; i++) {
    const wq = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, h * 0.18), win2);
    wq.position.set((i - 0.5) * w * 0.45, h * 0.8, d / 2 + 0.01);
    g.add(wq);
  }
  // 1 階：明るい店の中
  const shop = new THREE.MeshStandardMaterial({ color: '#f8e7c8', roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0.15 });
  glow.push({ m: shop, k: 0.8, base: 0.12 });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.42), shop);
  front.position.set(0, h * 0.23, d / 2 + 0.012);
  g.add(front);
  // ひさし（縞の布）
  const stripes = canvasTex(256, 64, (c, W, H) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? awning2 : awning; c.fillRect((i / 8) * W, 0, W / 8, H); } c.fillStyle = awning; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc((i + 0.5) * W / 8, H, W / 16, Math.PI, 0); c.fill(); } });
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.95, 1.0), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8, side: THREE.DoubleSide }));
  aw.position.set(0, h * 0.5, d / 2 + 0.45);
  aw.rotation.x = -0.95;
  aw.castShadow = true;
  g.add(aw);
  // 看板
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.7), new THREE.MeshStandardMaterial({ map: signTex(sign, { bg: signBg, fg: signFg }), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0 }));
  sb.material.emissiveMap = sb.material.map;
  glow.push({ m: sb.material, k: 0.3 });
  sb.position.set(0, h * 0.62, d / 2 + 0.02);
  g.add(sb);
  // 店先の品（八百屋の箱など）
  if (goods) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.BoxGeometry(0.55, 0.22, 0.4);
      b.translate(-w * 0.35 + i * 0.6, 0.65 + (i % 2) * 0.02, d / 2 + 0.5);
      parts.push(colorize(b, '#c9a36a'));
      for (let j = 0; j < 5; j++) {
        const f = new THREE.SphereGeometry(0.08, 8, 6);
        f.translate(-w * 0.35 + i * 0.6 + (j - 2) * 0.09, 0.82, d / 2 + 0.5 + (j % 2) * 0.08);
        parts.push(colorize(f, goods[i % goods.length]));
      }
    }
    const stand = new THREE.BoxGeometry(w * 0.8, 0.55, 0.5);
    stand.translate(0, 0.27, d / 2 + 0.5);
    parts.push(colorize(stand, '#8a6448'));
    const m = new THREE.Mesh(mergeGeometries(parts), vertexColorMat(0.7));
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** お祭りの屋台（+Z を向く）：骨組み・縞の屋根・のれん・看板・裸電球。 */
export function yatai({ sign = 'たこ焼き', roof = '#e03131', roof2 = '#ffffff', w = 2.6 } = {}, glow = []) {
  const g = new THREE.Group();
  const frame = matte('#8a6448', 0.8);
  for (const [x, z] of [[-w / 2, -0.8], [w / 2, -0.8], [-w / 2, 0.8], [w / 2, 0.8]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), frame);
    p.position.set(x, 1.2, z);
    g.add(p);
  }
  const stripes = canvasTex(128, 32, (c, W, H) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? roof2 : roof; c.fillRect((i / 8) * W, 0, W / 8, H); } });
  const rm = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, 1.1), rm);
    r.position.set(0, 2.62, s * 0.42);
    r.rotation.x = s * -1.05;
    g.add(r);
  }
  const counter = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.6), matte('#c9a36a', 0.8));
  counter.position.set(0, 0.45, 0.55);
  g.add(counter);
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.55), new THREE.MeshStandardMaterial({ map: signTex(sign, { bg: '#ffffff', fg: roof }), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.2 }));
  sb.material.emissiveMap = sb.material.map;
  glow.push({ m: sb.material, k: 0.38, base: 0.08 });
  sb.position.set(0, 2.25, 0.85);
  g.add(sb);
  // のれん（短い布を 3 枚）
  for (let i = 0; i < 3; i++) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, 0.4), matte(roof, 0.8, { side: THREE.DoubleSide }));
    n.position.set((i - 1) * w * 0.31, 1.8, 0.83);
    g.add(n);
  }
  // 裸電球
  const bulbM = new THREE.MeshStandardMaterial({ color: '#fff3bf', emissive: '#ffd36a', emissiveIntensity: 0.4 });
  glow.push({ m: bulbM, k: 2.2, base: 0.3 });
  for (const x of [-w * 0.3, w * 0.3]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bulbM);
    b.position.set(x, 1.95, 0.45);
    g.add(b);
  }
  // 中の明かり
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.2), new THREE.MeshStandardMaterial({ color: '#7a4a2a', emissive: '#ff9a4a', emissiveIntensity: 0.3, roughness: 0.9 }));
  glow.push({ m: inner.material, k: 0.45, base: 0.15 });
  inner.position.set(0, 1.4, -0.75);
  g.add(inner);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 光る材質の配列を、時間帯で明るくする（k が強さ、base が昼の値）。 */
export function setGlow(list, on) { for (const G of list) G.m.emissiveIntensity = (G.base || 0) + (G.k || 1) * on; }
