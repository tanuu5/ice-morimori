// 注文まわりの画面：吹き出し（名前・文・待ち時間）、伝票（器・味・トッピングと、できた段の ✓）、評価のカード。
import { t, onLangChange } from '../../core/i18n.js';
import { FLAVORS } from '../data/flavors.js';
import { TOPPINGS } from '../data/toppings.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class OrderUI {
  constructor(root) {
    root.insertAdjacentHTML('beforeend', `
<div id="talk" class="hidden"><div class="who"></div><div class="text"></div><div class="wait"><b></b></div><div class="next">▼</div></div>
<div id="ticket" class="hidden"><div class="head"><span data-i18n="ticket.title">${t('ticket.title')}</span><small class="kind"></small></div>
  <div class="rows"></div><div class="tops"></div><div class="vessel"></div></div>
<div id="rating" class="hidden"><div class="stars"></div><div class="pay"></div><div class="say"></div></div>`);
    this.talkEl = root.querySelector('#talk');
    this.ticketEl = root.querySelector('#ticket');
    this.ratingEl = root.querySelector('#rating');
    this.full = '';
    this.shown = 0;
    this.speed = 34; // 1 秒あたりの文字数
    this.ratingT = 0;
    this.order = null;
    this.built = [];
    onLangChange(() => { if (this.order) this.setTicket(this.order, this.built, this.vessel); });
  }

  /** 話す（文字を少しずつ出す）。 */
  talk(name, text, { color = '#ff8fab' } = {}) {
    this.talkEl.classList.remove('hidden');
    this.talkEl.querySelector('.who').textContent = name;
    this.talkEl.querySelector('.who').style.background = color;
    this.full = text;
    this.shown = 0;
    this.talkEl.querySelector('.text').textContent = '';
    this.talkEl.classList.remove('done');
  }
  get talking() { return this.shown < this.full.length; }
  skip() { this.shown = this.full.length; this._typeset(); }
  hideTalk() { this.talkEl.classList.add('hidden'); }
  setWait(ratio) {
    const w = this.talkEl.querySelector('.wait');
    w.classList.toggle('hidden', ratio === null);
    if (ratio === null) return;
    const b = w.querySelector('b');
    b.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1) + '%';
    w.classList.toggle('low', ratio < 0.3);
  }

  /** 伝票：order と、いま積んである味（下から）。 */
  setTicket(order, built = [], vessel = null) {
    this.order = order; this.built = built.slice(); this.vessel = vessel;
    const el = this.ticketEl;
    el.classList.remove('hidden');
    el.querySelector('.kind').textContent = order.type === 'exact' ? '' : t('ticket.kind.' + order.type);
    const rows = [];
    const dot = (f) => `<i class="dot" style="background:${FLAVORS[f].a}"></i>`;
    if (order.type === 'riddle') {
      rows.push(`<div class="row riddle"><i class="dot q">?</i><span>${esc(t('ticket.riddle'))}</span></div>`);
    } else if (order.type === 'free') {
      rows.push(`<div class="row"><i class="dot any">★</i><span>${esc(t('ticket.free', { n: order.n }))}</span><b class="cnt">${Math.min(built.length, order.n)}/${order.n}</b></div>`);
    } else if (order.type === 'same') {
      const f = order.scoops[0];
      const ok = built.filter((x) => x === f).length;
      rows.push(`<div class="row">${dot(f)}<span>${esc(t('flavor.' + f))} × ${order.n}</span><b class="cnt">${Math.min(ok, order.n)}/${order.n}</b></div>`);
    } else {
      // 上の段から順に並べる（塔と同じ向き）
      const want = order.scoops;
      const left = built.slice();
      for (let i = want.length - 1; i >= 0; i--) {
        const f = want[i];
        let ok;
        if (order.type === 'any') { const k = left.indexOf(f); ok = k >= 0; if (ok) left.splice(k, 1); }
        else ok = built[i] === f;
        const wrong = order.type !== 'any' && built[i] && built[i] !== f;
        rows.push(`<div class="row ${ok ? 'ok' : ''} ${wrong ? 'ng' : ''}">${dot(f)}<span>${esc(t('flavor.' + f))}</span><b class="mark">${ok ? '✓' : wrong ? '✗' : ''}</b></div>`);
      }
    }
    el.querySelector('.rows').innerHTML = rows.join('');
    el.querySelector('.tops').innerHTML = order.toppings.map((id) => `<span class="top"><i>${TOPPINGS[id]?.icon || '•'}</i>${esc(t('topping.' + id))}</span>`).join('');
    const vOk = vessel === order.vessel;
    el.querySelector('.vessel').innerHTML = `<span class="${vessel ? (vOk ? 'ok' : 'ng') : ''}">${order.vessel === 'cup' ? '🥤' : '🍦'} ${esc(t('vessel.' + order.vessel))}</span>`;
  }
  hideTicket() { this.ticketEl.classList.add('hidden'); this.order = null; }

  /** 評価のカード。 */
  rate(res, say) {
    const el = this.ratingEl;
    el.classList.remove('hidden');
    el.querySelector('.stars').innerHTML = [1, 2, 3, 4, 5].map((i) => `<i class="${i <= res.stars ? 'on' : ''}">★</i>`).join('');
    el.querySelector('.pay').innerHTML = res.pay ? `+¥${res.pay.toLocaleString()}${res.tip ? ` <small>${esc(t('rate.tip', { n: res.tip }))}</small>` : ''}${res.hearts ? ` <span class="hearts">${'♥'.repeat(res.hearts)}</span>` : ''}` : esc(t('rate.nopay'));
    el.querySelector('.say').textContent = say || '';
    this.ratingT = 3.2;
  }
  hideRating() { this.ratingEl.classList.add('hidden'); this.ratingT = 0; }

  update(dt) {
    if (this.shown < this.full.length) {
      this.shown = Math.min(this.full.length, this.shown + dt * this.speed);
      this._typeset();
    }
    if (this.ratingT > 0) { this.ratingT -= dt; if (this.ratingT <= 0) this.hideRating(); }
  }

  _typeset() {
    this.talkEl.querySelector('.text').textContent = this.full.slice(0, Math.floor(this.shown));
    this.talkEl.classList.toggle('done', this.shown >= this.full.length);
  }
}
