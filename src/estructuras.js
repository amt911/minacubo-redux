// @ts-check
import * as PM from './ParametrosMundo.js';

/**
 * @typedef {{x: number, y: number, z: number}} BlockCoord
 */

/**
 * Generate the block positions of an oak tree (`ArbolRoble`) as a pure
 * function. No randomness inside — caller supplies altura for deterministic
 * output. Coordinates are local to the tree origin at (0, 0).
 *
 * @param {number} [altura] tronco height in blocks. Defaults to a random 4-5.
 * @returns {{ bloquesmadera: BlockCoord[], bloqueshojas: BlockCoord[], altura: number }}
 */
export function generarArbolRoble(altura = Math.floor(Math.random() * 2) + 4) {
  const yBase = 8 / PM.PIXELES_ESTANDAR;

  const bloquesmadera = [];
  for (let i = 0; i < altura; i++) {
    bloquesmadera.push({ x: 0, y: yBase + i, z: 0 });
  }

  // Copa ENTERAMENTE encima del tronco: las hojas arrancan en k=altura
  // (una posicion por encima del bloque mas alto del tronco), tres capas
  // de 3x3 = 27 hojas. Asi el personaje pasa por debajo del arbol
  // incluso cuando el terreno proximo sube algunos bloques. Si las
  // hojas estuvieran tambien rodeando el tronco (la version anterior),
  // cualquier subida de terreno meteria al personaje contra ellas.
  const bloqueshojas = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = altura; k < altura + 3; k++) {
        bloqueshojas.push({ x: i, y: yBase + k, z: j });
      }
    }
  }

  return { bloquesmadera, bloqueshojas, altura };
}

class ArbolRoble {
  constructor() {
    const { bloquesmadera, bloqueshojas } = generarArbolRoble();
    this.bloquesmadera = bloquesmadera;
    this.bloqueshojas = bloqueshojas;
  }
}

export { ArbolRoble };
