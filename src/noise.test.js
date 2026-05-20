// @ts-check
import { describe, it, expect } from 'vitest';
import { createTerrainNoise, mulberry32 } from './noise.js';

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
