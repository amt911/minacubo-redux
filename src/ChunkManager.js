// @ts-check
import * as THREE from 'three';
import { identifyChunk } from './chunkMath.js';
import { createTerrainNoise, terrainHeight } from './noise.js';
import { generateChunkBlocks } from './chunkGen.js';
import { blockCastsShadow } from './BlockRegistry.js';

function isOnTree(x, z, list) {
  for (const p of list) {
    if (x === p.x && z === p.z) return true;
  }
  return false;
}

export class ChunkManager {
  // Generate (and keep meshed) one chunk beyond the visible window in every
  // direction. Avoids the "wait for worker + mesh build" lag when the player
  // crosses a chunk boundary — the next chunk is already loaded.
  static PRELOAD_RING = 1;

  /**
   * @param {{
   *   TAM_CHUNK: number,
   *   DISTANCIA_RENDER: number,
   *   seed: number,
   *   blockGeometries: Record<string, THREE.BufferGeometry>,
   *   blockMaterials: Record<string, THREE.Material | THREE.Material[]>,
   *   scene: THREE.Scene,
   * }} opts
   */
  constructor(opts) {
    this.TAM_CHUNK        = opts.TAM_CHUNK;
    this.DISTANCIA_RENDER = opts.DISTANCIA_RENDER;
    this.seed             = opts.seed;
    this._noise           = createTerrainNoise(this.seed);
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

    /** @type {Object<number, Object<number, Record<string, THREE.InstancedMesh>>>} */
    this.chunkMeshes = {};
    /** @type {THREE.InstancedMesh[]} */
    this.allMeshes = [];

    // Mesh build queue — drained by tick() within a per-frame time budget.
    /** @type {Array<{chunkX:number, chunkZ:number}>} */
    this._meshQueue = [];

    // Override shared geometry boundingSphere for per-chunk frustum culling.
    // See _createChunkMaterialMesh — mesh.position is set per chunk, this
    // sphere then lands at the chunk centroid via matrixWorld.
    const sphereRadius = 20;
    for (const tipo in this._geo) {
      this._geo[tipo].boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, 0, 0),
        sphereRadius
      );
    }

    // Worker pool for off-main-thread chunk data generation.
    /** @type {Worker[]} */
    this._workers = [];
    this._workerIdx = 0;
    /** @type {Map<number, (blocks: Array<{x:number,y:number,z:number,material:string}>) => void>} */
    this._pendingChunks = new Map();
    this._nextTaskId = 0;

    const WORKER_COUNT = 4;
    for (let i = 0; i < WORKER_COUNT; i++) {
      const w = new Worker(new URL('./chunkWorker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this._onWorkerMessage(e);
      this._workers.push(w);
    }
  }

  // ─── worker plumbing ──────────────────────────────────────────────────────

  /**
   * Request chunk block data from a worker (round-robin dispatch).
   * @param {number} chunkX
   * @param {number} chunkZ
   * @returns {Promise<Array<{x:number,y:number,z:number,material:string}>>}
   */
  _genChunkAsync(chunkX, chunkZ) {
    return new Promise((resolve) => {
      const id = this._nextTaskId++;
      this._pendingChunks.set(id, resolve);
      const worker = this._workers[this._workerIdx];
      this._workerIdx = (this._workerIdx + 1) % this._workers.length;
      worker.postMessage({ type: 'gen', id, chunkX, chunkZ, TC: this.TAM_CHUNK, seed: this.seed });
    });
  }

  _onWorkerMessage(e) {
    const data = e.data;
    if (data.type !== 'result') return;
    const resolve = this._pendingChunks.get(data.id);
    if (!resolve) return;
    this._pendingChunks.delete(data.id);
    resolve(data.blocks);
  }

  _storeChunkData(chunkX, chunkZ, blocks) {
    this.chunkCollision.push(blocks);
    if (!this.chunk[chunkX]) this.chunk[chunkX] = [];
    this.chunk[chunkX][chunkZ] = blocks;
  }

  // ─── mesh helpers ─────────────────────────────────────────────────────────

  /**
   * Build (or rebuild) every material mesh for one chunk from its block data.
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  _buildChunkMesh(chunkX, chunkZ) {
    const blocks = this.chunk[chunkX]?.[chunkZ];
    if (!blocks || blocks.length === 0) return;

    // Face culling: drop blocks with all 6 neighbours occupied.
    const occupancy = new Set();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const neighbor = this.chunk[chunkX + dx]?.[chunkZ + dz];
        if (!neighbor) continue;
        for (let i = 0; i < neighbor.length; i++) {
          const b = neighbor[i];
          occupancy.add(b.x + ',' + b.y + ',' + b.z);
        }
      }
    }

    /** @type {Record<string, Array<{x:number,y:number,z:number,material:string}>>} */
    const groups = {};
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (
        !occupancy.has((b.x + 1) + ',' + b.y + ',' + b.z) ||
        !occupancy.has((b.x - 1) + ',' + b.y + ',' + b.z) ||
        !occupancy.has(b.x + ',' + (b.y + 1) + ',' + b.z) ||
        !occupancy.has(b.x + ',' + (b.y - 1) + ',' + b.z) ||
        !occupancy.has(b.x + ',' + b.y + ',' + (b.z + 1)) ||
        !occupancy.has(b.x + ',' + b.y + ',' + (b.z - 1))
      ) {
        if (!groups[b.material]) groups[b.material] = [];
        groups[b.material].push(b);
      }
    }

    this._disposeChunkMesh(chunkX, chunkZ);

    if (!this.chunkMeshes[chunkX]) this.chunkMeshes[chunkX] = {};
    this.chunkMeshes[chunkX][chunkZ] = {};

    for (const type in groups) {
      this._createChunkMaterialMesh(chunkX, chunkZ, type, groups[type]);
    }
  }

  _createChunkMaterialMesh(chunkX, chunkZ, type, list) {
    const mesh = new THREE.InstancedMesh(this._geo[type], this._mat[type], list.length);

    let sumX = 0, sumY = 0, sumZ = 0;
    for (let i = 0; i < list.length; i++) {
      sumX += list[i].x;
      sumY += list[i].y;
      sumZ += list[i].z;
    }
    const cx = sumX / list.length;
    const cy = sumY / list.length;
    const cz = sumZ / list.length;
    mesh.position.set(cx, cy, cz);

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < list.length; i++) {
      matrix.setPosition(list[i].x - cx, list[i].y - cy, list[i].z - cz);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;

    mesh.frustumCulled = true;
    mesh.castShadow = blockCastsShadow(type);
    mesh.receiveShadow = true;
    mesh.userData.chunkX = chunkX;
    mesh.userData.chunkZ = chunkZ;
    mesh.userData.type = type;

    // Force matrixWorld now so raycasts (block break / placement / spring
    // arm) work before the next frame's auto-update.
    mesh.updateMatrixWorld(true);

    if (!this.chunkMeshes[chunkX]) this.chunkMeshes[chunkX] = {};
    if (!this.chunkMeshes[chunkX][chunkZ]) this.chunkMeshes[chunkX][chunkZ] = {};
    this.chunkMeshes[chunkX][chunkZ][type] = mesh;
    this._scene.add(mesh);
    this.allMeshes.push(mesh);
  }

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
   * Rebuild this chunk + 4 cardinal-neighbour chunks after a block edit.
   * `type` kept for API compatibility, unused.
   * @param {number} chunkX
   * @param {number} chunkZ
   * @param {string} _type
   */
  rebuildChunkMaterial(chunkX, chunkZ, _type) {
    this._buildChunkMesh(chunkX, chunkZ);
    this._buildChunkMesh(chunkX - 1, chunkZ);
    this._buildChunkMesh(chunkX + 1, chunkZ);
    this._buildChunkMesh(chunkX, chunkZ - 1);
    this._buildChunkMesh(chunkX, chunkZ + 1);
  }

  // ─── public API ───────────────────────────────────────────────────────────

  /**
   * Synchronously generate chunk (0,0) for NPC spawn data, then queue every
   * other visible chunk to the worker pool. Meshes for non-spawn chunks are
   * built progressively by tick() as their data arrives.
   * @returns {{ zombieSpawn: {x:number,y:number,z:number}, pigWaypoints: Array<{x:number,y:number,z:number}> }}
   */
  init() {
    const TC = this.TAM_CHUNK;
    const DR = this.DISTANCIA_RENDER;

    // The player spawns at the centre of the window — sync-generate THAT
    // chunk so something is visible before the worker pool catches up.
    // Using (0,0) instead would leave the player staring at empty space
    // because the spawn chunk would be ~DR/2 chunks behind them.
    const spawnCX = Math.floor(DR / 2);
    const spawnCZ = Math.floor(DR / 2);

    const getHeight = (x, z) => terrainHeight(this._noise, x, z);
    const { blocks: spawnBlocks, treeList } = generateChunkBlocks(getHeight, spawnCX, spawnCZ, TC);
    this._storeChunkData(spawnCX, spawnCZ, spawnBlocks);

    // NPC spawn picks random local coords inside the spawn chunk.
    const zombieLX = Math.floor(Math.random() * TC);
    const zombieLZ = Math.floor(Math.random() * TC);
    const zombieY  = terrainHeight(this._noise, spawnCX * TC + zombieLX, spawnCZ * TC + zombieLZ);
    const zombieSpawn = { x: zombieLX, y: zombieY, z: zombieLZ };

    const pigWaypoints = [];
    const nPigPoints = Math.floor(Math.random() * TC / 4) + 2;
    for (let m = 0; m < nPigPoints; m++) {
      let px = Math.floor(Math.random() * TC);
      let pz = Math.floor(Math.random() * TC);
      while (isOnTree(px, pz, treeList)) {
        px = Math.floor(Math.random() * TC);
        pz = Math.floor(Math.random() * TC);
      }
      const py = terrainHeight(this._noise, spawnCX * TC + px, spawnCZ * TC + pz);
      pigWaypoints.push({ x: px, y: py, z: pz });
    }

    // Queue worker gen for every other chunk in the initial window + a
    // PRELOAD_RING outside it. Dispatch nearest-spawn-first so the worker
    // pool (FIFO) processes chunks the player will actually see first.
    const R = ChunkManager.PRELOAD_RING;
    const queue = [];
    for (let i = -R; i < DR + R; i++) {
      for (let j = -R; j < DR + R; j++) {
        if (i === spawnCX && j === spawnCZ) continue;
        queue.push({ i, j, d: Math.abs(i - spawnCX) + Math.abs(j - spawnCZ) });
      }
    }
    queue.sort((a, b) => a.d - b.d);
    for (const { i, j } of queue) {
      this._genChunkAsync(i, j).then((blocks) => {
        this._storeChunkData(i, j, blocks);
        this._meshQueue.push({ chunkX: i, chunkZ: j });
      });
    }

    // Show the spawn chunk immediately so the player isn't staring at void.
    this._buildChunkMesh(spawnCX, spawnCZ);

    return { zombieSpawn, pigWaypoints };
  }

  /**
   * Drain a few mesh builds from the queue. Call once per frame.
   */
  tick() {
    if (this._meshQueue.length === 0) return;

    const R = ChunkManager.PRELOAD_RING;
    const { min, max } = this.chunkMinMax;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;

    // Sort by distance from window centre so chunks near the player build
    // first. Cheap relative to the actual mesh builds even for large queues.
    this._meshQueue.sort((a, b) =>
      (Math.abs(a.chunkX - cx) + Math.abs(a.chunkZ - cz)) -
      (Math.abs(b.chunkX - cx) + Math.abs(b.chunkZ - cz))
    );

    // Time-budget the mesh builds so we don't blow a frame even with a deep
    // backlog. ~6ms leaves headroom for the rest of the frame at 60 FPS.
    const start = performance.now();
    while (this._meshQueue.length > 0 && performance.now() - start < 6) {
      const { chunkX, chunkZ } = this._meshQueue.shift();
      if (chunkX < min.x - R || chunkX > max.x + R || chunkZ < min.z - R || chunkZ > max.z + R) continue;
      this._buildChunkMesh(chunkX, chunkZ);
    }
  }

  /**
   * Slide the window if the player crossed its midpoint. Disposes chunks
   * that left, async-generates new chunks (mesh build queued for tick()).
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

    // Dispose chunks that fell outside the (new window + preload ring).
    const R = ChunkManager.PRELOAD_RING;
    for (let a = oldMinZ - R; a <= oldMaxZ + R; a++) {
      for (let i = oldMinX - R; i <= oldMaxX + R; i++) {
        if (i < min.x - R || i > max.x + R || a < min.z - R || a > max.z + R) {
          this._disposeChunkMesh(i, a);
        }
      }
    }

    // Ensure every chunk inside (new window + preload ring) has data + mesh.
    for (let a = min.z - R; a <= max.z + R; a++) {
      for (let i = min.x - R; i <= max.x + R; i++) {
        if (this.chunkMeshes[i]?.[a]) continue; // already rendered
        if (this.chunk[i]?.[a]) {
          this._meshQueue.push({ chunkX: i, chunkZ: a });
        } else {
          this._genChunkAsync(i, a).then((blocks) => {
            this._storeChunkData(i, a, blocks);
            this._meshQueue.push({ chunkX: i, chunkZ: a });
          });
        }
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
