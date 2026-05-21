// @ts-check
import * as PM from './ParametrosMundo.js';
import * as estructuras from './estructuras.js';

function isNearOther(x, z, list) {
  for (const p of list) {
    if (Math.abs(x - p.x) <= 2 && Math.abs(z - p.z) <= 2) return true;
  }
  return false;
}

/**
 * Pure chunk-data generation: takes a height function and chunk coords,
 * returns the block list (plus list of placed trees). No Three.js, no
 * noise-impl dependency — both the main thread and the worker thread can
 * call this.
 *
 * @param {(x: number, z: number) => number} getHeight  world (x,z) → terrain Y
 * @param {number} chunkI chunk X index
 * @param {number} chunkJ chunk Z index
 * @param {number} TC chunk size
 * @returns {{ blocks: Array<{x:number,y:number,z:number,material:string}>, treeList: Array<{x:number,y:number,z:number}> }}
 */
export function generateChunkBlocks(getHeight, chunkI, chunkJ, TC) {
  const S = PM.PIXELES_ESTANDAR;

  const nArboles = Math.floor(Math.random() * TC / 5);
  const treeList = [];

  for (let m = 0; m < nArboles; m++) {
    let px = Math.floor(Math.random() * TC);
    let pz = Math.floor(Math.random() * TC);
    while (isNearOther(px, pz, treeList)) {
      px = Math.floor(Math.random() * TC);
      pz = Math.floor(Math.random() * TC);
    }
    treeList.push({ x: px, y: 10, z: pz });
  }

  const blocks = [];
  for (let x = chunkI * TC; x < chunkI * TC + TC; x++) {
    for (let z = chunkJ * TC; z < chunkJ * TC + TC; z++) {
      const v = getHeight(x, z);
      blocks.push({ x: x * 16 / S, y: v - 8 / S,         z: z * 16 / S, material: 'Grass' });
      for (let s = 0; s < 3; s++)
        blocks.push({ x: x * 16 / S, y: v - 8 / S - s - 1, z: z * 16 / S, material: 'Dirt' });
      for (let r = 3; r < 8; r++)
        blocks.push({ x: x * 16 / S, y: v - 8 / S - r - 1, z: z * 16 / S, material: 'Stone' });

      for (const arbol of treeList) {
        if (arbol.x + chunkI * TC === x && arbol.z + chunkJ * TC === z) {
          arbol.y = v + 0.5;
          arbol.x = arbol.x + chunkI * TC;
          arbol.z = arbol.z + chunkJ * TC;
        }
      }
    }
  }

  for (const treeOrigin of treeList) {
    const arbol = new estructuras.OakTree();
    for (const b of arbol.leaves)
      blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakLeaves' });
    for (const b of arbol.woodBlocks)
      blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakWood' });
  }

  return { blocks, treeList };
}
