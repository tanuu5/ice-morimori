// マルの顔：黒い画面に光る目と口（キャンバス）。表情が変わったとき・まばたき・口ぱくのときだけ描き直す。
//   face.set('happy')   表情の名前は EXPR のキー
import * as THREE from 'three';

const W = 256, H = 192;
const CYAN = '#8ff6ff';

// eyes：形、mouth：口、cheek：ほお
export const EXPR = {
  normal: { eyes: 'oval', mouth: 'smile' },
  happy: { eyes: 'arc', mouth: 'open', cheek: true },
  focus: { eyes: 'flat', mouth: 'dot' },
  surprised: { eyes: 'ring', mouth: 'o' },
  worried: { eyes: 'droop', mouth: 'wavy' },
  sad: { eyes: 'droop', mouth: 'frown' },
  love: { eyes: 'heart', mouth: 'open', cheek: true },
  star: { eyes: 'star', mouth: 'open', cheek: true },
  dizzy: { eyes: 'swirl', mouth: 'wavy' },
  wink: { eyes: 'wink', mouth: 'smile', cheek: true },
  think: { eyes: 'side', mouth: 'dot' },
  sleep: { eyes: 'closed', mouth: 'dot' },
  load: { eyes: 'dots', mouth: 'none' },
};

export class RobotFace {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.name = 'normal';
    this.blink = 0;
    this.blinkT = 2;
    this.talk = 0;
    this.talkPh = 0;
    this.look = 0;   // -1〜1 目の左右
    this.t = 0;
    this.key = '';
  }

  set(name) { if (EXPR[name]) this.name = name; }

  update(dt) {
    this.t += dt;
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2.5 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
    if (this.talk > 0) { this.talk -= dt; this.talkPh += dt * 12; }
    const E = EXPR[this.name];
    const blinking = this.blink > 0 && ['oval', 'ring', 'droop', 'side'].includes(E.eyes);
    const mouthOpen = this.talk > 0 && Math.sin(this.talkPh) > 0;
    const anim = E.eyes === 'dots' || E.eyes === 'swirl' ? Math.floor(this.t * 6) : 0;
    const key = `${this.name}|${blinking}|${mouthOpen}|${this.look.toFixed(1)}|${anim}`;
    if (key !== this.key) { this.key = key; this.draw(E, blinking, mouthOpen, anim); }
  }

  draw(E, blinking, mouthOpen, anim) {
    const g = this.g;
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    g.save();
    g.shadowColor = CYAN; g.shadowBlur = 14;
    g.fillStyle = CYAN; g.strokeStyle = CYAN; g.lineCap = 'round'; g.lineJoin = 'round';
    const ex = 58, ey = 82, lx = this.look * 16;
    const eye = (k) => 128 + k * ex + lx;
    const type = blinking ? 'closed' : E.eyes;
    for (const k of [-1, 1]) {
      const x = eye(k), y = ey;
      g.lineWidth = 12;
      g.beginPath();
      switch (type === 'wink' ? (k > 0 ? 'arc' : 'oval') : type) {
        case 'arc': g.arc(x, y + 12, 22, Math.PI * 1.12, Math.PI * 1.88); g.stroke(); break;
        case 'flat': g.moveTo(x - 20, y); g.lineTo(x + 20, y); g.stroke(); break;
        case 'closed': g.moveTo(x - 20, y + 4); g.quadraticCurveTo(x, y + 12, x + 20, y + 4); g.stroke(); break;
        case 'ring': g.lineWidth = 9; g.arc(x, y, 22, 0, Math.PI * 2); g.stroke(); break;
        case 'droop': g.ellipse(x, y + 4, 13, 20, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.lineWidth = 8; g.moveTo(x - 20 * k, y - 26); g.lineTo(x + 14 * k, y - 18); g.stroke(); break;
        case 'heart': heart(g, x, y, 24); break;
        case 'star': star(g, x, y, 26); break;
        case 'swirl': { g.lineWidth = 6; const a0 = anim * 0.7; for (let a = 0; a < 13; a += 0.3) { const r = a * 1.7; g.lineTo(x + Math.cos(a + a0) * r, y + Math.sin(a + a0) * r); } g.stroke(); break; }
        case 'side': g.ellipse(x + 10, y, 13, 21, 0, 0, Math.PI * 2); g.fill(); break;
        case 'dots': { g.shadowBlur = 8; for (let i = 0; i < 3; i++) { if (i === anim % 3 && k > 0) continue; g.beginPath(); g.arc(128 - 40 + i * 40, y, 9, 0, Math.PI * 2); g.fill(); } break; }
        default: g.ellipse(x, y, 15, 24, 0, 0, Math.PI * 2); g.fill();
      }
      if (type === 'dots') break;
    }
    // 口
    g.lineWidth = 8;
    const my = 142, mouth = mouthOpen ? 'talk' : E.mouth;
    g.beginPath();
    switch (mouth) {
      case 'smile': g.moveTo(108, my - 4); g.quadraticCurveTo(128, my + 14, 148, my - 4); g.stroke(); break;
      case 'open': g.moveTo(106, my - 6); g.quadraticCurveTo(128, my + 22, 150, my - 6); g.closePath(); g.fill(); break;
      case 'talk': g.ellipse(128, my + 2, 12, 9, 0, 0, Math.PI * 2); g.fill(); break;
      case 'o': g.lineWidth = 7; g.ellipse(128, my + 2, 10, 12, 0, 0, Math.PI * 2); g.stroke(); break;
      case 'dot': g.arc(128, my + 2, 5, 0, Math.PI * 2); g.fill(); break;
      case 'wavy': g.moveTo(106, my); for (let i = 0; i <= 8; i++) g.lineTo(106 + i * 5.5, my + (i % 2 ? -5 : 5)); g.stroke(); break;
      case 'frown': g.moveTo(110, my + 10); g.quadraticCurveTo(128, my - 6, 146, my + 10); g.stroke(); break;
      default: break;
    }
    g.restore();
    // ほお（ピンク）
    if (E.cheek) {
      g.fillStyle = 'rgba(255, 140, 190, 0.85)';
      for (const k of [-1, 1]) { g.beginPath(); g.ellipse(128 + k * 92, 122, 16, 9, 0, 0, Math.PI * 2); g.fill(); }
    }
    // 走査線（ごく薄く）
    g.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.5);
    this.tex.needsUpdate = true;
  }
}

function heart(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  g.fill();
}
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
