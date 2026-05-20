// @ts-check
import { describe, it, expect } from 'vitest';
import { aabbIntersect, aabbFromCenter } from './aabb.js';

const box = (minX, minY, minZ, maxX, maxY, maxZ) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

describe('aabbIntersect', () => {
  it('overlap total (uno dentro del otro)', () => {
    const outer = box(0, 0, 0, 10, 10, 10);
    const inner = box(2, 2, 2, 3, 3, 3);
    expect(aabbIntersect(outer, inner)).toBe(true);
    expect(aabbIntersect(inner, outer)).toBe(true);
  });

  it('overlap parcial en una esquina', () => {
    const a = box(0, 0, 0, 2, 2, 2);
    const b = box(1, 1, 1, 3, 3, 3);
    expect(aabbIntersect(a, b)).toBe(true);
  });

  it('tangente — caras pegadas en X cuentan como interseccion', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(1, 0, 0, 2, 1, 1);
    expect(aabbIntersect(a, b)).toBe(true);
  });

  it('tangente — arista compartida cuenta', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(1, 1, 0, 2, 2, 1);
    expect(aabbIntersect(a, b)).toBe(true);
  });

  it('tangente — vertice compartido cuenta', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(1, 1, 1, 2, 2, 2);
    expect(aabbIntersect(a, b)).toBe(true);
  });

  it('disjunto en eje X', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(2, 0, 0, 3, 1, 1);
    expect(aabbIntersect(a, b)).toBe(false);
  });

  it('disjunto en eje Y', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(0, 2, 0, 1, 3, 1);
    expect(aabbIntersect(a, b)).toBe(false);
  });

  it('disjunto en eje Z', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(0, 0, 2, 1, 1, 3);
    expect(aabbIntersect(a, b)).toBe(false);
  });

  it('disjunto en los tres ejes', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    const b = box(5, 5, 5, 6, 6, 6);
    expect(aabbIntersect(a, b)).toBe(false);
  });

  it('cajas coincidentes intersectan', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    expect(aabbIntersect(a, a)).toBe(true);
  });
});

describe('aabbFromCenter', () => {
  it('construye AABB simetrica a partir de centro y half-extents', () => {
    const aabb = aabbFromCenter({ x: 5, y: 10, z: -3 }, { x: 1, y: 2, z: 0.5 });
    expect(aabb).toEqual({
      min: { x: 4, y: 8, z: -3.5 },
      max: { x: 6, y: 12, z: -2.5 },
    });
  });

  it('half-extents cero produce caja degenerada en ese eje', () => {
    const aabb = aabbFromCenter({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 });
    expect(aabb.min.y).toBe(0);
    expect(aabb.max.y).toBe(0);
  });
});
