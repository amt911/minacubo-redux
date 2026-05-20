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
 * Minecraft-style terrain height: three layers stacked.
 *   - Detail: high-freq noise (~1 block of roughness).
 *   - Hills: mid-freq FBM (rolling terrain, ~5 blocks of variation).
 *   - Mountains: low-freq noise with threshold + exponential curve for
 *     dramatic sparse peaks (~20 blocks above baseline).
 * A baseline lifts everything so the ground sits comfortably above y=0.
 *
 * @param {(x: number, y: number) => number} noiseFn
 * @param {number} x  world coord
 * @param {number} z  world coord
 * @param {object} [opts]
 * @param {number} [opts.baseline]          default 3
 * @param {number} [opts.detailFreq]        default 0.05
 * @param {number} [opts.detailAmplitude]   default 1
 * @param {number} [opts.hillFreq]          default 0.015
 * @param {number} [opts.hillAmplitude]     default 3 (gentle rolling)
 * @param {number} [opts.mountainFreq]      default 0.003 (broad, gentle slopes)
 * @param {number} [opts.mountainAmplitude] default 40 (tall peaks)
 * @param {number} [opts.mountainThreshold] in [-1, 1], default 0.5 (sparse)
 * @param {number} [opts.mountainExponent]  curve sharpness, default 4 (smooth base + sharp top)
 * @returns {number} integer block height
 */
export function terrainHeight(noiseFn, x, z, opts = {}) {
  const {
    baseline = 3,
    detailFreq = 0.05,
    detailAmplitude = 1,
    hillFreq = 0.015,
    hillAmplitude = 3,
    mountainFreq = 0.003,
    mountainAmplitude = 40,
    mountainThreshold = 0.5,
    mountainExponent = 4,
  } = opts;

  const detail = noiseFn(x * detailFreq, z * detailFreq) * detailAmplitude;
  const hills = fbm(noiseFn, x * hillFreq, z * hillFreq, { octaves: 3 }) * hillAmplitude;

  const mountainNoise = noiseFn(x * mountainFreq, z * mountainFreq);
  let mountainBlocks = 0;
  if (mountainNoise > mountainThreshold) {
    const t = (mountainNoise - mountainThreshold) / (1 - mountainThreshold);
    mountainBlocks = Math.pow(t, mountainExponent) * mountainAmplitude;
  }

  return Math.round(baseline + detail + hills + mountainBlocks);
}
