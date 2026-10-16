// お客さんの見た目（体つき・肌・髪・服・帽子・小物）。乱数で町の人を作る。常連は characters.js で決める。
export const SKINS = ['#ffe0c4', '#f7d0ae', '#eab88f', '#d9a073', '#b97c52', '#8d5a3b'];
export const HAIRS = ['#2b2321', '#3b2a22', '#5a3b28', '#8a5a34', '#c98b4b', '#e5c07b', '#d9d4cf', '#a8a29e', '#7a4a3a'];
export const TOPS = ['#ff8fab', '#ffd166', '#74c0fc', '#8ce99a', '#ffffff', '#ffa94d', '#b197fc', '#63e6be', '#ff6b6b', '#4dabf7', '#f8f0e3', '#2f3e4e'];
export const BOTTOMS = ['#3b5b8c', '#2f3e4e', '#e9ecef', '#c9b79c', '#5c7cfa', '#495057', '#ffd8a8', '#96f2d7'];

/** 体つき：kid（子ども）/ teen（中高生）/ adult / elder。 */
export function randomLook(rng, { body } = {}) {
  const b = body || rng.pick(['kid', 'kid', 'teen', 'adult', 'adult', 'adult', 'elder']);
  const fem = rng.chance(0.5);
  const hairStyles = fem ? ['bob', 'pony', 'long', 'twin', 'bun', 'short'] : ['short', 'short', 'spiky', 'buzz', 'side'];
  let hair = rng.pick(hairStyles);
  if (b === 'elder') hair = rng.pick(fem ? ['bun', 'bob', 'short'] : ['short', 'buzz', 'bald']);
  const skin = rng.pick(SKINS);
  let hairColor = b === 'elder' ? rng.pick(['#d9d4cf', '#bdb7b0', '#a8a29e']) : rng.pick(HAIRS.slice(0, 7));
  // 髪と肌の明るさが近いと、はげ頭に見えるので、暗い色に替える
  if (Math.abs(lum(hairColor) - lum(skin)) < 0.18) hairColor = lum(skin) > 0.45 ? rng.pick(HAIRS.slice(0, 3)) : rng.pick(['#e5c07b', '#d9d4cf', '#2b2321']);
  const tops = b === 'adult' && rng.chance(0.25) ? 'shirt' : rng.pick(['tee', 'tee', 'tank', 'aloha', fem ? 'dress' : 'tee']);
  const look = {
    body: b,
    fem,
    skin,
    hair,
    hairColor,
    top: tops,
    topColor: rng.pick(TOPS),
    topColor2: rng.pick(TOPS),
    bottom: rng.pick(b === 'kid' ? ['shorts', 'shorts', 'skirt'] : ['shorts', 'pants', 'skirt', 'shorts']),
    bottomColor: rng.pick(BOTTOMS),
    shoe: rng.pick(['#ffffff', '#ff8787', '#495057', '#ffd43b', '#4dabf7']),
    hat: rng.pick([null, null, null, 'straw', 'cap', 'visor', 'bucket']),
    hatColor: rng.pick(['#f1d79a', '#ff8fab', '#74c0fc', '#ffffff', '#ffd166', '#8ce99a']),
    glasses: rng.chance(b === 'kid' ? 0.08 : 0.22) ? rng.pick(['sun', 'round']) : null,
    acc: rng.pick([null, null, null, 'towel', 'ring', 'bag', 'fan']),
    accColor: rng.pick(TOPS),
    blush: rng.chance(0.5),
    voice: b === 'kid' ? 'kid' : 'adult',
    pitch: (b === 'kid' ? 1.45 : b === 'teen' ? 1.15 : b === 'elder' ? 0.85 : 1) * (fem ? 1.12 : 0.9) * rng.range(0.93, 1.07),
  };
  if (look.top === 'dress') look.bottom = 'none';
  if (look.acc === 'ring' && b !== 'kid') look.acc = 'towel';
  return look;
}

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
