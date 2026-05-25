// @ts-check
import { describe, it, expect } from 'vitest';
import { identifyChunk, chunkToWorld, shiftMinMaxIfNeeded, isChunkInWindow } from './chunkMath.js';

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

// Regression: ChunkManager kept building / storing chunks that had scrolled
// out from under the player, leaking to 5000+ tracked chunks at DR=12.
// isChunkInWindow is the single predicate gating every entry into chunkMeshes
// and chunk[][] — exercising its boundary behaviour pins down the leak
// vector before it can come back via another path.
describe('isChunkInWindow (leak guard)', () => {
  const win = { min: { x: 0, z: 0 }, max: { x: 9, z: 9 } };

  it('chunks strictly inside the window are in', () => {
    expect(isChunkInWindow(0, 0, win, 0)).toBe(true);
    expect(isChunkInWindow(5, 5, win, 0)).toBe(true);
    expect(isChunkInWindow(9, 9, win, 0)).toBe(true);
  });

  it('chunks just outside the window are out (R=0)', () => {
    expect(isChunkInWindow(-1, 5, win, 0)).toBe(false);
    expect(isChunkInWindow(10, 5, win, 0)).toBe(false);
    expect(isChunkInWindow(5, -1, win, 0)).toBe(false);
    expect(isChunkInWindow(5, 10, win, 0)).toBe(false);
  });

  it('preload ring extends the in-set by R on every side', () => {
    expect(isChunkInWindow(-1, -1, win, 1)).toBe(true);
    expect(isChunkInWindow(10, 10, win, 1)).toBe(true);
    expect(isChunkInWindow(-2, 5, win, 1)).toBe(false);
    expect(isChunkInWindow(11, 5, win, 1)).toBe(false);
    expect(isChunkInWindow(-2, 5, win, 2)).toBe(true);
  });

  it('chunks far from the window are always out — leak prevention', () => {
    // Mimic the stale worker arrival: player scrolled 30 chunks past,
    // worker resolves for the old position. Must NOT pass the predicate.
    expect(isChunkInWindow(-30, 5, win, 1)).toBe(false);
    expect(isChunkInWindow(40, 5, win, 1)).toBe(false);
    expect(isChunkInWindow(5, -30, win, 1)).toBe(false);
    expect(isChunkInWindow(5, 40, win, 1)).toBe(false);
  });

  it('negative-only windows are handled (player walked into -x/-z)', () => {
    const negWin = { min: { x: -10, z: -10 }, max: { x: -1, z: -1 } };
    expect(isChunkInWindow(-5, -5, negWin, 0)).toBe(true);
    expect(isChunkInWindow(0, -5, negWin, 0)).toBe(false);
    expect(isChunkInWindow(0, -5, negWin, 1)).toBe(true);
  });

  // The hot-loop predicate: simulate the original leak — fast scroll across
  // many chunks dispatches builds for all the visited cells. Without the
  // window check the build queue would fire all of them. With it, only the
  // current window+ring survives, so the inflight set stays bounded.
  it('bounds the queue under fast scrolling — only window+ring chunks pass', () => {
    const R = 1;
    let admitted = 0;
    // Walk a long horizontal trail and "enqueue" every chunk visited.
    const queued = [];
    for (let px = 0; px < 100; px++) {
      // Each visited chunk gets pushed to the queue.
      queued.push({ x: px, z: 5 });
    }
    // After many scroll steps the window settled at min.x=90..max.x=99.
    const settledWin = { min: { x: 90, z: 0 }, max: { x: 99, z: 9 } };
    for (const c of queued) {
      if (isChunkInWindow(c.x, c.z, settledWin, R)) admitted++;
    }
    // Only chunks in [89..100] survive the filter (12 entries).
    expect(admitted).toBe(11); // px 89..99 inclusive
  });
});
