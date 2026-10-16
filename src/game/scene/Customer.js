// お客さんの 3D モデル：頭の大きい、夏服の町の人。表情（Face）・歩き・待つ・身ぶり・受け取ってなめる。
// モデルは +Z を向き、足もとが y = 0。屋台の前では -Z（屋台）を向いて立つ。
//
//   const c = new Customer(look)            data/looks.js の randomLook() か、常連の見た目
//   c.walkTo(x, z, speed)                   歩いて行く（着いたら c.arrived = true）
//   c.setMood('happy')                      表情と身ぶり（MOODS）
//   c.say(sec)                              口をぱくぱく
//   c.lookAt(worldPos)                      顔をそちらへ
//   c.hold(group)                           右手に塔（器ごと）を持つ。c.release() で返す
//   c.lick()                                1 回なめる
import * as THREE from 'three';
import { Face } from './Face.js';
import { damp, dampAngle, clamp } from '../../core/math.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeStatic } from './merge.js';

// 体つき（m）：leg 脚の長さ、torso 胴、head 頭の半径、sh 肩の幅の半分、ua / fa 上腕・前腕、girth 胴の太さ、hip 股の幅の半分
const SIZES = {
  kid: { leg: 0.34, torso: 0.3, head: 0.158, sh: 0.115, ua: 0.14, fa: 0.13, girth: 0.118, hip: 0.07 },
  teen: { leg: 0.54, torso: 0.4, head: 0.16, sh: 0.15, ua: 0.2, fa: 0.18, girth: 0.135, hip: 0.08 },
  adult: { leg: 0.6, torso: 0.45, head: 0.165, sh: 0.165, ua: 0.22, fa: 0.2, girth: 0.152, hip: 0.088 },
  elder: { leg: 0.54, torso: 0.44, head: 0.162, sh: 0.16, ua: 0.21, fa: 0.19, girth: 0.16, hip: 0.088 },
};

export const MOODS = {
  neutral: { face: { eyes: 'open', mouth: 'smile', brows: 'none', sweat: false, tears: false }, pose: 'rest' },
  happy: { face: { eyes: 'happy', mouth: 'grin', brows: 'up', sweat: false, tears: false }, pose: 'rest', bounce: 0.4 },
  excited: { face: { eyes: 'sparkle', mouth: 'open', brows: 'up', sweat: false, tears: false }, pose: 'cheer', bounce: 1 },
  delight: { face: { eyes: 'happy', mouth: 'cat', brows: 'up', sweat: false, tears: false }, pose: 'clasp', bounce: 0.6 },
  worried: { face: { eyes: 'open', mouth: 'wavy', brows: 'worried', sweat: true, tears: false }, pose: 'clasp' },
  surprised: { face: { eyes: 'wide', mouth: 'o', brows: 'up', sweat: false, tears: false }, pose: 'rest' },
  sad: { face: { eyes: 'sad', mouth: 'frown', brows: 'worried', sweat: false, tears: false }, pose: 'droop' },
  cry: { face: { eyes: 'closed', mouth: 'frown', brows: 'worried', sweat: false, tears: true }, pose: 'droop' },
  angry: { face: { eyes: 'angry', mouth: 'frown', brows: 'angry', sweat: false, tears: false }, pose: 'hips' },
  impatient: { face: { eyes: 'open', mouth: 'flat', brows: 'flat', sweat: false, tears: false }, pose: 'cross', tap: true },
  eat: { face: { eyes: 'closed', mouth: 'lick', brows: 'up', sweat: false, tears: false }, pose: 'hold' },
  yum: { face: { eyes: 'happy', mouth: 'cat', brows: 'up', sweat: false, tears: false }, pose: 'hold', bounce: 0.5 },
};

// 腕の形：[肩の前後（x）, 肩の開き（z）, ひじの曲げ]（右腕。左腕は z を反転）
const POSES = {
  rest: [0.05, 0.12, 0.25],
  cheer: [-2.7, 0.45, 0.35],
  clasp: [-0.75, -0.35, 1.5],
  droop: [0.12, 0.05, 0.1],
  hips: [0.2, 0.55, 1.9],
  cross: [-0.55, -0.55, 1.95],
  wave: [-2.6, 0.2, 0.9],
  hold: [-0.6, 0.1, 1.2],
};

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const qa = new THREE.Quaternion(), ma = new THREE.Matrix4();

function capsule(r, len, m, seg = 10) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), m); }

export class Customer {
  constructor(look) {
    this.look = look;
    const S = (this.S = SIZES[look.body] || SIZES.adult);
    const mats = (this.mats = []);
    const M = (hex, rough = 0.78, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra }); mats.push(m); return m; };
    const skin = M(look.skin, 0.62);
    const top = M(look.topColor, 0.82);
    const top2 = M(look.topColor2, 0.82);
    const bottom = M(look.bottomColor, 0.85);
    const hairM = M(look.hairColor, 0.7);
    const shoe = M(look.shoe, 0.6);

    const root = (this.root = new THREE.Group());
    root.name = 'customer';
    const hips = (this.hips = new THREE.Group());
    hips.position.y = S.leg;
    root.add(hips);

    // 脚（ズボンなら布、短パン・スカートなら肌）
    this.legs = [];
    const pantsLeg = look.bottom === 'pants';
    for (const k of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(k * S.hip, 0, 0);
      const thighLen = S.leg * 0.5, shinLen = S.leg * 0.5;
      const th = capsule(S.girth * 0.34, thighLen - 0.02, pantsLeg ? bottom : skin);
      th.position.y = -thighLen / 2;
      const knee = new THREE.Group();
      knee.position.y = -thighLen;
      const sh = capsule(S.girth * 0.29, shinLen - 0.06, pantsLeg ? bottom : skin);
      sh.position.y = -shinLen / 2 + 0.025;
      const foot = new THREE.Mesh(new RoundedBoxGeometry(S.girth * 0.66, 0.065, S.girth * 1.2, 2, 0.028), shoe);
      foot.position.set(0, -shinLen + 0.03, S.girth * 0.2);
      knee.add(sh, foot);
      leg.add(th, knee);
      // 短パンのすそ
      if (look.bottom === 'shorts') {
        const hem = new THREE.Mesh(new THREE.CylinderGeometry(S.girth * 0.47, S.girth * 0.5, thighLen * 0.55, 14), bottom);
        hem.position.y = -thighLen * 0.22;
        leg.add(hem);
      }
      hips.add(leg);
      this.legs.push({ g: leg, knee });
    }
    // 腰まわり（短パン・ズボンの上、スカート、ワンピースのすそ）
    if (look.bottom === 'skirt' || look.top === 'dress') {
      const sk = new THREE.Mesh(new THREE.CylinderGeometry(S.girth * 0.92, S.girth * 1.45, S.leg * 0.4, 20, 1, true), look.top === 'dress' ? top : bottom);
      sk.material.side = THREE.DoubleSide;
      sk.scale.z = 0.85;
      sk.position.y = -S.leg * 0.17;
      hips.add(sk);
    } else {
      const pts = [[0.001, 0.02], [0.92, 0.02], [0.98, -0.03], [1.0, -0.1], [0.62, -0.16], [0.001, -0.16]].map(([r, y]) => new THREE.Vector2(r * S.girth, y * (S.leg / 0.6)));
      const pelvis = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), bottom);
      pelvis.scale.z = 0.8;
      hips.add(pelvis);
    }

    // 胴：肩が張って、腰へ少しすぼまる形（回転体）
    const torso = (this.torso = new THREE.Group());
    torso.position.y = 0.0;
    hips.add(torso);
    const T = S.torso, g0 = S.girth;
    const prof = [[0.001, 0], [0.9, 0], [0.93, 0.22], [0.99, 0.55], [1.0, 0.76], [0.86, 0.92], [0.5, 1.0], [0.001, 1.01]].map(([r, y]) => new THREE.Vector2(r * g0, y * T));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), top);
    body.scale.z = 0.8;
    body.name = 'body';
    torso.add(body);
    // 服の柄（アロハの花・シャツのネクタイ・子どもの T シャツの帯）
    if (look.top === 'aloha') {
      for (let i = 0; i < 10; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(g0 * 0.17, 8, 6), top2);
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const y = T * (0.25 + (i % 3) * 0.22);
        f.position.set(Math.sin(a) * g0 * 0.98, y, Math.cos(a) * g0 * 0.79);
        f.scale.set(1, 1, 0.3);
        f.rotation.y = a;
        torso.add(f);
      }
    } else if (look.top === 'shirt') {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, T * 0.55, 0.012), top2);
      tie.position.set(0, T * 0.6, g0 * 0.8);
      tie.rotation.x = -0.12;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(g0 * 0.5, 0.018, 6, 18), top);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = T * 0.97;
      torso.add(tie, collar);
    } else if (look.top === 'tee') {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(g0 * 1.0, g0 * 0.995, T * 0.12, 24, 1, true), top2);
      stripe.scale.z = 0.8;
      stripe.position.y = T * 0.5;
      if (look.body === 'kid' || look.body === 'teen') torso.add(stripe);
    }

    // 腕
    this.arms = [];
    for (const k of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(k * S.sh, S.torso * 0.84, 0);
      const ua = capsule(S.girth * 0.3, S.ua - 0.03, skin);
      ua.position.y = -S.ua / 2;
      // 袖（タンクトップ・ワンピース以外）
      if (look.top !== 'tank' && look.top !== 'dress') {
        const long = look.top === 'shirt';
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(S.girth * 0.42, S.girth * 0.4, S.ua * (long ? 0.95 : 0.5), 14), top);
        sl.position.y = -S.ua * (long ? 0.47 : 0.22);
        shoulder.add(sl);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(S.girth * 0.42, 14, 10), top);
        shoulder.add(cap);
      }
      const elbow = new THREE.Group();
      elbow.position.y = -S.ua;
      const fa = capsule(S.girth * 0.27, S.fa - 0.03, skin);
      fa.position.y = -S.fa / 2;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(S.girth * 0.33, 12, 10), skin);
      hand.position.y = -S.fa - 0.01;
      const grip = new THREE.Group(); // 持ち物をつける所（手のひら）
      grip.userData.keepEmpty = true;
      grip.position.set(0, -S.fa - 0.02, S.girth * 0.12);
      elbow.add(fa, hand, grip);
      shoulder.add(ua, elbow);
      torso.add(shoulder);
      this.arms.push({ k, shoulder, elbow, grip, ik: null, pose: [0, 0, 0] });
    }

    // 頭
    const neck = new THREE.Group();
    neck.position.y = S.torso - 0.005;
    torso.add(neck);
    const head = (this.head = new THREE.Group());
    head.position.y = S.head * 0.92;
    neck.add(head);
    this.neck = neck;
    const R = S.head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), skin);
    skull.scale.set(1.04, 0.98, 1);
    skull.name = 'skull';
    head.add(skull);
    // 顔（キャンバス）：頭の前に薄い殻
    this.face = new Face({ blush: look.blush, lash: look.fem && look.body !== 'elder' });
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.tex, transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    mats.push(faceMat);
    const faceShell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 28, 20, Math.PI / 2 - 1.0, 2.0, Math.PI / 4, Math.PI / 2), faceMat);
    faceShell.scale.copy(skull.scale);
    faceShell.renderOrder = 2;
    faceShell.name = 'face';
    head.add(faceShell);
    // 耳と鼻
    for (const k of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), skin);
      ear.scale.set(0.55, 1, 0.8);
      ear.position.set(k * R * 1.0, -R * 0.08, 0);
      head.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(R * 0.09, 10, 8), skin);
    nose.position.set(0, -R * 0.2, R * 0.98);
    head.add(nose);
    this._hair(head, R, hairM, look);
    this._hat(head, R, look, M);
    if (look.glasses) this._glasses(head, R, look, M);
    this._accessory(torso, S, look, M);

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    faceShell.castShadow = false;
    // 動かない部品を、関節ごとに材質でまとめる（1 人 50 個ほどのメッシュを 15 個ほどに）
    mergeStatic(head);
    mergeStatic(torso, { keep: [neck, ...this.arms.map((a) => a.shoulder)] });
    for (const a of this.arms) { mergeStatic(a.shoulder, { keep: [a.elbow] }); mergeStatic(a.elbow, { keep: [a.grip] }); }
    for (const L of this.legs) { mergeStatic(L.g, { keep: [L.knee] }); mergeStatic(L.knee); }
    mergeStatic(hips, { keep: [...this.legs.map((L) => L.g), torso] });

    // 状態
    this.moodName = 'neutral';
    this.mood = MOODS.neutral;
    this.face.set(this.mood.face);
    this.pos = root.position;
    this.target = null;
    this.speed = 1.1;
    this.facing = 0;
    this.facingGoal = 0;
    this.walkPh = 0;
    this.moving = 0;
    this.arrived = true;
    this.t = Math.random() * 10;
    this.bounceT = 0;
    this.lookTarget = null;
    this.headYaw = 0; this.headPitch = 0;
    this.holding = null;
    this.lickT = -1;
    this.waveT = 0;
    this.jumpT = -1;
  }

  _hair(head, R, m, look) {
    const add = (geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
      const h = new THREE.Mesh(geo, m); h.position.set(x, y, z); h.scale.set(sx, sy, sz); h.rotation.set(rx, ry, rz); head.add(h); return h;
    };
    const style = look.hair;
    const BACK = [Math.PI - 0.15, Math.PI + 0.3]; // 後ろ半分（＋横を少し）の phi の範囲
    if (style === 'bald') {
      // 耳のまわりと後ろだけ
      add(new THREE.SphereGeometry(R * 1.03, 24, 8, BACK[0], BACK[1], Math.PI * 0.4, Math.PI * 0.22));
      return;
    }
    if (style === 'buzz') {
      add(new THREE.SphereGeometry(R * 1.025, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), 0, R * 0.02, -R * 0.03, 1, 1, 1, -0.2);
      return;
    }
    // 頭の上（前の生えぎわは高く、後ろは低く）
    add(new THREE.SphereGeometry(R * 1.075, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, R * 0.03, -R * 0.02, 1, 1, 1, -0.22);
    // 後ろ（えり足まで）
    add(new THREE.SphereGeometry(R * 1.07, 28, 12, BACK[0], BACK[1], Math.PI * 0.42, Math.PI * 0.36), 0, 0, -R * 0.01);
    // 前髪：額の上にかたまりをいくつか
    const n = style === 'side' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const sx = style === 'side' ? 0.35 : 0;
      const a = (u + sx) * 1.5;
      const x = Math.sin(a) * R * 0.86, z = Math.cos(a) * R * 0.86;
      add(new THREE.SphereGeometry(R * 0.36, 14, 10), x, R * 0.5 - Math.abs(u) * R * 0.12, z, 1, 0.62, 0.55, -0.5, a, -u * 0.6);
    }
    // 横（もみあげ）
    for (const k of [-1, 1]) add(new THREE.SphereGeometry(R * 0.3, 12, 10), k * R * 0.88, R * 0.12, R * 0.12, 0.42, 0.9, 0.7);
    if (style === 'spiky') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(new THREE.ConeGeometry(R * 0.22, R * 0.55, 6), Math.sin(a) * R * 0.55, R * 0.88, Math.cos(a) * R * 0.5 - R * 0.12, 1, 1, 1, Math.cos(a) * -0.75, 0, Math.sin(a) * 0.75);
      }
    } else if (style === 'side') {
      add(new THREE.SphereGeometry(R * 0.5, 14, 10), R * 0.42, R * 0.78, R * 0.3, 1.25, 0.5, 1, 0, 0, -0.35);
    } else if (style === 'bob') {
      for (const k of [-1, 1]) add(new THREE.SphereGeometry(R * 0.55, 16, 12), k * R * 0.82, -R * 0.2, -R * 0.05, 0.6, 1.15, 1.0);
      add(new THREE.SphereGeometry(R * 0.95, 20, 12), 0, -R * 0.15, -R * 0.38, 1.1, 0.85, 0.7);
    } else if (style === 'long') {
      add(new THREE.CapsuleGeometry(R * 0.72, R * 1.2, 4, 14), 0, -R * 0.95, -R * 0.5, 1.3, 1, 0.5);
      for (const k of [-1, 1]) add(new THREE.CapsuleGeometry(R * 0.26, R * 0.9, 4, 10), k * R * 0.86, -R * 0.55, R * 0.1, 0.8, 1, 0.8);
    } else if (style === 'pony') {
      add(new THREE.CapsuleGeometry(R * 0.3, R * 0.9, 4, 12), 0, R * 0.0, -R * 1.3, 1, 1, 1, 0.75);
      add(new THREE.TorusGeometry(R * 0.2, R * 0.06, 6, 14), 0, R * 0.42, -R * 1.0, 1, 1, 1, 0.9, 0, 0).material = new THREE.MeshStandardMaterial({ color: look.accColor || '#ff6b9a', roughness: 0.5 });
    } else if (style === 'twin') {
      for (const k of [-1, 1]) {
        add(new THREE.CapsuleGeometry(R * 0.26, R * 0.75, 4, 12), k * R * 1.18, -R * 0.2, -R * 0.15, 1, 1, 1, 0, 0, k * 0.3);
        add(new THREE.SphereGeometry(R * 0.14, 10, 8), k * R * 1.0, R * 0.3, -R * 0.1).material = new THREE.MeshStandardMaterial({ color: look.accColor || '#ff6b9a', roughness: 0.5 });
      }
    } else if (style === 'bun') {
      add(new THREE.SphereGeometry(R * 0.4, 18, 14), 0, R * 1.0, -R * 0.42);
    }
  }

  _hat(head, R, look, M) {
    if (!look.hat) return;
    const m = M(look.hatColor, 0.75);
    const g = new THREE.Group();
    g.rotation.x = -0.12; // 少し後ろへかぶる
    const H = 1.12; // 髪の上からかぶる大きさ
    if (look.hat === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.0, R * 2.05, 0.012, 36), m);
      brim.position.y = R * 0.52;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * H, R * 0.62, 28), m);
      crown.position.y = R * 0.82;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R * H * 1.005, R * H * 1.01, R * 0.14, 28, 1, true), M('#e8590c', 0.7));
      band.position.y = R * 0.6;
      g.add(brim, crown, band);
    } else if (look.hat === 'cap') {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(R * H, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
      crown.position.y = R * 0.08;
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.014, 22, 1, false, -Math.PI / 2, Math.PI), m);
      bill.position.set(0, R * 0.38, R * 0.92);
      bill.scale.set(1, 1, 0.8);
      bill.rotation.x = 0.12;
      const button = new THREE.Mesh(new THREE.SphereGeometry(R * 0.08, 8, 6), m);
      button.position.y = R * (H + 0.08);
      g.add(crown, bill, button);
    } else if (look.hat === 'visor') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R * H, R * H, R * 0.2, 28, 1, true), m);
      band.material.side = THREE.DoubleSide;
      band.position.y = R * 0.42;
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.85, 0.012, 22, 1, false, -Math.PI / 2, Math.PI), m);
      bill.position.set(0, R * 0.36, R * 0.98);
      bill.scale.set(1, 1, 0.85);
      bill.rotation.x = 0.15;
      g.add(band, bill);
    } else if (look.hat === 'bucket') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * H, R * 0.62, 26), m);
      crown.position.y = R * 0.78;
      const top = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 26), m);
      top.rotation.x = -Math.PI / 2;
      top.position.y = R * 1.09;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * H, R * 1.5, R * 0.24, 28, 1, true), m);
      brim.material.side = THREE.DoubleSide;
      brim.position.y = R * 0.38;
      g.add(crown, top, brim);
    }
    head.add(g);
  }

  _glasses(head, R, look, M) {
    const sun = look.glasses === 'sun';
    const frame = M(sun ? '#2b2321' : '#7a5a44', 0.4);
    const lens = M(sun ? '#203040' : '#ffffff', 0.15, sun ? {} : { transparent: true, opacity: 0.25 });
    for (const k of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.26, R * 0.26, 0.008, 16), lens);
      l.rotation.x = Math.PI / 2;
      l.position.set(k * R * 0.33, -R * 0.05, R * 1.02);
      const r = new THREE.Mesh(new THREE.TorusGeometry(R * 0.27, 0.006, 6, 18), frame);
      r.position.copy(l.position);
      head.add(l, r);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(R * 0.16, 0.008, 0.008), frame);
    bridge.position.set(0, -R * 0.02, R * 1.04);
    head.add(bridge);
  }

  _accessory(torso, S, look, M) {
    if (!look.acc) return;
    const m = M(look.accColor, 0.75);
    if (look.acc === 'towel') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(S.girth * 0.75, S.girth * 0.18, 8, 20, Math.PI * 1.3), m);
      t.rotation.set(Math.PI / 2 + 0.15, 0, Math.PI * 0.85);
      t.position.y = S.torso * 0.95;
      torso.add(t);
    } else if (look.acc === 'ring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(S.girth * 1.45, S.girth * 0.42, 12, 24), m);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = S.torso * 0.2;
      torso.add(ring);
    } else if (look.acc === 'bag') {
      const bag = new THREE.Mesh(new RoundedBoxGeometry(S.girth * 1.4, S.torso * 0.55, S.girth * 0.7, 2, 0.03), m);
      bag.position.set(0, S.torso * 0.55, -S.girth * 1.05);
      torso.add(bag);
    } else if (look.acc === 'fan') {
      this.fan = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), M(look.accColor, 0.7, { side: THREE.DoubleSide }));
      disc.position.y = -0.1;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), M('#c9a36a', 0.7));
      stick.position.y = -0.03;
      this.fan.add(disc, stick);
      this.fan.rotation.x = Math.PI;
      this.arms[0].grip.add(this.fan);
    }
  }

  // ---------------------------------------------------------------- 操作
  walkTo(x, z, speed = 1.1) { this.target = new THREE.Vector3(x, 0, z); this.speed = speed; this.arrived = false; }
  place(x, z, facing = Math.PI) { this.root.position.set(x, 0, z); this.facing = this.facingGoal = facing; this.root.rotation.y = facing; this.target = null; this.arrived = true; }
  turnTo(angle) { this.facingGoal = angle; }
  setMood(name) {
    const m = MOODS[name] || MOODS.neutral;
    this.moodName = name;
    this.mood = m;
    this.face.set(m.face);
  }
  say(sec = 1.2) { this.face.talk = sec; }
  lookAt(p) { this.lookTarget = p ? p.clone() : null; }
  wave(sec = 1.2) { this.waveT = sec; }
  jump() { this.jumpT = 0; }
  /** 右手で塔を持つ。group は器の根もとが原点。 */
  hold(group) {
    this.holding = group;
    const g = this.arms[0].grip;
    g.add(group);
    group.position.set(0, 0.0, 0.0);
  }
  release() { const g = this.holding; if (g) g.parent?.remove(g); this.holding = null; return g; }
  lick() { this.lickT = 0; }

  update(dt) {
    this.t += dt;
    this.face.update(dt);
    const root = this.root;
    // 歩く
    let moving = 0;
    if (this.target) {
      v1.copy(this.target).sub(root.position);
      v1.y = 0;
      const d = v1.length();
      if (d < 0.03) { this.target = null; this.arrived = true; }
      else {
        const step = Math.min(d, this.speed * dt);
        root.position.addScaledVector(v1.normalize(), step);
        this.facingGoal = Math.atan2(v1.x, v1.z);
        moving = 1;
        this.walkPh += step / (this.S.leg * 0.55);
      }
    }
    this.moving = damp(this.moving, moving, 10, dt);
    this.facing = dampAngle(this.facing, this.facingGoal, 8, dt);
    root.rotation.y = this.facing;
    // 足と腰
    const sw = Math.sin(this.walkPh) * 0.55 * this.moving;
    this.legs[0].g.rotation.x = sw; this.legs[1].g.rotation.x = -sw;
    this.legs[0].knee.rotation.x = Math.max(0, -Math.sin(this.walkPh)) * 0.6 * this.moving;
    this.legs[1].knee.rotation.x = Math.max(0, Math.sin(this.walkPh)) * 0.6 * this.moving;
    // 足ぶみ（いらいら）
    if (this.mood.tap && !moving) this.legs[1].g.rotation.x = -Math.max(0, Math.sin(this.t * 9)) * 0.18;
    let bob = Math.abs(Math.sin(this.walkPh)) * 0.03 * this.moving;
    // はずむ（うれしい）
    if (this.mood.bounce) bob += Math.max(0, Math.sin(this.t * 9)) * 0.025 * this.mood.bounce;
    if (this.jumpT >= 0) { this.jumpT += dt; const k = this.jumpT / 0.45; bob += k < 1 ? Math.sin(k * Math.PI) * 0.16 : 0; if (k >= 1) this.jumpT = -1; }
    const breathe = Math.sin(this.t * 2.2) * 0.006;
    this.hips.position.y = this.S.leg + bob;
    this.torso.scale.y = 1 + breathe;
    this.torso.rotation.x = (this.moodName === 'sad' || this.moodName === 'cry' ? 0.15 : 0) + (this.look.body === 'elder' ? 0.12 : 0);
    // 腕
    let pose = POSES[this.mood.pose] || POSES.rest;
    if (this.holding && this.mood.pose !== 'cheer') pose = POSES.hold;
    for (const a of this.arms) {
      let want = pose;
      if (a.k < 0 && this.waveT > 0) want = POSES.wave;
      if (a.k > 0 && this.holding) want = POSES.rest; // 左手は下ろす
      const swing = Math.sin(this.walkPh) * 0.5 * this.moving * -a.k;
      a.pose[0] = damp(a.pose[0], want[0] + (want === POSES.rest ? swing : 0), 9, dt);
      a.pose[1] = damp(a.pose[1], want[1], 9, dt);
      a.pose[2] = damp(a.pose[2], want[2], 9, dt);
      let wv = 0;
      if (a.k < 0 && this.waveT > 0) wv = Math.sin(this.t * 14) * 0.35;
      a.shoulder.rotation.set(a.pose[0], 0, a.k * (a.pose[1] + 0.04) + wv);
      a.elbow.rotation.set(-a.pose[2], 0, 0);
    }
    this.waveT = Math.max(0, this.waveT - dt);
    // なめる：頭を前へ、塔を口もとへ
    let lickK = 0;
    if (this.lickT >= 0) {
      this.lickT += dt;
      const k = this.lickT / 0.9;
      lickK = k < 1 ? Math.sin(k * Math.PI) : 0;
      if (k >= 1) this.lickT = -1;
    }
    if (this.holding) {
      const a = this.arms[0];
      a.shoulder.rotation.x -= lickK * 0.35;
      a.elbow.rotation.x -= lickK * 0.35;
    }
    // 頭の向き
    let yaw = 0, pitch = 0;
    if (this.lookTarget) {
      this.head.getWorldPosition(v2);
      v3.copy(this.lookTarget).sub(v2);
      const local = v3.applyQuaternion(qa.copy(root.quaternion).invert());
      yaw = clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.6, 0.6);
    }
    if (this.moodName === 'sad' || this.moodName === 'cry') pitch += 0.3;
    pitch += lickK * 0.35;
    this.headYaw = dampAngle(this.headYaw, yaw * (1 - this.moving * 0.7), 6, dt);
    this.headPitch = damp(this.headPitch, pitch, 6, dt);
    this.head.rotation.set(this.headPitch, this.headYaw, Math.sin(this.t * 1.3) * 0.03);
    // 持っている塔は、腕の向きによらず真上を向かせる（握る所は器の根もとから少し上）
    if (this.holding) {
      const grip = this.arms[0].grip;
      root.updateMatrixWorld(true);
      grip.getWorldQuaternion(qa);
      const want = new THREE.Quaternion().setFromAxisAngle(v1.set(0, 1, 0), this.facing);
      this.holding.quaternion.copy(qa.invert().multiply(want));
      this.holding.position.set(0, 0, 0);
      // 器の根もと（原点）が手のひらより少し下に来るよう、塔の座標で下げる
      this.holding.translateY(-0.05);
    }
    this.face.state.lookX = clamp(yaw * 0.8, -1, 1);
    this.face.state.lookY = clamp(pitch * 1.2, -1, 1);
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
    this.face.dispose();
  }
}
