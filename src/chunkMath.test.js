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

  it('player en el midpoint exacto → no shift', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 3, z: 3 }, w)).toEqual(w);
  });

  it('player pasa midpoint en Z positivo → window desplaza +Z', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 3, z: 4 }, w)).toEqual(window(0, 1, 6, 7));
  });

  it('player bajo midpoint en X positivo (X>=0) → window desplaza -X', () => {
    const w = window(2, 0, 8, 6);
    expect(shiftMinMaxIfNeeded({ x: 4, z: 3 }, w)).toEqual(window(1, 0, 7, 6));
  });

  it('shift negativo requiere player >= 0 (no entra en chunks negativos)', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: -1, z: 3 }, w)).toEqual(w);
  });

  it('shift x y z simultaneos en una llamada', () => {
    const w = window(0, 0, 6, 6);
    expect(shiftMinMaxIfNeeded({ x: 4, z: 4 }, w)).toEqual(window(1, 1, 7, 7));
  });

  it('no muta el argumento de entrada', () => {
    const w = window(0, 0, 6, 6);
    shiftMinMaxIfNeeded({ x: 4, z: 4 }, w);
    expect(w).toEqual(window(0, 0, 6, 6));
  });
});
