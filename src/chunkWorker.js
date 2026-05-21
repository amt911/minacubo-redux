// Module Web Worker — generates chunk block data off the main thread.
// Cannot import `noise.js` directly because it depends on `simplex-noise`
// via a bare specifier (workers don't see the document's importmap), so we
// inline mulberry32 / fbm / terrainHeight and load simplex-noise via the
// dev-server-resolved absolute URL.

import { generateChunkBlocks } from './chunkGen.js';

const noiseModUrl = '/node_modules/simplex-noise/dist/esm/simplex-noise.js';
const { createNoise2D } = await import(noiseModUrl);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fbm(noiseFn, x, y, { octaves = 3, persistence = 0.5, lacunarity = 2 } = {}) {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += noiseFn(x * freq, y * freq) * amp;
    max += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return total / max;
}

function terrainHeight(noiseFn, x, z) {
  const detail = noiseFn(x * 0.05, z * 0.05) * 1;
  const hills  = fbm(noiseFn, x * 0.015, z * 0.015, { octaves: 3 }) * 7;
  const mNoise = noiseFn(x * 0.003, z * 0.003);
  let mountains = 0;
  if (mNoise > 0.3) {
    const t = (mNoise - 0.3) / 0.7;
    mountains = Math.pow(t, 4) * 45;
  }
  return Math.round(4 + detail + hills + mountains);
}

let getHeight = null;

self.onmessage = (e) => {
  const data = e.data;
  if (data.type === 'init') {
    const base = createNoise2D(mulberry32(data.seed));
    getHeight = (x, z) => terrainHeight(base, x, z);
  } else if (data.type === 'gen') {
    const r = generateChunkBlocks(getHeight, data.chunkX, data.chunkZ, data.TC);
    self.postMessage({
      type: 'result',
      id: data.id,
      chunkX: data.chunkX,
      chunkZ: data.chunkZ,
      blocks: r.blocks,
    });
  }
};
