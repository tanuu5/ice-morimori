// ゲーム中の表示：上の帯（日・場所・お客さんの人数・売上と目標）と、下の操作の案内。
import { t, onLangChange } from '../core/i18n.js';

export class Hud {
  constructor(root) {
    root.insertAdjacentHTML('beforeend', `
<div id="hud" class="hidden">
  <div class="bar">
    <div class="day"><b class="d"></b><span class="loc"></span></div>
    <div class="guests"><i class="ico">☺</i><span class="g"></span></div>
    <div class="money"><span class="m"></span><small class="goal"></small><i class="meter"><b></b></i></div>
  </div>
  <div class="hints">
    <span><i data-glyph="scoop"></i><b data-i18n="howto.scoop">${t('howto.scoop')}</b></span>
    <span><i data-glyph="shelf"></i><b data-i18n="howto.shelf">${t('howto.shelf')}</b></span>
    <span><i data-glyph="serve"></i><b data-i18n="howto.serve">${t('howto.serve')}</b></span>
    <span><i data-glyph="discard"></i><b data-i18n="howto.discard">${t('howto.discard')}</b></span>
  </div>
</div>`);
    this.el = root.querySelector('#hud');
    this.q = (s) => this.el.querySelector(s);
    this.data = { day: 1, loc: '', guest: 0, guests: 0, money: 0, goal: 0 };
    onLangChange(() => this.set({}));
  }
  show(on) { this.el.classList.toggle('hidden', !on); }
  setScore() {}
  set(p) {
    Object.assign(this.data, p);
    const d = this.data;
    this.q('.d').textContent = t('hud.day', { n: d.day });
    this.q('.loc').textContent = d.loc ? t('loc.' + d.loc) : '';
    this.q('.g').textContent = t('hud.guests', { n: d.guest, total: d.guests });
    this.q('.m').textContent = '¥' + d.money.toLocaleString();
    this.q('.goal').textContent = d.goal ? t('hud.goal', { n: d.goal.toLocaleString() }) : '';
    this.q('.meter b').style.width = (d.goal ? Math.min(100, (d.money / d.goal) * 100) : 0).toFixed(1) + '%';
    this.el.classList.toggle('reached', !!d.goal && d.money >= d.goal);
  }
}
