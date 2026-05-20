// @ts-check
import { describe, it, expect } from 'vitest';
import { generarArbolRoble, ArbolRoble } from './estructuras.js';
import { PIXELES_ESTANDAR } from './ParametrosMundo.js';

const Y_BASE = 8 / PIXELES_ESTANDAR;

describe('generarArbolRoble', () => {
  it('tronco tiene exactamente `altura` bloques', () => {
    const tree = generarArbolRoble(4);
    expect(tree.bloquesmadera).toHaveLength(4);
    expect(generarArbolRoble(7).bloquesmadera).toHaveLength(7);
  });

  it('tronco siempre en x=0, z=0', () => {
    const tree = generarArbolRoble(5);
    for (const block of tree.bloquesmadera) {
      expect(block.x).toBe(0);
      expect(block.z).toBe(0);
    }
  });

  it('tronco apilado verticalmente desde yBase', () => {
    const tree = generarArbolRoble(4);
    expect(tree.bloquesmadera.map((b) => b.y)).toEqual([
      Y_BASE,
      Y_BASE + 1,
      Y_BASE + 2,
      Y_BASE + 3,
    ]);
  });

  it('corona tiene 27 hojas (3 capas 3x3 enteramente encima del tronco)', () => {
    expect(generarArbolRoble(4).bloqueshojas).toHaveLength(27);
    expect(generarArbolRoble(5).bloqueshojas).toHaveLength(27);
    expect(generarArbolRoble(6).bloqueshojas).toHaveLength(27);
  });

  it('todas las hojas estan estrictamente encima del tronco', () => {
    // El tronco ocupa k=0..altura-1, top y=yBase+(altura-1). La hoja mas
    // baja debe estar a y=yBase+altura para que el personaje pase por
    // debajo y la copa quede arriba (no rodeando el tronco).
    for (const altura of [3, 4, 5, 6]) {
      const tree = generarArbolRoble(altura);
      const yMinHoja = Math.min(...tree.bloqueshojas.map((b) => b.y));
      const yMaxTronco = Math.max(...tree.bloquesmadera.map((b) => b.y));
      expect(yMinHoja).toBeGreaterThan(yMaxTronco);
      expect(yMinHoja).toBe(Y_BASE + altura);
    }
  });

  it('corona es radio 1 en x y z (rango [-1, 1])', () => {
    const tree = generarArbolRoble(4);
    for (const block of tree.bloqueshojas) {
      expect(block.x).toBeGreaterThanOrEqual(-1);
      expect(block.x).toBeLessThanOrEqual(1);
      expect(block.z).toBeGreaterThanOrEqual(-1);
      expect(block.z).toBeLessThanOrEqual(1);
    }
  });

  it('hojas debajo del tope (k < altura) saltan columna central (x=0,z=0)', () => {
    const tree = generarArbolRoble(4);
    const yTope = Y_BASE + tree.altura;
    const debajo = tree.bloqueshojas.filter((b) => b.y < yTope);
    expect(debajo.some((b) => b.x === 0 && b.z === 0)).toBe(false);
  });

  it('hojas en el tope (k = altura) incluyen columna central', () => {
    const tree = generarArbolRoble(4);
    const yTope = Y_BASE + tree.altura;
    const enTope = tree.bloqueshojas.filter((b) => b.y === yTope);
    expect(enTope.some((b) => b.x === 0 && b.z === 0)).toBe(true);
    expect(enTope).toHaveLength(9);
  });

  it('devuelve la altura usada', () => {
    expect(generarArbolRoble(4).altura).toBe(4);
    expect(generarArbolRoble(9).altura).toBe(9);
  });

  it('altura por defecto cae en rango 4-5 (random)', () => {
    for (let i = 0; i < 20; i++) {
      const { altura } = generarArbolRoble();
      expect(altura).toBeGreaterThanOrEqual(4);
      expect(altura).toBeLessThanOrEqual(5);
    }
  });
});

describe('ArbolRoble (clase wrapper)', () => {
  it('expone bloquesmadera y bloqueshojas con shape correcto', () => {
    const arbol = new ArbolRoble();
    expect(Array.isArray(arbol.bloquesmadera)).toBe(true);
    expect(Array.isArray(arbol.bloqueshojas)).toBe(true);
    expect(arbol.bloquesmadera.length).toBeGreaterThanOrEqual(4);
    expect(arbol.bloquesmadera.length).toBeLessThanOrEqual(5);
  });
});
