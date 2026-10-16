// 物語：はじまり、朝の電話（源さん）、夜の電話と学習ログ、常連の注文と台詞、源さんのノート、エンディング。
// 文はすべて i18n のキー（src/i18n/story.ja.js / story.en.js）。行は { who, key, face?, if? }。
//   who：maru / gen / phone（電話の源さん）/ mina / sota / tanaka / ume / haruka / kid / narration
//   face：マルの表情（RobotFace の EXPR）

const L = (who, key, face) => ({ who, key, face });

export const INTRO = [
  L('narration', 'st.intro.1'), L('narration', 'st.intro.2'),
  L('phone', 'st.intro.3'), L('maru', 'st.intro.4', 'happy'), L('phone', 'st.intro.5'), L('phone', 'st.intro.6'),
  L('maru', 'st.intro.7', 'focus'), L('phone', 'st.intro.8'), L('maru', 'st.intro.9', 'star'), L('phone', 'st.intro.10'),
  L('phone', 'st.intro.11'), L('maru', 'st.intro.12', 'happy'),
];

// 朝（営業の前）。3 日目にノート、4 日目にソース・ウエハースを教わる
export const MORNING = {
  1: [L('phone', 'st.d1.am.1'), L('phone', 'st.d1.am.2'), L('phone', 'st.d1.am.3'), L('phone', 'st.d1.am.4'), L('maru', 'st.d1.am.5', 'happy')],
  2: [L('phone', 'st.d2.am.1'), L('phone', 'st.d2.am.2'), L('maru', 'st.d2.am.3', 'star')],
  3: [L('phone', 'st.d3.am.1'), L('phone', 'st.d3.am.2'), L('phone', 'st.d3.am.3'), L('maru', 'st.d3.am.4', 'think'), L('phone', 'st.d3.am.5')],
  4: [L('phone', 'st.d4.am.1'), L('phone', 'st.d4.am.2'), L('maru', 'st.d4.am.3', 'think')],
  5: [L('phone', 'st.d5.am.1'), L('phone', 'st.d5.am.2'), L('maru', 'st.d5.am.3', 'surprised'), L('phone', 'st.d5.am.4')],
  6: [L('narration', 'st.d6.am.1'), L('phone', 'st.d6.am.2'), L('maru', 'st.d6.am.3', 'love')],
};

// 夜（結果のあと）。good：目標を達成したか
export function evening(day, good) {
  const d = day.id;
  const E = {
    1: [L('maru', 'st.d1.pm.1', 'happy'), L('phone', good ? 'st.d1.pm.2a' : 'st.d1.pm.2b'), L('phone', 'st.d1.pm.3'), L('maru', 'st.d1.pm.4', 'happy'), L('phone', 'st.d1.pm.5')],
    2: [L('phone', 'st.d2.pm.1'), L('phone', 'st.d2.pm.2'), L('maru', 'st.d2.pm.3', 'think'), L('phone', 'st.d2.pm.4')],
    3: [L('phone', 'st.d3.pm.1'), L('maru', 'st.d3.pm.2', 'happy'), L('phone', 'st.d3.pm.3')],
    4: [L('maru', 'st.d4.pm.1', 'think'), L('phone', 'st.d4.pm.2'), L('phone', 'st.d4.pm.3')],
    5: [L('maru', 'st.d5.pm.1', 'surprised'), L('phone', 'st.d5.pm.2'), L('phone', 'st.d5.pm.3'), L('maru', 'st.d5.pm.4', 'think')],
  }[d] || [];
  return [...E, L('narration', 'log.d' + d)];
}

export const ENDING = [
  L('narration', 'st.end.1'), L('maru', 'st.end.2', 'think'), L('gen', 'st.end.3'),
  L('mina', 'st.end.4'), L('sota', 'st.end.5'), L('tanaka', 'st.end.6'), L('ume', 'st.end.7'), L('gen', 'st.end.8'),
  L('maru', 'st.end.9', 'love'), L('narration', 'log.d6'), L('narration', 'st.end.10'),
];

// 常連の注文：日ごとに { order, line（注文の文のキー）, good, bad }
//   order の形は sim/orders.js と同じ（type, scoops, n, vessel, toppings）。riddle は data/riddles.js の id
export const REGULAR_ORDERS = {
  mina: {
    1: { order: { type: 'exact', scoops: ['strawberry'], vessel: 'cone' } },
    2: { order: { type: 'exact', scoops: ['strawberry', 'vanilla', 'strawberry'], vessel: 'cone' } },
    3: { order: { type: 'exact', scoops: ['strawberry', 'soda', 'vanilla', 'strawberry'], vessel: 'cone', toppings: ['sprinkle'] } },
    4: { order: { type: 'free', n: 5, vessel: 'cone', toppings: ['cherry'] } },
    5: { order: { type: 'free', n: 7, vessel: 'cup' } },
    6: { order: { type: 'free', n: 10, vessel: 'cup', toppings: ['cherry'] } },
  },
  sota: {
    2: { order: { type: 'exact', scoops: ['mango', 'soda'], vessel: 'cup' } },
    3: { order: { type: 'free', n: 3, vessel: 'cone', toppings: ['sprinkle'] } },
    5: { order: { type: 'riddle', riddle: 'sunset', vessel: 'cone' } },
    6: { order: { type: 'free', n: 6, vessel: 'cup', toppings: ['sauce', 'cherry'] } },
  },
  tanaka: {
    1: { order: { type: 'exact', scoops: ['vanilla'], vessel: 'cone' } },
    2: { order: { type: 'exact', scoops: ['vanilla'], vessel: 'cup' } },
    4: { order: { type: 'exact', scoops: ['vanilla', 'choco'], vessel: 'cone' } },
    5: { order: { type: 'exact', scoops: ['choco', 'vanilla', 'choco'], vessel: 'cone' } },
    6: { order: { type: 'riddle', riddle: 'tanaka', vessel: 'cone' } },
  },
  ume: {
    3: { order: { type: 'riddle', riddle: 'gen', vessel: 'cone' } },
    4: { order: { type: 'exact', scoops: ['strawberry'], vessel: 'cup' } },
    6: { order: { type: 'exact', scoops: ['strawberry', 'vanilla'], vessel: 'cup' } },
  },
  gen: {
    6: { order: { type: 'free', n: 5, vessel: 'cone', toppings: [] }, min: 5 },
  },
};

// 源さんのノート：何日目から読めるか
export const NOTEBOOK = [
  { id: 'scoop', day: 1 }, { id: 'stack', day: 1 }, { id: 'mina', day: 1 }, { id: 'ume', day: 3 }, { id: 'gen', day: 3 },
  { id: 'riddle', day: 3 }, { id: 'tanaka', day: 4 }, { id: 'special', day: 5, evening: true },
];
