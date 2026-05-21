// @ts-check
import { describe, it, expect } from 'vitest';
import { generateOakTree, OakTree } from './estructuras.js';
import { PIXELES_ESTANDAR } from './ParametrosMundo.js';

const Y_BASE = 8 / PIXELES_ESTANDAR;

describe('generateOakTree', () => {
  it('trunk has exactly `height` bloques', () => {
    const tree = generateOakTree(4);
    expect(tree.woodBlocks).toHaveLength(4);
    expect(generateOakTree(7).woodBlocks).toHaveLength(7);
  });

  it('trunk always at x=0, z=0', () => {
    const tree = generateOakTree(5);
    for (const block of tree.woodBlocks) {
      expect(block.x).toBe(0);
      expect(block.z).toBe(0);
    }
  });

  it('trunk stacked vertically from yBase', () => {
    const tree = generateOakTree(4);
    expect(tree.woodBlocks.map((b) => b.y)).toEqual([
      Y_BASE,
      Y_BASE + 1,
      Y_BASE + 2,
      Y_BASE + 3,
    ]);
  });

  it('corona tiene 8*height - 7 hojas (formula derivada)', () => {
    expect(generateOakTree(4).leaves).toHaveLength(8 * 4 - 7);
    expect(generateOakTree(5).leaves).toHaveLength(8 * 5 - 7);
    expect(generateOakTree(6).leaves).toHaveLength(8 * 6 - 7);
  });

  it('canopy is radius 1 in x and z (range [-1, 1])', () => {
    const tree = generateOakTree(4);
    for (const block of tree.leaves) {
      expect(block.x).toBeGreaterThanOrEqual(-1);
      expect(block.x).toBeLessThanOrEqual(1);
      expect(block.z).toBeGreaterThanOrEqual(-1);
      expect(block.z).toBeLessThanOrEqual(1);
    }
  });

  it('hojas below del tope (k < height) saltan columna central (x=0,z=0)', () => {
    const tree = generateOakTree(4);
    const yTop = Y_BASE + tree.height;
    const below = tree.leaves.filter((b) => b.y < yTop);
    expect(below.some((b) => b.x === 0 && b.z === 0)).toBe(false);
  });

  it('hojas en el tope (k = height) incluyen columna central', () => {
    const tree = generateOakTree(4);
    const yTop = Y_BASE + tree.height;
    const atTop = tree.leaves.filter((b) => b.y === yTop);
    expect(atTop.some((b) => b.x === 0 && b.z === 0)).toBe(true);
    expect(atTop).toHaveLength(9);
  });

  it('devuelve la height usada', () => {
    expect(generateOakTree(4).height).toBe(4);
    expect(generateOakTree(9).height).toBe(9);
  });

  it('height por defecto cae en rango 4-5 (random)', () => {
    for (let i = 0; i < 20; i++) {
      const { height } = generateOakTree();
      expect(height).toBeGreaterThanOrEqual(4);
      expect(height).toBeLessThanOrEqual(5);
    }
  });
});

describe('OakTree (wrapper class)', () => {
  it('exposes woodBlocks y leaves with correct shape', () => {
    const tree = new OakTree();
    expect(Array.isArray(tree.woodBlocks)).toBe(true);
    expect(Array.isArray(tree.leaves)).toBe(true);
    expect(tree.woodBlocks.length).toBeGreaterThanOrEqual(4);
    expect(tree.woodBlocks.length).toBeLessThanOrEqual(5);
  });
});
