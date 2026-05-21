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
