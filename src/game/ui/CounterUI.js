// 調理中の画面の表示（3D の位置に重ねる HTML）：味の名札（押して選べる）、量のゲージ（すくっている玉のまわり）、
// 着地の評価（PERFECT / GOOD / OK / MISS）とコンボ。位置は毎フレーム、カメラで画面へ投影して決める。
import * as THREE from 'three';
import { t, onLangChange } from '../../core/i18n.js';
import { tubCenter, COUNTER_Y } from '../layout.js';
import { SWEET, POUR_SWEET } from '../Counter.js';
import { FLAVORS } from '../data/flavors.js';
import { TOPPINGS } from '../data/toppings.js';

const R = 34; // ゲージの円の半径（px）
const C = 2 * Math.PI * R;

export class CounterUI {
  constructor(root, counter, { onTag, onShelf, onToss } = {}) {
    this.onShelf = onShelf;
    this.onToss = onToss;
    this.counter = counter;
    const el = (this.el = document.createElement('div'));
    el.id = 'cui';
    el.className = 'layer hidden';
    const a0 = SWEET[0] * C, a1 = (SWEET[1] - SWEET[0]) * C;
    el.innerHTML = `
      <div class="tags"></div>
      <svg class="gauge hidden" width="${R * 2 + 16}" height="${R * 2 + 16}" viewBox="0 0 ${R * 2 + 16} ${R * 2 + 16}">
        <circle class="g-bg" cx="${R + 8}" cy="${R + 8}" r="${R}" />
        <circle class="g-sweet" cx="${R + 8}" cy="${R + 8}" r="${R}" stroke-dasharray="${a1} ${C}" stroke-dashoffset="${-a0}" />
        <circle class="g-fill" cx="${R + 8}" cy="${R + 8}" r="${R}" stroke-dasharray="0 ${C}" />
      </svg>
      <div class="pops"></div>
      <div class="tray hidden"></div>
      <button class="shelfBtn" data-nav-skip></button>
      <button class="tossBtn" data-nav-skip><b class="fill"></b><span></span></button>`;
    root.appendChild(el);
    this.tagsEl = el.querySelector('.tags');
    this.gauge = el.querySelector('.gauge');
    this.fill = el.querySelector('.g-fill');
    this.popsEl = el.querySelector('.pops');
    this.trayEl = el.querySelector('.tray');
    this.shelfBtn = el.querySelector('.shelfBtn');
    this.shelfBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onShelf?.(); });
    // すてる（長押し）：押しているあいだ onToss(true)、離したら onToss(false)
    this.tossBtn = el.querySelector('.tossBtn');
    this.tossFill = this.tossBtn.querySelector('.fill');
    const tossDown = (e) => { e.preventDefault(); this.onToss?.(true); try { this.tossBtn.setPointerCapture(e.pointerId); } catch { /* 作った PointerEvent では例外 */ } };
    const tossUp = (e) => { e.preventDefault(); this.onToss?.(false); };
    this.tossBtn.addEventListener('pointerdown', tossDown);
    this.tossBtn.addEventListener('pointerup', tossUp);
    this.tossBtn.addEventListener('pointercancel', tossUp);
    this.tossBtn.addEventListener('pointerleave', tossUp);
    this.tags = [];
    this.onTag = onTag;
    this.pops = [];
    this._v = new THREE.Vector3();
    onLangChange(() => this.buildTags());
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  /** 味とトッピングの名札を作り直す（並べる味が変わったとき）。 */
  buildTags() {
    this.tagsEl.innerHTML = '';
    this.tags = [];
    this.ttags = [];
    const bind = (b, key) => {
      // 押した瞬間に選んで、そのまま押しているあいだ「すくう／かける」
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.onTag?.(key, true); try { b.setPointerCapture(e.pointerId); } catch { /* 作った PointerEvent では例外になる */ } });
      const up = (e) => { e.preventDefault(); this.onTag?.(key, false); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    };
    this.trayEl.innerHTML = '';
    for (const id of this.counter.topList) {
      const b = document.createElement('button');
      b.className = 'tbtn2';
      b.innerHTML = `<i style="background:${TOPPINGS[id].color}">${TOPPINGS[id].icon}</i><span>${t('topping.' + id)}</span><em class="mode">${t('topmode.' + TOPPINGS[id].mode)}</em>`;
      bind(b, 'top:' + id);
      this.trayEl.appendChild(b);
      this.ttags.push({ id, b });
    }
    this.counter.flavors.forEach((id, i) => {
      if (!id) return;
      const b = document.createElement('button');
      b.className = 'tag';
      b.dataset.i = i;
      b.innerHTML = `<i style="background:${FLAVORS[id].a}"></i><span>${t('flavor.' + id)}</span>`;
      bind(b, i);
      this.tagsEl.appendChild(b);
      this.tags.push({ i, b });
    });
  }

  /** すてる長押しの進み具合（0〜1）。 */
  setToss(p) {
    this.tossFill.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%';
    this.tossBtn.classList.toggle('holding', p > 0);
  }

  /** 着地などの評価の文字を、3D の位置に出す。 */
  pop(text, pos, cls = '') {
    const d = document.createElement('div');
    d.className = 'pop ' + cls;
    d.textContent = text;
    this.popsEl.appendChild(d);
    this.pops.push({ d, pos: pos.clone(), t: 0 });
  }

  update(dt, camera) {
    const W = innerWidth, H = innerHeight;
    const v = this._v;
    const proj = (p) => { v.copy(p).project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H, v.z]; };
    const ctr = this.counter;
    const selecting = ctr.phase === 'select';
    // 名札：ケースの手前のふちの少し下
    const iceShelf = ctr.shelf === 'ice';
    for (const { i, b } of this.tags) {
      const c = tubCenter(i, v);
      c.z -= 0.075;
      c.y = COUNTER_Y - 0.005;
      const [x, y] = proj(c);
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
      b.classList.toggle('on', iceShelf && i === ctr.sel);
      b.classList.toggle('dim', !iceShelf || (!selecting && i !== ctr.sel));
      b.classList.toggle('locked', ctr.toppings.length > 0);
    }
    // トッピングの棚：画面下に並べる（選んでいる・のせた）
    const showTray = !iceShelf && ctr.phase !== 'idle';
    this.trayEl.classList.toggle('hidden', !showTray);
    for (const { id, b } of this.ttags) {
      const done = ctr.applied(id);
      b.classList.toggle('on', id === ctr.tsel);
      b.classList.toggle('done', done);
      b.classList.toggle('dim', !selecting && id !== ctr.tsel);
    }
    // 切り替えのボタン（マウス・タッチ用。キーなら Tab）
    const canTop = ctr.topList.length > 0 && ctr.phase !== 'idle';
    this.shelfBtn.classList.toggle('hidden', !canTop || (iceShelf && !ctr.tower.count) || (!iceShelf && ctr.toppings.length > 0));
    const label = iceShelf ? t('shelf.toTop') : t('shelf.toIce');
    if (this.shelfBtn.textContent !== label) this.shelfBtn.textContent = label;
    // すてるボタン：捨てられるものがあるときだけ。何を捨てるかで文言を替える
    const what = ctr.canDiscard();
    this.tossBtn.classList.toggle('hidden', !what);
    const tl = what === 'ball' ? t('toss.ball') : what === 'tool' ? t('toss.tool') : t('toss.tower');
    const span = this.tossBtn.querySelector('span');
    if (span.textContent !== tl) span.textContent = tl;
    // ゲージ（すくう：玉のまわり、かける：塔のてっぺんの上）
    const showG = ctr.phase === 'scoop' || ctr.phase === 'pour';
    this.gauge.classList.toggle('hidden', !showG);
    if (showG) {
      const at = ctr.phase === 'scoop' && ctr.ball ? ctr.ball.root.position : ctr.tool ? ctr.tool.position : null;
      if (at) {
        const [x, y] = proj(at);
        this.gauge.style.transform = `translate(${(x - R - 8).toFixed(1)}px, ${(y - R - 8).toFixed(1)}px)`;
      }
      const band = ctr.phase === 'pour' ? POUR_SWEET : SWEET;
      if (band !== this._band) {
        this._band = band;
        this.el.querySelector('.g-sweet').setAttribute('stroke-dasharray', `${(band[1] - band[0]) * C} ${C}`);
        this.el.querySelector('.g-sweet').setAttribute('stroke-dashoffset', `${-band[0] * C}`);
      }
      const g = Math.min(1, ctr.gauge);
      this.fill.setAttribute('stroke-dasharray', `${(g * C).toFixed(1)} ${C}`);
      const sweet = g >= band[0] && g <= band[1];
      this.gauge.classList.toggle('sweet', sweet);
      this.gauge.classList.toggle('over', g > band[1]);
    }
    // 評価の文字：上へ浮かんで消える
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const p = this.pops[k];
      p.t += dt;
      const [x, y] = proj(p.pos);
      const life = 1.1;
      const a = p.t < 0.12 ? p.t / 0.12 : Math.max(0, 1 - (p.t - 0.6) / (life - 0.6));
      const s = p.t < 0.12 ? 0.6 + (p.t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (p.t - 0.12) * 1.2);
      p.d.style.transform = `translate(${x.toFixed(1)}px, ${(y - p.t * 60).toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(3)})`;
      p.d.style.opacity = a.toFixed(3);
      if (p.t > life) { p.d.remove(); this.pops.splice(k, 1); }
    }
  }
}
