// @ts-check

/**
 * @typedef {{x: number, y: number, z: number}} Vec3
 * @typedef {{min: Vec3, max: Vec3}} AABB
 */

// Thickness of the ground probe just below the feet. Not a snap EPS:
// snap is done to the exact face (no offset) so a gap exactly one player
// tall lets you walk through but blocks jumping. The probe only keeps
// `onGround` true when the player rests on a block with no Y movement.
const GROUND_PROBE = 1e-4;

const cloneAABB = (a) => ({
  min: { x: a.min.x, y: a.min.y, z: a.min.z },
  max: { x: a.max.x, y: a.max.y, z: a.max.z },
});

const shiftAABB = (a, axis, amount) => {
  a.min[axis] += amount;
  a.max[axis] += amount;
};

/**
 * Strict AABB-AABB intersection: touching faces do NOT count as a hit.
 * Unlike the general `aabbIntersect` in `aabb.js` (which counts tangency),
 * we need strict here so the player can pass under a ceiling whose bottom
 * face is exactly at head height — common in 2-block-tall structures
 * (e.g. lower leaves at y=2.5 when the 2-block-tall player has head at y=2).
 */
const aabbIntersectStrict = (a, b) =>
  a.min.x < b.max.x && a.max.x > b.min.x &&
  a.min.y < b.max.y && a.max.y > b.min.y &&
  a.min.z < b.max.z && a.max.z > b.min.z;

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

  // Sub-stepping: if the delta exceeds half a block we split into sub-steps.
  // Without this, a fast fall (large negative delta.y) or a diagonal sprint
  // can tunnel — the AABB shifts so far in one step that it skips over a
  // block without intersecting. 0.5 units = half a block, guarantees any
  // block between the old and new position is detected.
  const maxAbs = Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z));
  const steps = Math.max(1, Math.ceil(maxAbs / MAX_STEP));
  const dx = delta.x / steps;
  const dy = delta.y / steps;
  const dz = delta.z / steps;

  let hitWallX = false;
  let hitWallZ = false;
  let hitCeiling = false;

  for (let s = 0; s < steps; s++) {
    // X axis
    if (dx !== 0) {
      shiftAABB(aabb, 'x', dx);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dx > 0) {
          aabb.max.x = b.min.x;
          aabb.min.x = aabb.max.x - sizeX;
        } else {
          aabb.min.x = b.max.x;
          aabb.max.x = aabb.min.x + sizeX;
        }
        hitWallX = true;
      }
    }

    // Y axis
    if (dy !== 0) {
      shiftAABB(aabb, 'y', dy);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dy < 0) {
          aabb.min.y = b.max.y;
          aabb.max.y = aabb.min.y + sizeY;
        } else {
          aabb.max.y = b.min.y;
          aabb.min.y = aabb.max.y - sizeY;
          hitCeiling = true;
        }
      }
    }

    // Z axis
    if (dz !== 0) {
      shiftAABB(aabb, 'z', dz);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dz > 0) {
          aabb.max.z = b.min.z;
          aabb.min.z = aabb.max.z - sizeZ;
        } else {
          aabb.min.z = b.max.z;
          aabb.max.z = aabb.min.z + sizeZ;
        }
        hitWallZ = true;
      }
    }
  }

  // Ground probe: thin slab just below the feet. Without this, after landing
  // on an exact face (no EPS), strict intersect no longer detects ground
  // contact on idle frames (dy=0 → Y axis skipped). A GROUND_PROBE-tall slab
  // decouples ground detection from the rest of collision resolution.
  let onGround = false;
  const probe = {
    min: { x: aabb.min.x, y: aabb.min.y - GROUND_PROBE, z: aabb.min.z },
    max: { x: aabb.max.x, y: aabb.min.y, z: aabb.max.z },
  };
  for (const b of blocks) {
    if (aabbIntersectStrict(probe, b)) {
      onGround = true;
      break;
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
