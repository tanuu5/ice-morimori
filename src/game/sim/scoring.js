// 採点：注文と、できた塔をくらべる。★1〜5、代金、チップ、♥、ひとこと（の種類）。
//   built = { vessel, scoops: [{ flavor, grade, melt }], sizes: [0〜1], toppings: [{ id, q }], left（待ち時間の残りの割合） }
import { riddleMatch } from '../data/riddles.js';

const GRADE = { perfect: 1, good: 0.82, ok: 0.55 };

export function correctness(order, flavors) {
  const n = order.n, m = flavors.length;
  if (!m) return 0;
  const denom = Math.max(n, m);
  switch (order.type) {
    case 'riddle': {
      if (riddleMatch(order.riddle, flavors)) return 1;
      return positional(order.scoops, flavors) * 0.7;
    }
    case 'free': return Math.min(m, n) / n * (m > n ? 0.95 : 1);
    case 'same': return flavors.filter((f) => f === order.scoops[0]).length / denom;
    case 'any': {
      const want = order.scoops.slice();
      let hit = 0;
      for (const f of flavors) { const k = want.indexOf(f); if (k >= 0) { hit++; want.splice(k, 1); } }
      return hit / denom;
    }
    default: return positional(order.scoops, flavors);
  }
}

function positional(want, got) {
  let hit = 0;
  for (let i = 0; i < Math.min(want.length, got.length); i++) if (want[i] === got[i]) hit++;
  return hit / Math.max(want.length, got.length);
}

export function evaluate(order, built) {
  const flavors = built.scoops.map((s) => s.flavor);
  let correct = correctness(order, flavors);
  const vesselOk = built.vessel === order.vessel;
  if (!vesselOk) correct = Math.max(0, correct - 0.15);
  const m = built.scoops.length;
  const beauty = m ? built.scoops.reduce((a, s) => a + (GRADE[s.grade] ?? 0.5), 0) / m : 0;
  const size = built.sizes.length ? built.sizes.reduce((a, b) => a + b, 0) / built.sizes.length : 1;
  const melt = m ? built.scoops.reduce((a, s) => a + s.melt, 0) / m : 0;
  // トッピング：頼まれたものがあるか（量のよさも）
  let top = 1;
  if (order.toppings.length) {
    let got = 0;
    for (const id of order.toppings) { const t = built.toppings.find((x) => x.id === id); if (t) got += 0.6 + 0.4 * (t.q ?? 1); }
    top = got / order.toppings.length;
  }
  const extra = built.toppings.filter((x) => !order.toppings.includes(x.id)).length;
  const left = Math.max(0, Math.min(1, built.left ?? 1));
  let score = correct * 58 + beauty * 16 + size * 6 + top * 10 + (0.5 + 0.5 * left) * 10;
  score *= 1 - Math.max(0, melt - 0.25) * 0.55;
  score = Math.round(Math.max(0, Math.min(100, score)));
  let stars = score >= 90 ? 5 : score >= 76 ? 4 : score >= 58 ? 3 : score >= 38 ? 2 : 1;
  if (correct < 0.5) stars = Math.min(stars, 2);
  if (!m) stars = 1;
  // 代金とチップ
  const price = 100 + 120 * order.n + 60 * order.toppings.length;
  const pay = !m ? 0 : correct >= 0.5 ? price : Math.round(price * 0.5 / 10) * 10;
  const tip = Math.round((pay * ({ 5: 0.5, 4: 0.25, 3: 0.08 }[stars] || 0)) / 10) * 10 + (extra && stars >= 3 ? 30 : 0);
  const hearts = stars >= 5 ? 2 : stars >= 4 ? 1 : 0;
  // ひとこと：いちばん目立つ理由
  let reason = 'great';
  if (!m) reason = 'empty';
  else if (correct < 0.5) reason = 'wrong';
  else if (!vesselOk) reason = 'vessel';
  else if (correct < 0.99) reason = m < order.n ? 'short' : m > order.n ? 'extra' : 'mixed';
  else if (order.toppings.length && top < 0.6) reason = 'topping';
  else if (melt > 0.55) reason = 'melted';
  else if (left < 0.15) reason = 'slow';
  else if (beauty < 0.7) reason = 'messy';
  else if (stars >= 5) reason = beauty > 0.97 ? 'perfect' : 'great';
  else reason = 'good';
  return { score, stars, pay, tip, hearts, reason, correct, beauty, size, melt, top, left, vesselOk };
}
