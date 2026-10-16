// 移動アイス屋台「しろくま号」：電動三輪の運転台（-X 側）＋荷台のアイスのカウンター＋大きな縞のパラソル。
// カウンターには 8 つのアイスの槽（Tubs が中身を描く）、コーン立て、トッピング、コーンとカップの置き場。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, paint, matte, metal, glass, rubber, glow, canvasTex, roundRect, FONT_POP, FONT_UI, shadows } from './materials.js';
import { COUNTER_Y, BODY, WELL, TUB, tubCenter, STAND, CONE_RACK, CUP_RACK, DIPPER_WELL } from '../layout.js';

export const CART_COLORS = { mint: '#7fd6c2', mintDark: '#4fb8a4', cream: '#fff3df', pink: '#ff9eb5', navy: '#2d4a6b' };

function box(w, h, d, m, r = 0.02, seg = 3) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), m);
}

/** 前の面の看板（しろくまの顔と「しろくま号」）。 */
function signTexture() {
  return canvasTex(1024, 384, (g, w, h) => {
    g.fillStyle = CART_COLORS.cream; g.fillRect(0, 0, w, h);
    // 下の波模様
    g.fillStyle = CART_COLORS.mint;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.78 + Math.sin(x / 40) * 10);
    g.lineTo(w, h); g.fill();
    // しろくまの顔
    const cx = 170, cy = 170;
    g.fillStyle = '#ffffff'; g.strokeStyle = CART_COLORS.navy; g.lineWidth = 10;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 78, cy - 78, 34, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.beginPath(); g.arc(cx, cy, 110, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = CART_COLORS.navy;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 42, cy - 12, 12, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.ellipse(cx, cy + 30, 22, 15, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7; g.beginPath(); g.moveTo(cx, cy + 44); g.lineTo(cx, cy + 62);
    g.arc(cx - 16, cy + 62, 16, 0, Math.PI, false); g.moveTo(cx + 32, cy + 62); g.arc(cx + 16, cy + 62, 16, 0, Math.PI, false); g.stroke();
    g.fillStyle = CART_COLORS.pink; g.globalAlpha = 0.55;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 70, cy + 28, 18, 11, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    // 文字：くまの右の幅（x = 320〜990）に収まる大きさで描く（はみ出すと看板の端で切れる）
    const fit = (text, font, size, maxW) => {
      let px = size;
      g.font = font(px);
      while (px > 20 && g.measureText(text).width > maxW) { px -= 2; g.font = font(px); }
      return px;
    };
    const X0 = 320, W = 990 - X0;
    g.textBaseline = 'middle';
    g.fillStyle = CART_COLORS.navy;
    fit('しろくま号', (px) => `${px}px ${FONT_POP}`, 140, W);
    g.fillText('しろくま号', X0, 150);
    g.fillStyle = CART_COLORS.mintDark;
    fit('ICE CREAM・アイスクリーム', (px) => `bold ${px}px ${FONT_UI}`, 58, W - 10);
    g.fillText('ICE CREAM・アイスクリーム', X0 + 6, 262);
  });
}

/** パラソル：交互の色の布（12 枚）、ふちのひだ、てっぺんの飾り。 */
function parasol(colA, colB) {
  const g = new THREE.Group();
  g.name = 'parasol';
  const N = 12, R = 1.32, H = 0.34;
  const mA = matte(colA, 0.75, { side: THREE.DoubleSide }), mB = matte(colB, 0.75, { side: THREE.DoubleSide });
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const pos = [];
    const S = 8; // 半径方向の分割（布の少しのたわみ）
    for (let s = 0; s < S; s++) {
      const r0 = (s / S) * R, r1 = ((s + 1) / S) * R;
      const y0 = H - (s / S) * H - Math.sin((s / S) * Math.PI) * 0.03, y1 = H - ((s + 1) / S) * H - Math.sin(((s + 1) / S) * Math.PI) * 0.03;
      const sag = (r) => 1 - 0.035 * (r / R); // 骨と骨の間はへこむ
      const am = (a0 + a1) / 2;
      const p = (r, y, a, k) => [Math.cos(a) * r * k, y - (k < 1 ? 0.012 * (r / R) : 0), Math.sin(a) * r * k];
      const A = p(r0, y0, a0, 1), B = p(r1, y1, a0, 1), C = p(r1, y1, am, sag(r1)), D = p(r0, y0, am, sag(r0));
      const E = p(r1, y1, a1, 1), F = p(r0, y0, a1, 1);
      pos.push(...A, ...B, ...C, ...A, ...C, ...D, ...D, ...C, ...E, ...D, ...E, ...F);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    // 下向きの面が外側（上）を向くように頂点の順をそろえたので、法線を上に
    const m = new THREE.Mesh(geo, i % 2 ? mB : mA);
    m.name = 'cloth' + i;
    g.add(m);
    // ふちのひだ（垂れ）
    const val = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.995, R * 0.995, 0.09, 6, 1, true, -a1 + Math.PI / 2, a1 - a0), i % 2 ? mA : mB);
    val.position.y = -0.045;
    val.name = 'valance' + i;
    g.add(val);
  }
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), paint(CART_COLORS.pink, 0.3));
  fin.position.y = H + 0.03;
  fin.name = 'finial';
  g.add(fin);
  // ふちの電球（夜に光る）
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), glow('#ffd88a', 0), 24);
  bulbs.name = 'bulbs';
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 0.13;
    mm.makeTranslation(Math.cos(a) * R * 0.99, -0.1, Math.sin(a) * R * 0.99);
    bulbs.setMatrixAt(i, mm);
  }
  g.add(bulbs);
  g.userData.bulbs = bulbs;
  return g;
}

function wheel(r = 0.19, w = 0.11) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r - 0.045, 0.048, 12, 28), rubber());
  tire.name = 'tire';
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.06, r - 0.06, w * 0.7, 24), paint(CART_COLORS.cream, 0.35));
  hub.rotation.x = Math.PI / 2;
  hub.name = 'hub';
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = w * 0.35;
  cap.name = 'cap';
  g.add(tire, hub, cap);
  return g;
}

export class Cart {
  constructor() {
    const root = (this.root = new THREE.Group());
    root.name = 'cart';
    const C = CART_COLORS;
    const mint = paint(C.mint), cream = paint(C.cream), navy = paint(C.navy, 0.5);
    const steel = mat('steelTop', () => new THREE.MeshStandardMaterial({ color: '#d5d9dc', roughness: 0.48, metalness: 0.55 })), steelDark = metal('#9aa4ad', 0.45);

    // ---------------- 荷台の箱（カウンター）
    const bw = BODY.x1 - BODY.x0, bd = BODY.z1 - BODY.z0, bh = COUNTER_Y - BODY.y0;
    const cx = (BODY.x0 + BODY.x1) / 2;
    const lower = box(bw, bh * 0.55, bd, mint, 0.04);
    lower.position.set(cx, BODY.y0 + bh * 0.275, 0);
    lower.name = 'bodyLower';
    // 上の段は天板の下で止める（天板と同じ高さに面があると、ちらつく）
    const uh = bh * 0.47 - 0.024;
    const upper = box(bw, uh, bd, cream, 0.04);
    upper.position.set(cx, COUNTER_Y - 0.022 - uh / 2, 0);
    upper.name = 'bodyUpper';
    root.add(lower, upper);
    // 前の看板（お客さんの側）
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.4), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }));
    sign.position.set(cx, BODY.y0 + bh * 0.52, BODY.z1 + 0.003);
    sign.name = 'sign';
    root.add(sign);
    // 縁取り（ミントの帯）
    const trim = box(bw + 0.02, 0.03, bd + 0.02, paint(C.mintDark), 0.012);
    trim.position.set(cx, COUNTER_Y - 0.04, 0);
    trim.name = 'trim';
    root.add(trim);

    // 天板（ステンレス）：槽の穴をあけるので 4 枚に分けて作る
    const topT = 0.022, ty = COUNTER_Y - topT / 2;
    const slab = (x0, x1, z0, z1, name) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, topT, z1 - z0), steel);
      m.position.set((x0 + x1) / 2, ty, (z0 + z1) / 2);
      m.name = name;
      root.add(m);
    };
    slab(BODY.x0, WELL.x0, BODY.z0, BODY.z1, 'topLeft');
    slab(WELL.x1, BODY.x1, BODY.z0, BODY.z1, 'topRight');
    slab(WELL.x0, WELL.x1, BODY.z0, WELL.z0, 'topBack');
    slab(WELL.x0, WELL.x1, WELL.z1, BODY.z1, 'topFront');
    // 槽（冷えた内側）
    const wellIn = new THREE.Mesh(new THREE.BoxGeometry(WELL.x1 - WELL.x0, WELL.depth, WELL.z1 - WELL.z0), new THREE.MeshStandardMaterial({ color: '#b9c6cf', roughness: 0.35, metalness: 0.6, side: THREE.BackSide }));
    wellIn.position.set((WELL.x0 + WELL.x1) / 2, COUNTER_Y - WELL.depth / 2, (WELL.z0 + WELL.z1) / 2);
    wellIn.name = 'wellInside';
    root.add(wellIn);
    // 容器（ステンレスのバット）8 つ。中身のアイスは Tubs が描く
    this.tubFrames = [];
    const wallM = new THREE.MeshStandardMaterial({ color: '#c4ccd3', roughness: 0.3, metalness: 0.8, side: THREE.BackSide });
    for (let i = 0; i < TUB.cols * TUB.rows; i++) {
      const p = tubCenter(i);
      const frame = new THREE.Group();
      frame.position.copy(p);
      frame.name = 'tub' + i;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(TUB.w + 0.008, 0.008, TUB.d + 0.008), steelDark);
      rim.position.y = -0.004;
      // ふちは枠だけに見えるよう、中を抜いた形にする
      const rimGeo = new THREE.ShapeGeometry(rectRing(TUB.w + 0.012, TUB.d + 0.012, TUB.w - 0.004, TUB.d - 0.004));
      rimGeo.rotateX(-Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, steel);
      rimMesh.position.y = 0.001;
      rimMesh.name = 'rim';
      const wall = new THREE.Mesh(new THREE.BoxGeometry(TUB.w, 0.1, TUB.d), wallM);
      wall.position.y = -0.05;
      wall.name = 'wall';
      frame.add(rimMesh, wall);
      root.add(frame);
      this.tubFrames.push(frame);
    }
    // ガラスのふた（奥に開けてある）
    const lid = new THREE.Mesh(new THREE.BoxGeometry(WELL.x1 - WELL.x0 + 0.02, 0.006, 0.17), glass());
    lid.position.set((WELL.x0 + WELL.x1) / 2, COUNTER_Y + 0.13, WELL.z0 - 0.05);
    lid.rotation.x = -1.25;
    lid.name = 'lid';
    lid.visible = false;
    root.add(lid);

    // コーン立て（塔の土台）
    const stand = new THREE.Group();
    stand.position.copy(STAND);
    stand.name = 'stand';
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.012, 24), steel);
    foot.position.y = 0.006;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.055, 8), steel);
    post.position.y = 0.035;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 8, 24), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.062;
    stand.add(foot, post, ring);
    root.add(stand);
    this.stand = stand;

    // コーンとカップの置き場（右の端）
    const coneTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 20, 1, true), glass());
    coneTube.position.copy(CONE_RACK).add(new THREE.Vector3(0, 0.1, 0));
    coneTube.name = 'coneTube';
    root.add(coneTube);
    this.coneRackTop = CONE_RACK.clone().add(new THREE.Vector3(0, 0.2, 0));
    // ディッシャーの水入れ（ステンレスの筒に水）
    const wellCup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.09, 20, 1, true), steel);
    wellCup.position.copy(DIPPER_WELL).add(new THREE.Vector3(0, 0.045, 0));
    wellCup.name = 'dipperWell';
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshPhysicalMaterial({ color: '#bfe9ff', roughness: 0.05, transparent: true, opacity: 0.7, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.copy(DIPPER_WELL).add(new THREE.Vector3(0, 0.075, 0));
    root.add(wellCup, water);
    // コーンの束（筒の中）とカップの重ね
    const coneStack = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.11, 18, 1, true), matte('#d99a52', 0.85));
      c.rotation.x = Math.PI;
      c.position.y = 0.06 + i * 0.022;
      coneStack.add(c);
    }
    coneStack.position.copy(CONE_RACK);
    coneStack.name = 'coneStack';
    const cupStack = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.06, 18, 1, true), matte(i % 2 ? '#ff9eb5' : '#fff6ea', 0.6, { side: THREE.DoubleSide }));
      c.position.y = 0.03 + i * 0.012;
      cupStack.add(c);
    }
    cupStack.position.copy(CUP_RACK);
    cupStack.name = 'cupStack';
    root.add(coneStack, cupStack);
    this.cupRackTop = CUP_RACK.clone().add(new THREE.Vector3(0, 0.12, 0));

    // ---------------- 運転台（-X 側）
    const cab = new THREE.Group();
    cab.name = 'cab';
    const cabBody = box(0.82, 0.62, 0.74, mint, 0.12, 5);
    cabBody.position.set(-0.98, 0.64, 0);
    cabBody.name = 'cabBody';
    const cabTop = box(0.74, 0.46, 0.72, cream, 0.16, 5);
    cabTop.position.set(-1.02, 1.16, 0);
    cabTop.name = 'cabTop';
    // 窓
    const win = paint('#3b5a78', 0.15, { clearcoat: 1 });
    const front = box(0.02, 0.32, 0.6, win, 0.01);
    front.position.set(-1.39, 1.16, 0);
    front.rotation.z = -0.12;
    front.name = 'windshield';
    const sideL = box(0.42, 0.28, 0.02, win, 0.01);
    sideL.position.set(-1.0, 1.17, -0.361);
    sideL.name = 'windowL';
    const sideR = sideL.clone();
    sideR.position.z = 0.361;
    sideR.name = 'windowR';
    const backWin = box(0.02, 0.24, 0.46, win, 0.01);
    backWin.position.set(-0.645, 1.18, 0);
    backWin.name = 'windowBack';
    // くまの耳（屋根）
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), cream);
      ear.scale.set(1, 1, 0.55);
      ear.position.set(-1.05, 1.42, 0.24 * s);
      ear.name = s < 0 ? 'earL' : 'earR';
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), paint(C.pink, 0.5));
      inner.scale.set(1, 1, 0.4);
      inner.position.set(-1.05, 1.42, 0.24 * s);
      inner.translateX(-0.035);
      inner.name = 'earInner';
      cab.add(ear, inner);
    }
    // 前の顔（目・鼻）とライト
    const eyeM = paint(C.navy, 0.3);
    for (const s of [-1, 1]) {
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 20), glow('#fff6d8', 0.5));
      light.rotation.z = Math.PI / 2;
      light.position.set(-1.4, 0.72, 0.22 * s);
      light.name = 'headlight';
      const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 20), metal());
      rimL.rotation.y = Math.PI / 2;
      rimL.position.copy(light.position).add(new THREE.Vector3(-0.012, 0, 0));
      cab.add(light, rimL);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), eyeM);
    nose.scale.set(0.6, 0.8, 1.2);
    nose.position.set(-1.4, 0.55, 0);
    nose.name = 'nose';
    const bumper = box(0.08, 0.08, 0.76, steel, 0.03);
    bumper.position.set(-1.42, 0.38, 0);
    bumper.name = 'bumper';
    cab.add(cabBody, cabTop, front, sideL, sideR, backWin, nose, bumper);
    // 屋根の看板：大きなアイス
    const bigCone = new THREE.Group();
    bigCone.name = 'roofCone';
    const coneM = matte('#e0a35c', 0.7);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 20), coneM);
    cone.rotation.x = Math.PI;
    cone.position.y = 0.15;
    const scoops = [['#ff9eb5', 0.36], ['#fff6e6', 0.5], ['#8fd6ff', 0.63]];
    bigCone.add(cone);
    for (const [col, y] of scoops) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), matte(col, 0.6));
      s.position.y = y;
      s.scale.y = 0.85;
      bigCone.add(s);
    }
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), paint('#e8213f', 0.2));
    cherry.position.y = 0.75;
    bigCone.add(cherry);
    bigCone.position.set(-0.9, 1.4, 0);
    bigCone.rotation.z = -0.15;
    cab.add(bigCone);
    root.add(cab);
    this.cab = cab;

    // 車輪
    this.wheels = [];
    for (const [x, z, flip] of [[0.18, -0.36, 1], [0.18, 0.36, 0], [-1.18, 0.0, 0]]) {
      const w = wheel();
      w.position.set(x, 0.19, z);
      if (flip) w.rotation.y = Math.PI;
      w.name = 'wheel';
      root.add(w);
      this.wheels.push(w);
    }
    // 車輪の覆い
    for (const z of [-0.36, 0.36]) {
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.13, 20, 1, true, 0, Math.PI), mint);
      fender.rotation.z = Math.PI / 2;
      fender.rotation.y = Math.PI / 2;
      fender.position.set(0.18, 0.2, z);
      fender.name = 'fender';
      root.add(fender);
    }
    // 下回り
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), steelDark);
    chassis.position.set(-0.4, 0.3, 0);
    chassis.name = 'chassis';
    root.add(chassis);

    // ---------------- パラソル
    // パラソルは高めに（調理のカメラが布の下から見上げる形にならないように）
    const PH = 2.05;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, PH, 10), metal('#f4f4f4', 0.35));
    pole.position.set(-0.47, COUNTER_Y + PH / 2, -0.29);
    pole.name = 'pole';
    root.add(pole);
    const umb = parasol(C.mint, '#ffffff');
    umb.position.set(-0.47, COUNTER_Y + PH, -0.29);
    umb.rotation.set(0.08, 0, -0.1);
    umb.scale.setScalar(1.12);
    root.add(umb);
    this.parasol = umb;

    // 小さな飾り：ベルと旗
    // 旗は運転台の屋根の後ろの角に（カウンターの前だとお客さんの顔にかかる）
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 6), metal());
    flagPole.position.set(-0.7, 1.62, -0.3);
    flagPole.name = 'flagPole';
    const flag = new THREE.Group();
    const fm = new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.8 });
    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), fm);
    f1.position.x = 0.11;
    const f2 = f1.clone();
    f2.rotation.y = Math.PI;
    f2.position.x = 0.11;
    f2.position.z = -0.001;
    flag.add(f1, f2);
    flag.position.set(-0.7, 1.81, -0.3);
    flag.name = 'flag';
    root.add(flagPole, flag);
    this.flag = flag;

    shadows(root);
    sign.receiveShadow = true;
    for (const m of [lid, coneTube]) m.castShadow = false;
    this.time = 0;
  }

  setNight(on) {
    const b = this.parasol.userData.bulbs;
    b.visible = on;
    b.material.emissiveIntensity = 3.2;
  }

  update(dt) {
    this.time += dt;
    // 旗がなびく
    this.flag.rotation.y = Math.sin(this.time * 2.3) * 0.25;
  }
}

/** 外側 w×h、内側 iw×ih の四角い輪。 */
function rectRing(w, h, iw, ih) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-iw / 2, -ih / 2); hole.lineTo(-iw / 2, ih / 2); hole.lineTo(iw / 2, ih / 2); hole.lineTo(iw / 2, -ih / 2); hole.closePath();
  s.holes.push(hole);
  return s;
}

function flagTexture() {
  return canvasTex(256, 150, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = CART_COLORS.pink;
    roundRect(g, 0, 0, w, h, 0); g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold 64px ${FONT_POP}`;
    g.fillText('アイス', w / 2, h / 2 + 4);
  });
}
