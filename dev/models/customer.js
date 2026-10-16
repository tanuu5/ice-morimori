// 確認台：お客さん（乱数の見た目を 4 人並べる）。mode で表情と身ぶり
import { Customer, MOODS } from '../../src/game/scene/Customer.js';
import { randomLook } from '../../src/game/data/looks.js';
import { Rng } from '../../src/core/rng.js';

export default {
  title: 'Customers',
  create({ THREE }) {
    const root = new THREE.Group();
    const rng = new Rng(Number(new URLSearchParams(location.search).get('seed') || 3));
    const people = [];
    const bodies = ['kid', 'teen', 'adult', 'elder'];
    for (let i = 0; i < 4; i++) {
      const c = new Customer(randomLook(rng, { body: bodies[i] }));
      c.place((i - 1.5) * 0.62, 0, 0);
      root.add(c.root);
      people.push(c);
    }
    return {
      root,
      update(dt, ctx) {
        for (const c of people) {
          if (c.moodName !== ctx.mode) c.setMood(ctx.mode);
          if (ctx.mode === 'walk') { c.moving = 1; c.walkPh += dt * 6; }
          c.update(dt);
        }
      },
    };
  },
  modes: [...Object.keys(MOODS), 'walk'],
  views: { faces: { pos: [0, 1.25, 2.2], target: [0, 1.0, 0], fov: 32 } },
  background: '#cfe5f1',
};
