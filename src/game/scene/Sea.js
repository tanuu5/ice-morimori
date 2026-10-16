// 海：大きな板を、頂点でゆるくうねらせ、ピクセルでさざ波の法線・空の映り込み・日の照り返し・波打ち際の泡を描く。
// 色はすべて線形（あとで OutputPass がトーンマップする）。霧は自前で地平線の色へ溶かす（空とつなげるため）。
import * as THREE from 'three';

const vert = /* glsl */ `
  uniform float uTime, uSwell;
  varying vec3 vWorld;
  varying float vSwell;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    float s = sin(w.x * 0.21 + uTime * 0.9) * 0.5 + sin(w.z * 0.17 - uTime * 0.7 + w.x * 0.05) * 0.5;
    s += sin((w.x + w.z) * 0.43 + uTime * 1.6) * 0.18;
    w.y += s * uSwell;
    vSwell = s;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */ `
  uniform vec3 uShallow, uDeep, uSkyTop, uSkyHorizon, uSunDir, uSunColor, uFogColor, uFoamColor;
  uniform float uTime, uShoreZ, uFoam, uFogNear, uFogFar, uGlint, uRough;
  varying vec3 vWorld;
  varying float vSwell;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  // 波の高さ（法線を差分で出す）
  float h(vec2 p) {
    float t = uTime;
    float v = 0.0;
    v += sin(dot(p, vec2(0.9, 0.4)) * 1.3 + t * 1.7) * 0.25;
    v += sin(dot(p, vec2(-0.5, 0.85)) * 2.1 + t * 2.3) * 0.15;
    v += sin(dot(p, vec2(0.2, -1.0)) * 3.7 + t * 3.1) * 0.08;
    v += (noise(p * 2.2 + t * 0.6) - 0.5) * 0.22;
    v += (noise(p * 6.0 - t * 0.9) - 0.5) * 0.08;
    return v;
  }
  void main() {
    vec3 V = cameraPosition - vWorld;
    float dist = length(V);
    V /= max(dist, 1e-4);
    // 遠くほど細かい波を弱める（ちらつき防止）
    float far = clamp(dist / 140.0, 0.0, 1.0);
    vec2 p = vWorld.xz;
    float e = 0.08 + far * 0.5;
    float hx = h(p + vec2(e, 0.0)) - h(p - vec2(e, 0.0));
    float hz = h(p + vec2(0.0, e)) - h(p - vec2(0.0, e));
    float amp = mix(0.55, 0.06, far) * uRough;
    vec3 N = normalize(vec3(-hx * amp / e, 1.0, -hz * amp / e));
    // 浅い所（岸の近く）と深い所の色
    float depth = clamp((vWorld.z - uShoreZ) / 40.0, 0.0, 1.0);
    vec3 water = mix(uShallow, uDeep, smoothstep(0.0, 1.0, depth) * 0.85 + far * 0.15);
    water *= 0.85 + vSwell * 0.08;
    // 空の映り込み（フレネル）
    float fres = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 4.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, max(R.y, 0.0)));
    vec3 col = mix(water, sky, clamp(0.12 + fres * 0.85, 0.0, 1.0));
    // 日の照り返し（きらきら）
    vec3 L = normalize(uSunDir);
    float sp = pow(max(dot(R, L), 0.0), 220.0) * 6.0 + pow(max(dot(R, L), 0.0), 18.0) * 0.25;
    float sparkle = step(0.82, noise(p * 9.0 + uTime * 2.0)) * pow(max(dot(R, L), 0.0), 40.0) * 5.0;
    col += uSunColor * (sp + sparkle) * uGlint;
    // 波打ち際の泡（岸から少しのあいだ、寄せては返す）
    if (uFoam > 0.0) {
      float dz = vWorld.z - uShoreZ;
      float surge = sin(uTime * 0.8 + vWorld.x * 0.08) * 0.9;
      float band = smoothstep(2.2, 0.0, dz - surge) * smoothstep(-0.6, 0.4, dz - surge);
      float lace = smoothstep(0.45, 0.75, noise(p * 3.0 + vec2(0.0, uTime * 0.5)) + band * 0.5);
      float line = smoothstep(0.35, 0.0, abs(dz - surge - 0.15));
      col = mix(col, uFoamColor, clamp((band * lace + line * 0.8) * uFoam, 0.0, 1.0));
      // 岸の近くは砂が透けて見える（明るく）
      col = mix(col, uShallow * 1.25, smoothstep(5.0, 0.0, dz) * 0.35);
    }
    // 霧：地平線の色へ
    float fog = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`;

export class Sea {
  constructor({ size = 1600, segments = 160 } = {}) {
    this.uniforms = {
      uTime: { value: 0 },
      uSwell: { value: 0.06 },
      uShallow: { value: new THREE.Color('#4fd8d0') },
      uDeep: { value: new THREE.Color('#1677b8') },
      uSkyTop: { value: new THREE.Color('#3f8fe0') },
      uSkyHorizon: { value: new THREE.Color('#bfe6ff') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.7) },
      uSunColor: { value: new THREE.Color('#fff4dc') },
      uFogColor: { value: new THREE.Color('#cfeeff') },
      uFoamColor: { value: new THREE.Color('#ffffff') },
      uShoreZ: { value: 14 },
      uFoam: { value: 1 },
      uFogNear: { value: 60 },
      uFogFar: { value: 700 },
      uGlint: { value: 1 },
      uRough: { value: 1 },
    };
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, fog: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.name = 'sea';
    this.mesh.frustumCulled = false;
  }

  set(p) {
    const u = this.uniforms;
    const colors = { shallow: 'uShallow', deep: 'uDeep', skyTop: 'uSkyTop', skyHorizon: 'uSkyHorizon', sunColor: 'uSunColor', fogColor: 'uFogColor', foamColor: 'uFoamColor' };
    for (const [k, name] of Object.entries(colors)) if (p[k] !== undefined) u[name].value.set(p[k]);
    const nums = { swell: 'uSwell', shoreZ: 'uShoreZ', foam: 'uFoam', fogNear: 'uFogNear', fogFar: 'uFogFar', glint: 'uGlint', rough: 'uRough' };
    for (const [k, name] of Object.entries(nums)) if (p[k] !== undefined) u[name].value = p[k];
    if (p.sunDir) u.uSunDir.value.copy(p.sunDir).normalize();
  }

  update(dt) { this.uniforms.uTime.value += dt; }
}
