// アイスの味。色（a = 地の色、b = 筋の色、speck = 粒の色）と、模様の強さ。
// 名前は i18n のキー（flavor.<id>）。hard はすくいにくさ（大きいほどゲージがゆっくり）。
export const FLAVORS = {
  vanilla: { a: '#fff1d2', b: '#ffe6b0', speck: '#5a4030', speckAmt: 0.12, speckScale: 40, swirl: 0.35, hard: 1.0 },
  choco: { a: '#7a4428', b: '#5c301c', speck: '#3a1f12', speckAmt: 0.0, speckScale: 30, swirl: 0.5, hard: 1.15, gloss: 0.12 },
  strawberry: { a: '#ffb3c4', b: '#ff8aa6', speck: '#d8304e', speckAmt: 0.55, speckScale: 18, swirl: 0.6, hard: 0.95 },
  soda: { a: '#9fdcff', b: '#e8f8ff', speck: '#ffffff', speckAmt: 0.2, speckScale: 22, swirl: 0.8, hard: 0.85 },
  mango: { a: '#ffc04d', b: '#ffdb8a', speck: '#ff9a1f', speckAmt: 0.25, speckScale: 16, swirl: 0.55, hard: 0.9 },
  matcha: { a: '#a7c96a', b: '#8fb557', speck: '#6f9440', speckAmt: 0.1, speckScale: 40, swirl: 0.3, hard: 1.05 },
  mint: { a: '#aef2d6', b: '#c9f7e4', speck: '#3b2214', speckAmt: 0.6, speckScale: 11, swirl: 0.3, hard: 1.0 },
  blueberry: { a: '#a98be0', b: '#cdb6f2', speck: '#5b3a9a', speckAmt: 0.45, speckScale: 20, swirl: 0.75, hard: 0.95 },
};

export const FLAVOR_IDS = Object.keys(FLAVORS);
