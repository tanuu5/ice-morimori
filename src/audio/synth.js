// 音源と効果音。音声ファイルは使わず、Web Audio のオシレーターとノイズで鳴らす。
// どの関数も (ctx, out, t, p) の形：out はミキサーの系統（{ dry, wet }）、t は鳴らす時刻（ctx.currentTime 基準）。
// p は { f（Hz）or m（MIDI）, dur, vel（0〜1）, pan（-1〜1）, rev（リバーブへの送り 0〜1） } など。
// 値はすべて fin() で確かめてから使う（NaN が AudioParam に入ると、その音はもう鳴らない）。

const fin = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const FLOOR = 0.0001; // 指数ランプは 0 に向かえないので、ここまで下げる

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    const n = ctx.sampleRate * 1.5;
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < n; i++) d[i] = ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

/** node → 音量 → 定位 → out.dry（と、rev があれば out.wet）につなぐ。音量の GainNode を返す。 */
function route(ctx, node, out, p) {
  const g = ctx.createGain();
  g.gain.value = 0;
  let last = node.connect(g);
  if (p.pan) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, fin(p.pan, 0)));
    last = last.connect(pan);
  }
  last.connect(out.dry);
  const rev = fin(p.rev, 0);
  if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; last.connect(s).connect(out.wet); }
  return g;
}

/** 立ち上がり a、減衰 d で peak から消える（打楽器・効果音の形）。 */
function perc(param, t, peak, a, d) {
  param.setValueAtTime(FLOOR, t);
  param.linearRampToValueAtTime(Math.max(FLOOR, peak), t + a);
  param.exponentialRampToValueAtTime(FLOOR, t + a + d);
}
/** 立ち上がり a、保持、離して r で消える（持続音の形）。 */
function adsr(param, t, peak, a, hold, r) {
  param.setValueAtTime(FLOOR, t);
  param.linearRampToValueAtTime(Math.max(FLOOR, peak), t + a);
  param.setValueAtTime(Math.max(FLOOR, peak), t + a + hold);
  param.exponentialRampToValueAtTime(FLOOR, t + a + hold + r);
}

function osc(ctx, type, f, t, end) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f), t);
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

function noise(ctx, t, end) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  s.start(t, Math.random() * 1.2);
  s.stop(end + 0.05);
  return s;
}

function filter(ctx, type, f, q = 0.8) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = Math.max(10, f);
  b.Q.value = q;
  return b;
}

const hz = (p, def) => fin(p.f, p.m !== undefined ? mtof(fin(p.m, 69)) : def);

// ---------------------------------------------------------------- 楽器（シーケンサーから使う）
export const INSTRUMENTS = {
  /** 矩形波のリード（チップチューン寄り）。 */
  lead(ctx, out, t, p) {
    const f = hz(p, 440), dur = fin(p.dur, 0.25), vel = fin(p.vel, 0.8);
    const o = osc(ctx, 'square', f, t, t + dur + 0.2);
    const lp = filter(ctx, 'lowpass', Math.min(9000, f * 6), 0.7);
    const g = route(ctx, o.connect(lp), out, { rev: 0.18, ...p });
    adsr(g.gain, t, 0.14 * vel, 0.006, Math.max(0, dur - 0.03), 0.12);
  },
  /** のこぎり波のベース（フィルターで弾く）。 */
  bass(ctx, out, t, p) {
    const f = hz(p, 55), dur = fin(p.dur, 0.25), vel = fin(p.vel, 0.8);
    const o = osc(ctx, 'sawtooth', f, t, t + dur + 0.15);
    const lp = filter(ctx, 'lowpass', 900, 3);
    lp.frequency.setValueAtTime(220 + 2200 * vel, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    const g = route(ctx, o.connect(lp), out, p);
    adsr(g.gain, t, 0.3 * vel, 0.004, Math.max(0, dur - 0.04), 0.08);
  },
  /** 少しずらした 3 本ののこぎり波のパッド（和音向け）。 */
  pad(ctx, out, t, p) {
    const f = hz(p, 220), dur = fin(p.dur, 1), vel = fin(p.vel, 0.6);
    const lp = filter(ctx, 'lowpass', 1800, 0.5);
    const mix = ctx.createGain();
    for (const det of [-9, 0, 8]) { const o = osc(ctx, 'sawtooth', f, t, t + dur + 0.8); o.detune.value = det; o.connect(mix); }
    mix.gain.value = 0.33;
    const g = route(ctx, mix.connect(lp), out, { rev: 0.35, ...p });
    adsr(g.gain, t, 0.08 * vel, 0.12, Math.max(0, dur - 0.12), 0.6);
  },
  /** 弾いた音（三角波＋短い倍音）。アルペジオ・メロディに。 */
  pluck(ctx, out, t, p) {
    const f = hz(p, 440), vel = fin(p.vel, 0.8);
    const o = osc(ctx, 'triangle', f, t, t + 0.6);
    const o2 = osc(ctx, 'sine', f * 2, t, t + 0.25);
    const m = ctx.createGain();
    o.connect(m); o2.connect(m);
    const g = route(ctx, m, out, { rev: 0.2, ...p });
    perc(g.gain, t, 0.25 * vel, 0.003, 0.45);
  },
  /** 鐘（FM）。完成・ご褒美の合図に。 */
  bell(ctx, out, t, p) {
    const f = hz(p, 880), vel = fin(p.vel, 0.7), dur = fin(p.dur, 1.4);
    const car = osc(ctx, 'sine', f, t, t + dur);
    const mod = osc(ctx, 'sine', f * 3.5, t, t + dur);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + dur);
    mod.connect(mg).connect(car.frequency);
    const g = route(ctx, car, out, { rev: 0.35, ...p });
    perc(g.gain, t, 0.18 * vel, 0.002, dur);
  },
  kick(ctx, out, t, p) {
    const vel = fin(p.vel, 0.9);
    const o = osc(ctx, 'sine', 150, t, t + 0.45);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = route(ctx, o, out, p);
    perc(g.gain, t, 0.9 * vel, 0.002, 0.38);
  },
  snare(ctx, out, t, p) {
    const vel = fin(p.vel, 0.8);
    const n = noise(ctx, t, t + 0.25);
    const g = route(ctx, n.connect(filter(ctx, 'bandpass', 1800, 0.7)), out, { rev: 0.15, ...p });
    perc(g.gain, t, 0.5 * vel, 0.001, 0.18);
    const o = osc(ctx, 'triangle', 190, t, t + 0.15);
    const g2 = route(ctx, o, out, p);
    perc(g2.gain, t, 0.3 * vel, 0.001, 0.09);
  },
  hat(ctx, out, t, p) {
    const vel = fin(p.vel, 0.6), open = !!p.open;
    const n = noise(ctx, t, t + (open ? 0.35 : 0.08));
    const g = route(ctx, n.connect(filter(ctx, 'highpass', 7500, 0.7)), out, p);
    perc(g.gain, t, 0.22 * vel, 0.001, open ? 0.3 : 0.05);
  },

  // ---- アイスもりもり：夏の楽器
  /** ウクレレふう：三角波にのこぎり波を少し、明るく弾いてすぐ消える。和音でかき鳴らす。 */
  uke(ctx, out, t, p) {
    const f = hz(p, 440), vel = fin(p.vel, 0.8);
    const o1 = osc(ctx, 'triangle', f, t, t + 0.9);
    const o2 = osc(ctx, 'sawtooth', f, t, t + 0.5);
    o2.detune.value = 7;
    const lp = filter(ctx, 'lowpass', Math.min(9000, f * 8), 0.7);
    lp.frequency.setValueAtTime(Math.min(9000, f * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.6), t + 0.45);
    const m = ctx.createGain();
    const g2 = ctx.createGain(); g2.gain.value = 0.28;
    o1.connect(m); o2.connect(g2).connect(m);
    const g = route(ctx, m.connect(lp), out, { rev: 0.16, ...p });
    perc(g.gain, t, 0.17 * vel, 0.002, 0.65);
  },
  /** マリンバ：サイン波と、すぐ消える 4 倍の倍音（木をたたいた音）。 */
  marimba(ctx, out, t, p) {
    const f = hz(p, 440), vel = fin(p.vel, 0.8);
    const o = osc(ctx, 'sine', f, t, t + 0.8);
    const o2 = osc(ctx, 'sine', f * 4, t, t + 0.15);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    const m = ctx.createGain();
    o.connect(m); o2.connect(g2).connect(m);
    const g = route(ctx, m, out, { rev: 0.18, ...p });
    perc(g.gain, t, 0.3 * vel, 0.002, 0.5);
  },
  /** スチールドラム：FM（比 2）で金属っぽく。 */
  steel(ctx, out, t, p) {
    const f = hz(p, 440), vel = fin(p.vel, 0.8), dur = 0.85;
    const car = osc(ctx, 'sine', f, t, t + dur);
    const mod = osc(ctx, 'sine', f * 2, t, t + dur);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.3, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.08), t + 0.32);
    mod.connect(mg).connect(car.frequency);
    const g = route(ctx, car, out, { rev: 0.24, ...p });
    perc(g.gain, t, 0.19 * vel, 0.004, dur * 0.8);
  },
  /** 太鼓：低い音の音程が下がる＋皮の音。 */
  taiko(ctx, out, t, p) {
    const vel = fin(p.vel, 0.9);
    const o = osc(ctx, 'sine', 118, t, t + 0.6);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
    const g = route(ctx, o, out, { rev: 0.28, ...p });
    perc(g.gain, t, 0.85 * vel, 0.003, 0.5);
    const n = noise(ctx, t, t + 0.12);
    const g2 = route(ctx, n.connect(filter(ctx, 'lowpass', 850, 0.8)), out, p);
    perc(g2.gain, t, 0.3 * vel, 0.001, 0.08);
  },
  /** 鉦（チキチキ）。 */
  kane(ctx, out, t, p) {
    const vel = fin(p.vel, 0.6);
    for (const [f, a] of [[2400, 0.1], [3720, 0.07], [5100, 0.04]]) {
      const o = osc(ctx, 'square', f, t, t + 0.12);
      const g = route(ctx, o.connect(filter(ctx, 'bandpass', f, 4)), out, { rev: 0.2, ...p });
      perc(g.gain, t, a * vel, 0.001, 0.09);
    }
  },
  /** 笛（篠笛ふう）：サイン波・ゆれ・息の音。 */
  flute(ctx, out, t, p) {
    const f = hz(p, 880), dur = fin(p.dur, 0.4), vel = fin(p.vel, 0.7);
    const o = osc(ctx, 'sine', f, t, t + dur + 0.2);
    const lfo = osc(ctx, 'sine', 5.4, t, t + dur + 0.2);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.011, t + Math.min(0.3, dur));
    lfo.connect(lg).connect(o.frequency);
    const g = route(ctx, o, out, { rev: 0.35, ...p });
    adsr(g.gain, t, 0.12 * vel, 0.05, Math.max(0, dur - 0.08), 0.16);
    const n = noise(ctx, t, t + dur);
    const g2 = route(ctx, n.connect(filter(ctx, 'bandpass', f * 1.5, 2)), out, { rev: 0.3 });
    adsr(g2.gain, t, 0.02 * vel, 0.04, Math.max(0, dur - 0.06), 0.1);
  },
  /** エレピ（FM、やわらかい）。 */
  epiano(ctx, out, t, p) {
    const f = hz(p, 440), dur = fin(p.dur, 0.5), vel = fin(p.vel, 0.7);
    const car = osc(ctx, 'sine', f, t, t + dur + 1);
    const mod = osc(ctx, 'sine', f, t, t + dur + 1);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.1 * vel, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + 0.6);
    mod.connect(mg).connect(car.frequency);
    const g = route(ctx, car, out, { rev: 0.22, ...p });
    adsr(g.gain, t, 0.12 * vel, 0.004, Math.max(0, dur - 0.05), 0.5);
  },
  /** シェイカー。 */
  shaker(ctx, out, t, p) {
    const vel = fin(p.vel, 0.5);
    const n = noise(ctx, t, t + 0.09);
    const g = route(ctx, n.connect(filter(ctx, 'bandpass', 6500, 1.2)), out, p);
    g.gain.setValueAtTime(FLOOR, t); g.gain.linearRampToValueAtTime(0.11 * vel, t + 0.025); g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.08);
  },
  /** 手拍子。 */
  clap(ctx, out, t, p) {
    const vel = fin(p.vel, 0.7);
    for (const dt of [0, 0.011, 0.023]) {
      const n = noise(ctx, t + dt, t + dt + 0.12);
      const g = route(ctx, n.connect(filter(ctx, 'bandpass', 1500, 1.1)), out, { rev: 0.2, ...p });
      perc(g.gain, t + dt, (dt ? 0.25 : 0.32) * vel, 0.001, dt === 0.023 ? 0.11 : 0.02);
    }
  },
};

// ---------------------------------------------------------------- 効果音（audio.sfx(name) で鳴らす）
// 作品に合わせて足す・作り替える。名前はゲームの出来事に合わせる（coin, hit, gameover …）。
export const SFX = {
  ui_move(ctx, out, t) { INSTRUMENTS.pluck(ctx, out, t, { f: 1320, vel: 0.35, rev: 0 }); },
  ui_ok(ctx, out, t) { INSTRUMENTS.pluck(ctx, out, t, { f: 988, vel: 0.5 }); INSTRUMENTS.pluck(ctx, out, t + 0.06, { f: 1480, vel: 0.5 }); },
  ui_back(ctx, out, t) { INSTRUMENTS.pluck(ctx, out, t, { f: 880, vel: 0.45 }); INSTRUMENTS.pluck(ctx, out, t + 0.06, { f: 587, vel: 0.45 }); },
  pause(ctx, out, t) { INSTRUMENTS.bell(ctx, out, t, { f: 784, vel: 0.9, dur: 0.6 }); },
  jump(ctx, out, t, p = {}) {
    const o = osc(ctx, 'square', 300, t, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(760 * fin(p.pitch, 1), t + 0.14);
    const g = route(ctx, o.connect(filter(ctx, 'lowpass', 3200)), out, p);
    perc(g.gain, t, 0.12, 0.004, 0.16);
  },
  land(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.12);
    const g = route(ctx, n.connect(filter(ctx, 'lowpass', 600, 0.9)), out, p);
    perc(g.gain, t, 0.35 * fin(p.vel, 1), 0.002, 0.1);
  },
  coin(ctx, out, t, p = {}) {
    const k = fin(p.pitch, 1);
    for (const [dt, f] of [[0, 1319], [0.07, 1976]]) {
      const o = osc(ctx, 'square', f * k, t + dt, t + dt + 0.3);
      const g = route(ctx, o.connect(filter(ctx, 'lowpass', 6000)), out, { rev: 0.15, ...p });
      perc(g.gain, t + dt, 0.1, 0.002, dt ? 0.26 : 0.08);
    }
  },
  hit(ctx, out, t, p = {}) {
    const o = osc(ctx, 'sawtooth', 220, t, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    const g = route(ctx, o.connect(filter(ctx, 'lowpass', 1400)), out, p);
    perc(g.gain, t, 0.3, 0.002, 0.22);
    SFX.land(ctx, out, t, { vel: 0.8 });
  },
  explode(ctx, out, t, p = {}) {
    const dur = fin(p.dur, 1.1);
    const n = noise(ctx, t, t + dur);
    const lp = filter(ctx, 'lowpass', 3000, 0.6);
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = route(ctx, n.connect(lp), out, { rev: 0.3, ...p });
    perc(g.gain, t, 0.7, 0.004, dur);
    INSTRUMENTS.kick(ctx, out, t, { vel: 1 });
  },
  powerup(ctx, out, t, p = {}) {
    [523, 659, 784, 1047, 1319].forEach((f, i) => INSTRUMENTS.pluck(ctx, out, t + i * 0.055, { f, vel: 0.55, rev: 0.25, ...p }));
  },

  // ---- アイスもりもり（仮置き。音の仕上げで作り直す）
  voice(ctx, out, t, p = {}) {
    // しゃべり声のかわり：短い「ぽぴぷ」を n 回
    const k = fin(p.pitch, 1), n = Math.max(1, Math.min(10, fin(p.n, 4)));
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.085;
      const f = (330 + ((i * 7919) % 5) * 40) * k;
      const o = osc(ctx, 'triangle', f, tt, tt + 0.08);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, tt + 0.05);
      const g = route(ctx, o.connect(filter(ctx, 'lowpass', 2600)), out, { rev: 0.08, ...p });
      perc(g.gain, tt, 0.07, 0.004, 0.06);
    }
  },
  serve(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.4);
    const bp = filter(ctx, 'bandpass', 600, 1.2);
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    const g = route(ctx, n.connect(bp), out, { rev: 0.1, ...p });
    perc(g.gain, t, 0.18, 0.06, 0.28);
  },
  cheer(ctx, out, t, p = {}) {
    [784, 988, 1175, 1568].forEach((f, i) => INSTRUMENTS.bell(ctx, out, t + i * 0.07, { f, vel: 0.5, dur: 0.9 }));
  },
  sad(ctx, out, t, p = {}) {
    INSTRUMENTS.pluck(ctx, out, t, { f: 392, vel: 0.5 });
    INSTRUMENTS.pluck(ctx, out, t + 0.16, { f: 311, vel: 0.5 });
  },
  register(ctx, out, t, p = {}) {
    INSTRUMENTS.bell(ctx, out, t + 0.05, { f: 2093, vel: 0.55, dur: 0.7 });
    INSTRUMENTS.bell(ctx, out, t + 0.12, { f: 2637, vel: 0.45, dur: 0.9 });
  },

  /** すくうときのざりざり（くり返して鳴らす）。 */
  scrape(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.09);
    const bp = filter(ctx, 'bandpass', 1800 + Math.random() * 900, 1.4);
    const g = route(ctx, n.connect(bp), out, { rev: 0.03, ...p });
    perc(g.gain, t, 0.11 * fin(p.vel, 1), 0.008, 0.07);
  },
  /** 玉がはなれる「ぽんっ」。 */
  pop(ctx, out, t, p = {}) {
    const o = osc(ctx, 'sine', 620, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.1);
    const g = route(ctx, o, out, { rev: 0.1, ...p });
    perc(g.gain, t, 0.22, 0.003, 0.11);
  },
  /** のったときの「ぽよん」。p.pitch で高さ。 */
  plop(ctx, out, t, p = {}) {
    const k = fin(p.pitch, 1);
    const o = osc(ctx, 'sine', 330 * k, t, t + 0.35);
    o.frequency.setValueAtTime(330 * k, t);
    o.frequency.exponentialRampToValueAtTime(170 * k, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(240 * k, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(200 * k, t + 0.3);
    const g = route(ctx, o, out, { rev: 0.12, ...p });
    perc(g.gain, t, 0.3, 0.003, 0.3);
    const n = noise(ctx, t, t + 0.06);
    const g2 = route(ctx, n.connect(filter(ctx, 'lowpass', 700, 0.8)), out, p);
    perc(g2.gain, t, 0.12, 0.001, 0.05);
  },
  /** PERFECT のきらきら（コンボで高く）。 */
  sparkle(ctx, out, t, p = {}) {
    const k = fin(p.pitch, 1);
    [1319, 1760, 2349].forEach((f, i) => INSTRUMENTS.bell(ctx, out, t + i * 0.045, { f: f * k, vel: 0.42, dur: 0.7 }));
  },
  /** 傾いたときの「ぐらっ」。 */
  wobble(ctx, out, t, p = {}) {
    const o = osc(ctx, 'triangle', 150, t, t + 0.5);
    const lfo = osc(ctx, 'sine', 9, t, t + 0.5);
    const lg = ctx.createGain(); lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    const g = route(ctx, o.connect(filter(ctx, 'lowpass', 900)), out, p);
    perc(g.gain, t, 0.16, 0.02, 0.42);
  },
  /** 「べちゃっ」。 */
  splat(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.3);
    const lp = filter(ctx, 'lowpass', 2200, 1.2);
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    const g = route(ctx, n.connect(lp), out, { rev: 0.1, ...p });
    perc(g.gain, t, 0.45 * fin(p.vel, 1), 0.002, 0.25);
    const o = osc(ctx, 'sine', 420, t, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    const g2 = route(ctx, o, out, p);
    perc(g2.gain, t, 0.3 * fin(p.vel, 1), 0.002, 0.16);
  },
  /** 塔がきしむ音（くずれる前）。 */
  creak(ctx, out, t, p = {}) {
    const o = osc(ctx, 'sawtooth', 90, t, t + 0.6);
    o.frequency.linearRampToValueAtTime(70, t + 0.5);
    const bp = filter(ctx, 'bandpass', 600, 6);
    const g = route(ctx, o.connect(bp), out, p);
    adsr(g.gain, t, 0.26, 0.08, 0.3, 0.2);
  },
  /** スプレーをふる「しゃかしゃか」。 */
  rattle(ctx, out, t, p = {}) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.022;
      const n = noise(ctx, tt, tt + 0.03);
      const g = route(ctx, n.connect(filter(ctx, 'bandpass', 5200 + i * 700, 2)), out, p);
      perc(g.gain, tt, 0.12, 0.001, 0.025);
    }
  },
  /** ソースをしぼる「ぶにゅ」。 */
  squeeze(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.25);
    const bp = filter(ctx, 'bandpass', 300, 5);
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.linearRampToValueAtTime(520, t + 0.2);
    const g = route(ctx, n.connect(bp), out, p);
    adsr(g.gain, t, 0.45, 0.03, 0.12, 0.08);
  },
  /** さくらんぼがのる「ぷにっ」。 */
  pip(ctx, out, t, p = {}) {
    const o = osc(ctx, 'sine', 900, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.05);
    const g = route(ctx, o, out, { rev: 0.15, ...p });
    perc(g.gain, t, 0.2, 0.002, 0.1);
  },
  /** ウエハースが刺さる「さくっ」。 */
  crunch(ctx, out, t, p = {}) {
    for (let i = 0; i < 4; i++) {
      const tt = t + i * 0.018 + Math.random() * 0.01;
      const n = noise(ctx, tt, tt + 0.04);
      const g = route(ctx, n.connect(filter(ctx, 'highpass', 2500 + i * 400, 0.8)), out, p);
      perc(g.gain, tt, 0.12 - i * 0.02, 0.001, 0.035);
    }
  },
  /** 自転車のベル「ちりんちりん」（屋台が着いたとき）。 */
  bikebell(ctx, out, t, p = {}) {
    for (const dt of [0, 0.22]) {
      INSTRUMENTS.bell(ctx, out, t + dt, { f: 2637, vel: 0.5, dur: 0.6 });
      INSTRUMENTS.bell(ctx, out, t + dt + 0.005, { f: 3520, vel: 0.3, dur: 0.5 });
    }
  },
  /** マルの声「ぴぽ」：mood = happy（上がる）/ sad（下がる）/ normal。 */
  robot(ctx, out, t, p = {}) {
    const n = Math.max(1, Math.min(6, fin(p.n, 2)));
    const up = p.mood === 'happy' ? 1.25 : p.mood === 'sad' ? 0.8 : 1.05;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.09;
      const f0 = (700 + ((i * 3) % 4) * 140) * fin(p.pitch, 1);
      const o = osc(ctx, 'square', f0, tt, tt + 0.09);
      o.frequency.exponentialRampToValueAtTime(f0 * up, tt + 0.07);
      const g = route(ctx, o.connect(filter(ctx, 'lowpass', 2600)), out, { rev: 0.06, ...p });
      perc(g.gain, tt, 0.05, 0.004, 0.07);
    }
  },
  /** 花火の「どーん」と、ぱちぱち。 */
  boom(ctx, out, t, p = {}) {
    const o = osc(ctx, 'sine', 70, t, t + 1.4);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    const g = route(ctx, o, out, { rev: 0.5, ...p });
    perc(g.gain, t, 0.55 * fin(p.vel, 1), 0.005, 1.2);
    const n = noise(ctx, t, t + 1.4);
    const lp = filter(ctx, 'lowpass', 600, 0.7);
    const g2 = route(ctx, n.connect(lp), out, { rev: 0.6, ...p });
    perc(g2.gain, t, 0.25 * fin(p.vel, 1), 0.01, 1.2);
    for (let i = 0; i < 14; i++) {
      const tt = t + 0.35 + Math.random() * 0.9;
      const c = noise(ctx, tt, tt + 0.02);
      const gc = route(ctx, c.connect(filter(ctx, 'highpass', 3000, 0.7)), out, { rev: 0.4, ...p });
      perc(gc.gain, tt, 0.05 * fin(p.vel, 1), 0.001, 0.015);
    }
  },
  /** カモメ「みゃあ」。 */
  gull(ctx, out, t, p = {}) {
    const f = 1500 + Math.random() * 400;
    for (const [dt, len] of [[0, 0.22], [0.3, 0.16]]) {
      const o = osc(ctx, 'sawtooth', f, t + dt, t + dt + len);
      o.frequency.setValueAtTime(f * 0.8, t + dt);
      o.frequency.linearRampToValueAtTime(f * 1.15, t + dt + len * 0.3);
      o.frequency.linearRampToValueAtTime(f * 0.75, t + dt + len);
      const g = route(ctx, o.connect(filter(ctx, 'bandpass', 2200, 3)), out, { rev: 0.4, ...p });
      adsr(g.gain, t + dt, 0.035 * fin(p.vel, 1), 0.03, len * 0.5, len * 0.4);
    }
  },
  /** ひぐらし「カナカナカナ」（夕方）：細かいふるえを、短い音の連打で。 */
  higurashi(ctx, out, t, p = {}) {
    const vel = fin(p.vel, 1);
    for (let i = 0; i < 9; i++) {
      const f = 4300 - i * 60;
      for (let j = 0; j < 4; j++) {
        const tt = t + i * 0.12 + j * 0.018;
        const o = osc(ctx, 'sine', f, tt, tt + 0.02);
        const g = route(ctx, o, out, { rev: 0.5, ...p });
        perc(g.gain, tt, 0.028 * (1 - i * 0.07) * vel, 0.002, 0.014);
      }
    }
  },
  /** ノートをめくる。 */
  page(ctx, out, t, p = {}) {
    const n = noise(ctx, t, t + 0.25);
    const bp = filter(ctx, 'bandpass', 2500, 0.8);
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + 0.2);
    const g = route(ctx, n.connect(bp), out, p);
    adsr(g.gain, t, 0.08, 0.05, 0.08, 0.1);
  },
  /** 遠くの祭り太鼓（くり返し）。 */
  matsuri(ctx, out, t, p = {}) {
    INSTRUMENTS.taiko(ctx, out, t, { vel: 0.35, rev: 0.6 });
    INSTRUMENTS.taiko(ctx, out, t + 0.3, { vel: 0.25, rev: 0.6 });
    INSTRUMENTS.kane(ctx, out, t + 0.15, { vel: 0.2 });
  },
};
