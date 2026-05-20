// @ts-check
import { createNoise2D } from 'simplex-noise';

/**
 * Deterministic 32-bit PRNG (Mulberry32). Inlined to avoid a UMD-only
 * dependency for seeding. Produces a function in [0, 1).
 *
 * @param {number} seed integer seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a 2D noise function from a seed. With the same seed two calls
 * produce identical noise — required for determinism in tests and for
 * reproducible terrain.
 *
 * @param {number} [seed] integer seed. Defaults to a random 32-bit value.
 * @returns {(x: number, y: number) => number} value in roughly [-1, 1]
 */
export function createTerrainNoise(seed = Math.floor(Math.random() * 0xffffffff)) {
  return createNoise2D(mulberry32(seed));
}
