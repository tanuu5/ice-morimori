// 作品の画面（Screens.addModal で足す）：一日の結果、改造ショップ、源さんのノート、確認。
// ボタンは data-act（Screens が知らないものは onAction に届く）。
import { t } from '../../core/i18n.js';
import { UPGRADES, UPGRADE_IDS } from '../data/upgrades.js';
import { NOTEBOOK } from '../data/story.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function addModals(screens) {
  screens.addModal('results', `<section id="m-results" class="modal hidden"><div class="card results" data-scroll></div></section>`);
  screens.addModal('shop', `<section id="m-shop" class="modal hidden"><div class="card shop" data-scroll></div></section>`);
  screens.addModal('notebook', `<section id="m-notebook" class="modal hidden"><div class="card notebook"></div></section>`);
  screens.addModal('confirm', `<section id="m-confirm" class="modal hidden"><div class="card confirm"></div></section>`);
}

/** 一日の結果。r = { day, money, goal, stars[], hearts, tips, best, angry, medal } */
export function fillResults(screens, r) {
  const el = screens.modals.results.querySelector('.card');
  const served = r.stars.filter((s) => s > 0).length;
  const avg = served ? r.stars.filter((s) => s > 0).reduce((a, b) => a + b, 0) / served : 0;
  const stars = (n) => [1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('');
  el.innerHTML = `
    <h2>${esc(t('res.title'))}</h2>
    <p class="sub">${esc(r.endless ? t('card.endless') : t('hud.day', { n: r.day }))} ・ ${esc(t('loc.' + r.location))}</p>
    <div class="big ${r.money >= r.goal ? 'ok' : ''}">¥${r.money.toLocaleString()}<small> / ${esc(t('hud.goal', { n: r.goal.toLocaleString() }))}</small></div>
    ${r.money >= r.goal ? `<div class="medal">${esc(t('res.medal'))}</div>` : `<div class="miss">${esc(t('res.nomedal'))}</div>`}
    <dl class="stats">
      <dt>${esc(t('res.guests'))}</dt><dd>${served} / ${r.stars.length}${r.angry ? ` <small>(${esc(t('res.angry', { n: r.angry }))})</small>` : ''}</dd>
      <dt>${esc(t('res.stars'))}</dt><dd class="stars">${stars(avg)} <small>${avg.toFixed(1)}</small></dd>
      <dt>${esc(t('res.hearts'))}</dt><dd class="hearts">♥ ${r.hearts}</dd>
      <dt>${esc(t('res.tips'))}</dt><dd>¥${r.tips.toLocaleString()}</dd>
      <dt>${esc(t('res.best'))}</dt><dd>${esc(t('res.tiers', { n: r.best }))}</dd>
    </dl>
    <p class="wallet">${esc(t('res.wallet', { n: r.wallet.toLocaleString() }))}</p>
    <button data-act="resultsNext">${esc(t('res.next'))}</button>`;
}

/** 改造ショップ。 */
export function fillShop(screens, { wallet, upgrades, nextLabel }) {
  const el = screens.modals.shop.querySelector('.card');
  const rows = UPGRADE_IDS.map((id) => {
    const U = UPGRADES[id], lv = upgrades[id] || 0, max = U.levels.length;
    const price = lv < max ? U.levels[lv] : null;
    const can = price !== null && wallet >= price;
    const pips = Array.from({ length: max }, (_, i) => `<b class="${i < lv ? 'on' : ''}"></b>`).join('');
    return `<div class="item">
      <i class="ico">${U.icon}</i>
      <div class="info"><b>${esc(t('up.' + id))}</b><small>${esc(t('up.' + id + '.d'))}</small><span class="pips">${pips}</span></div>
      ${price === null ? `<em class="maxed">${esc(t('shop.max'))}</em>` : `<button data-act="buy:${id}" ${can ? '' : 'disabled'}>¥${price.toLocaleString()}</button>`}
    </div>`;
  }).join('');
  el.innerHTML = `
    <h2>${esc(t('shop.title'))}</h2>
    <p class="wallet">${esc(t('res.wallet', { n: wallet.toLocaleString() }))}</p>
    <div class="items">${rows}</div>
    <button data-act="shopNext" class="primary">${esc(nextLabel || t('shop.next'))}</button>`;
}

/** 源さんのノート。unlocked(page) で読めるか。 */
export function fillNotebook(screens, page, unlocked) {
  const el = screens.modals.notebook.querySelector('.card');
  const P = NOTEBOOK[page];
  const ok = unlocked(P);
  const tabs = NOTEBOOK.map((p, i) => `<button data-act="note:${i}" class="tab ${i === page ? 'on' : ''}" ${unlocked(p) ? '' : 'disabled'}>${i + 1}</button>`).join('');
  el.innerHTML = `
    <h2>${esc(t('note.title'))}</h2>
    <div class="tabs" data-nav-skip>${tabs}</div>
    <div class="page">
      <h3>${esc(ok ? t('note.' + P.id + '.t') : '？？？')}</h3>
      <p>${ok ? esc(t('note.' + P.id + '.b')).replace(/\n/g, '<br>') : esc(t('note.locked'))}</p>
    </div>
    <div class="row2">
      <button data-act="notePrev">${esc(t('note.prev'))}</button>
      <button data-act="noteNext">${esc(t('note.next'))}</button>
    </div>
    <button data-act="back">${esc(t('ui.close'))}</button>`;
}

export function fillConfirm(screens, text, yes = 'confirmYes') {
  const el = screens.modals.confirm.querySelector('.card');
  el.innerHTML = `<p class="q">${esc(text)}</p><div class="row2"><button data-act="${yes}">${esc(t('ui.yes'))}</button><button data-act="back">${esc(t('ui.no'))}</button></div>`;
}
