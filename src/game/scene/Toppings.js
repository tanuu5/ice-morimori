// トッピング：カウンターの前のふちに並ぶ入れ物（スプレーの瓶・チョコソースのボトル・さくらんぼの瓶・ウエハースの箱）と、
// 塔のいちばん上の玉にのせた見た目（スプレーの粒・ソースのかかり・さくらんぼ・ウエハース）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COUNTER_Y } from '../layout.js';
import { canvasTex } from './materials.js';

export const TOP_SPOTS = { sprinkle: [-0.44, 0.235], sauce: [-0.3, 0.24], cherry: [-0.16, 0.235], wafer: [-0.02, 0.24] };
export function topSpot(id, out = new THREE.Vector3()) { const s = TOP_SPOTS[id]; return out.set(s[0], COUNTER_Y, s[1]); }

const SPRINKLE_COLORS = ['#ff6fa8', '#ffd43b', '#4dabf7', '#69db7c', '#ffffff', '#ff922b', '#b197fc'];
const glassM = () => new THREE.MeshPhysicalMaterial({ color: '#e8f8ff', roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false });

let sprinkleGeo = null;
const sGeo = () => sprinkleGeo || (sprinkleGeo = new THREE.CapsuleGeometry(0.0024, 0.007, 2, 6).rotateZ(Math.PI / 2));
let sprinkleMat = null;
const sMat = () => sprinkleMat || (sprinkleMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
export const sauceMat = () => new THREE.MeshPhysicalMaterial({ color: '#4a2412', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 });
// さくらんぼ・ウエハースの材質はみんなで 1 つ（まとめて描けるように）
let _cherryM = null, _stemM = null, _waferM = null;
const cherryMat = () => _cherryM || (_cherryM = new THREE.MeshPhysicalMaterial({ color: '#d8102e', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }));
const stemMat = () => _stemM || (_stemM = new THREE.MeshStandardMaterial({ color: '#5a8a3a', roughness: 0.6 }));

function waferTex() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#efc27c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d29a4f'; g.lineWidth = 3;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, (i / 8) * h); g.lineTo(w, (i / 8) * h); g.stroke(); }
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo((i / 4) * w, 0); g.lineTo((i / 4) * w, h); g.stroke(); }
  });
}

/** さくらんぼ（軸つき）。原点が実の中心。 */
export function makeCherry() {
  const g = new THREE.Group();
  g.name = 'cherry';
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.017, 18, 14), cherryMat());
  fruit.scale.set(1, 0.92, 1);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.012, 0), new THREE.Vector3(0.004, 0.03, 0), new THREE.Vector3(0.014, 0.045, 0.002)]);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.0018, 5), stemMat());
  g.add(fruit, stem);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** ウエハース。原点が下の端。 */
let wTex = null;
export function makeWafer() {
  wTex = wTex || waferTex();
  _waferM = _waferM || new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.75 });
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.062, 0.007, 2, 0.002), _waferM);
  m.geometry.translate(0, 0.031, 0);
  m.castShadow = true;
  m.name = 'wafer';
  return m;
}

/** カウンターの入れ物。tools[id] は手に持って運ぶ道具（スプレーの瓶・ボトル・さくらんぼ・ウエハース）。 */
export class ToppingShelf {
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.name = 'toppings';
    parent.add(this.root);
    this.items = {};
    this.tools = {};
    // スプレーの瓶（ふたに穴）
    {
      const g = new THREE.Group();
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20), glassM());
      jar.position.y = 0.04;
      const inside = new THREE.InstancedMesh(sGeo(), sMat(), 60);
      const mm = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * 6.28, r = Math.random() * 0.024;
        mm.makeRotationFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)).setPosition(Math.cos(a) * r, 0.006 + Math.random() * 0.05, Math.sin(a) * r);
        inside.setMatrixAt(i, mm);
        inside.setColorAt(i, c.set(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]));
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 20), new THREE.MeshStandardMaterial({ color: '#ff6fa8', roughness: 0.4 }));
      cap.position.y = 0.088;
      g.add(jar, inside, cap);
      this.tools.sprinkle = g;
    }
    // チョコソースのボトル
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.1, 18), new THREE.MeshPhysicalMaterial({ color: '#5a2d16', roughness: 0.3, clearcoat: 0.7 }));
      body.position.y = 0.05;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0265, 0.0265, 0.04, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#fff3df', roughness: 0.7 }));
      label.position.y = 0.05;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.035, 16), new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.4 }));
      cap.position.y = 0.117;
      g.add(body, label, cap);
      this.tools.sauce = g;
    }
    // さくらんぼの瓶（中にいくつか）と、運ぶ 1 個
    {
      const g = new THREE.Group();
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.06, 20), glassM());
      jar.position.y = 0.03;
      g.add(jar);
      for (let i = 0; i < 5; i++) {
        const c = makeCherry();
        c.scale.setScalar(0.8);
        c.position.set(Math.cos(i * 1.3) * 0.014, 0.014 + (i % 2) * 0.012, Math.sin(i * 1.3) * 0.014);
        c.rotation.y = i;
        g.add(c);
      }
      this.items.cherryJar = g;
      this.tools.cherry = makeCherry();
    }
    // ウエハースの箱
    {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.045, 0.04, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#7fd6c2', roughness: 0.6 }));
      box.position.y = 0.0225;
      g.add(box);
      for (let i = 0; i < 3; i++) { const w = makeWafer(); w.position.set(-0.018 + i * 0.018, 0.03, 0); w.rotation.z = (i - 1) * 0.12; g.add(w); }
      this.items.waferBox = g;
      this.tools.wafer = makeWafer();
    }
    // 置く
    this.homes = {};
    for (const id of Object.keys(TOP_SPOTS)) {
      const base = new THREE.Group();
      topSpot(id, base.position);
      base.name = 'top-' + id;
      if (id === 'cherry') base.add(this.items.cherryJar);
      else if (id === 'wafer') base.add(this.items.waferBox);
      this.root.add(base);
      this.homes[id] = base;
    }
    for (const [id, tool] of Object.entries(this.tools)) {
      tool.name = 'tool-' + id;
      tool.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.root.add(tool);
      this.toolHome(id, tool.position);
      tool.userData.home = tool.position.clone();
    }
    this.available = Object.keys(TOP_SPOTS);
  }

  /** 道具の置き場（スプレーとソースは入れ物ごと、さくらんぼとウエハースは入れ物の上）。 */
  toolHome(id, out = new THREE.Vector3()) {
    topSpot(id, out);
    if (id === 'cherry') out.y += 0.075;
    if (id === 'wafer') out.y += 0.05;
    return out;
  }

  setAvailable(list) {
    this.available = list.slice();
    for (const id of Object.keys(TOP_SPOTS)) {
      const on = list.includes(id);
      this.homes[id].visible = on;
      this.tools[id].visible = on && (id === 'sprinkle' || id === 'sauce');
    }
  }
}

/** いちばん上の玉にのせたトッピングの見た目。scoop は ScoopMesh。 */
export class ToppingDecor {
  constructor(scoop) {
    this.scoop = scoop;
    this.r = scoop.r;
    this.sprinkles = null;
    this.nSpr = 0;
    this.sauce = null;
    this.sauceAmt = 0;
  }

  /** スプレーの粒を n 個足す（表面の上のほうにくっつく）。 */
  addSprinkles(n) {
    if (!this.sprinkles) {
      this.sprinkles = new THREE.InstancedMesh(sGeo(), sMat(), 160);
      this.sprinkles.count = 0;
      this.sprinkles.castShadow = false;
      this.sprinkles.name = 'sprinkles';
      this.scoop.root.add(this.sprinkles);
    }
    const S = this.sprinkles, r = this.r;
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    for (let i = 0; i < n && S.count < 160; i++) {
      // 上 70° までの向き
      const a = Math.random() * Math.PI * 2, cz = 1 - Math.random() * (1 - Math.cos(1.2));
      const sz = Math.sqrt(1 - cz * cz);
      d.set(Math.cos(a) * sz, cz, Math.sin(a) * sz);
      p.copy(d).multiplyScalar(r * (1.0 + (this.sauce ? 0.05 : 0.01)));
      q.setFromUnitVectors(up, d).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.random() * 6.28));
      mm.compose(p, q, new THREE.Vector3(1, 1, 1));
      S.setMatrixAt(S.count, mm);
      S.setColorAt(S.count, c.set(SPRINKLE_COLORS[Math.floor(Math.random() * SPRINKLE_COLORS.length)]));
      S.count++;
    }
    S.instanceMatrix.needsUpdate = true;
    if (S.instanceColor) S.instanceColor.needsUpdate = true;
    this.nSpr = S.count;
  }

  /** ソースのかかり具合（0〜1）。上からかぶさる殻と、縁の垂れ。 */
  setSauce(amt) {
    amt = Math.max(0, Math.min(1.2, amt));
    if (Math.abs(amt - this.sauceAmt) < 0.02 && this.sauce) return;
    this.sauceAmt = amt;
    const r = this.r;
    if (!this.sauce) {
      this.sauce = new THREE.Group();
      this.sauce.name = 'sauce';
      this.sauceM = sauceMat();
      this.cap = new THREE.Mesh(new THREE.BufferGeometry(), this.sauceM);
      this.cap.castShadow = false;
      this.sauce.add(this.cap);
      this.drips = [];
      for (let i = 0; i < 6; i++) {
        const dr = new THREE.Mesh(new THREE.CapsuleGeometry(1, 1, 3, 8), this.sauceM);
        dr.userData.a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
        dr.userData.k = 0.6 + Math.random() * 0.8;
        this.sauce.add(dr);
        this.drips.push(dr);
      }
      this.scoop.root.add(this.sauce);
    }
    // 殻：上から theta までの球面、縁は波打つ
    const theta = 0.35 + amt * 1.05;
    const g = new THREE.SphereGeometry(r * 1.045, 36, 14, 0, Math.PI * 2, 0, theta);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = Math.acos(Math.max(-1, Math.min(1, v.y / (r * 1.045)))) / theta; // 0 = てっぺん、1 = 縁
      const a = Math.atan2(v.z, v.x);
      const wave = Math.sin(a * 6 + 1.3) * 0.5 + Math.sin(a * 11) * 0.25;
      const k = Math.max(0, t - 0.7) / 0.3;
      v.y -= k * (0.15 + wave * 0.12) * r * amt;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    this.cap.geometry.dispose();
    this.cap.geometry = g;
    const edgeY = Math.cos(theta) * r;
    for (const d of this.drips) {
      const L = Math.max(0, amt - 0.35) * r * 0.9 * d.userData.k;
      d.visible = L > 0.002;
      if (!d.visible) continue;
      const a = d.userData.a, ex = Math.sin(theta) * r * 1.03;
      d.scale.set(r * 0.09, L * 0.5, r * 0.09);
      d.position.set(Math.cos(a) * ex, edgeY - L * 0.4, Math.sin(a) * ex);
    }
  }

  /** さくらんぼを、てっぺんの x（玉の座標）に。 */
  addCherry(x = 0) {
    const c = makeCherry();
    c.position.set(x, this.r * (this.sauce ? 1.06 : 1.0) + 0.012, 0);
    c.rotation.y = Math.random() * 6;
    this.scoop.root.add(c);
    this.cherry = c;
  }

  /** ウエハースを、てっぺんの近くに斜めに刺す。 */
  addWafer(x = 0) {
    const w = makeWafer();
    w.position.set(x * 0.6 + this.r * 0.25, this.r * 0.55, this.r * 0.15);
    w.rotation.set(0.2, Math.random() * 0.6 - 0.3, -0.45);
    this.scoop.root.add(w);
    this.wafer = w;
  }
}
