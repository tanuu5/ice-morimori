// 操作のヒント：お客さんの吹き出しのすぐ下（縦長の画面では左下）に、ぴょこぴょこ動く吹き出しで出す。
//   hints.show('scoop')   文は i18n の hint.<key>。{glyph:xxx} の所にボタンの絵が入る
//   hints.hide()          消す
// 何を出すかは Game が決める（1 日目の最初のお客さん、3 日目の最初のトッピングなど）。
import { t, onLangChange } from '../../core/i18n.js';

export class Hints {
  constructor(root, { refresh, device } = {}) {
    this.device = device; // () => 'kb' | 'pad' | 'touch'
    this.el = document.createElement('div');
    this.el.id = 'hint';
    this.el.className = 'hidden';
    root.appendChild(this.el);
    this.key = null;
    this.t = 0;
    this.refresh = refresh; // ボタンの絵を描き直す（refreshGlyphs）
    onLangChange(() => { if (this.key) this._render(); });
  }

  show(key) {
    if (this.key === key) return;
    this.key = key;
    this.t = 0;
    this._render();
    this.el.classList.remove('hidden');
  }

  _render() {
    // {glyph:scoop} → ボタンの絵の入れ物
    // タッチでは、ボタンの絵のかわりに画面のボタンの名前で言う文にする
    const touchKey = 'hint.' + this.key + '.touch';
    const text = this.device?.() === 'touch' && t(touchKey) !== touchKey ? t(touchKey) : t('hint.' + this.key);
    const html = text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
      .replace(/\{glyph:(\w+)\}/g, (m, a) => `<span class="g" data-glyph="${a}"></span>`);
    this.el.innerHTML = `<span class="i">!</span><span class="tx">${html}</span>`;
    this.refresh?.(this.el);
  }

  hide() { this.key = null; this.el.classList.add('hidden'); }

  update(dt) {
    if (!this.key) return;
    const dev = this.device?.();
    if (dev !== this._dev) { this._dev = dev; this._render(); }
    this.t += dt;
    // ぴょこぴょこ（ゲームの時間で）
    const y = Math.abs(Math.sin(this.t * 3.2)) * -5;
    const a = Math.min(1, this.t / 0.25);
    // 縦長（CSS の max-aspect-ratio: 4/5 と同じ境目）：下（CSS の置き場所のまま）
    const narrow = innerWidth / innerHeight < 0.8;
    const st = this.el.style;
    if (narrow) {
      st.top = st.left = st.bottom = st.maxWidth = '';
    } else {
      // お客さんの吹き出しのすぐ下に、左をそろえて出す（吹き出しにも、右の伝票にもかからないように）
      const talk = document.getElementById('talk'), ticket = document.getElementById('ticket');
      let top = 56, left = 10;
      if (talk && !talk.classList.contains('hidden')) { const r = talk.getBoundingClientRect(); top = r.bottom + 14; left = r.left; }
      let right = innerWidth - 10;
      if (ticket && !ticket.classList.contains('hidden')) { const r = ticket.getBoundingClientRect(); if (r.bottom > top - 4 && r.left > left) right = r.left - 12; }
      st.top = top.toFixed(0) + 'px';
      st.bottom = 'auto';
      st.left = left.toFixed(0) + 'px';
      st.maxWidth = Math.max(240, Math.min(680, right - left)).toFixed(0) + 'px';
    }
    st.transform = `translate(0, ${y.toFixed(1)}px)`;
    st.opacity = a.toFixed(3);
  }
}
