// 確認台：マル。mode で表情と動き（reach は左手が前で円を描く、lift は胴をのばす）
import { Robot } from '../../src/game/scene/Robot.js';
import { EXPR } from '../../src/game/scene/RobotFace.js';

export default {
  title: 'Maru (robot)',
  create({ THREE }) {
    const r = new Robot();
    const target = new THREE.Vector3();
    return {
      root: r.root,
      update(dt, ctx) {
        const p = ctx.params;
        r.setFace(p.face || 'normal');
        r.lift = p.lift || 0;
        if (p.reach) {
          const t = ctx.time;
          target.set(0.15 + Math.cos(t * 1.5) * 0.12, 0.95 + Math.sin(t * 1.5) * 0.15 + (p.lift || 0), 0.42);
          r.reach('L', target);
          r.look(target);
        } else { r.reach('L', null); r.look(null); }
        if (p.far) { r.reach('L', target.set(0.2, 1.6, 0.9)); r.look(target); }
        r.update(dt);
      },
    };
  },
  modes: {
    idle: { face: 'normal' }, reach: { face: 'focus', reach: true }, far: { face: 'focus', far: true }, lift: { face: 'normal', reach: true, lift: 0.35 },
    ...Object.fromEntries(Object.keys(EXPR).map((k) => [k, { face: k }])),
  },
  views: { face: { pos: [0, 1.12, 1.0], target: [0, 1.0, 0], fov: 26 }, backcam: { pos: [0.4, 1.6, -1.0], target: [0.1, 0.9, 0.6], fov: 40 } },
  background: '#cfe5f1',
};
