// マルの改造（日の終わりのショップで買う）。levels はそれぞれの段階の値段。
//   fan：冷却ファン（溶けにくい）　gyro：ジャイロ（揺れが小さく・ゆっくり）　bell：呼びこみの鈴（お客さんが待ってくれる）
//   aim：ねらいライト（落とす所に印）
export const UPGRADES = {
  fan: { levels: [1200, 2600, 4400], icon: '❄' },
  gyro: { levels: [1500, 3200, 5400], icon: '◎' },
  bell: { levels: [1000, 2800], icon: '♪' },
  aim: { levels: [2400], icon: '◉' },
};
export const UPGRADE_IDS = Object.keys(UPGRADES);

/** 改造の段階から、遊びの値へ。 */
export function upgradeEffects(u = {}) {
  return {
    meltMul: 1 - 0.18 * (u.fan || 0),
    swingScale: 1 - 0.08 * (u.gyro || 0),
    speedScale: 1 - 0.08 * (u.gyro || 0),
    patienceMul: 1 + 0.15 * (u.bell || 0),
    aim: (u.aim || 0) > 0,
  };
}
