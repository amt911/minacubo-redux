// @ts-check
import * as THREE from 'three';
import * as estructuras from './estructuras.js';
import * as PM from './ParametrosMundo.js';
import { identifyChunk } from './chunkMath.js';
import { terrainHeight } from './noise.js';
import { blockCastsShadow } from './BlockRegistry.js';

function isNearOther(x, z, list) {
  for (const p of list) {
    if (Math.abs(x - p.x) <= 2 && Math.abs(z - p.z) <= 2) return true;
  }
  return false;
}

function isOnTree(x, z, list) {
  for (const p of list) {
    if (x === p.x && z === p.z) return true;
  }
  return false;
}

export class ChunkManager {
  /**
   * @param {{
   *   TAM_CHUNK: number,
   *   DISTANCIA_RENDER: number,
   *   noise: (x: number, y: number) => number,
   *   mesh: Record<string, THREE.InstancedMesh>,
   *   blockGeometries: Record<string, THREE.BufferGeometry>,
   *   blockMaterials: Record<string, THREE.Material | THREE.Material[]>,
   *   sizeIMesh: Record<string, number>,
   *   scene: THREE.Scene,
   * }} opts
   */
  constructor(opts) {
    this.TAM_CHUNK        = opts.TAM_CHUNK;
    this.DISTANCIA_RENDER = opts.DISTANCIA_RENDER;
    this._noise           = opts.noise;
    this.mesh             = opts.mesh;
    this._geo             = opts.blockGeometries;
    this._mat             = opts.blockMaterials;
    this.sizeIMesh        = opts.sizeIMesh;
    this._scene           = opts.scene;

    /** @type {Array<Array<Array<{x:number,y:number,z:number,material:string}>>>} */
    this.chunk = [];

    /** @type {Array<Array<{x:number,y:number,z:number,material:string}>>} */
    this.chunkCollision = [];

    /** @type {{min:{x:number,z:number}, max:{x:number,z:number}}} */
    this.chunkMinMax = {
      min: { x: 0, z: 0 },
      max: { x: this.DISTANCIA_RENDER - 1, z: this.DISTANCIA_RENDER - 1 },
    };
  }

  // ─── internal helpers ──────────────────────────────────────────────────────

  /** @param {THREE.InstancedMesh} mesh @param {string} type */
  _applyMeshShadows(mesh, type) {
    mesh.castShadow    = blockCastsShadow(type);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  }

  /**
   * Generate blocks for one chunk column at grid coords (chunkI, chunkJ).
   * Returns the block array and tree list.
   * @returns {{ blocks: Array<{x:number,y:number,z:number,material:string}>, treeList: Array<{x:number,y:number,z:number}> }}
   */
  _generateChunkBlocks(chunkI, chunkJ) {
    const TC = this.TAM_CHUNK;
    const S  = PM.PIXELES_ESTANDAR;

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
        const v = terrainHeight(this._noise, x, z);
        blocks.push({ x: x * 16 / S, y: v - 8 / S,         z: z * 16 / S, material: 'Grass' });
        for (let s = 0; s < 3; s++)
          blocks.push({ x: x * 16 / S, y: v - 8 / S - s - 1, z: z * 16 / S, material: 'Dirt' });
        for (let r = 3; r < 8; r++)
          blocks.push({ x: x * 16 / S, y: v - 8 / S - r - 1, z: z * 16 / S, material: 'Stone' });

        // Resolve tree Y at this column
        for (const arbol of treeList) {
          if (arbol.x + chunkI * TC === x && arbol.z + chunkJ * TC === z) {
            arbol.y = v + 0.5;
            arbol.x = arbol.x + chunkI * TC;
            arbol.z = arbol.z + chunkJ * TC;
          }
        }
      }
    }

    // Append tree blocks
    for (const treeOrigin of treeList) {
      const arbol = new estructuras.OakTree();
      for (const b of arbol.leaves)
        blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakLeaves' });
      for (const b of arbol.woodBlocks)
        blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakWood' });
    }

    return { blocks, treeList };
  }

  _storeChunk(blocks) {
    this.chunkCollision.push(blocks);
    const idx = identifyChunk(blocks[0].x, blocks[0].z, this.TAM_CHUNK);
    if (this.chunk[idx.x] === undefined) this.chunk[idx.x] = [];
    this.chunk[idx.x][idx.z] = blocks;
    return idx;
  }

  _rebuildAllMeshes() {
    const { min, max } = this.chunkMinMax;
    const l = Object.fromEntries(Object.keys(this.mesh).map(k => [k, 0]));
    const matrix = new THREE.Matrix4();

    for (let a = min.z; a <= max.z; a++) {
      for (let i = min.x; i <= max.x; i++) {
        if (!this.chunk[i]?.[a]) continue;
        for (const blk of this.chunk[i][a]) {
          matrix.setPosition(blk.x, blk.y, blk.z);
          this.mesh[blk.material].setMatrixAt(l[blk.material], matrix);
          l[blk.material]++;
        }
      }
    }

    for (const tipo in this.mesh) {
      if (l[tipo] !== undefined) this.mesh[tipo].count = l[tipo];
      this.mesh[tipo].instanceMatrix.needsUpdate = true;
      this._scene.add(this.mesh[tipo]);
    }
  }

  // ─── public API ───────────────────────────────────────────────────────────

  /**
   * Generate the initial world. Returns NPC spawn data.
   * @returns {{ zombieSpawn: {x:number,y:number,z:number}, pigWaypoints: Array<{x:number,y:number,z:number}> }}
   */
  init() {
    const TC = this.TAM_CHUNK;
    const DR = this.DISTANCIA_RENDER;
    const S  = PM.PIXELES_ESTANDAR;
    const matrix = new THREE.Matrix4();

    let k = 0, cTierra = 0, cPiedra = 0, cHojas = 0, cMadera = 0;
    let zombieSpawn = { x: 0, y: 0, z: 0 };
    const pigWaypoints = [];

    for (let i = 0; i < DR; i++) {
      for (let j = 0; j < DR; j++) {
        const nArboles    = Math.floor(Math.random() * TC / 5) + 1;
        const nPigPoints  = Math.floor(Math.random() * TC / 4) + 2;
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

        let zombieLX = 0, zombieLZ = 0;
        if (i === 0 && j === 0) {
          zombieLX = Math.floor(Math.random() * TC);
          zombieLZ = Math.floor(Math.random() * TC);
          for (let m = 0; m < nPigPoints; m++) {
            let px = Math.floor(Math.random() * TC);
            let pz = Math.floor(Math.random() * TC);
            while (isOnTree(px, pz, treeList)) {
              px = Math.floor(Math.random() * TC);
              pz = Math.floor(Math.random() * TC);
            }
            pigWaypoints.push({ x: px, y: 10, z: pz });
          }
        }

        const blocks = [];
        for (let x = i * TC; x < (i * TC) + TC; x++) {
          for (let z = j * TC; z < (j * TC) + TC; z++) {
            const v = terrainHeight(this._noise, x, z);

            if (i === 0 && j === 0) {
              if (zombieLX + i * TC === x && zombieLZ + j * TC === z)
                zombieSpawn = { x, y: v, z };
              for (const wp of pigWaypoints) {
                if (wp.x + i * TC === x && wp.z + j * TC === z) {
                  wp.y = v;
                  wp.x = wp.x + i * TC;
                  wp.z = wp.z + j * TC;
                }
              }
            }

            matrix.setPosition(x * 16 / S, v - 8 / S, z * 16 / S);
            this.mesh['Grass'].setMatrixAt(k++, matrix);
            blocks.push({ x: x * 16 / S, y: v - 8 / S, z: z * 16 / S, material: 'Grass' });

            for (const arbol of treeList) {
              if (arbol.x + i * TC === x && arbol.z + j * TC === z) {
                arbol.y = v + 0.5;
                arbol.x = arbol.x + i * TC;
                arbol.z = arbol.z + j * TC;
              }
            }

            for (let s = 0; s < 3; s++) {
              matrix.setPosition(x * 16 / S, v - 8 / S - s - 1, z * 16 / S);
              this.mesh['Dirt'].setMatrixAt(cTierra++, matrix);
              blocks.push({ x: x * 16 / S, y: v - 8 / S - s - 1, z: z * 16 / S, material: 'Dirt' });
            }
            for (let r = 3; r < 8; r++) {
              matrix.setPosition(x * 16 / S, v - 8 / S - r - 1, z * 16 / S);
              this.mesh['Stone'].setMatrixAt(cPiedra++, matrix);
              blocks.push({ x: x * 16 / S, y: v - 8 / S - r - 1, z: z * 16 / S, material: 'Stone' });
            }
          }
        }

        for (const treeOrigin of treeList) {
          const arbol = new estructuras.OakTree();
          for (const b of arbol.leaves) {
            matrix.setPosition(treeOrigin.x + b.x, treeOrigin.y + b.y - 0.5, treeOrigin.z + b.z);
            this.mesh['OakLeaves'].setMatrixAt(cHojas++, matrix);
            blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakLeaves' });
          }
          for (const b of arbol.woodBlocks) {
            matrix.setPosition(treeOrigin.x + b.x, treeOrigin.y + b.y - 0.5, treeOrigin.z + b.z);
            this.mesh['OakWood'].setMatrixAt(cMadera++, matrix);
            blocks.push({ x: treeOrigin.x + b.x, y: treeOrigin.y + b.y - 0.5, z: treeOrigin.z + b.z, material: 'OakWood' });
          }
        }

        this.chunkCollision.push(blocks);
        const chunkIndex = identifyChunk(blocks[0].x, blocks[0].z, this.TAM_CHUNK);
        if (this.chunk[chunkIndex.x] === undefined) this.chunk[chunkIndex.x] = [];
        this.chunk[chunkIndex.x][chunkIndex.z] = blocks;
      }
    }

    this.mesh['Grass'].count    = k;
    this.mesh['Dirt'].count    = cTierra;
    this.mesh['Stone'].count    = cPiedra;
    this.mesh['OakLeaves'].count = cHojas;
    this.mesh['OakWood'].count = cMadera;

    for (const tipo in this.mesh) {
      this._applyMeshShadows(this.mesh[tipo], tipo);
      this._scene.add(this.mesh[tipo]);
    }

    return { zombieSpawn, pigWaypoints };
  }

  /**
   * Check if player crossed chunk midpoint and scroll window if so.
   * Rebuilds all meshes when window moves.
   * @param {number} playerX
   * @param {number} playerZ
   * @returns {boolean} true if meshes were rebuilt
   */
  updateScroll(playerX, playerZ) {
    const aux = identifyChunk(playerX, playerZ, this.TAM_CHUNK);
    const { min, max } = this.chunkMinMax;
    let needRebuild = false;

    const midX = (min.x + max.x) / 2;
    const midZ = (min.z + max.z) / 2;

    if (aux.z > midZ)      { min.z++; max.z++; needRebuild = true; }
    else if (aux.z < midZ) { min.z--; max.z--; needRebuild = true; }

    if (aux.x > midX)      { min.x++; max.x++; needRebuild = true; }
    else if (aux.x < midX) { min.x--; max.x--; needRebuild = true; }

    if (!needRebuild) return false;

    // Generate any missing chunks in the new window
    for (let a = min.z; a <= max.z; a++) {
      for (let i = min.x; i <= max.x; i++) {
        if (this.chunk[i]?.[a]) continue;
        if (!this.chunk[i]) this.chunk[i] = [];
        const { blocks } = this._generateChunkBlocks(i, a);
        this.chunkCollision.push(blocks);
        const idx = identifyChunk(blocks[0].x, blocks[0].z, this.TAM_CHUNK);
        if (!this.chunk[idx.x]) this.chunk[idx.x] = [];
        this.chunk[idx.x][idx.z] = blocks;
      }
    }

    // Reuse existing InstancedMesh objects — just overwrite matrix data.
    // Avoids allocating new typed arrays every scroll step.
    this._rebuildAllMeshes();
    return true;
  }

  /**
   * Collect blocks for collision detection around a chunk position.
   * Push individual blocks into a single array — avoids per-chunk array
   * allocation from concat().
   * @param {{x:number,z:number}} chunkPos
   * @param {number} radius chunk radius
   */
  getCollisionsAround(chunkPos, radius) {
    const result = [];
    const r = Math.floor(radius / 2);
    const cx = Math.floor(chunkPos.x);
    const cz = Math.floor(chunkPos.z);
    for (let i = cx - r; i <= cx + r; i++) {
      const col = this.chunk[i];
      if (!col) continue;
      for (let j = cz - r; j <= cz + r; j++) {
        const blocks = col[j];
        if (!blocks) continue;
        for (let k = 0; k < blocks.length; k++) result.push(blocks[k]);
      }
    }
    return result;
  }

  /**
   * Collect blocks for player collision — only the 3×3 chunks around player.
   * Much cheaper than scanning the entire visible window each frame.
   * @param {number} playerX
   * @param {number} playerZ
   */
  getPlayerCollisions(playerX, playerZ) {
    return this.getCollisionsAround(
      identifyChunk(playerX, playerZ, this.TAM_CHUNK),
      3
    );
  }
}
