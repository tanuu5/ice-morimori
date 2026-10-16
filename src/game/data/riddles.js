// 謎かけの注文。answer は下から順の味。alt は別の正解。needs は並んでいないと出さない味。
// 文は i18n のキー（riddle.<id>）、答えの説明はノートに載る（note.riddle.<id>）。
export const RIDDLES = {
  panda: { answer: ['vanilla', 'choco', 'vanilla'], alt: [['choco', 'vanilla', 'choco'], ['vanilla', 'choco'], ['choco', 'vanilla']], needs: ['vanilla', 'choco'] },
  sky: { answer: ['soda', 'vanilla'], alt: [['vanilla', 'soda']], needs: ['soda', 'vanilla'] },
  signal: { answer: ['matcha', 'mango', 'strawberry'], alt: [['mint', 'mango', 'strawberry']], needs: ['matcha', 'mango', 'strawberry'] },
  sunset: { answer: ['mango', 'strawberry', 'blueberry'], alt: [['mango', 'strawberry']], needs: ['mango', 'strawberry'] },
  forest: { answer: ['matcha', 'mint', 'matcha'], alt: [['mint', 'matcha', 'mint'], ['matcha', 'mint'], ['mint', 'matcha']], needs: ['matcha', 'mint'] },
  snowman: { answer: ['vanilla', 'vanilla'], alt: [], needs: ['vanilla'] },
  sea: { answer: ['vanilla', 'soda', 'blueberry'], alt: [['soda', 'blueberry'], ['vanilla', 'soda']], needs: ['soda', 'vanilla'] },
  sakura: { answer: ['strawberry', 'vanilla', 'strawberry'], alt: [['vanilla', 'strawberry'], ['strawberry', 'vanilla']], needs: ['strawberry', 'vanilla'] },
  night: { answer: ['blueberry', 'choco', 'mango'], alt: [['choco', 'blueberry', 'mango'], ['blueberry', 'mango']], needs: ['blueberry', 'mango'] },
  tiger: { answer: ['mango', 'choco', 'mango', 'choco'], alt: [['choco', 'mango', 'choco', 'mango'], ['mango', 'choco', 'mango']], needs: ['mango', 'choco'] },
  // 物語の注文（ふつうのお客さんは頼まない）
  gen: { answer: ['matcha', 'vanilla'], alt: [], needs: ['matcha', 'vanilla'], story: true },
  tanaka: { answer: ['vanilla', 'choco'], alt: [], needs: ['vanilla', 'choco'], story: true },
};

/** 並んでいる味で出せる謎かけ。 */
export function riddlesFor(flavors) {
  return Object.keys(RIDDLES).filter((id) => !RIDDLES[id].story && RIDDLES[id].answer.concat(RIDDLES[id].needs).every((f) => flavors.includes(f)));
}

/** 作った並び（下から）が、その謎かけの答えか。 */
export function riddleMatch(id, built) {
  const R = RIDDLES[id];
  const same = (a) => a.length === built.length && a.every((f, i) => f === built[i]);
  return same(R.answer) || R.alt.some(same);
}
