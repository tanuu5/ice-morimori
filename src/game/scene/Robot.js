// 主人公の AI ロボ「マル」：白い丸い体、黒い画面の顔、紙の帽子、縞のエプロン（後ろにリボン）、ボールの車輪、のびる腕。
// モデルは +Z を向き、足もと（車輪の下）が y = 0。屋台の後ろに立ち、左手（+X 側）でディッシャーを持つ。
//
//   robot.reach('L', worldPos)   左手をそこへ（届かなければ前腕がのびる）。null で下ろす
//   robot.look(worldPos)          顔をそちらへ
//   robot.setFace('happy')        表情（RobotFace の EXPR）
//   robot.say(sec)                口ぱく
//   robot.lift = 0.2              胴を上へのばす（高い塔のとき）
//   robot.hop() / robot.wiggle()  よろこぶ
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RobotFace } from './RobotFace.js';
import { mergeStatic } from './merge.js';
import { canvasTex } from './materials.js';
import { damp, dampAngle, clamp } from '../../core/math.js';

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const m1 = new THREE.Matrix4(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

const UA = 0.17, FA = 0.15, FA_EXT = 0.5; // 上腕・前腕の長さ、前腕がのびる最大

function stripeTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fd6c2';
    for (let i = 0; i < 8; i++) if (i % 2) g.fillRect((i / 8) * w, 0, w / 8, h);
  }, { repeat: [2, 1] });
}

/** 紙の帽子（ソーダファウンテンの店員の、舟の形の帽子）：前後に長いテント形。下の縁にミントの帯（テクスチャ）。 */
function paperHat() {
  const Wd = 0.135, L = 0.175, Hh = 0.12, ridge = 0.14;
  const tri = [
    [-Wd, 0, -L], [-Wd, 0, L], [0, Hh, ridge], [-Wd, 0, -L], [0, Hh, ridge], [0, Hh, -ridge],
    [Wd, 0, L], [Wd, 0, -L], [0, Hh, -ridge], [Wd, 0, L], [0, Hh, -ridge], [0, Hh, ridge],
    [-Wd, 0, L], [Wd, 0, L], [0, Hh, ridge], [Wd, 0, -L], [-Wd, 0, -L], [0, Hh, -ridge],
  ];
  const pos = [], uv = [];
  for (const [x, y, z] of tri) { pos.push(x, y, z); uv.push((z / L) * 0.5 + 0.5, y / Hh); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const tex = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fd6c2'; g.fillRect(0, h * 0.72, w, h * 0.2);
    g.fillStyle = '#ff8fab'; g.fillRect(0, h * 0.66, w, h * 0.04);
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  const hat = new THREE.Mesh(geo, m);
  hat.name = 'hat';
  return hat;
}

export class Robot {
  constructor() {
    const root = (this.root = new THREE.Group());
    root.name = 'robot';
    const white = new THREE.MeshPhysicalMaterial({ color: '#f7f9fb', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18 });
    const mint = new THREE.MeshPhysicalMaterial({ color: '#7fd6c2', roughness: 0.38, clearcoat: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a3340', roughness: 0.5, metalness: 0.3 });
    const joint = new THREE.MeshStandardMaterial({ color: '#c9d2da', roughness: 0.35, metalness: 0.6 });
    const pink = new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.45 });
    this.mats = [white, mint, dark, joint, pink];

    // 車輪（ボール）
    const wheel = (this.wheel = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 18), mint));
    wheel.position.y = 0.15;
    wheel.name = 'wheel';
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 32), white);
    band.rotation.y = Math.PI / 2;
    wheel.add(band);
    const skirt = new THREE.Mesh(new THREE.SphereGeometry(0.18, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), white);
    skirt.position.y = 0.16;
    skirt.name = 'skirt';
    // のびる柱（胴を上げたとき見える）
    const column = (this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1, 16), joint));
    column.name = 'column';
    root.add(wheel, skirt, column);

    // 胴
    const body = (this.body = new THREE.Group());
    body.name = 'body';
    body.position.y = 0.27;
    root.add(body);
    const prof = [[0.001, 0], [0.15, 0.0], [0.2, 0.08], [0.215, 0.22], [0.2, 0.38], [0.15, 0.47], [0.08, 0.52], [0.001, 0.53]].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), white);
    torso.scale.z = 0.86;
    torso.name = 'torso';
    body.add(torso);
    // エプロン（前）と、ひも・リボン（後ろ）
    const apronM = new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.8, side: THREE.DoubleSide });
    this.mats.push(apronM);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.218, 0.2, 0.3, 24, 1, true, -0.95, 1.9), apronM);
    apron.scale.z = 0.88;
    apron.position.y = 0.17;
    apron.rotation.y = 0; // 前（+Z）を中心に
    apron.name = 'apron';
    const bib = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.212, 0.12, 20, 1, true, -0.55, 1.1), apronM);
    bib.scale.z = 0.88;
    bib.position.y = 0.37;
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.06, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.7 }));
    pocket.position.set(0, 0.16, 0.196);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.007, 6, 40), apronM);
    tie.rotation.x = Math.PI / 2;
    tie.scale.y = 0.87;
    tie.position.y = 0.24;
    const bow = new THREE.Group();
    bow.position.set(0, 0.24, -0.19);
    for (const k of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16), pink);
      loop.scale.set(1.2, 0.7, 1);
      loop.position.x = k * 0.032;
      loop.rotation.z = k * 0.3;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.006), pink);
      tail.position.set(k * 0.012, -0.035, 0);
      tail.rotation.z = k * 0.35;
      bow.add(loop, tail);
    }
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), pink));
    bow.name = 'bow';
    body.add(apron, bib, pocket, tie, bow);
    // 背中のふた（ねじ）
    const hatch = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.1, 0.01, 2, 0.01), joint);
    hatch.position.set(0, 0.38, -0.178);
    body.add(hatch);

    // 腕：肩（玉）→ 上腕 → ひじ（玉）→ 前腕（のびる）→ 手
    this.arms = {};
    for (const [side, k] of [['L', 1], ['R', -1]]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(k * 0.215, 0.4, 0);
      shoulder.name = 'shoulder' + side;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), mint);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, UA - 0.04, 4, 12), white);
      upper.position.y = -UA / 2;
      const elbow = new THREE.Group();
      elbow.position.y = -UA;
      const eball = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10), joint);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, FA - 0.05, 4, 12), white);
      fore.position.y = -FA / 2 + 0.01;
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 1, 10), joint); // のびる中の筒
      inner.visible = false;
      const wrist = new THREE.Group();
      wrist.position.y = -FA;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), white);
      hand.scale.set(1, 0.9, 0.8);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.025, 4, 8), white);
      thumb.position.set(-k * 0.035, 0.005, 0.015);
      thumb.rotation.z = k * 0.8;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 16), mint);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.03;
      wrist.add(hand, thumb, cuff);
      elbow.add(eball, fore, inner, wrist);
      shoulder.add(ball, upper, elbow);
      body.add(shoulder);
      this.arms[side] = { side, k, shoulder, elbow, wrist, fore, inner, ext: 0, target: null, rest: new THREE.Vector3(k * 0.26, 0.2, 0.12), cur: new THREE.Vector3() };
    }

    // 首（じゃばら）と頭
    const neck = (this.neck = new THREE.Group());
    neck.position.y = 0.52;
    body.add(neck);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.055 - i * 0.004, 0.014, 8, 20), joint);
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.012 + i * 0.022;
      neck.add(r);
    }
    const head = (this.head = new THREE.Group());
    head.position.y = 0.07;
    head.name = 'head';
    neck.add(head);
    const shell = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.28, 0.29, 5, 0.09), white);
    shell.position.y = 0.14;
    shell.name = 'shell';
    head.add(shell);
    // 画面（黒いガラス＋光る顔）
    this.face = new RobotFace();
    const screenM = new THREE.MeshPhysicalMaterial({ color: '#05070a', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#ffffff', emissiveMap: this.face.tex, emissiveIntensity: 1.6 });
    this.mats.push(screenM);
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.21, 0.02, 4, 0.05), dark);
    bezel.position.set(0, 0.14, 0.142);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.272, 0.185), screenM);
    screen.position.set(0, 0.14, 0.1535);
    screen.name = 'screen';
    head.add(bezel, screen);
    // 耳（ミントの丸）とアンテナ
    for (const k of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), mint);
      ear.rotation.z = Math.PI / 2;
      ear.position.set(k * 0.185, 0.14, 0);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), joint);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(k * 0.205, 0.14, 0);
      head.add(ear, bolt);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), joint);
    ant.position.set(0.09, 0.32, -0.04);
    ant.rotation.z = -0.25;
    const tip = (this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), new THREE.MeshStandardMaterial({ color: '#e8213f', emissive: '#ff3355', emissiveIntensity: 0.6, roughness: 0.3 })));
    tip.position.set(0.102, 0.37, -0.04);
    this.mats.push(tip.material);
    head.add(ant, tip);
    // 紙の帽子
    const hat = paperHat();
    this.mats.push(hat.material);
    hat.position.set(-0.025, 0.252, -0.005);
    hat.rotation.set(0.0, 0, 0.16);
    head.add(hat);

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    screen.castShadow = false;
    // 動かない部品を、関節ごとにまとめる
    mergeStatic(head);
    mergeStatic(body, { keep: [neck, this.arms.L.shoulder, this.arms.R.shoulder] });
    for (const a of Object.values(this.arms)) { mergeStatic(a.shoulder, { keep: [a.elbow] }); mergeStatic(a.wrist); }

    // 状態
    this.t = 0;
    this.lift = 0;
    this.liftCur = 0;
    this.lookTarget = null;
    this.yaw = 0; this.pitch = 0;
    this.hopT = -1;
    this.wiggleT = 0;
    this.speed = 0;     // 走っているとき（車輪を回す）
  }

  setFace(name) { this.face.set(name); }
  say(sec = 1) { this.face.talk = sec; }
  look(p) { this.lookTarget = p ? p.clone() : null; }
  reach(side, p) { const a = this.arms[side]; a.target = p ? (a.target || new THREE.Vector3()).copy(p) : null; }
  hop() { this.hopT = 0; }
  wiggle(sec = 0.8) { this.wiggleT = sec; }

  /** 頭の位置（ワールド）。お客さんが見る所。 */
  headWorld(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, 0.14, 0.1)); }

  update(dt) {
    this.t += dt;
    this.face.update(dt);
    const root = this.root;
    // 浮いているようなゆれ、喜びのぴょん、くねくね
    let bob = Math.sin(this.t * 2.6) * 0.006;
    if (this.hopT >= 0) { this.hopT += dt; const k = this.hopT / 0.42; bob += k < 1 ? Math.sin(k * Math.PI) * 0.09 : 0; if (k >= 1) this.hopT = -1; }
    this.wiggleT = Math.max(0, this.wiggleT - dt);
    this.liftCur = damp(this.liftCur, this.lift, 4, dt);
    this.body.position.y = 0.27 + this.liftCur + bob;
    this.body.rotation.z = this.wiggleT > 0 ? Math.sin(this.t * 22) * 0.08 : damp(this.body.rotation.z, 0, 8, dt);
    // 柱：車輪から胴の下まで
    const ch = Math.max(0.02, this.liftCur + 0.06);
    this.column.scale.y = ch;
    this.column.position.y = 0.24 + ch / 2;
    this.column.visible = this.liftCur > 0.01;
    // 車輪
    this.wheel.rotation.x += this.speed * dt / 0.15;
    // 頭の向き
    let yaw = 0, pitch = 0;
    root.updateMatrixWorld(true);
    if (this.lookTarget) {
      this.neck.getWorldPosition(v1);
      v2.copy(this.lookTarget).sub(v1);
      v2.applyQuaternion(q1.copy(root.quaternion).invert());
      yaw = clamp(Math.atan2(v2.x, v2.z), -1.1, 1.1);
      pitch = clamp(-Math.atan2(v2.y - 0.1, Math.hypot(v2.x, v2.z)), -0.5, 0.75);
    }
    this.yaw = dampAngle(this.yaw, yaw, 7, dt);
    this.pitch = damp(this.pitch, pitch, 7, dt);
    this.head.rotation.set(this.pitch, this.yaw, Math.sin(this.t * 1.7) * 0.025);
    this.face.look = clamp(-yaw * 0.6, -1, 1) * 0; // 画面の目は顔の向きで十分
    // 腕
    root.updateMatrixWorld(true);
    for (const a of Object.values(this.arms)) this._arm(a, dt);
  }

  /** 2 本の骨の IK（前腕はのびる）。目標がなければ、体の横で軽くぶらぶら。 */
  _arm(a, dt) {
    const sh = a.shoulder;
    // 目標を胴の座標へ
    if (a.target) { v1.copy(a.target); this.body.worldToLocal(v1); }
    else v1.copy(a.rest).add(v4.set(0, Math.sin(this.t * 2 + a.k) * 0.01, 0));
    // なめらかに追う（手先の位置）
    if (!a.init) { a.cur.copy(v1); a.init = true; }
    a.cur.x = damp(a.cur.x, v1.x, 18, dt); a.cur.y = damp(a.cur.y, v1.y, 18, dt); a.cur.z = damp(a.cur.z, v1.z, 18, dt);
    const T = v2.copy(a.cur).sub(sh.position); // 肩から見た目標
    let d = T.length();
    const reach = UA + FA;
    const ext = clamp(d - reach + 0.02, 0, FA_EXT);
    a.ext = damp(a.ext, ext, 14, dt);
    const fa = FA + a.ext;
    d = clamp(d, 0.05, UA + fa - 0.002);
    // 肘を曲げる向き（外・下・少し後ろ）
    const pole = v3.set(a.k * 0.7, -0.6, -0.4).normalize();
    const dir = v4.copy(T).normalize();
    const n = new THREE.Vector3().crossVectors(dir, pole).normalize();
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
    const cosA = clamp((UA * UA + d * d - fa * fa) / (2 * UA * d), -1, 1);
    const alpha = Math.acos(cosA);
    // 上腕の向き：目標の向きを、肘側へ alpha だけ回す
    const upper = dir.clone().applyAxisAngle(n, alpha);
    // 肩の回転：-Y を上腕の向きへ、X を曲げの軸へ
    const Y = upper.clone().negate();
    const X = n.clone().sub(Y.clone().multiplyScalar(n.dot(Y))).normalize();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    m1.makeBasis(X, Y, Z);
    sh.quaternion.setFromRotationMatrix(m1);
    // 肘：前腕を目標へ
    const elbowPos = upper.clone().multiplyScalar(UA).add(sh.position);
    const f = a.cur.clone().sub(elbowPos).normalize().applyQuaternion(q2.copy(sh.quaternion).invert());
    a.elbow.rotation.set(Math.atan2(-f.z, -f.y), 0, 0);
    // のびた前腕
    a.wrist.position.y = -fa;
    a.inner.visible = a.ext > 0.01;
    a.inner.scale.y = a.ext + 0.02;
    a.inner.position.y = -FA - a.ext / 2 + 0.01;
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
    this.face.tex.dispose();
  }
}
