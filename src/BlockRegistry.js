// @ts-check
import { Grass, Dirt, Rock, Stone, OakLeaves, OakWood, BaseStone, Glass, GlowStone } from './Cubo.js';

/** @type {string[]} */
export const BLOCK_TYPES = [
  'Grass',
  'Dirt',
  'Rock',
  'Stone',
  'OakWood',
  'BaseStone',
  'Glass',
  'GlowStone',
  'OakLeaves',
];

const _instances = {
  Grass:      new Grass(),
  Dirt:       new Dirt(),
  Rock:       new Rock(),
  Stone:      new Stone(),
  OakWood:    new OakWood(),
  BaseStone:  new BaseStone(),
  Glass:      new Glass(),
  GlowStone:  new GlowStone(),
  OakLeaves:  new OakLeaves(),
};

/** @type {Record<string, THREE.Material | THREE.Material[]>} */
export const blockMaterials = Object.fromEntries(
  Object.entries(_instances).map(([k, v]) => [k, v.material])
);

/** @type {Record<string, THREE.BufferGeometry>} */
export const blockGeometries = Object.fromEntries(
  Object.entries(_instances).map(([k, v]) => [k, v.geometria])
);

// Materials that cast shadows. Buried bulk (Dirt, Stone, Rock) is excluded —
// they're always surrounded by other blocks so their shadow contribution is
// invisible, but they double shadow-map geometry. Big perf win to skip them.
const _SHADOW_CASTERS = new Set([
  'Grass',
  'OakWood',
  'OakLeaves',
  'BaseStone',
  'Glass',
  'GlowStone',
]);

/** @param {string} type */
export function blockCastsShadow(type) {
  return _SHADOW_CASTERS.has(type);
}
