// 空：グラデーションのドーム＋太陽＋雲（シェーダーだけで描く。画像なし）。
// 時間帯（朝・昼・夕・夜）は uniforms を差し替えて変える（World.setTime）。
// 雲は天頂を中心に平面へ投影した fbm。地平線の近くは投影が伸びるので、高さで薄くする。
import * as THREE from 'three';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // いちばん奥に描く
  }`;

const frag = /* glsl */ `
  uniform vec3 uTop, uMid, uHorizon, uGround, uSunDir, uSunColor, uCloudLit, uCloudShade;
  uniform float uSunSize, uSunGlow, uCloud, uTime, uStars, uCloudSpeed;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir + vec3(0.0, 1e-5, 0.0));
    float y = d.y;
    // 空の色：地平線 → 中ほど → 天頂
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.25, y));
    col = mix(col, uTop, smoothstep(0.2, 0.9, y));
    // 地平線より下（海の向こうに見える分）
    col = mix(col, uGround, smoothstep(0.0, -0.08, y));
    // 太陽
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sd, 6.0) * 0.18 + pow(sd, 64.0) * 0.5) * uSunGlow;
    col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, sd) * 6.0;
    // 地平線のもや（太陽の側が明るい）
    col += uSunColor * 0.12 * pow(1.0 - abs(y), 8.0) * (0.4 + 0.6 * sd);
    // 星（夜）
    if (uStars > 0.0 && y > 0.0) {
      vec2 sp = d.xz / (y + 0.35) * 220.0;
      float st = step(0.997, hash(floor(sp))) * smoothstep(0.05, 0.4, y);
      col += vec3(st) * uStars * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(sp)) * 40.0));
    }
    // 雲：天頂を中心に平面へ投影
    if (uCloud > 0.0 && y > 0.0) {
      vec2 p = d.xz / max(y + 0.12, 0.02) * 1.6;
      p += vec2(uTime * uCloudSpeed, uTime * uCloudSpeed * 0.3);
      float n = fbm(p * 0.9);
      float n2 = fbm(p * 2.3 + 4.0);
      float c = smoothstep(0.58 - uCloud * 0.22, 0.86 - uCloud * 0.2, n * 0.8 + n2 * 0.3);
      c *= smoothstep(0.0, 0.12, y);           // 地平線の近くは薄く
      // 太陽の側から照らされたような陰影（上の段の濃さで影）
      float sh = fbm(p * 0.9 + normalize(uSunDir.xz + vec2(1e-4)) * 0.12);
      vec3 cc = mix(uCloudLit, uCloudShade, clamp((sh - n) * 4.0 + 0.45, 0.0, 1.0));
      cc += uSunColor * pow(sd, 8.0) * 0.6;
      col = mix(col, cc, clamp(c, 0.0, 1.0) * 0.95);
    }
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`;

export class Sky {
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.7) },
      uSunColor: { value: new THREE.Color() },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
      uSunSize: { value: 0.0018 },
      uSunGlow: { value: 1 },
      uCloud: { value: 0.5 },
      uCloudSpeed: { value: 0.004 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  /** 時間帯の色。値は THREE.Color に渡せるもの。 */
  set(p) {
    const u = this.uniforms;
    for (const k of ['top', 'mid', 'horizon', 'ground', 'sunColor', 'cloudLit', 'cloudShade']) {
      if (p[k] !== undefined) u['u' + k[0].toUpperCase() + k.slice(1)].value.set(p[k]);
    }
    if (p.sunDir) u.uSunDir.value.copy(p.sunDir).normalize();
    if (p.sunSize !== undefined) u.uSunSize.value = p.sunSize;
    if (p.sunGlow !== undefined) u.uSunGlow.value = p.sunGlow;
    if (p.cloud !== undefined) u.uCloud.value = p.cloud;
    if (p.stars !== undefined) u.uStars.value = p.stars;
  }

  update(dt, camera) {
    this.uniforms.uTime.value += dt;
    if (camera) this.mesh.position.copy(camera.position);
  }
}
