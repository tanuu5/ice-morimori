// 確認台：アイスの玉・コーン・カップ。8 つの味を並べる／3 段のコーン／溶けたとき。
import { ScoopMesh, makeCone, makeCup } from '../../src/game/scene/IceCream.js';
import { FLAVOR_IDS } from '../../src/game/data/flavors.js';

export default {
  title: 'Ice cream',
  create({ THREE }) {
    const root = new THREE.Group();
    const scoops = [];
    // 8 つの味（2 段 × 4）
    const row = new THREE.Group();
    row.name = 'flavors';
    FLAVOR_IDS.forEach((id, i) => {
      const s = new ScoopMesh(id, 0.052, (i + 1) / 9.3);
      s.root.position.set(((i % 4) - 1.5) * 0.13, 0.055 + Math.floor(i / 4) * 0.0, Math.floor(i / 4) * -0.14);
      row.add(s.root);
      scoops.push(s);
    });
    root.add(row);
    // 3 段のコーン
    const tower = new THREE.Group();
    tower.name = 'tower';
    const cone = makeCone();
    cone.position.y = 0.13;
    tower.add(cone);
    ['strawberry', 'vanilla', 'soda'].forEach((id, i) => {
      const s = new ScoopMesh(id, 0.05, 0.3 + i * 0.21);
      s.root.position.y = 0.13 + 0.03 + i * 0.075;
      tower.add(s.root);
      scoops.push(s);
    });
    tower.position.set(0.36, 0, -0.07);
    root.add(tower);
    const cup = makeCup();
    cup.position.set(-0.36, 0.07, -0.07);
    const cs = new ScoopMesh('mango', 0.05, 0.77);
    cs.root.position.set(-0.36, 0.09, -0.07);
    scoops.push(cs);
    root.add(cup, cs.root);
    return {
      root,
      update(dt, ctx) {
        const m = ctx.params.melt ?? 0;
        for (const s of scoops) s.setMelt(m);
      },
    };
  },
  modes: { fresh: { melt: 0 }, soft: { melt: 0.45 }, melted: { melt: 0.9 } },
  views: { close: { pos: [0, 0.3, 0.55], target: [0, 0.08, -0.05], fov: 30 }, tower: { pos: [0.36, 0.22, 0.42], target: [0.36, 0.2, -0.07], fov: 28 } },
  background: '#cfe5f1',
};
