// @ts-check
import * as PM from './ParametrosMundo.js';

/**
 * @typedef {{x: number, y: number, z: number}} BlockCoord
 */

/**
 * Generate the block positions of an oak tree as a pure function.
 * No randomness inside — caller supplies height for deterministic output.
 * Coordinates are local to the tree origin at (0, 0).
 *
 * @param {number} [height] trunk height in blocks. Defaults to a random 4-5.
 * @returns {{ woodBlocks: BlockCoord[], leaves: BlockCoord[], height: number }}
 */
export function generateOakTree(height = Math.floor(Math.random() * 2) + 4) {
  const yBase = 8 / PM.PIXELES_ESTANDAR;

  const woodBlocks = [];
  for (let i = 0; i < height; i++) {
    woodBlocks.push({ x: 0, y: yBase + i, z: 0 });
  }

  const leaves = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = 2; k < height + 1; k++) {
        if (i !== 0 || j !== 0 || k > height - 1) {
          leaves.push({ x: i, y: yBase + k, z: j });
        }
      }
    }
  }

  return { woodBlocks, leaves, height };
}

class OakTree {
  constructor() {
    const { woodBlocks, leaves } = generateOakTree();
    this.woodBlocks = woodBlocks;
    this.leaves = leaves;
  }
}

export { OakTree };
export { OakTree as ArbolRoble };
