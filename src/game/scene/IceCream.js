// アイスの見た目：すくった玉（下のふちのひだ・でこぼこ）、やわらかい光り方、溶けると垂れて艶が出る。
// コーン（ワッフル模様）とカップも。
//
// 材質は MeshPhysicalMaterial に onBeforeCompile で次を足す（玉ごとに uniforms を持つ。プログラムは共有）：
//   頂点：溶け（下が垂れて広がる）　ピクセル：味の色の筋と粒、細かいでこぼこ（法線）、縁がほんのり明るい（光が透けるように）
// NaN よけ：normalize は長さ 0 を避け、pow の底は max(x, 0.0)。
import * as THREE from 'three';
import { FLAVORS } from '../data/flavors.js';
import { canvasTex } from './materials.js';
import { Rng } from '../../core/rng.js';

const NOISE = /* glsl */ `
  float ih3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float in3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(ih3(i), ih3(i + vec3(1, 0, 0)), f.x), mix(ih3(i + vec3(0, 1, 0)), ih3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(ih3(i + vec3(0, 0, 1)), ih3(i + vec3(1, 0, 1)), f.x), mix(ih3(i + vec3(0, 1, 1)), ih3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float ifbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * in3(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
`;

/** 味の材質。opts.tub = true ならケースの表面用（溶けで垂れない）。 */
export function iceMaterial(flavorId, opts = {}) {
  const F = FLAVORS[flavorId] || FLAVORS.vanilla;
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.62, metalness: 0,
    sheen: 0.5, sheenRoughness: 0.55, sheenColor: new THREE.Color(F.b).lerp(new THREE.Color('#ffffff'), 0.5),
    clearcoat: 0, clearcoatRoughness: 0.3,
  });
  m.name = 'ice:' + flavorId;
  const u = (m.userData.u = {
    uColA: { value: new THREE.Color(F.a) },
    uColB: { value: new THREE.Color(F.b) },
    uSpeck: { value: new THREE.Color(F.speck) },
    uSpeckAmt: { value: F.speckAmt },
    uSpeckScale: { value: F.speckScale },
    uSwirl: { value: F.swirl },
    uSeed: { value: opts.seed ?? Math.random() * 50 },
    uMelt: { value: 0 },
    uBumpAmt: { value: opts.tub ? 0.6 : 1.0 },
    uSag: { value: opts.tub ? 0 : 1 },
    uScale: { value: opts.scale ?? 1 },   // 模様の大きさ（ケースの表面は大きな座標なので小さく）
  });
  m.userData.flavor = flavorId;
  m.userData.baseRough = 0.62 - (F.gloss || 0);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uMelt, uSeed, uSag, uScale;
        varying vec3 vObj; varying vec3 vObjN;
        ${NOISE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObj = position * uScale;
        vObjN = normal;
        if (uSag > 0.5 && uMelt > 0.0) {
          float low = smoothstep(0.25, -0.95, position.y);
          float wob = in3(position * 3.0 + uSeed);
          transformed.y -= uMelt * (0.32 * low * (0.7 + 0.6 * wob)) + uMelt * 0.08;
          transformed.xz *= 1.0 + uMelt * 0.22 * low;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uColA, uColB, uSpeck;
        uniform float uSpeckAmt, uSpeckScale, uSwirl, uSeed, uMelt, uBumpAmt;
        uniform mat3 normalMatrix; // 頂点シェーダーと同じもの（物体の座標 → 見た目の座標）
        varying vec3 vObj; varying vec3 vObjN;
        ${NOISE}
        float iceH(vec3 p) { return ifbm(p * 7.0 + uSeed) * 0.7 + in3(p * 23.0 + uSeed * 1.7) * 0.3; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vObj;
          float sw = ifbm(p * 2.6 + vec3(uSeed));
          float streak = smoothstep(0.38, 0.72, sw + sin(p.y * 9.0 + sw * 6.0) * 0.08);
          vec3 base = mix(uColA, uColB, streak * uSwirl);
          float sp = in3(p * uSpeckScale + uSeed * 3.1);
          float speck = smoothstep(0.86 - uSpeckAmt * 0.12, 0.92 - uSpeckAmt * 0.1, sp) * step(0.01, uSpeckAmt);
          // 1 ピクセルに模様がいくつも入るほど遠いときは、粒を出さない（ざらついて汚れに見えるので）
          float px = length(fwidth(p * uSpeckScale));
          speck *= 1.0 - smoothstep(0.25, 0.7, px);
          base = mix(base, uSpeck, speck * 0.85);
          // 溶けたところは色が少し濃く、なめらかに
          base *= 1.0 - uMelt * 0.08;
          diffuseColor.rgb *= base;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // 細かいでこぼこ：物体の座標での高さの勾配を、見た目の法線にまぜる
          vec3 p = vObj;
          float e = 0.012;
          float h0 = iceH(p);
          vec3 g = vec3(iceH(p + vec3(e, 0, 0)) - h0, iceH(p + vec3(0, e, 0)) - h0, iceH(p + vec3(0, 0, e)) - h0) / e;
          vec3 n0 = normalize(vObjN + vec3(1e-5));
          g -= dot(g, n0) * n0;
          float far = smoothstep(0.08, 0.45, length(fwidth(p * 7.0)));
          float amt = 0.022 * uBumpAmt * (1.0 - uMelt * 0.75) * (1.0 - far * 0.8);
          vec3 gv = normalize(normalMatrix * (g + vec3(1e-6))) * min(length(g) * amt, 0.6);
          normal = normalize(normal - gv);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // 縁がほんのり明るい（光が少し透けるように）
          vec3 Vv = normalize(vViewPosition + vec3(1e-6));
          float rim = pow(max(1.0 - abs(dot(normal, -Vv)), 0.0), 2.5);
          totalEmissiveRadiance += diffuseColor.rgb * rim * 0.12;
        }`);
  };
  m.customProgramCacheKey = () => 'ice-v1';
  return m;
}

// ---------------------------------------------------------------- 玉の形
const geoCache = new Map();
/** すくった玉の形（半径 1）。variant ごとに少しずつ違う。 */
export function scoopGeometry(variant = 0) {
  if (geoCache.has(variant)) return geoCache.get(variant);
  const rng = new Rng(9100 + variant * 77);
  const g = new THREE.SphereGeometry(1, 56, 40);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const ph = rng.range(0, 6.28), ph2 = rng.range(0, 6.28);
  const folds = rng.int(9, 13);
  const skirtY = rng.range(-0.42, -0.32);
  const tilt = rng.range(-0.08, 0.08);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    let r = 1;
    // ふわっとしたでこぼこ
    r += vnoise(v.x * 2.3 + ph, v.y * 2.3, v.z * 2.3 + ph2) * 0.07;
    // 上のほうの巻き込み（ディッシャーで丸めた筋）
    const top = Math.max(0, v.y);
    r += Math.sin(a * 3 + v.y * 6 + ph) * 0.018 * top;
    // 下のふちのひだ（ディッシャーのふちで切れた所が外へはみ出す）
    const band = Math.exp(-Math.pow((v.y - skirtY - Math.sin(a + ph) * tilt) / 0.1, 2));
    const fold = 0.65 + 0.35 * Math.sin(a * folds + vnoise(v.x * 4, 0, v.z * 4) * 3);
    r += band * 0.13 * fold;
    // 底は平たく
    let y = v.y * r;
    if (y < -0.62) y = -0.62 + (y + 0.62) * 0.25;
    v.set(v.x * r, y, v.z * r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  geoCache.set(variant, g);
  return g;
}

function vnoise(x, y, z) {
  // 簡単な値ノイズ（-0.5〜0.5）
  const s = Math.sin(x * 1.7 + Math.sin(y * 2.3 + z * 1.1)) * Math.cos(z * 1.9 + Math.sin(x * 1.3 - y * 0.7)) + Math.sin(y * 2.9 + x * 0.6) * 0.4;
  return s * 0.4;
}

/** 垂れ（しずく）の形：上が細く、先が丸い。長さ 1。 */
let dripGeo = null;
export function dripGeometry() {
  if (dripGeo) return dripGeo;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12; // 0 = 先、1 = 付け根
    const y = -1 + t;
    const r = t < 0.25 ? Math.sin((t / 0.25) * Math.PI * 0.5) * 0.16 + 0.02 : 0.18 - (t - 0.25) * 0.12;
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  dripGeo = new THREE.LatheGeometry(pts, 12);
  return dripGeo;
}

/** すくった 1 つの玉。root を塔の段に置く。r は半径（m）。 */
export class ScoopMesh {
  constructor(flavorId, r, seed = Math.random()) {
    this.flavor = flavorId;
    this.r = r;
    this.root = new THREE.Group();
    this.root.name = 'scoop:' + flavorId;
    const variant = Math.floor(seed * 6) % 6;
    this.mat = iceMaterial(flavorId, { seed: seed * 40 });
    this.mesh = new THREE.Mesh(scoopGeometry(variant), this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.scale.setScalar(r);
    this.mesh.rotation.y = seed * Math.PI * 2;
    this.root.add(this.mesh);
    // 垂れ（溶けると伸びる）
    this.drips = [];
    const rng = new Rng(Math.floor(seed * 1e6));
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(dripGeometry(), this.mat);
      const a = rng.range(0, Math.PI * 2);
      d.userData = { a, k: rng.range(0.6, 1.2), w: rng.range(0.7, 1.1) };
      d.position.set(Math.cos(a) * r * 0.93, -r * 0.3, Math.sin(a) * r * 0.93);
      d.visible = false;
      d.castShadow = false;
      this.root.add(d);
      this.drips.push(d);
    }
    this.melt = 0;
  }

  setMelt(m) {
    this.melt = Math.max(0, Math.min(1, m));
    const u = this.mat.userData.u;
    u.uMelt.value = this.melt;
    this.mat.roughness = this.mat.userData.baseRough - this.melt * 0.4;
    this.mat.clearcoat = this.melt * 0.5;
    const r = this.r;
    for (const d of this.drips) {
      const k = Math.max(0, this.melt * 1.3 - 0.3) * d.userData.k;
      d.visible = k > 0.02;
      if (!d.visible) continue;
      const len = r * (0.18 + k * 0.62);
      const w = r * (0.75 + k * 0.25) * d.userData.w;
      d.scale.set(w, len, w);
      const a = d.userData.a;
      const out = 0.9 + this.melt * 0.16;
      d.position.set(Math.cos(a) * r * out, -r * (0.22 + this.melt * 0.28), Math.sin(a) * r * out);
      // 下の玉の丸みに沿うよう、外へ少し傾ける
      d.rotation.set(-Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25);
    }
  }

  dispose() { this.mat.dispose(); }
}

// ---------------------------------------------------------------- コーンとカップ
let waffleTex = null;
function waffleTexture() {
  if (waffleTex) return waffleTex;
  waffleTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d99a52'; g.fillRect(0, 0, w, h);
    // 格子（斜め）：溝は濃く、山は明るく
    const n = 8;
    g.lineWidth = 9;
    for (let i = -n; i <= n * 2; i++) {
      const x = (i / n) * w;
      g.strokeStyle = '#b8732f';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, h); g.stroke();
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + w, 0); g.stroke();
    }
    g.lineWidth = 2;
    for (let i = -n; i <= n * 2; i++) {
      const x = (i / n) * w + 6;
      g.strokeStyle = 'rgba(255,220,160,0.45)';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, h); g.stroke();
    }
  }, { repeat: [3, 2] });
  return waffleTex;
}

/** ワッフルコーン：先が下。上のふちの高さが 0、先が -h。 */
export function makeCone({ r = 0.042, h = 0.13 } = {}) {
  const g = new THREE.Group();
  g.name = 'cone';
  const tex = waffleTexture();
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 0.85 });
  const geo = new THREE.ConeGeometry(r, h, 32, 6, true);
  geo.rotateX(Math.PI);
  geo.translate(0, -h / 2, 0);
  const cone = new THREE.Mesh(geo, m);
  cone.name = 'coneBody';
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.14, 10, 32), new THREE.MeshStandardMaterial({ color: '#c98a46', roughness: 0.8 }));
  rim.rotation.x = Math.PI / 2;
  rim.name = 'coneRim';
  // 中（上からのぞいたとき）
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 24), new THREE.MeshStandardMaterial({ color: '#b07a3e', roughness: 0.9 }));
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = -0.004;
  g.add(cone, rim, cap);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { topY: 0, height: h, radius: r };
  return g;
}

let cupTex = null;
function cupTexture() {
  if (cupTex) return cupTex;
  cupTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#fff6ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff9eb5';
    for (let i = 0; i < 16; i++) { if (i % 2) g.fillRect((i / 16) * w, 0, w / 16, h); }
    g.fillStyle = '#7fd6c2'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
  });
  return cupTex;
}

/** 紙のカップ：底が -h、ふちが 0。 */
export function makeCup({ r = 0.056, h = 0.07 } = {}) {
  const g = new THREE.Group();
  g.name = 'cup';
  const geo = new THREE.CylinderGeometry(r, r * 0.75, h, 32, 1, true);
  geo.translate(0, -h / 2, 0);
  const side = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cupTexture(), roughness: 0.6, side: THREE.DoubleSide }));
  side.name = 'cupSide';
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(r * 0.75, 24), new THREE.MeshStandardMaterial({ color: '#f4ece0', roughness: 0.7 }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -h + 0.002;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003, 6, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
  rim.rotation.x = Math.PI / 2;
  g.add(side, bottom, rim);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { topY: 0, height: h, radius: r };
  return g;
}
