// 開発用の自動プレイ：本物のループ（game.step）を回しながら、すくう・落とすを機械的に行う。
// 揺れ方や崩れ方の確かめ、撮影の場面づくりに使う（__dev.game.auto.stack(5, { aim: 0.01 })）。
//   aim：落とすときに狙う、てっぺんからのずれ（m）。0 なら真ん中、0.03 ならわざと外す
//   gauge：すくう量（0〜1）
export function makeAutoplay(game) {
  const dt = 1 / 60;
  const run = (cond, max = 10) => { let t = 0; while (!cond() && t < max) { game.step(dt); t += dt; } return t; };
  return {
    /** n 段積む。戻り値：各段の着地の結果と、最後の塔の段数。 */
    stack(n, { aim = 0, gauge = 0.72, flavors = null, side = 1 } = {}) {
      const c = game.counter;
      const out = [];
      for (let k = 0; k < n; k++) {
        if (c.phase !== 'select') run(() => c.phase === 'select', 3);
        const list = c.flavors.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
        c.pick(flavors ? c.flavors.indexOf(flavors[k % flavors.length]) : list[k % list.length]);
        c.press();
        game.tagHeld = true; // 押しっぱなしのあつかい（ループの入力で離されないように）
        run(() => c.gauge >= gauge, 3);
        game.tagHeld = false;
        c.release();
        run(() => c.phase === 'aim', 2);
        // 揺れが狙いの位置を通るまで待つ（てっぺん + aim * side）
        const want = () => c.tower.dropPoint().x + aim * side;
        run(() => Math.abs(c.dipperPos.x - c.tower.root.position.x - want()) < 0.002, 8);
        c.press();
        run(() => c.phase === 'select' || c.phase === 'settle', 2);
        out.push(c.last ? { grade: c.last.grade, ratio: +(c.last.ratio || 0).toFixed(2) } : null);
        run(() => c.phase === 'select', 2);
      }
      return { results: out, tiers: c.tower.count, danger: +c.tower.danger().toFixed(2) };
    },
    /** 今のお客さんの注文どおりに作って渡す（作り始めるまで待つ）。戻り値：採点の結果。 */
    serve({ aim = 0, gauge = 0.72, wrong = false } = {}) {
      const sh = game.shift;
      run(() => sh.phase === 'make' || sh.phase === 'closed', 20);
      if (sh.phase !== 'make') return { phase: sh.phase };
      const o = sh.order;
      let flavors = o.type === 'free' ? null : o.scoops.slice();
      if (wrong && flavors) flavors = flavors.map((f) => game.counter.flavors.find((x) => x && x !== f) || f);
      this.stack(o.n, { aim, gauge, flavors });
      sh.serve();
      run(() => sh.phase === 'react', 3);
      const r = sh.result;
      return { order: `${o.type}:${o.scoops.join('/')}${o.toppings.length ? '+' + o.toppings.join('/') : ''}`, stars: r.stars, score: r.score, pay: r.pay, tip: r.tip, reason: r.reason };
    },
    /** 1 日を最後まで自動で。 */
    day({ aim = 0 } = {}) {
      const sh = game.shift;
      const out = [];
      for (let i = 0; i < 20 && sh.phase !== 'closed' && game.shift === sh; i++) out.push(this.serve({ aim }));
      return { results: out, money: sh.money };
    },
    /** sec 秒、そのまま時間を進める（溶けと揺れを見る）。 */
    wait(sec) { run(() => false, sec); return { tiers: game.counter.tower.count, danger: +game.counter.tower.danger().toFixed(2) }; },
  };
}
