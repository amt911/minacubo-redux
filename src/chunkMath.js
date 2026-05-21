// @ts-check

/**
 * @typedef {{x: number, z: number}} Coord2
 * @typedef {{min: Coord2, max: Coord2}} ChunkMinMax
 */

/**
 * Map a world coordinate (x, z) to its containing chunk index. Truncates
 * toward zero (matches the original `Math.round((v - v % tam) / tam)`
 * formulation, which is equivalent to `Math.trunc(v / tam)` for both
 * positive and negative inputs).
 *
 * @param {number} x
 * @param {number} z
 * @param {number} tamChunk
 * @returns {Coord2}
 */
export function identifyChunk(x, z, tamChunk) {
  return {
    x: Math.round((x - (x % tamChunk)) / tamChunk),
    z: Math.round((z - (z % tamChunk)) / tamChunk),
  };
}

/**
 * Top-left world coordinate of a chunk.
 *
 * @param {number} chunkX
 * @param {number} chunkZ
 * @param {number} tamChunk
 * @returns {Coord2}
 */
export function chunkToWorld(chunkX, chunkZ, tamChunk) {
  return { x: chunkX * tamChunk, z: chunkZ * tamChunk };
}

/**
 * Apply the visible-window shift rule from `MyScene.update`. If the player is
 * past the midpoint of the current window on either axis, the window slides
 * one chunk in that direction. Returns a *new* {min, max} (does not mutate).
 *
 * Mirrors the original behaviour: the negative-direction shift only fires
 * when the resulting min is still >= 0 (avoids going into negative chunks).
 *
 * @param {Coord2} playerChunk
 * @param {ChunkMinMax} minMax
 * @returns {ChunkMinMax}
 */
export function shiftMinMaxIfNeeded(playerChunk, minMax) {
  const min = { ...minMax.min };
  const max = { ...minMax.max };

  const midZ = (min.z + max.z) / 2;
  if (playerChunk.z > midZ) {
    min.z++;
    max.z++;
  } else if (playerChunk.z < midZ && playerChunk.z >= 0) {
    min.z--;
    max.z--;
  }

  const midX = (min.x + max.x) / 2;
  if (playerChunk.x > midX) {
    min.x++;
    max.x++;
  } else if (playerChunk.x < midX && playerChunk.x >= 0) {
    min.x--;
    max.x--;
  }

  return { min, max };
}
