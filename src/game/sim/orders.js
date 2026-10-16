// 注文をつくる。種類：
//   exact   味を下から順に指定　　any  味は指定・順番はおまかせ　　same  同じ味で n 段
//   free    おまかせで n 段　　　　riddle  謎かけ（答えは data/riddles.js）
// 器（コーン・カップ）とトッピングも決める。常連の注文は data/characters.js の脚本から。
import { RIDDLES, riddlesFor } from '../data/riddles.js';

/** day：DAYS の 1 日、rng：Rng、index：その日の何人目か（1 から）。 */
export function makeOrder(day, rng, index, opts = {}) {
  const flavors = day.flavors.filter(Boolean);
  const [lo, hi] = day.tiers;
  // 段数：低めが多く、ときどき高い
  const roll = rng.float();
  let n = roll < 0.45 ? lo + rng.int(0, Math.min(1, hi - lo)) : roll < 0.85 ? rng.int(lo, Math.max(lo, hi - 1)) : hi;
  n = Math.max(1, Math.min(hi, n));
  const vessel = day.vessels.length > 1 && (rng.chance(n >= 4 ? 0.45 : 0.3)) ? 'cup' : 'cone';
  const order = { vessel, type: 'exact', scoops: [], toppings: [], n, index };
  // 謎かけ
  const rid = riddlesFor(flavors);
  if (day.riddle && rid.length && rng.chance(day.riddle)) {
    const id = rng.pick(rid);
    order.type = 'riddle';
    order.riddle = id;
    order.scoops = RIDDLES[id].answer.slice();
    order.n = order.scoops.length;
  } else {
    const t = n >= 2 ? rng.float() : 0;
    if (n >= 3 && t < 0.12) { order.type = 'free'; }
    else if (n >= 2 && t < 0.24) { order.type = 'same'; const f = rng.pick(flavors); order.scoops = Array(n).fill(f); }
    else if (n >= 2 && t < 0.42) { order.type = 'any'; for (let i = 0; i < n; i++) order.scoops.push(rng.pick(flavors)); }
    else { for (let i = 0; i < n; i++) order.scoops.push(rng.pick(flavors)); }
  }
  // トッピング
  if (day.toppings.length && rng.chance(0.55)) {
    const k = rng.chance(0.25) && day.toppings.length > 1 ? 2 : 1;
    const pool = day.toppings.slice();
    for (let i = 0; i < k; i++) order.toppings.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  // 待てる時間：段数が多いほど長く
  order.patience = (22 + order.n * 7 + order.toppings.length * 5) * (day.patience || 1);
  return order;
}

/** 注文の文（話しことば）を i18n で組み立てる。t は i18n の t。 */
export function orderText(order, t, voice = 'adult') {
  const fl = (id) => t('flavor.' + id);
  const vessel = t('vessel.' + order.vessel);
  const top = order.toppings.length ? t('order.toppings', { list: order.toppings.map((x) => t('topping.' + x)).join(t('order.and')) }) : '';
  const v = voice === 'kid' ? 'kid' : 'adult';
  let body;
  switch (order.type) {
    case 'riddle': return t('riddle.' + order.riddle) + (top ? ' ' + top : '');
    case 'free': body = t(`order.free.${v}`, { n: order.n }); break;
    case 'same': body = t(`order.same.${v}`, { f: fl(order.scoops[0]), n: order.n }); break;
    case 'any': body = t(`order.any.${v}`, { list: order.scoops.map(fl).join(t('order.and')), n: order.n }); break;
    default:
      body = order.n === 1 ? t(`order.one.${v}`, { f: fl(order.scoops[0]), vessel })
        : t(`order.exact.${v}`, { list: order.scoops.map(fl).join(t('order.then')), n: order.n });
  }
  const ves = order.n > 1 || order.type !== 'exact' ? t('order.vessel', { vessel }) : '';
  return [body, ves, top].filter(Boolean).join(' ');
}
