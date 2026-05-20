// @ts-check

/**
 * @typedef {{x: number, y: number, z: number}} Vec3
 * @typedef {{min: Vec3, max: Vec3}} AABB
 */

/**
 * Build an AABB from a center point and a half-extent (radio) per axis.
 *
 * @param {Vec3} center
 * @param {Vec3} halfExtents
 * @returns {AABB}
 */
export function aabbFromCenter(center, halfExtents) {
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
 * Test whether two axis-aligned bounding boxes intersect. Tangent contact
 * (shared face/edge/corner) counts as intersection.
 *
 * @param {AABB} a
 * @param {AABB} b
 * @returns {boolean}
 */
export function aabbIntersect(a, b) {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}
