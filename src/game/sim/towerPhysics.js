// 塔の物理（見た目なし。Node でも動く）。Tower.js が見た目をかぶせて使う。
//
// 2D（塔の座標の x–y 平面＝画面の左右）。玉と玉の継ぎ目 i ごとに、相対の角度 th と角速度 om。
//
// 1. つり合いの角度（thEq）を、毎フレーム連立方程式で解く：
//      K thEq = 重さのかたよりのトルク（置いたときのずれ）＋ 風・土台の加速度のトルク
//    K は継ぎ目のばね（対角）から、重力が傾きを強める分（下が傾くと上の重心も横へずれる）を引いた行列。
//    K が正定値でなくなったら（溶けてやわらかい・高すぎる）支えきれないので、いちばん弱い継ぎ目から倒れる。
// 2. 各継ぎ目は、そのつり合いへ向かう減衰つきのばね（陰的に解くので暴れない）。着地や手渡しで揺れる。
// 3. 角度が BREAK を超えた継ぎ目で折れて、上が落ちる。
//
// ばねの強さは「上の重さ × (重心の高さ + 足もとの広さ)」に比例させる（高く積んだだけでは倒れない）。
// くっつき具合（置いたときのずれ）と溶けで弱くなる。

export const G = 9.8;
export const PERFECT = 0.16;   // ずれが支えの半径のこの割合より小さければ PERFECT（中心へ吸い付く）
export const GOOD = 0.42;      // これより小さければ GOOD
export const MISS = 0.92;      // これより大きいと乗らずに落ちる
export const BREAK = 0.42;     // 継ぎ目の角度（rad）がこれを超えたら折れる
export const P = {
  stiff: 1.7,       // 重力の行列の行の和に対する、ばねの倍率（1 を超えていれば、まっすぐな塔は必ず立つ）
  grip: 4.2,        // 足もとの広さ（重さ × 足もとの半径）に対する、ばねの倍率（低い塔をずれに強くする）
  hold: 1.15,       // 重心が継ぎ目から「足もとの半径 × この値」より外へ出ると、支えきれずに倒れる
  meltSoft: 0.6,    // 溶けきると、ばねがこの割合だけ弱くなる
  zeta: 0.16,       // 減衰（小さいほど揺れが長く残る）
  impact: 0.05,     // 着地の勢いのうち、塔を揺らす割合
  sub: 4,           // 1 フレームの刻みの数
  wMin: 3, wMax: 38, // 揺れの速さ（rad/s）の範囲
};

export const VESSEL_SPEC = {
  cone: { rim: 0.1115, seat: 0.42, width: 0.042 },
  cup: { rim: 0.066, seat: 0.12, width: 0.056 },
};

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export class TowerPhysics {
  constructor(vessel = 'cone') {
    this.rand = Math.random;
    this.reset(vessel);
  }

  reset(vessel = 'cone') {
    this.vessel = vessel;
    this.V = VESSEL_SPEC[vessel];
    this.items = [];
    this.topX = 0; this.topY = this.V.rim; this.topPhi = 0;
    this.unstable = 0;  // 支えきれない度合い（0 = 大丈夫、1 = 倒れる）
  }

  get count() { return this.items.length; }

  /** 各段の中心（cx, cy）・継ぎ目（px, py）・累積の角度（phi）。straight = true なら角度 0 の形（つり合いの計算用）。 */
  layout(straight = false) {
    let px = 0, py = this.V.rim, phi = 0;
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      phi += straight ? 0 : it.th;
      const c = Math.cos(phi), s = Math.sin(phi);
      const h = (i === 0 ? this.V.seat : 0.55) * it.r;
      const cx = px + c * it.off - s * h;
      const cy = py + s * it.off + c * h;
      if (straight) { it.spx = px; it.spy = py; it.scx = cx; it.scy = cy; }
      else { it.px = px; it.py = py; it.phi = phi; it.cx = cx; it.cy = cy; }
      const top = 0.9 * it.r;
      px = cx - s * top;
      py = cy + c * top;
    }
    if (!straight) { this.topX = px; this.topY = py; this.topPhi = phi; }
  }

  dropPoint() {
    this.layout();
    const n = this.items.length;
    return { x: this.topX, y: this.topY, angle: this.topPhi, r: n ? this.items[n - 1].r : this.V.width };
  }

  supportR() {
    const n = this.items.length;
    return n ? this.items[n - 1].r : this.V.width * 1.05;
  }

  /** 落ちてきた玉（中心の横位置 x、落ちる速さ vy）を受ける。 */
  land(r, x, vy = -1.5) {
    this.layout();
    const supportR = this.supportR();
    const along = (x - this.topX) * Math.cos(this.topPhi);
    const ratio = Math.abs(along) / supportR;
    if (ratio > MISS) return { ok: false, grade: 'miss', off: along, ratio };
    let grade = 'ok', off, stick;
    if (ratio < PERFECT) { grade = 'perfect'; off = 0; stick = 1.0; }
    // まあまあの所に落ちた玉は、少し真ん中へすべって落ち着く
    else if (ratio < GOOD) { grade = 'good'; off = along * 0.5; stick = 0.9; }
    else { off = along * 0.7; stick = 0.74 - (ratio - GOOD) * 0.3; }
    const below = this.items[this.items.length - 1];
    // 足もとの広さ：コーンの口は玉を包むので広く、玉の上はその半径の 7 割
    const rc = below ? supportR * 0.7 : supportR * 1.2;
    const m = Math.pow(r / 0.053, 3);
    const it = { r, m, off, th: 0, om: 0, stick, melt: 0, rc, grade };
    this.items.push(it);
    this.layout();
    // 落ちた勢いで、ずれた側へ揺れる（アイスがやわらかく受け止めるので、ごく一部だけ）
    const vImp = Math.abs(vy);
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const j = this.items[i];
      const I = this._inertia(i);
      const lever = it.cx - j.px;
      let dw = (-m * vImp * lever * P.impact) / Math.max(I, 1e-6);
      dw += (this.rand() - 0.5) * 0.3 * vImp / (1 + (n - 1 - i) * 0.6);
      j.om += clamp(dw, -1.8, 1.8);
    }
    return { ok: true, grade, off, ratio, item: it };
  }

  /** 継ぎ目 i より上の、継ぎ目まわりの慣性（今の形で）。 */
  _inertia(i) {
    let I = 0;
    const p = this.items[i];
    for (let j = i; j < this.items.length; j++) {
      const q = this.items[j];
      const dx = q.cx - p.px, dy = q.cy - p.py;
      I += q.m * (dx * dx + dy * dy + 0.4 * q.r * q.r);
    }
    return Math.max(I, 1e-6);
  }

  /** 手で塔を押す（手渡しの揺れ・演出）。dw は根もとの継ぎ目の角速度の変化。 */
  nudge(dw) {
    const n = this.items.length;
    for (let i = 0; i < n; i++) this.items[i].om += dw * (1 + i * 0.15);
  }

  /** つり合いの角度を解く。戻り値：K が正定値なら true。 */
  _equilibrium(env) {
    const items = this.items, n = items.length;
    this.layout(true);
    const Mh = new Float64Array(n), M = new Float64Array(n), tau = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = items[i];
      let mh = 0, mm = 0, tg = 0;
      for (let j = i; j < n; j++) {
        const q = items[j];
        mh += q.m * (q.scy - p.spy);
        mm += q.m;
        tg += -G * q.m * (q.scx - p.spx);
      }
      Mh[i] = mh; M[i] = mm;
      tau[i] = tg + mh * ((env.baseAx || 0) - (env.wind || 0));
    }
    // K[i][j] = k_i δij - G Mh[max(i, j)]
    // ばね k_i は、重力の行列の行の和（R_i = Σ_j Mh[max(i, j)]）に比例させる：倍率が 1 を超えていれば必ず支えられる
    // （対角優位）。溶けて倍率が 1 を下回ると、高い塔から支えきれなくなる
    const K = this._K || (this._K = []);
    let tail = 0;
    const R = this._R || (this._R = new Float64Array(24));
    for (let i = n - 1; i >= 0; i--) { R[i] = (i + 1) * Mh[i] + tail; tail += Mh[i]; }
    for (let i = 0; i < n; i++) {
      const p = items[i];
      const q = Math.max(0.2, p.stick * (1 - P.meltSoft * p.melt));
      p.k = G * (P.stiff * q * R[i] + P.grip * q * M[i] * p.rc) + 0.01;
      K[i] = K[i] || new Float64Array(24);
      for (let j = 0; j < n; j++) K[i][j] = (i === j ? p.k : 0) - G * Mh[Math.max(i, j)];
    }
    // コレスキー分解（L L^T）。対角が負になったら正定値ではない
    const L = this._L || (this._L = Array.from({ length: 24 }, () => new Float64Array(24)));
    let worst = Infinity, worstI = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = K[i][j];
        for (let q = 0; q < j; q++) s -= L[i][q] * L[j][q];
        if (i === j) {
          const rel = s / items[i].k; // 自分のばねのうち、支えに残っている割合
          if (rel < worst) { worst = rel; worstI = i; }
          if (s <= 1e-9) { this.unstable = 1; this.weakest = i; return false; }
          L[i][i] = Math.sqrt(s);
        } else L[i][j] = s / L[j][j];
      }
    }
    this.unstable = clamp(1 - worst / 0.25, 0, 1) * 0.9; // 支えの残りが 25% を切ると危なくなっていく
    this.weakest = worstI;
    // 前進・後退代入
    const y = this._y || (this._y = new Float64Array(24));
    for (let i = 0; i < n; i++) { let s = tau[i]; for (let q = 0; q < i; q++) s -= L[i][q] * y[q]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let q = i + 1; q < n; q++) s -= L[q][i] * items[q].thEq; items[i].thEq = s / L[i][i]; }
    for (let i = 0; i < n; i++) items[i].kd = K[i][i];
    return true;
  }

  /** 今の形で、継ぎ目ごとに上の重心が足もとからどれだけはみ出しているか（1 を超えると倒れる）。いちばん大きい所。 */
  _overhang() {
    const items = this.items, n = items.length;
    let worst = 0, at = -1, dir = 0;
    for (let i = 0; i < n; i++) {
      const p = items[i];
      let mx = 0, mm = 0;
      for (let j = i; j < n; j++) { const q = items[j]; mx += q.m * (q.cx - p.px); mm += q.m; }
      const d = mx / mm;
      const limit = p.rc * P.hold * (0.75 + 0.35 * p.stick) * (1 - 0.3 * p.melt);
      const o = Math.abs(d) / limit;
      if (o > worst) { worst = o; at = i; dir = Math.sign(d); }
    }
    return { worst, at, dir };
  }

  /** dt 秒進める。env = { wind, baseAx, meltRate }。折れたら、その継ぎ目の番号を返す（なければ -1）。 */
  step(dt, env = {}) {
    const items = this.items, n = items.length;
    for (const it of items) it.melt = Math.min(1, it.melt + (env.meltRate || 0) * dt);
    if (!n) { this.unstable = 0; this.over = 0; return -1; }
    let ok = this._equilibrium(env);
    // 重心が足もとの外へ出たら、そこから倒れる（-dir：重心の側へ回る＝時計回りが右）
    this.layout();
    const oh = this._overhang();
    this.over = oh.worst;
    if (ok && oh.worst > 1) { ok = false; this.weakest = oh.at; this.fallDir = -oh.dir; }
    else this.fallDir = 0;
    if (!ok) {
      // 支えきれない：いちばん弱い継ぎ目が、傾いている向きへ倒れていく
      const w = this.weakest;
      const dir = this.fallDir || Math.sign(items[w].th + items[w].om * 0.05) || (this.rand() < 0.5 ? -1 : 1);
      for (let i = 0; i < n; i++) { items[i].thEq = i === w ? dir * 1.2 : items[i].th; items[i].kd = Math.max(items[i].kd || 0.5, 0.5); }
    }
    this.layout();
    const SUB = P.sub, h = dt / SUB;
    for (let i = 0; i < n; i++) {
      const p = items[i];
      const I = this._inertia(i);
      let w = Math.sqrt(Math.max(p.kd, 0.02) / I);
      w = clamp(w, P.wMin, P.wMax);
      if (!ok && i === this.weakest) w = 3.2; // 倒れるときはゆっくり（見せ場）
      const z = P.zeta;
      for (let s = 0; s < SUB; s++) {
        // th'' = w² (thEq - th) - 2 z w th'（陰的）
        const om = (p.om + h * w * w * (p.thEq - p.th)) / (1 + 2 * z * w * h + w * w * h * h);
        p.om = om;
        p.th += om * h;
      }
    }
    this.layout();
    for (let i = 0; i < n; i++) if (Math.abs(items[i].th) > BREAK) return i;
    return -1;
  }

  /** 折れた継ぎ目 i より上を取り除いて返す。 */
  breakAt(i) { return this.items.splice(i); }

  danger() {
    let d = Math.max(this.unstable, Math.min(1, (this.over || 0)) * 0.95);
    for (const it of this.items) d = Math.max(d, Math.abs(it.th) / BREAK);
    return Math.min(1, d);
  }
}
