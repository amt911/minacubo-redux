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

/**
 * Fractal Brownian Motion — sum a noise function across decreasing
 * amplitudes / increasing frequencies. Produces natural-looking terrain
 * (smoother than raw simplex, captures both broad shape and fine detail).
 *
 * @param {(x: number, y: number) => number} noiseFn base noise in [-1, 1]
 * @param {number} x
 * @param {number} y
 * @param {object} [opts]
 * @param {number} [opts.octaves]      default 3
 * @param {number} [opts.persistence]  amp decay per octave, default 0.5
 * @param {number} [opts.lacunarity]   freq growth per octave, default 2
 * @returns {number} value in roughly [-1, 1] (normalized by total amplitude)
 */
export function fbm(noiseFn, x, y, opts = {}) {
  const { octaves = 3, persistence = 0.5, lacunarity = 2 } = opts;
  let total = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * freq, y * freq) * amp;
    max += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return total / max;
}

/**
 * Minecraft-style terrain height: mostly flat plains with sparse mountain
 * peaks. Combines:
 *   - low-amplitude FBM at higher freq for gentle hills.
 *   - low-freq noise with threshold for sparse mountain contributions.
 *
 * @param {(x: number, y: number) => number} noiseFn
 * @param {number} x  world coord
 * @param {number} z  world coord
 * @param {object} [opts]
 * @param {number} [opts.plainFreq]       default 0.02
 * @param {number} [opts.plainAmplitude]  default 1.5 (max plain height ~3)
 * @param {number} [opts.mountainFreq]    default 0.008
 * @param {number} [opts.mountainAmplitude] default 12
 * @param {number} [opts.mountainThreshold] in [-1, 1], default 0.3
 * @returns {number} integer block height
 */
export function terrainHeight(noiseFn, x, z, opts = {}) {
  const {
    plainFreq = 0.02,
    plainAmplitude = 1.5,
    mountainFreq = 0.008,
    mountainAmplitude = 12,
    mountainThreshold = 0.3,
  } = opts;

  const plain = fbm(noiseFn, x * plainFreq, z * plainFreq, { octaves: 3 });
  const plainBlocks = (plain + 1) * plainAmplitude;

  const mountainNoise = noiseFn(x * mountainFreq, z * mountainFreq);
  let mountainBlocks = 0;
  if (mountainNoise > mountainThreshold) {
    const t = (mountainNoise - mountainThreshold) / (1 - mountainThreshold);
    mountainBlocks = t * mountainAmplitude;
  }

  return Math.round(plainBlocks + mountainBlocks);
}
