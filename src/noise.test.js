// @ts-check
import { describe, it, expect } from 'vitest';
import { createTerrainNoise, mulberry32, fbm, terrainHeight } from './noise.js';

describe('mulberry32', () => {
  it('mismo seed produce misma secuencia', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it('seeds distintos divergen', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('valores caen en [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('createTerrainNoise', () => {
  it('mismo seed produce misma noise2D para iguales (x, y)', () => {
    const n1 = createTerrainNoise(7);
    const n2 = createTerrainNoise(7);
    for (const [x, y] of [
      [0, 0],
      [0.5, 0.5],
      [10, -3],
      [100, 100],
    ]) {
      expect(n1(x, y)).toBe(n2(x, y));
    }
  });

  it('seeds distintos producen noise distinta', () => {
    const n1 = createTerrainNoise(1);
    const n2 = createTerrainNoise(2);
    expect(n1(5, 5)).not.toBe(n2(5, 5));
  });

  it('valores caen en [-1, 1] (rango simplex)', () => {
    const noise = createTerrainNoise(99);
    for (let i = 0; i < 200; i++) {
      const v = noise(i * 0.123, i * 0.456);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('snapshot heightmap reproducible con seed fijo', () => {
    const noise = createTerrainNoise(2024);
    const heightmap = [];
    for (let x = 0; x < 4; x++) {
      const row = [];
      for (let y = 0; y < 4; y++) {
        row.push(Math.round(noise(x * 0.1, y * 0.1) * 100) / 100);
      }
      heightmap.push(row);
    }
    expect(heightmap).toMatchSnapshot();
  });
});

describe('fbm', () => {
  it('mismo seed → mismo valor en (x, y)', () => {
    const n = createTerrainNoise(5);
    expect(fbm(n, 1.5, 2.5)).toBe(fbm(n, 1.5, 2.5));
  });

  it('octavas mayores no rompen el rango [-1, 1]', () => {
    const n = createTerrainNoise(42);
    for (let i = 0; i < 50; i++) {
      const v = fbm(n, i * 0.3, i * 0.7, { octaves: 5 });
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('terrainHeight', () => {
  it('determinista con seed fijo', () => {
    const n = createTerrainNoise(2024);
    expect(terrainHeight(n, 10, 20)).toBe(terrainHeight(n, 10, 20));
  });

  it('mayoria del mapa esta dentro del rango de colinas (hill-dominant)', () => {
    const n = createTerrainNoise(2024);
    const samples = [];
    for (let x = 0; x < 100; x++) {
      for (let z = 0; z < 100; z++) {
        samples.push(terrainHeight(n, x, z));
      }
    }
    const inHillRange = samples.filter((h) => h >= -3 && h <= 14).length;
    expect(inHillRange / samples.length).toBeGreaterThan(0.7);
  });

  it('hay picos dramaticos ocasionales (mountains)', () => {
    // Muestra un area amplia: mountains son sparse (threshold 0.5) y broad
    // (freq 0.003 → wavelength ~333), asi que un grid pequeño puede caer
    // entre picos. 600x600 es ~1.8 longitudes de onda en cada eje.
    const n = createTerrainNoise(2024);
    let max = -Infinity;
    for (let x = 0; x < 600; x += 3) {
      for (let z = 0; z < 600; z += 3) {
        max = Math.max(max, terrainHeight(n, x, z));
      }
    }
    expect(max).toBeGreaterThanOrEqual(15);
  });

  it('alturas son enteros (Math.round aplicado)', () => {
    const n = createTerrainNoise(7);
    for (let i = 0; i < 20; i++) {
      const h = terrainHeight(n, i, i * 2);
      expect(Number.isInteger(h)).toBe(true);
    }
  });

  it('snapshot heightmap reproducible (8x8 con seed 2024)', () => {
    const n = createTerrainNoise(2024);
    const heightmap = [];
    for (let x = 0; x < 8; x++) {
      const row = [];
      for (let z = 0; z < 8; z++) {
        row.push(terrainHeight(n, x, z));
      }
      heightmap.push(row);
    }
    expect(heightmap).toMatchSnapshot();
  });
});
