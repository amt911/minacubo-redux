// @ts-check
import { aabbIntersect } from './aabb.js';

/**
 * @typedef {{x: number, y: number, z: number}} Vec3
 * @typedef {{min: Vec3, max: Vec3}} AABB
 */

const EPS = 1e-6;

const cloneAABB = (a) => ({
  min: { x: a.min.x, y: a.min.y, z: a.min.z },
  max: { x: a.max.x, y: a.max.y, z: a.max.z },
});

const shiftAABB = (a, axis, amount) => {
  a.min[axis] += amount;
  a.max[axis] += amount;
};

/**
 * Axis-separated AABB collision resolution against a list of solid block
 * AABBs. The player AABB is moved one axis at a time: any intersection
 * detected after a single-axis move is resolved by snapping back to the
 * face of the offending block on that same axis.
 *
 * The technique is standard for voxel/grid games (Minecraft-style): it
 * sidesteps "tunneling" through corners that swept-AABB has on diagonals,
 * is stable against jitter (no double-correction), and naturally produces
 * sliding along walls when moving diagonally.
 *
 * @param {AABB} currentAABB player AABB at the start of the step
 * @param {Vec3} delta movement intent for the step (post-gravity for y)
 * @param {AABB[]} blocks solid block AABBs nearby (caller filters)
 * @returns {{ aabb: AABB, onGround: boolean, hitWallX: boolean, hitWallZ: boolean, hitCeiling: boolean }}
 */
const MAX_STEP = 0.5;

export function resolveMovement(currentAABB, delta, blocks) {
  const aabb = cloneAABB(currentAABB);
  const sizeX = currentAABB.max.x - currentAABB.min.x;
  const sizeY = currentAABB.max.y - currentAABB.min.y;
  const sizeZ = currentAABB.max.z - currentAABB.min.z;

  // Sub-stepping: si el delta es mayor que medio bloque, lo dividimos en
  // sub-pasos. Sin esto, una caida rapida (delta.y muy negativo) o un
  // ataque diagonal a alta velocidad pueden "tunelar" — el AABB se shiftea
  // tan lejos en un paso que pasa por encima del bloque sin intersectar.
  // 0.5 unidades = medio bloque, garantiza que cualquier bloque entre la
  // posicion previa y la nueva sea detectado.
  const maxAbs = Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z));
  const steps = Math.max(1, Math.ceil(maxAbs / MAX_STEP));
  const dx = delta.x / steps;
  const dy = delta.y / steps;
  const dz = delta.z / steps;

  let onGround = false;
  let hitWallX = false;
  let hitWallZ = false;
  let hitCeiling = false;

  for (let s = 0; s < steps; s++) {
    // X axis
    if (dx !== 0) {
      shiftAABB(aabb, 'x', dx);
      for (const b of blocks) {
        if (!aabbIntersect(aabb, b)) continue;
        if (dx > 0) {
          aabb.max.x = b.min.x - EPS;
          aabb.min.x = aabb.max.x - sizeX;
        } else {
          aabb.min.x = b.max.x + EPS;
          aabb.max.x = aabb.min.x + sizeX;
        }
        hitWallX = true;
      }
    }

    // Y axis
    if (dy !== 0) {
      shiftAABB(aabb, 'y', dy);
      for (const b of blocks) {
        if (!aabbIntersect(aabb, b)) continue;
        if (dy < 0) {
          aabb.min.y = b.max.y + EPS;
          aabb.max.y = aabb.min.y + sizeY;
          onGround = true;
        } else {
          aabb.max.y = b.min.y - EPS;
          aabb.min.y = aabb.max.y - sizeY;
          hitCeiling = true;
        }
      }
    }

    // Z axis
    if (dz !== 0) {
      shiftAABB(aabb, 'z', dz);
      for (const b of blocks) {
        if (!aabbIntersect(aabb, b)) continue;
        if (dz > 0) {
          aabb.max.z = b.min.z - EPS;
          aabb.min.z = aabb.max.z - sizeZ;
        } else {
          aabb.min.z = b.max.z + EPS;
          aabb.max.z = aabb.min.z + sizeZ;
        }
        hitWallZ = true;
      }
    }
  }

  return { aabb, onGround, hitWallX, hitWallZ, hitCeiling };
}

/**
 * Build an AABB from a center point + half-extents.
 *
 * @param {Vec3} center
 * @param {Vec3} halfExtents
 * @returns {AABB}
 */
export function aabbFromCenterSize(center, halfExtents) {
  return {
    min: {
      x: center.x - halfExtents.x,
      y: center.y - halfExtents.y,
      z: center.z - halfExtents.z,
    },
    max: {
      x: center.x + halfExtents.x,
      y: center.y + halfExtents.y,
      z: center.z + halfExtents.z,
    },
  };
}

/**
 * Convert a list of block centers (`{x, y, z}`) to a list of unit-cube
 * AABBs (each block is 1x1x1 centered at the given point). Useful to
 * adapt the legacy `bloques` array into the input expected by
 * `resolveMovement`.
 *
 * @param {Vec3[]} blocks
 * @returns {AABB[]}
 */
export function blockCentersToAABBs(blocks) {
  const HE = { x: 0.5, y: 0.5, z: 0.5 };
  const result = new Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    result[i] = aabbFromCenterSize(blocks[i], HE);
  }
  return result;
}
