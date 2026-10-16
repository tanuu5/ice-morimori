// 共有の材質と、キャンバスで描くテクスチャの小道具。
import * as THREE from 'three';

const cache = new Map();

/** 同じ設定の材質を 1 つにまとめる（draw call と program を増やさない）。 */
export function mat(key, make) {
  let m = cache.get(key);
  if (!m) { m = make(); m.name = key; cache.set(key, m); }
  return m;
}

export const paint = (hex, rough = 0.42, extra = {}) =>
  mat(`paint:${hex}:${rough}:${JSON.stringify(extra)}`, () => new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.25, ...extra }));
export const matte = (hex, rough = 0.85, extra = {}) =>
  mat(`matte:${hex}:${rough}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra }));
export const metal = (hex = '#d9dee4', rough = 0.28) =>
  mat(`metal:${hex}:${rough}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 1 }));
export const glass = () =>
  mat('glass', () => new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false }));
export const rubber = () => mat('rubber', () => new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.9 }));
export const glow = (hex, intensity = 2) =>
  mat(`glow:${hex}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: hex, emissiveIntensity: intensity, roughness: 1 }));

/** キャンバスに描いてテクスチャにする。draw(g, w, h)。 */
export function canvasTex(w, h, draw, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** 角の丸い四角を描く（キャンバス）。 */
export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const FONT_UI = '"Zen Maru Gothic", "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", system-ui, sans-serif';
export const FONT_POP = '"Mochiy Pop One", "Zen Maru Gothic", "Hiragino Maru Gothic ProN", system-ui, sans-serif';

/** 影を落とす・受ける（子も全部）。 */
export function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}
