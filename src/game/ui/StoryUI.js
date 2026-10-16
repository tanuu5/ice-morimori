// 物語の会話（画面下の箱。名前・文字送り・▼）と、日のはじまりの大きな見出し（DAY 2 なぎさ海水浴場）。
//   story.show(lines, onDone)  lines = [{ who, text, face? }]（text は表示する文。who は話す人の id）
//   story.next()               進める（文字送りの途中なら、全部出す）
//   story.card(day)            日の見出しを出す（時間で消える）
import { t, onLangChange } from '../../core/i18n.js';
import { REGULARS } from '../data/characters.js';

const COLORS = { maru: '#7fd6c2', gen: '#ffa94d', phone: '#ffa94d', ...Object.fromEntries(Object.entries(REGULARS).map(([k, v]) => [k, v.color])), haruka: '#ffa8a8', kid: '#74c0fc', narration: '#adb5bd' };

export class StoryUI {
  constructor(root) {
    root.insertAdjacentHTML('beforeend', `
<div id="story" class="hidden"><div class="who"></div><div class="text"></div><div class="next"><span data-glyph="scoop"></span>▼</div></div>
<div id="daycard" class="hidden"><div class="d"></div><div class="loc"></div><div class="sub"></div></div>`);
    this.el = root.querySelector('#story');
    this.cardEl = root.querySelector('#daycard');
    this.lines = [];
    this.i = 0;
    this.full = '';
    this.shown = 0;
    this.speed = 32;
    this.onDone = null;
    this.onLine = null;    // (line) => void　1 行ごと（表情・声）
    this.cardT = 0;
    this.active = false;
    this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.next(); });
    onLangChange(() => { if (this.active) this._render(); });
  }

  show(lines, onDone) {
    this.lines = lines;
    this.i = 0;
    this.onDone = onDone;
    this.active = true;
    this.el.classList.remove('hidden');
    this._line();
  }

  _line() {
    const L = this.lines[this.i];
    this.full = typeof L.text === 'function' ? L.text() : L.text;
    this.shown = 0;
    this._render();
    this.onLine?.(L);
  }

  _render() {
    const L = this.lines[this.i];
    if (!L) return;
    const who = this.el.querySelector('.who');
    const name = L.who === 'narration' ? '' : t('name.' + (L.who === 'phone' ? 'gen' : L.who)) + (L.who === 'phone' ? ' ' + t('story.phone') : '');
    who.textContent = name;
    who.classList.toggle('hidden', !name);
    who.style.background = COLORS[L.who] || '#7fd6c2';
    this.el.classList.toggle('narration', L.who === 'narration');
    this.el.querySelector('.text').textContent = this.full.slice(0, Math.floor(this.shown));
    this.el.classList.toggle('done', this.shown >= this.full.length);
  }

  get typing() { return this.shown < this.full.length; }

  next() {
    if (!this.active) return;
    if (this.typing) { this.shown = this.full.length; this._render(); return; }
    this.i++;
    if (this.i >= this.lines.length) { this.hide(); const f = this.onDone; this.onDone = null; f?.(); return; }
    this._line();
  }

  hide() { this.active = false; this.el.classList.add('hidden'); }

  card(day, sub = '') {
    this.cardEl.classList.remove('hidden');
    this.cardEl.querySelector('.d').textContent = day.endless ? t('card.endless') : t('hud.day', { n: day.id });
    this.cardEl.querySelector('.loc').textContent = t('loc.' + day.location);
    this.cardEl.querySelector('.sub').textContent = sub;
    this.cardT = 0;
    this.cardOn = true;
  }

  update(dt) {
    if (this.active && this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * this.speed);
      this._render();
    }
    if (this.cardOn) {
      // 出て、少しとどまって、消える（濃さはゲームの時間で）
      this.cardT += dt;
      const k = this.cardT;
      const a = k < 0.35 ? k / 0.35 : k < 2.6 ? 1 : Math.max(0, 1 - (k - 2.6) / 0.5);
      this.cardEl.style.opacity = a.toFixed(3);
      this.cardEl.style.transform = `translate(-50%, -50%) scale(${(0.9 + 0.1 * Math.min(1, k / 0.35)).toFixed(3)})`;
      if (k > 3.1) { this.cardOn = false; this.cardEl.classList.add('hidden'); }
    }
  }
}
