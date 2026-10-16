// 6 日間の営業。場所・時間帯・並べる味（8 つの槽、null は準備中）・注文の難しさ・常連の出番。
//   tiers：注文の段数の範囲　vessels：器　toppings：使えるトッピング　riddle：謎かけの割合
//   melt：溶ける速さ（1 秒あたり）　wind：風（横の加速度 m/s²）　patience：待てる時間の倍率　goal：目標の売上
//   regulars：{ 何人目: 常連の id }（その日の物語の注文）
export const DAYS = [
  {
    id: 1, location: 'harbor', look: 'morning',
    flavors: ['vanilla', 'choco', 'strawberry', null, null, null, null, null],
    tiers: [1, 2], vessels: ['cone'], toppings: [], riddle: 0,
    customers: 6, melt: 0.007, wind: 0, patience: 1.4, goal: 1500,
    regulars: { 1: 'mina', 4: 'tanaka' },
  },
  {
    id: 2, location: 'beach', look: 'noon',
    flavors: ['vanilla', 'choco', 'strawberry', 'soda', 'mango', null, null, null],
    tiers: [1, 3], vessels: ['cone', 'cup'], toppings: [], riddle: 0,
    customers: 7, melt: 0.016, wind: 0, patience: 1.2, goal: 2600,
    regulars: { 2: 'sota', 4: 'mina', 6: 'tanaka' },
  },
  {
    id: 3, location: 'park', look: 'afternoon',
    flavors: ['vanilla', 'choco', 'strawberry', 'soda', 'mango', 'matcha', null, null],
    tiers: [1, 4], vessels: ['cone', 'cup'], toppings: ['sprinkle', 'cherry'], riddle: 0.1,
    customers: 8, melt: 0.011, wind: 0, patience: 1.1, goal: 3800,
    regulars: { 1: 'ume', 3: 'mina', 6: 'sota' },
  },
  {
    id: 4, location: 'street', look: 'evening',
    flavors: ['vanilla', 'choco', 'strawberry', 'soda', 'mango', 'matcha', 'mint', null],
    tiers: [2, 5], vessels: ['cone', 'cup'], toppings: ['sprinkle', 'cherry', 'sauce', 'wafer'], riddle: 0.25,
    customers: 8, melt: 0.01, wind: 0, patience: 1.0, goal: 4600,
    regulars: { 2: 'tanaka', 4: 'ume', 6: 'mina' },
  },
  {
    id: 5, location: 'cape', look: 'sunset',
    flavors: ['vanilla', 'choco', 'strawberry', 'soda', 'mango', 'matcha', 'mint', 'blueberry'],
    tiers: [2, 7], vessels: ['cone', 'cup'], toppings: ['sprinkle', 'cherry', 'sauce', 'wafer'], riddle: 0.25,
    customers: 8, melt: 0.009, wind: 0.35, patience: 1.0, goal: 6500,
    regulars: { 1: 'sota', 3: 'tanaka', 5: 'mina' },
  },
  {
    id: 6, location: 'festival', look: 'night',
    flavors: ['vanilla', 'choco', 'strawberry', 'soda', 'mango', 'matcha', 'mint', 'blueberry'],
    tiers: [2, 8], vessels: ['cone', 'cup'], toppings: ['sprinkle', 'cherry', 'sauce', 'wafer'], riddle: 0.3,
    customers: 9, melt: 0.008, wind: 0, patience: 1.0, goal: 7200,
    regulars: { 2: 'ume', 4: 'sota', 6: 'tanaka', 7: 'mina', 9: 'gen' },
  },
];

/** エンドレス営業（6 日目のあと）。場所は選べる。 */
export function endlessDay(location, n) {
  const d = DAYS[5];
  return { ...d, id: 6 + n, location, look: { harbor: 'morning', beach: 'noon', park: 'afternoon', street: 'evening', cape: 'sunset', festival: 'night' }[location] || 'noon',
    tiers: [2, Math.min(10, 6 + Math.floor(n / 2))], customers: 10, regulars: {}, riddle: 0.3, goal: 8000 + n * 1000, endless: true };
}
