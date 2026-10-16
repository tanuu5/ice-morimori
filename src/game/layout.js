// 屋台まわりの寸法と置き場所（メートル）。場面・アイス・ロボ・カメラが同じ値を見る。
// 向き：お客さんは +Z 側に立って -Z を向く。ロボは -Z 側に立って +Z を向く。海（景色）は +Z の向こう。
import * as THREE from 'three';

export const COUNTER_Y = 0.88;                 // 屋台の天板の高さ
export const BODY = { x0: -0.52, x1: 0.86, z0: -0.34, z1: 0.34, y0: 0.32 };   // 荷台の箱

// アイスのケース（天板に埋めた冷凍の槽）。4 列 × 2 段
export const WELL = { x0: -0.16, x1: 0.64, z0: -0.27, z1: 0.07, depth: 0.13 };
export const TUB = { cols: 4, rows: 2, w: 0.19, d: 0.15 };
/** i 番目（0〜7、奥の段の左から）の容器の中心（天板の高さ）。 */
export function tubCenter(i, out = new THREE.Vector3()) {
  const col = i % TUB.cols, row = Math.floor(i / TUB.cols);
  const gx = (WELL.x1 - WELL.x0 - TUB.cols * TUB.w) / (TUB.cols + 1);
  const gz = (WELL.z1 - WELL.z0 - TUB.rows * TUB.d) / (TUB.rows + 1);
  return out.set(WELL.x0 + gx + TUB.w / 2 + col * (TUB.w + gx), COUNTER_Y, WELL.z0 + gz + TUB.d / 2 + row * (TUB.d + gz));
}

// 塔の土台（コーン立て・カップ置き）。天板の前のふち
export const STAND = new THREE.Vector3(0.24, COUNTER_Y, 0.2);
// トッピングの置き場（天板の左の端、2 × 2）
export function toppingSpot(i, out = new THREE.Vector3()) {
  const col = i % 2, row = Math.floor(i / 2);
  return out.set(-0.43 + col * 0.17, COUNTER_Y, -0.15 + row * 0.27);
}
// コーンとカップの置き場（右の端）
export const CONE_RACK = new THREE.Vector3(0.76, COUNTER_Y, 0.02);
export const DIPPER_WELL = new THREE.Vector3(0.75, COUNTER_Y, -0.2); // ディッシャーを休ませる水入れ
export const CUP_RACK = new THREE.Vector3(0.76, COUNTER_Y, 0.2);

export const ROBOT_POS = new THREE.Vector3(-0.12, 0, -0.62);
export const ROBOT_SCALE = 1.12;
export const ROBOT_BASE_LIFT = 0.16; // ふだんから胴を少し上げて、肩を天板より上に
export const CUSTOMER_POS = new THREE.Vector3(0.86, 0, 0.92);

// アイスの玉の大きさ（半径）。すくう量で SCOOP_R.min〜max
export const SCOOP_R = { min: 0.03, ideal: 0.053, max: 0.062 };
