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
 * True if (chunkX, chunkZ) sits inside the visible window plus an R-chunk
 * preload ring around it. Single source of truth used by ChunkManager.tick
 * (drop stale mesh-builds), _genChunkAsync.then (drop late worker results),
 * and evictDistantChunkData (cull strays). Centralising it avoids the kind
 * of off-by-one drift that let the chunk leak grow to 5000+ entries.
 *
 * @param {number} chunkX
 * @param {number} chunkZ
 * @param {ChunkMinMax} minMax
 * @param {number} preloadRing
 * @returns {boolean}
 */
export function isChunkInWindow(chunkX, chunkZ, minMax, preloadRing) {
  return chunkX >= minMax.min.x - preloadRing
      && chunkX <= minMax.max.x + preloadRing
      && chunkZ >= minMax.min.z - preloadRing
      && chunkZ <= minMax.max.z + preloadRing;
}

/**
 * Apply the visible-window shift rule from `MyScene.update`. If the player is
 * past the midpoint of the current window on either axis, the window slides
 * one chunk in that direction. Returns a *new* {min, max} (does not mutate).
 *
 * Window can shift into negative chunk indices — terrain generates in all directions.
 *
 * @param {Coord2} playerChunk
 * @param {ChunkMinMax} minMax
 * @returns {ChunkMinMax}
 */
export function shiftMinMaxIfNeeded(playerChunk, minMax) {
  const min = { ...minMax.min };
  const max = { ...minMax.max };

  // Even-window hysteresis: with DR even, mid is a half-integer, so an
  // integer chunk index always sits on one side of it. Without ceil/floor
  // the window would oscillate every frame between two states.
  const midZ = (min.z + max.z) / 2;
  if (playerChunk.z > Math.ceil(midZ))       { min.z++; max.z++; }
  else if (playerChunk.z < Math.floor(midZ)) { min.z--; max.z--; }

  const midX = (min.x + max.x) / 2;
  if (playerChunk.x > Math.ceil(midX))       { min.x++; max.x++; }
  else if (playerChunk.x < Math.floor(midX)) { min.x--; max.x--; }

  return { min, max };
}
