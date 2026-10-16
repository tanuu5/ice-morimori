// カメラ：名前のついた構図（shot）へ、なめらかに移る。画面が縦長のときは横の画角が足りるように広げて下がる。
//   rig.go('serve')   ゆっくり移る        rig.cut('wide')   すぐに切り替える
//   rig.lift          塔の高さに合わせて注視点を上げる量（m）
import * as THREE from 'three';
import { damp } from '../core/math.js';

export const SHOTS = {
  // ロボの右肩越し：手前にケース、屋台の前のふちに塔、向こうにお客さんと景色
  serve: { pos: [1.02, 1.88, -1.58], target: [0.28, 1.0, 0.6], fov: 40, hfov: 54 },
  // 塔が高いとき：少し引いて上へ
  serveHigh: { pos: [0.7, 2.0, -1.9], target: [0.28, 1.35, 0.5], fov: 42, hfov: 54 },
  // 縦長の画面の調理：屋台を大きく、少し上から（名札をタップしやすく）
  serveP: { pos: [0.78, 2.12, -1.32], target: [0.22, 0.98, 0.3], fov: 60, hfov: 38 },
  // 広い：屋台・ロボ・お客さん・景色（前の左から）
  wide: { pos: [-2.6, 1.55, 4.6], target: [0.1, 0.95, 0.2], fov: 38, hfov: 60 },
  // お客さんの顔（ロボの側から）
  face: { pos: [0.36, 1.32, -0.25], target: [0.7, 1.22, 1.05], fov: 32, hfov: 40 },
  // タイトル：屋台を斜め前から、空を広く
  title: { pos: [3.2, 1.25, 4.4], target: [-0.2, 1.35, 0.0], fov: 40, hfov: 58 },
  // 会話：マルを正面から（お客さんの側）
  talk: { pos: [0.6, 1.32, 1.45], target: [-0.16, 1.18, -0.55], fov: 34, hfov: 46 },
  // 到着：左から走って来る屋台を、前の右から
  arrive: { pos: [2.8, 1.45, 5.0], target: [-1.0, 0.9, 0.0], fov: 40, hfov: 60 },
  // エンディング：花火の空を見上げる
  ending: { pos: [2.3, 1.05, 3.6], target: [-0.2, 2.1, -1.2], fov: 52, hfov: 64 },
};

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.shots = SHOTS; // 開発中に構図を試すため（__dev.game.rig.shots.serve.pos = …）
    this.overrides = {}; // 場所ごとの構図（灯台の岬の到着など）
    this.shot = 'serve';
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.fov = 40;
    this.goalPos = new THREE.Vector3();
    this.goalTarget = new THREE.Vector3();
    this.goalFov = 40;
    this.speed = 3;
    this.lift = 0;      // 注視点を上げる量（m）
    this.pull = 0;      // 見ている方向の逆へ下がる量（m）：高い塔とケースを両方おさめる
    this.shake = 0;
    this.time = 0;
    this.offset = new THREE.Vector3(); // 演出で足すずれ
  }

  /** 場所ごとに構図を差し替える（{ arrive: {...}, title: {...} }）。 */
  setOverrides(o = {}) { this.overrides = o; }

  _goal(name) {
    const aspectNow = this.camera.aspect || 16 / 9;
    if (aspectNow < 0.75 && (this.overrides[name + 'P'] || SHOTS[name + 'P'])) name = name + 'P';
    const S = this.overrides[name] || SHOTS[name];
    if (!S) throw new Error('構図がありません: ' + name);
    const aspect = this.camera.aspect || 16 / 9;
    // 縦長：横の画角（hfov）が足りるまで縦の画角を広げ、足りなければ後ろへ下がる
    const want = THREE.MathUtils.degToRad(S.hfov);
    let fov = S.fov;
    const hNow = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
    let back = 1;
    if (hNow < want) {
      const need = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(want / 2) / aspect));
      fov = Math.min(need, 62);
      const hGot = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
      back = Math.tan(want / 2) / Math.tan(hGot / 2);
    }
    const p = new THREE.Vector3(...S.pos), t = new THREE.Vector3(...S.target);
    p.sub(t).multiplyScalar(back).add(t);
    return { p, t, fov };
  }

  go(name, speed = 3) {
    this.shot = name;
    this.speed = speed;
    const g = this._goal(name);
    this.goalPos.copy(g.p);
    this.goalTarget.copy(g.t);
    this.goalFov = g.fov;
  }

  cut(name) {
    this.go(name);
    this.pos.copy(this.goalPos);
    this.target.copy(this.goalTarget);
    this.fov = this.goalFov;
    this.update(0);
  }

  /** 画面の大きさが変わったら構図を計算し直す。 */
  refit() { this.go(this.shot, this.speed); }

  update(dt) {
    this.time += dt;
    const k = this.speed;
    // 下がる向き：構図の注視点からカメラへ
    const bx = this.goalPos.x - this.goalTarget.x, by = this.goalPos.y - this.goalTarget.y, bz = this.goalPos.z - this.goalTarget.z;
    const bl = Math.hypot(bx, by, bz) || 1;
    const pl = this.pull / bl;
    this.pos.x = damp(this.pos.x, this.goalPos.x + bx * pl, k, dt);
    this.pos.y = damp(this.pos.y, this.goalPos.y + by * pl + this.lift * 0.6, k, dt);
    this.pos.z = damp(this.pos.z, this.goalPos.z + bz * pl, k, dt);
    this.target.x = damp(this.target.x, this.goalTarget.x, k, dt);
    this.target.y = damp(this.target.y, this.goalTarget.y + this.lift, k, dt);
    this.target.z = damp(this.target.z, this.goalTarget.z, k, dt);
    this.fov = damp(this.fov, this.goalFov, k, dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const cam = this.camera;
    // 手持ちのような、ごく小さな揺れ
    const t = this.time;
    const sway = 0.006, sk = this.shake * 0.03;
    cam.position.set(
      this.pos.x + Math.sin(t * 0.7) * sway + (Math.random() - 0.5) * sk + this.offset.x,
      this.pos.y + Math.sin(t * 0.53 + 1) * sway * 0.6 + (Math.random() - 0.5) * sk + this.offset.y,
      this.pos.z + this.offset.z,
    );
    cam.lookAt(this.target);
    if (Math.abs(cam.fov - this.fov) > 1e-3) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
