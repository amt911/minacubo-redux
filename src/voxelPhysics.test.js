// @ts-check
import { describe, it, expect } from 'vitest';
import {
  resolveMovement,
  aabbFromCenterSize,
  blockCentersToAABBs,
} from './voxelPhysics.js';

const player = (x, y, z) =>
  aabbFromCenterSize({ x, y, z }, { x: 0.25, y: 1, z: 0.25 });
const block = (x, y, z) =>
  aabbFromCenterSize({ x, y, z }, { x: 0.5, y: 0.5, z: 0.5 });

describe('resolveMovement', () => {
  it('mundo vacio: el player se mueve por completo, sin contactos', () => {
    const start = player(0, 5, 0);
    const r = resolveMovement(start, { x: 1, y: 2, z: -3 }, []);
    expect(r.aabb.min.x).toBeCloseTo(start.min.x + 1);
    expect(r.aabb.min.y).toBeCloseTo(start.min.y + 2);
    expect(r.aabb.min.z).toBeCloseTo(start.min.z - 3);
    expect(r.onGround).toBe(false);
    expect(r.hitWallX).toBe(false);
    expect(r.hitWallZ).toBe(false);
    expect(r.hitCeiling).toBe(false);
  });

  it('cae sobre bloque: snap del bottom al top del bloque, onGround=true', () => {
    const start = player(0, 5, 0);
    const blocks = [block(0, 0, 0)]; // top en y=0.5
    const r = resolveMovement(start, { x: 0, y: -10, z: 0 }, blocks);
    expect(r.aabb.min.y).toBeCloseTo(0.5, 5);
    expect(r.onGround).toBe(true);
  });

  it('camina hacia pared en +X: aabb.max.x se queda en block.min.x', () => {
    const start = player(0, 0.5, 0); // pies en 0.5 → encima del suelo virtual
    const blocks = [block(1, 0.5, 0)]; // bloque a la derecha (min.x=0.5)
    const r = resolveMovement(start, { x: 1, y: 0, z: 0 }, blocks);
    expect(r.aabb.max.x).toBeCloseTo(0.5, 5);
    expect(r.hitWallX).toBe(true);
  });

  it('camina hacia pared en -Z: aabb.min.z se queda en block.max.z', () => {
    const start = player(0, 0.5, 0);
    const blocks = [block(0, 0.5, -1)]; // bloque detras (max.z=-0.5)
    const r = resolveMovement(start, { x: 0, y: 0, z: -1 }, blocks);
    expect(r.aabb.min.z).toBeCloseTo(-0.5, 5);
    expect(r.hitWallZ).toBe(true);
  });

  it('salta debajo de hoja de arbol: no se sube a la hoja (bloque arriba ≠ suelo)', () => {
    // Player a y=2 saltando (delta.y=+1.4). Hoja a y=5 (bottom=4.5). Tras
    // delta player.max.y = 4.4 < 4.5 → no overlap, no ceiling hit. El
    // jump bug original "subia" al player a la hoja: aqui validamos que
    // NUNCA marcamos onGround para un bloque por encima del jugador.
    const start = player(0, 2, 0);
    const blocks = [block(0, 5, 0)];
    const r = resolveMovement(start, { x: 0, y: 1.4, z: 0 }, blocks);
    expect(r.aabb.min.y).toBeCloseTo(start.min.y + 1.4);
    expect(r.onGround).toBe(false);
    expect(r.hitCeiling).toBe(false);
  });

  it('cabeza pega techo: aabb.max.y se queda en block.min.y, hitCeiling=true', () => {
    // Player con altura 2 (centro y=1 → top y=2). Techo a y=3 (bottom=2.5).
    const start = player(0, 1, 0);
    const blocks = [block(0, 3, 0)];
    const r = resolveMovement(start, { x: 0, y: 2, z: 0 }, blocks);
    expect(r.aabb.max.y).toBeCloseTo(2.5, 5);
    expect(r.hitCeiling).toBe(true);
    expect(r.onGround).toBe(false);
  });

  it('movimiento diagonal contra pared: desliza por el otro eje', () => {
    // Player en (0, 0.5, 0). Pared a la derecha (block en x=1). Input
    // diagonal +X +Z deberia: chocar en X (hitWallX), avanzar en Z.
    const start = player(0, 0.5, 0);
    const blocks = [block(1, 0.5, 0)];
    const r = resolveMovement(start, { x: 1, y: 0, z: 1 }, blocks);
    expect(r.hitWallX).toBe(true);
    expect(r.hitWallZ).toBe(false);
    // Aabb.max.x clampada a block.min.x (=0.5).
    expect(r.aabb.max.x).toBeCloseTo(0.5, 5);
    // Movimiento Z completo.
    expect(r.aabb.min.z).toBeCloseTo(start.min.z + 1);
  });

  it('no muta el aabb de entrada', () => {
    const start = player(0, 5, 0);
    const startCopy = JSON.parse(JSON.stringify(start));
    resolveMovement(start, { x: 1, y: -1, z: 1 }, [block(0, 0, 0)]);
    expect(start).toEqual(startCopy);
  });

  it('delta cero: aabb sin cambios, sin contactos detectados', () => {
    const start = player(0, 5, 0);
    const r = resolveMovement(start, { x: 0, y: 0, z: 0 }, [block(0, 0, 0)]);
    expect(r.aabb).toEqual(start);
    expect(r.onGround).toBe(false);
    expect(r.hitWallX).toBe(false);
  });

  it('cae entre dos bloques separados: pasa por el hueco', () => {
    // Bloques en x=0 y x=2. Player en x=1, cae sin tocar nada lateralmente.
    const start = player(1, 5, 0);
    const blocks = [block(0, 0, 0), block(2, 0, 0)];
    const r = resolveMovement(start, { x: 0, y: -10, z: 0 }, blocks);
    expect(r.onGround).toBe(false);
    expect(r.aabb.min.y).toBeCloseTo(start.min.y - 10);
  });

  it('camina bajo bloque cuyo bottom toca la cabeza: sin colision (tangencia exclusiva)', () => {
    // Player altura 2 (centro y=1 → top y=2). Hoja a y=2.5 (bottom=2).
    // Player camina en +X. La hoja queda exactamente "rozando" la cabeza.
    // Con interseccion estricta NO debe contar como bloque, el player
    // avanza libremente.
    const start = player(0, 1, 0);
    const blocks = [block(1, 2.5, 0)]; // hoja a la derecha, altura 2.5
    const r = resolveMovement(start, { x: 1, y: 0, z: 0 }, blocks);
    expect(r.hitWallX).toBe(false);
    expect(r.aabb.min.x).toBeCloseTo(start.min.x + 1);
  });

  it('cae sobre uno de varios bloques al mismo nivel', () => {
    const start = player(0, 5, 0);
    const blocks = [block(0, 0, 0), block(1, 0, 0), block(-1, 0, 0)];
    const r = resolveMovement(start, { x: 0, y: -10, z: 0 }, blocks);
    expect(r.onGround).toBe(true);
    expect(r.aabb.min.y).toBeCloseTo(0.5, 5);
  });
});

describe('aabbFromCenterSize', () => {
  it('construye AABB centrada con half-extents simetricos', () => {
    const a = aabbFromCenterSize({ x: 1, y: 2, z: 3 }, { x: 0.5, y: 1, z: 0.25 });
    expect(a.min).toEqual({ x: 0.5, y: 1, z: 2.75 });
    expect(a.max).toEqual({ x: 1.5, y: 3, z: 3.25 });
  });
});

describe('blockCentersToAABBs', () => {
  it('mapea cada centro a AABB 1x1x1', () => {
    const out = blockCentersToAABBs([{ x: 0, y: 0, z: 0 }, { x: 1, y: 5, z: -2 }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    });
    expect(out[1]).toEqual({
      min: { x: 0.5, y: 4.5, z: -2.5 },
      max: { x: 1.5, y: 5.5, z: -1.5 },
    });
  });
});
