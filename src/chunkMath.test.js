// @ts-check
import { describe, it, expect } from 'vitest';
import { identifyChunk, chunkToWorld, shiftMinMaxIfNeeded } from './chunkMath.js';

describe('identifyChunk', () => {
  it('coords positivas mapean a chunk correcto', () => {
    expect(identifyChunk(0, 0, 12)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(5, 7, 12)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(11, 11, 12)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(12, 12, 12)).toEqual({ x: 1, z: 1 });
    expect(identifyChunk(23, 24, 12)).toEqual({ x: 1, z: 2 });
  });

  it('multiplos exactos del tamano caen en el chunk superior', () => {
    expect(identifyChunk(24, 36, 12)).toEqual({ x: 2, z: 3 });
  });

  it('coords negativas truncan hacia cero (no Math.floor)', () => {
    expect(identifyChunk(-1, -1, 12)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(-12, -12, 12)).toEqual({ x: -1, z: -1 });
    expect(identifyChunk(-13, -13, 12)).toEqual({ x: -1, z: -1 });
    expect(identifyChunk(-24, -25, 12)).toEqual({ x: -2, z: -2 });
  });

  it('coords float caen en el chunk correcto', () => {
    expect(identifyChunk(0.5, 11.999, 12)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(12.5, 12.5, 12)).toEqual({ x: 1, z: 1 });
    expect(identifyChunk(-0.5, -0.5, 12)).toEqual({ x: 0, z: 0 });
  });

  it('tam_chunk = 1 → cada unidad es un chunk', () => {
    expect(identifyChunk(0, 0, 1)).toEqual({ x: 0, z: 0 });
    expect(identifyChunk(5, 3, 1)).toEqual({ x: 5, z: 3 });
  });
});

describe('chunkToWorld', () => {
  it('chunk (0, 0) mapea a origen', () => {
    expect(chunkToWorld(0, 0, 12)).toEqual({ x: 0, z: 0 });
  });

  it('chunk (n, m) → coord top-left = (n*tam, m*tam)', () => {
    expect(chunkToWorld(2, 3, 12)).toEqual({ x: 24, z: 36 });
    expect(chunkToWorld(-1, 1, 12)).toEqual({ x: -12, z: 12 });
  });
});

describe('shiftMinMaxIfNeeded', () => {
  const window = (minX, minZ, maxX, maxZ) => ({
    min: { x: minX, z: minZ },
    max: { x: maxX, z: maxZ },
  });

  it('player at exact midpoint → no shift', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 3, z: 3 }, w)).toEqual(w);
  });

  it('player past midpoint in Z positive → window shifts +Z', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 3, z: 4 }, w)).toEqual(window(0, 1, 6, 7));
  });

  it('player below midpoint in X → window shifts -X', () => {
    const w = window(2, 0, 8, 6);
    expect(shiftMinMaxIfNeeded({ x: 4, z: 3 }, w)).toEqual(window(1, 0, 7, 6));
  });

  it('window shifts into negative chunks when player crosses midpoint below 0', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: -1, z: 3 }, w)).toEqual(window(-1, 0, 5, 6));
  });

  it('shifts x and z simultaneously in one call', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 4, z: 4 }, w)).toEqual(window(1, 1, 7, 7));
  });

  it('does not mutate the input argument', () => {
    const w = window(0, 0, 6, 6);
    shiftMinMaxIfNeeded({ x: 4, z: 4 }, w);
    expect(w).toEqual(window(0, 0, 6, 6));
  });

  // Regression: with DR=20 (window 0..19), midpoint is 9.5. Player spawn at
  // chunk 10 would slide forward, then chunk 10 < 10.5 slides back, etc.
  // Window has to stay put for any chunk within the [floor, ceil] band.
  it('even-sized window: player chunk at either side of half-integer mid → no shift', () => {
    const w = window(0, 0, 19, 19);
    expect(shiftMinMaxIfNeeded({ x: 10, z: 10 }, w)).toEqual(w);
    expect(shiftMinMaxIfNeeded({ x: 9, z: 9 }, w)).toEqual(w);
    expect(shiftMinMaxIfNeeded({ x: 9, z: 10 }, w)).toEqual(w);
  });

  it('even-sized window: shifts only when player chunk leaves the hysteresis band', () => {
    const w = window(0, 0, 19, 19);
    expect(shiftMinMaxIfNeeded({ x: 11, z: 11 }, w)).toEqual(window(1, 1, 20, 20));
    expect(shiftMinMaxIfNeeded({ x: 8, z: 8 }, w)).toEqual(window(-1, -1, 18, 18));
  });
});
