// @ts-check
import * as THREE from 'three';
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

// ─── Per-face rendering primitives ────────────────────────────────────────
// Direction encoding throughout the chunk pipeline:
//   0=+x, 1=-x, 2=+y, 3=-y, 4=+z, 5=-z

const S = 1; // block size in world units (each chunk block occupies 1 unit)
const H = S / 2;

// One shared unit-plane geometry. Each face instance bakes its orientation
// into the per-instance matrix, so all 6 face directions reuse this single
// BufferGeometry — no per-direction geometry duplication.
export const FACE_GEOMETRY = new THREE.PlaneGeometry(S, S);

// Big enough sphere to cover an entire chunk's vertical extent (deep stone
// to tall mountains). Shared geometry → shared sphere; per-chunk
// mesh.position relocates it to the chunk centroid for frustum culling.
FACE_GEOMETRY.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

/**
 * Local matrix per face direction: rotates the +Z-facing unit plane to face
 * the given direction, then offsets it to the +H face of a unit cube centered
 * at origin. A face's full instance matrix is `T(blockCenter) * FACE_MATRICES[dir]`.
 */
export const FACE_MATRICES = (() => {
  const m = (rot, dx, dy, dz) => {
    const out = new THREE.Matrix4();
    rot(out);
    out.elements[12] = dx;
    out.elements[13] = dy;
    out.elements[14] = dz;
    return out;
  };
  return [
    m((o) => o.makeRotationY( Math.PI / 2),  H,  0,  0),
    m((o) => o.makeRotationY(-Math.PI / 2), -H,  0,  0),
    m((o) => o.makeRotationX(-Math.PI / 2),  0,  H,  0),
    m((o) => o.makeRotationX( Math.PI / 2),  0, -H,  0),
    m((o) => o.identity(),                    0,  0,  H),
    m((o) => o.makeRotationY( Math.PI),       0,  0, -H),
  ];
})();

/** World-space offset from a block centre to each of its 6 face centres. */
export const FACE_OFFSETS = [
  new THREE.Vector3( H,  0,  0),
  new THREE.Vector3(-H,  0,  0),
  new THREE.Vector3( 0,  H,  0),
  new THREE.Vector3( 0, -H,  0),
  new THREE.Vector3( 0,  0,  H),
  new THREE.Vector3( 0,  0, -H),
];

/** Outward normal per face direction. Used by raycast for placement. */
export const FACE_NORMALS = [
  new THREE.Vector3( 1,  0,  0),
  new THREE.Vector3(-1,  0,  0),
  new THREE.Vector3( 0,  1,  0),
  new THREE.Vector3( 0, -1,  0),
  new THREE.Vector3( 0,  0,  1),
  new THREE.Vector3( 0,  0, -1),
];

/** Neighbour-block delta in (x, y, z) per face direction — for occupancy lookup. */
export const FACE_NEIGHBOUR_DELTA = [
  [ 1,  0,  0],
  [-1,  0,  0],
  [ 0,  1,  0],
  [ 0, -1,  0],
  [ 0,  0,  1],
  [ 0,  0, -1],
];

// Block types whose material differs by face direction. Maps faceDir → index
// into the material array. Types absent here use a single material on all faces.
const FACE_MATERIAL_INDEX = {
  Grass:   [0, 0, 1, 2, 0, 0], // sides = 0, top = 1, bottom = 2
  OakWood: [0, 0, 1, 1, 0, 0], // sides = 0, top + bottom = 1
};

/**
 * Resolve a (type, faceDir) pair to its concrete material plus a stable grouping
 * key. Faces with the same key go into the same InstancedMesh.
 *
 * @param {string} type
 * @param {number} faceDir
 * @returns {{ material: THREE.Material, key: string }}
 */
export function getFaceMaterial(type, faceDir) {
  const mat = blockMaterials[type];
  if (Array.isArray(mat)) {
    const idx = FACE_MATERIAL_INDEX[type]?.[faceDir] ?? 0;
    return { material: mat[idx], key: type + ':' + idx };
  }
  return { material: mat, key: type };
}

// Pre-computed lookup tables so the per-face hot loop in ChunkManager doesn't
// allocate a fresh `{ material, key }` object for every emitted face. With
// thousands of faces per chunk rebuild, the GC pressure from those temporaries
// was the dominant cost of the per-face refactor.
/** @type {Record<string, THREE.Material[]>} */
export const FACE_MATERIALS_BY_TYPE = {};
/** @type {Record<string, string[]>} */
export const FACE_KEYS_BY_TYPE = {};
for (const type of BLOCK_TYPES) {
  const mats = new Array(6);
  const keys = new Array(6);
  for (let d = 0; d < 6; d++) {
    const { material, key } = getFaceMaterial(type, d);
    mats[d] = material;
    keys[d] = key;
  }
  FACE_MATERIALS_BY_TYPE[type] = mats;
  FACE_KEYS_BY_TYPE[type] = keys;
}
