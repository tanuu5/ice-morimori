// 場所の一覧。build(world) → { root, update?(dt, camera), setLook?(id, look), dispose?(), seaParams?, seaLevel?, seaEdge?, sea? }
import { buildBeach } from './beach.js';
import { buildHarbor } from './harbor.js';
import { buildPark } from './park.js';
import { buildStreet } from './street.js';
import { buildCape } from './cape.js';
import { buildFestival } from './festival.js';

export const LOCATIONS = {
  harbor: buildHarbor,
  beach: buildBeach,
  park: buildPark,
  street: buildStreet,
  cape: buildCape,
  festival: buildFestival,
};
