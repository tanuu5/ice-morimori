// 世界：空・海・光・環境マップ・場所の背景。時間帯（LOOKS）と場所（locations/）を切り替える。
import * as THREE from 'three';
import { Sky } from './scene/Sky.js';
import { Sea } from './scene/Sea.js';
import { Cart } from './scene/Cart.js';
import { LOCATIONS } from './scene/locations/index.js';
import { mergeStatic } from './scene/merge.js';

// 時間帯の見た目（色は sRGB の 16 進）。sun は太陽のある向き（+Z が海、+X が東）
export const LOOKS = {
  morning: {
    sky: { top: '#4f9fe3', mid: '#94cdf3', horizon: '#e4f1f2', ground: '#9fc7d9', sunColor: '#fff0d2', cloudLit: '#ffffff', cloudShade: '#b9cde0', cloud: 0.5, sunSize: 0.0016 },
    sun: [0.62, 0.42, -0.62], sunColor: '#fff0dc', sunI: 2.1, hemiSky: '#cfe6ff', hemiGround: '#d9c9a8', hemiI: 0.85, envI: 0.4,
    sea: { shallow: '#4dd3cc', deep: '#1a74b5', skyTop: '#4f9fe3', skyHorizon: '#cde8f5', fogColor: '#dcedf1' },
    fog: '#dcedf1', fogNear: 40, fogFar: 520, exposure: 0.95,
    post: { bloomStrength: 0.28, bloomThreshold: 1.6, saturation: 1.1, contrast: 1.04, gain: [1.0, 0.99, 0.97] },
  },
  noon: {
    sky: { top: '#2f86e0', mid: '#7cc2f5', horizon: '#d8f0fb', ground: '#8fc4dc', sunColor: '#fffaf0', cloudLit: '#ffffff', cloudShade: '#c4d6e8', cloud: 0.62, sunSize: 0.0014 },
    sun: [0.22, 0.93, -0.3], sunColor: '#fffaf0', sunI: 2.4, hemiSky: '#d2eaff', hemiGround: '#e8d9b8', hemiI: 0.9, envI: 0.42,
    sea: { shallow: '#3fe0d0', deep: '#126fc0', skyTop: '#2f86e0', skyHorizon: '#c8ecfb', fogColor: '#d5eefa' },
    fog: '#d5eefa', fogNear: 40, fogFar: 520, exposure: 1.0,
    post: { bloomStrength: 0.3, bloomThreshold: 1.6, saturation: 1.12, contrast: 1.05, gain: [1.0, 1.0, 0.98] },
  },
  afternoon: {
    sky: { top: '#3a8fdd', mid: '#88c6ef', horizon: '#eaf0e6', ground: '#a7c4cf', sunColor: '#fff0d0', cloudLit: '#fffaf0', cloudShade: '#c7c9d8', cloud: 0.55, sunSize: 0.0016 },
    sun: [-0.52, 0.6, -0.55], sunColor: '#ffeccc', sunI: 2.2, hemiSky: '#d6e8ff', hemiGround: '#d8cfa8', hemiI: 0.85, envI: 0.4,
    sea: { shallow: '#48cfc6', deep: '#1b6fae', skyTop: '#3a8fdd', skyHorizon: '#dbeaf0', fogColor: '#e2ece8' },
    fog: '#e2ece8', fogNear: 40, fogFar: 480, exposure: 1.0,
    post: { bloomStrength: 0.3, bloomThreshold: 1.6, saturation: 1.1, contrast: 1.04, gain: [1.02, 1.0, 0.96] },
  },
  evening: {
    sky: { top: '#4a74c9', mid: '#a7a8d8', horizon: '#ffd2a1', ground: '#b49aa0', sunColor: '#ffc27a', cloudLit: '#ffe0c0', cloudShade: '#9b8fb5', cloud: 0.5, sunSize: 0.0022 },
    sun: [-0.78, 0.26, -0.45], sunColor: '#ffc48a', sunI: 2.0, hemiSky: '#c9c6ee', hemiGround: '#c9a68c', hemiI: 0.8, envI: 0.38,
    sea: { shallow: '#5ab9c0', deep: '#2a5a96', skyTop: '#4a74c9', skyHorizon: '#ffd8b0', fogColor: '#f3d6be' },
    fog: '#f3d6be', fogNear: 35, fogFar: 420, exposure: 1.02,
    post: { bloomStrength: 0.4, bloomThreshold: 1.4, saturation: 1.1, contrast: 1.05, gain: [1.05, 0.98, 0.92] },
  },
  sunset: {
    sky: { top: '#3b4f9e', mid: '#c27aa8', horizon: '#ffb36b', ground: '#7a5d7d', sunColor: '#ffad5c', cloudLit: '#ffb98a', cloudShade: '#7c5f92', cloud: 0.45, sunSize: 0.004, sunGlow: 1.6 },
    sun: [-0.2, 0.07, 0.97], sunColor: '#ffa868', sunI: 1.9, hemiSky: '#b9a3d6', hemiGround: '#a07a6a', hemiI: 0.85, envI: 0.45,
    sea: { shallow: '#4d8fb0', deep: '#2b3f7c', skyTop: '#5a5ca8', skyHorizon: '#ffb377', fogColor: '#e9a98a' },
    fog: '#e9a98a', fogNear: 30, fogFar: 380, exposure: 1.06,
    post: { bloomStrength: 0.5, bloomThreshold: 1.2, saturation: 1.12, contrast: 1.06, gain: [1.06, 0.96, 0.92] },
  },
  night: {
    sky: { top: '#0b1636', mid: '#1b2b5a', horizon: '#3a3f6e', ground: '#141a33', sunColor: '#c8d8ff', cloudLit: '#3a4775', cloudShade: '#141c3a', cloud: 0.3, sunSize: 0.0012, sunGlow: 0.5, stars: 1 },
    sun: [0.35, 0.55, 0.75], sunColor: '#b8c8ff', sunI: 0.35, hemiSky: '#45568f', hemiGround: '#2a2433', hemiI: 0.55, envI: 0.35,
    sea: { shallow: '#1f4a6a', deep: '#0c1d3d', skyTop: '#1b2b5a', skyHorizon: '#3a3f6e', fogColor: '#262c55' },
    fog: '#262c55', fogNear: 25, fogFar: 300, exposure: 1.1,
    post: { bloomStrength: 0.5, bloomThreshold: 1.05, bloomRadius: 0.55, saturation: 1.12, contrast: 1.05, gain: [0.98, 0.98, 1.04], lift: [0.015, 0.015, 0.03] },
  },
};

export class World {
  constructor(renderer) {
    this.renderer = renderer;
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog('#dcedf1', 40, 520);
    this.sky = new Sky();
    scene.add(this.sky.mesh);
    this.sea = new Sea();
    scene.add(this.sea.mesh);

    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#d9c9a8', 1.2);
    scene.add(this.hemi);
    const sun = (this.sunLight = new THREE.DirectionalLight('#fff0dc', 2.6));
    sun.castShadow = true;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.015;
    sun.shadow.radius = 3;
    sun.shadow.intensity = 0.88;
    // 影は屋台のまわりだけ細かく（背景は遠いので、別に大きな影は描かない）
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
    scene.add(sun, sun.target);
    this.sunDir = new THREE.Vector3(0.6, 0.4, -0.6).normalize();
    renderer.onQuality = (p) => { sun.shadow.mapSize.set(p.shadowSize, p.shadowSize); sun.shadow.map?.dispose(); sun.shadow.map = null; };
    renderer.onQuality(renderer.preset);

    this.cart = new Cart();
    scene.add(this.cart.root);
    mergeStatic(this.cart.root, { keep: [...this.cart.wheels, this.cart.parasol, this.cart.flag] });
    mergeStatic(this.cart.parasol); // パラソルの布は中でまとめる（グループごと大きさを変えるので、外とはまとめない）
    // 屋台の手もとの明かり（夕方から夜。パラソルの下の電球の代わり）
    this.cartLight = new THREE.PointLight('#ffd9a0', 0, 3.6, 1.6);
    this.cartLight.position.set(0.35, 2.15, 0.45);
    this.cart.root.add(this.cartLight);

    this.pmrem = new THREE.PMREMGenerator(renderer.renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envScene.add(this.envSky.mesh);
    this.envRT = null;

    this.location = null;
    this.locationId = null;
    this.lookId = null;
    this.time = 0;
    this.focus = new THREE.Vector3(0.2, 1, 0); // 影のカメラを合わせる中心
  }

  /** 時間帯を変える。 */
  setLook(id) {
    const L = LOOKS[id];
    if (!L) throw new Error('時間帯がありません: ' + id);
    this.lookId = id;
    this.sky.set({ ...L.sky, stars: L.sky.stars ?? 0, sunGlow: L.sky.sunGlow ?? 1, sunDir: new THREE.Vector3(...L.sun) });
    this.sunDir.set(...L.sun).normalize();
    this.sunLight.color.set(L.sunColor);
    this.sunLight.intensity = L.sunI;
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.scene.fog.color.set(L.fog);
    this.scene.fog.near = L.fogNear;
    this.scene.fog.far = L.fogFar;
    this.sea.set({ ...L.sea, sunDir: this.sunDir, sunColor: L.sunColor, fogNear: L.fogNear + 20, fogFar: L.fogFar * 1.3 });
    this.renderer.setLook({ exposure: L.exposure, vignette: 0.22, ...L.post });
    this.cart.setNight(id === 'night');
    this.cartLight.intensity = id === 'night' ? 3.2 : id === 'evening' || id === 'sunset' ? 0.9 : 0;
    // 環境マップ（映り込み）を空から作り直す
    this.envSky.set({ ...L.sky, stars: 0, sunGlow: (L.sky.sunGlow ?? 1) * 0.35, sunSize: 0.0001, sunDir: new THREE.Vector3(...L.sun) });
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = L.envI;
    this.location?.setLook?.(id, L);
  }

  /** 場所（背景）を変える。 */
  setLocation(id) {
    if (this.locationId === id) return;
    if (this.location) { this.scene.remove(this.location.root); this.location.dispose?.(); }
    const make = LOCATIONS[id] || LOCATIONS.beach; // まだ作っていない場所は砂浜で代用
    if (!LOCATIONS[id]) console.warn('[world] 場所がまだありません（砂浜で代用）:', id);
    this.location = make(this);
    this.locationId = id;
    // 動かない建物・小物を材質ごとにまとめる（draw call を減らす）
    this.location.merged = mergeStatic(this.location.root);
    this.scene.add(this.location.root);
    this.sea.mesh.visible = this.location.sea !== false;
    this.sea.mesh.position.y = this.location.seaLevel ?? 0;
    // 海の板は岸（または岸壁）の少し手前から沖へ。陸の下には水を置かない（うねりで砂の上ににじまないように）
    const edge = this.location.seaEdge ?? ((this.location.seaParams?.shoreZ ?? 14) - 6);
    this.sea.mesh.position.z = edge + 800;
    this.sea.set(this.location.seaParams || {});
    if (this.lookId) this.location.setLook?.(this.lookId, LOOKS[this.lookId]);
  }

  update(dt, camera) {
    this.time += dt;
    this.sky.update(dt, camera);
    this.sea.update(dt);
    this.cart.update(dt);
    this.location?.update?.(dt, camera);
    // 太陽の影：屋台のまわりを追う
    const f = this.focus;
    this.sunLight.position.copy(f).addScaledVector(this.sunDir, 14);
    this.sunLight.target.position.copy(f);
  }
}
