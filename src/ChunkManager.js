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
   *   blockGeometries: Record<string, THREE.BufferGeometry>,
   *   blockMaterials: Record<string, THREE.Material | THREE.Material[]>,
   *   scene: THREE.Scene,
   * }} opts
   */
  constructor(opts) {
    this.TAM_CHUNK        = opts.TAM_CHUNK;
    this.DISTANCIA_RENDER = opts.DISTANCIA_RENDER;
    this._noise           = opts.noise;
    this._geo             = opts.blockGeometries;
    this._mat             = opts.blockMaterials;
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

    // Per-chunk per-material InstancedMesh map. Indexed
    // `chunkMeshes[chunkX][chunkZ][material]`.
    /** @type {Object<number, Object<number, Record<string, THREE.InstancedMesh>>>} */
    this.chunkMeshes = {};

    // Flat list of every currently-live chunk mesh — used by raycasters.
    /** @type {THREE.InstancedMesh[]} */
    this.allMeshes = [];
  }

  // ─── internal mesh helpers ────────────────────────────────────────────────

  /**
   * Build (or rebuild) every material mesh for one chunk from its block data.
   * No-op when the chunk has no block data.
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  _buildChunkMesh(chunkX, chunkZ) {
    const blocks = this.chunk[chunkX]?.[chunkZ];
    if (!blocks || blocks.length === 0) return;

    /** @type {Record<string, Array<{x:number,y:number,z:number,material:string}>>} */
    const groups = {};
    for (const b of blocks) {
      if (!groups[b.material]) groups[b.material] = [];
      groups[b.material].push(b);
    }

    // Dispose anything we already had for this chunk.
    this._disposeChunkMesh(chunkX, chunkZ);

    if (!this.chunkMeshes[chunkX]) this.chunkMeshes[chunkX] = {};
    this.chunkMeshes[chunkX][chunkZ] = {};

    for (const type in groups) {
      this._createChunkMaterialMesh(chunkX, chunkZ, type, groups[type]);
    }
  }

  /**
   * Create one InstancedMesh holding all instances of `type` inside one chunk.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @param {string} type
   * @param {Array<{x:number,y:number,z:number}>} list
   */
  _createChunkMaterialMesh(chunkX, chunkZ, type, list) {
    const mesh = new THREE.InstancedMesh(this._geo[type], this._mat[type], list.length);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < list.length; i++) {
      matrix.setPosition(list[i].x, list[i].y, list[i].z);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;

    // Compute bounding sphere from actual instance matrices — Three.js
    // InstancedMesh has its own method that iterates the matrices.
    // Without this, frustum culling uses the unit-cube geometry sphere at
    // world origin → all chunks share one wrong sphere and disappear when
    // the camera turns away from origin.
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    mesh.castShadow = blockCastsShadow(type);
    mesh.receiveShadow = true;
    mesh.userData.chunkX = chunkX;
    mesh.userData.chunkZ = chunkZ;
    mesh.userData.type = type;

    if (!this.chunkMeshes[chunkX]) this.chunkMeshes[chunkX] = {};
    if (!this.chunkMeshes[chunkX][chunkZ]) this.chunkMeshes[chunkX][chunkZ] = {};
    this.chunkMeshes[chunkX][chunkZ][type] = mesh;
    this._scene.add(mesh);
    this.allMeshes.push(mesh);
  }

  /**
   * Dispose every material mesh for one chunk (removes from scene + allMeshes).
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  _disposeChunkMesh(chunkX, chunkZ) {
    const chunkObj = this.chunkMeshes[chunkX]?.[chunkZ];
    if (!chunkObj) return;
    for (const type in chunkObj) {
      const mesh = chunkObj[type];
      this._scene.remove(mesh);
      mesh.dispose();
      const idx = this.allMeshes.indexOf(mesh);
      if (idx >= 0) this.allMeshes.splice(idx, 1);
    }
    delete this.chunkMeshes[chunkX][chunkZ];
  }

  /**
   * Rebuild one chunk's mesh for a single material (after a block add/remove).
   * If no blocks of that material remain, the existing mesh is disposed.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @param {string} type
   */
  rebuildChunkMaterial(chunkX, chunkZ, type) {
    const blocks = this.chunk[chunkX]?.[chunkZ];
    if (!blocks) return;
    const list = blocks.filter((b) => b.material === type);

    const existing = this.chunkMeshes[chunkX]?.[chunkZ]?.[type];
    if (existing) {
      this._scene.remove(existing);
      existing.dispose();
      const idx = this.allMeshes.indexOf(existing);
      if (idx >= 0) this.allMeshes.splice(idx, 1);
      delete this.chunkMeshes[chunkX][chunkZ][type];
    }

    if (list.length === 0) return;
    this._createChunkMaterialMesh(chunkX, chunkZ, type, list);
  }

  // ─── chunk data generation ────────────────────────────────────────────────

  /**
   * Generate blocks for one chunk column at grid coords (chunkI, chunkJ).
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

  // ─── public API ───────────────────────────────────────────────────────────

  /**
   * Generate the initial world. Returns NPC spawn data.
   * @returns {{ zombieSpawn: {x:number,y:number,z:number}, pigWaypoints: Array<{x:number,y:number,z:number}> }}
   */
  init() {
    const TC = this.TAM_CHUNK;
    const DR = this.DISTANCIA_RENDER;

    let zombieSpawn = { x: 0, y: 0, z: 0 };
    const pigWaypoints = [];

    // Generate chunk data (no rendering yet).
    for (let i = 0; i < DR; i++) {
      for (let j = 0; j < DR; j++) {
        const { blocks, treeList } = this._generateChunkBlocks(i, j);
        this.chunkCollision.push(blocks);
        if (!this.chunk[i]) this.chunk[i] = [];
        this.chunk[i][j] = blocks;

        // Place zombie + pig spawn data inside chunk (0,0).
        if (i === 0 && j === 0) {
          const zombieLX = Math.floor(Math.random() * TC);
          const zombieLZ = Math.floor(Math.random() * TC);
          const zombieY  = terrainHeight(this._noise, zombieLX, zombieLZ);
          zombieSpawn = { x: zombieLX, y: zombieY, z: zombieLZ };

          const nPigPoints = Math.floor(Math.random() * TC / 4) + 2;
          for (let m = 0; m < nPigPoints; m++) {
            let px = Math.floor(Math.random() * TC);
            let pz = Math.floor(Math.random() * TC);
            while (isOnTree(px, pz, treeList)) {
              px = Math.floor(Math.random() * TC);
              pz = Math.floor(Math.random() * TC);
            }
            const py = terrainHeight(this._noise, px, pz);
            pigWaypoints.push({ x: px, y: py, z: pz });
          }
        }
      }
    }

    // Build per-chunk meshes for the visible window.
    for (let i = 0; i < DR; i++) {
      for (let j = 0; j < DR; j++) {
        this._buildChunkMesh(i, j);
      }
    }

    return { zombieSpawn, pigWaypoints };
  }

  /**
   * Slide the visible window if the player has crossed its midpoint.
   * Disposes chunk meshes that left the window and builds meshes for the
   * chunks that entered.
   * @param {number} playerX
   * @param {number} playerZ
   * @returns {boolean} true if window moved
   */
  updateScroll(playerX, playerZ) {
    const aux = identifyChunk(playerX, playerZ, this.TAM_CHUNK);
    const { min, max } = this.chunkMinMax;
    const oldMinX = min.x, oldMaxX = max.x, oldMinZ = min.z, oldMaxZ = max.z;
    let moved = false;

    const midX = (min.x + max.x) / 2;
    const midZ = (min.z + max.z) / 2;

    if (aux.z > midZ)      { min.z++; max.z++; moved = true; }
    else if (aux.z < midZ) { min.z--; max.z--; moved = true; }

    if (aux.x > midX)      { min.x++; max.x++; moved = true; }
    else if (aux.x < midX) { min.x--; max.x--; moved = true; }

    if (!moved) return false;

    // Generate chunk data for any new slots in the window.
    for (let a = min.z; a <= max.z; a++) {
      for (let i = min.x; i <= max.x; i++) {
        if (this.chunk[i]?.[a]) continue;
        if (!this.chunk[i]) this.chunk[i] = [];
        const { blocks } = this._generateChunkBlocks(i, a);
        this.chunkCollision.push(blocks);
        this.chunk[i][a] = blocks;
      }
    }

    // Dispose meshes for chunks that left the window.
    for (let a = oldMinZ; a <= oldMaxZ; a++) {
      for (let i = oldMinX; i <= oldMaxX; i++) {
        if (i < min.x || i > max.x || a < min.z || a > max.z) {
          this._disposeChunkMesh(i, a);
        }
      }
    }

    // Build meshes for chunks that entered the window.
    for (let a = min.z; a <= max.z; a++) {
      for (let i = min.x; i <= max.x; i++) {
        if (this.chunkMeshes[i]?.[a]) continue;
        this._buildChunkMesh(i, a);
      }
    }

    return true;
  }

  /**
   * Collect blocks around a chunk position for collision detection.
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
   * Player collisions — only the 3×3 chunks around player.
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
