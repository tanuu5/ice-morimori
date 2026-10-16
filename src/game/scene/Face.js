// お客さんの顔：キャンバスに目・まゆ・口・ほお・汗・涙を描き、頭の前の殻に貼る。表情が変わったときだけ描き直す。
//   face.set({ eyes, mouth, brows, blush, sweat, tears })
//   eyes: open / happy / closed / wide / sad / angry / sparkle / wink / dizzy
//   mouth: smile / grin / open / o / flat / frown / wavy / cat / lick
//   brows: none / up / worried / angry / flat
import * as THREE from 'three';

const W = 256, H = 256;

export class Face {
  constructor({ blush = true, ink = '#2b2321', lash = false } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.ink = ink;
    this.lash = lash;
    this.state = { eyes: 'open', mouth: 'smile', brows: 'none', blush: blush ? 0.5 : 0, sweat: false, tears: false, lookX: 0, lookY: 0 };
    this.blinkT = 1 + Math.random() * 3;
    this.blink = 0;
    this.talk = 0;       // > 0 のあいだ口がぱくぱく
    this.talkPh = 0;
    this.dirty = true;
    this.key = '';
  }

  set(p) { Object.assign(this.state, p); }

  update(dt) {
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    if (this.talk > 0) { this.talk -= dt; this.talkPh += dt * 11; }
    const s = this.state;
    const mouthOpen = this.talk > 0 && Math.sin(this.talkPh) > -0.2;
    const eyes = this.blink > 0 && ['open', 'wide', 'sad', 'angry'].includes(s.eyes) ? 'closed' : s.eyes;
    const key = [eyes, mouthOpen ? 'talk' : s.mouth, s.brows, s.blush.toFixed(2), s.sweat, s.tears, s.lookX.toFixed(1), s.lookY.toFixed(1)].join('|');
    if (key !== this.key) { this.key = key; this.draw(eyes, mouthOpen ? (s.mouth === 'frown' ? 'o' : 'open') : s.mouth); }
  }

  draw(eyes, mouth) {
    const g = this.g, s = this.state, ink = this.ink;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ex = 50, ey = 130, lx = s.lookX * 8, ly = s.lookY * 6;
    // ほお
    if (s.blush > 0) {
      g.fillStyle = `rgba(255, 120, 140, ${0.35 * s.blush + 0.15})`;
      for (const k of [-1, 1]) { g.beginPath(); g.ellipse(128 + k * 70, 166, 21, 12, 0, 0, Math.PI * 2); g.fill(); }
    }
    // まゆ
    g.strokeStyle = ink; g.lineWidth = 6;
    for (const k of [-1, 1]) {
      const x = 128 + k * ex, y = ey - 34;
      g.beginPath();
      if (s.brows === 'up') { g.moveTo(x - 13, y + 2); g.quadraticCurveTo(x, y - 8, x + 13, y + 2); }
      else if (s.brows === 'worried') { g.moveTo(x - 13 * k, y - 6); g.lineTo(x + 13 * k, y + 4); }
      else if (s.brows === 'angry') { g.moveTo(x - 13 * k, y + 6); g.lineTo(x + 13 * k, y - 4); }
      else if (s.brows === 'flat') { g.moveTo(x - 12, y); g.lineTo(x + 12, y); }
      else continue;
      g.stroke();
    }
    // 目
    for (const k of [-1, 1]) {
      const x = 128 + k * ex + lx, y = ey + ly;
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 7;
      switch (eyes === 'wink' ? (k > 0 ? 'happy' : 'open') : eyes) {
        case 'happy': g.lineWidth = 8; g.beginPath(); g.arc(x, y + 8, 17, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); break;
        case 'closed': g.beginPath(); g.moveTo(x - 14, y + 2); g.quadraticCurveTo(x, y + 9, x + 14, y + 2); g.stroke(); break;
        case 'sad': g.beginPath(); g.ellipse(x, y + 2, 10, 14, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.lineWidth = 5; g.moveTo(x - 14 * k, y - 18); g.lineTo(x + 10 * k, y - 12); g.stroke(); break;
        case 'angry': g.beginPath(); g.ellipse(x, y + 3, 10, 12, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.lineWidth = 6; g.moveTo(x - 14 * k, y - 14); g.lineTo(x + 12 * k, y - 6); g.stroke(); break;
        case 'wide': g.beginPath(); g.ellipse(x, y, 17, 22, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4, y - 6, 5.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x - 4, y + 6, 2.5, 0, Math.PI * 2); g.fill(); break;
        case 'sparkle': star(g, x, y, 22, ink); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 3, y - 3, 3.5, 0, Math.PI * 2); g.fill(); break;
        case 'dizzy': g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = a * 1.3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke(); break;
        default:
          g.beginPath(); g.ellipse(x, y, 14, 19, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 4.5, y - 6.5, 5.8, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x - 4, y + 7, 2.6, 0, Math.PI * 2); g.fill();
          if (this.lash) { g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 9 * k, y - 10); g.lineTo(x + 16 * k, y - 15); g.stroke(); }
      }
    }
    // 口
    g.strokeStyle = ink; g.fillStyle = '#c2414f'; g.lineWidth = 6;
    const mx = 128, my = 180;
    g.beginPath();
    switch (mouth) {
      case 'grin': g.moveTo(mx - 20, my - 4); g.quadraticCurveTo(mx, my + 22, mx + 20, my - 4); g.closePath(); g.fill(); g.stroke(); break;
      case 'open': g.ellipse(mx, my + 2, 11, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
      case 'o': g.ellipse(mx, my + 2, 8, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
      case 'flat': g.moveTo(mx - 12, my); g.lineTo(mx + 12, my); g.stroke(); break;
      case 'frown': g.moveTo(mx - 13, my + 8); g.quadraticCurveTo(mx, my - 6, mx + 13, my + 8); g.stroke(); break;
      case 'wavy': g.moveTo(mx - 16, my + 2); for (let i = 0; i <= 8; i++) g.lineTo(mx - 16 + i * 4, my + 2 + (i % 2 ? -4 : 4)); g.stroke(); break;
      case 'cat': g.moveTo(mx - 16, my - 2); g.quadraticCurveTo(mx - 8, my + 8, mx, my); g.quadraticCurveTo(mx + 8, my + 8, mx + 16, my - 2); g.stroke(); break;
      case 'lick': g.moveTo(mx - 12, my); g.quadraticCurveTo(mx, my + 8, mx + 12, my); g.stroke(); g.fillStyle = '#ff8fa3'; g.beginPath(); g.ellipse(mx + 2, my + 9, 7, 8, 0, 0, Math.PI * 2); g.fill(); break;
      default: g.moveTo(mx - 13, my - 2); g.quadraticCurveTo(mx, my + 11, mx + 13, my - 2); g.stroke();
    }
    // 汗と涙
    if (s.sweat) {
      g.fillStyle = 'rgba(120, 190, 255, 0.95)';
      g.beginPath(); g.moveTo(212, 92); g.quadraticCurveTo(226, 116, 212, 122); g.quadraticCurveTo(198, 116, 212, 92); g.fill();
    }
    if (s.tears) {
      g.fillStyle = 'rgba(120, 190, 255, 0.9)';
      for (const k of [-1, 1]) { g.beginPath(); g.ellipse(128 + k * ex, ey + 30, 6, 12, 0, 0, Math.PI * 2); g.fill(); }
    }
    this.tex.needsUpdate = true;
  }

  dispose() { this.tex.dispose(); }
}

function star(g, x, y, r, col) {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}
