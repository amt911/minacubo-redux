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

    // Number of chunks whose block data has been generated. Monotonic — chunk
    // *meshes* come and go but the block lists stay (collision queries need
    // them off-screen). Was previously a parallel `chunkCollision` array of
    // block lists used only for its `.length` in the perf HUD; the array
    // grew unbounded and held references to disposed-chunk block data.
    this.chunkCount = 0;

    // Per-chunk max Y of any block — used by the underground-cull pass to
    // toggle bulk meshes (Stone/Dirt/Rock) invisible when the player is far
    // above this column. Keyed [chunkX][chunkZ]. Populated on _storeChunkData.
    /** @type {Object<number, Object<number, number>>} */
    this.chunkMaxY = {};

    // LOD bookkeeping. Chunks within `lodNearRadius` chunks of the player
    // render at full detail (every exposed block). Chunks beyond render at
    // "top of column only" — saves the cliff-side blocks that the full path
    // would emit, at the cost of losing distant terrain depth.
    //
    // _playerChunk is updated by setPlayerChunk() (called from updateScroll
    // and externally from MyScene.update); chunkLOD[x][z] stores the LOD
    // that the current mesh was built at, so updateScroll can detect a
    // transition and queue a rebuild.
    this.lodNearRadius = 4;
    this._playerChunk = { x: 0, z: 0 };
    /** @type {Object<number, Object<number, 'NEAR' | 'FAR'>>} */
    this.chunkLOD = {};

    /** @type {{min:{x:number,z:number}, max:{x:number,z:number}}} */
    this.chunkMinMax = {
      min: { x: 0, z: 0 },
      max: { x: this.DISTANCIA_RENDER - 1, z: this.DISTANCIA_RENDER - 1 },
    };

    /** @type {Object<number, Object<number, Record<string, THREE.InstancedMesh>>>} */
    this.chunkMeshes = {};

    // Mesh build queue — drained by tick() within a per-frame time budget.
    /** @type {Array<{chunkX:number, chunkZ:number}>} */
    this._meshQueue = [];

    // Dispose queue — scroll events can flag dozens of chunks for disposal
    // at once and each mesh.dispose() is sync WebGL work, so batching them
    // all in one frame produced a visible hitch on every chunk crossing.
    // tick() drains this with its own time budget after the build queue.
    /** @type {Array<[number, number]>} */
    this._disposeQueue = [];

    // Exponential moving average of single-chunk build time (ms). Exposed
    // for the in-game perf HUD.
    this._buildTimeAvgMs = 0;
    this._buildCount = 0;

    // Per-chunk bounding sphere is now computed in _createChunkMaterialMesh
    // via a per-mesh geometry clone, so we don't touch the shared geometry
    // here. The clone is cheap (BoxGeometry: 24 verts, 36 indices ≈ 600 B
    // per mesh) and lets the frustum cull each chunk based on the real
    // extent of its emitted blocks instead of a worst-case shared radius.

    // Worker pool for off-main-thread chunk data generation.
    /** @type {Worker[]} */
    this._workers = [];
    this._workerIdx = 0;
    /** @type {Map<number, (blocks: Array<{x:number,y:number,z:number,material:string}>) => void>} */
    this._pendingChunks = new Map();
    this._nextTaskId = 0;

    // Dedupe in-flight gens by chunk coords. Without this, fast scrolling
    // dispatches the same chunk multiple times before the first result
    // returns — workers get clogged with duplicate work and the visible
    // chunks lag behind.
    /** @type {Map<string, Promise<Array<{x:number,y:number,z:number,material:string}>>>} */
    this._pendingGens = new Map();

    // Worker pool sized to leave the main thread + render thread room. On
    // a 4-core machine we get 2 workers; on 8-core, 6; capped at 8 so a
    // 32-core box doesn't spawn an absurd number of dedicated workers (each
    // carries its own simplex-noise + module load, ~5 MB JS heap).
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const WORKER_COUNT = Math.max(2, Math.min(8, hc - 2));
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
    const key = chunkX + ',' + chunkZ;
    const existing = this._pendingGens.get(key);
    if (existing) return existing;

    const p = new Promise((resolve) => {
      const id = this._nextTaskId++;
      this._pendingChunks.set(id, resolve);
      const worker = this._workers[this._workerIdx];
      this._workerIdx = (this._workerIdx + 1) % this._workers.length;
      worker.postMessage({ type: 'gen', id, chunkX, chunkZ, TC: this.TAM_CHUNK, seed: this.seed });
    }).then((blocks) => {
      this._pendingGens.delete(key);
      return blocks;
    });

    this._pendingGens.set(key, p);
    return p;
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
    if (!this.chunk[chunkX]) this.chunk[chunkX] = [];
    if (!this.chunk[chunkX][chunkZ]) this.chunkCount++;
    this.chunk[chunkX][chunkZ] = blocks;

    // Track max Y for the underground-cull pass.
    let maxY = -Infinity;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].y > maxY) maxY = blocks[i].y;
    }
    if (!this.chunkMaxY[chunkX]) this.chunkMaxY[chunkX] = {};
    this.chunkMaxY[chunkX][chunkZ] = maxY;

    // Collision cache covers the 3×3 chunks around the last queried player
    // position. A newly arrived chunk inside that window changes the answer,
    // so flush. Chunks far from the player don't invalidate.
    if (this._collCacheResult) {
      const pc = identifyChunk(this._collCacheKeyX, this._collCacheKeyZ, this.TAM_CHUNK);
      if (Math.abs(chunkX - pc.x) <= 1 && Math.abs(chunkZ - pc.z) <= 1) {
        this._invalidateCollisionCache();
      }
    }

    // Face culling at chunk boundaries depends on neighbour block data
    // being present at build time. If a cardinal neighbour is already
    // meshed when our data arrives, its boundary faces toward us were
    // emitted as exposed (we weren't there yet) — re-queue it so its
    // boundary face culling refreshes against our blocks. Skip diagonal
    // neighbours; they only share one corner block per face direction.
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let i = 0; i < dirs.length; i++) {
      const nx = chunkX + dirs[i][0];
      const nz = chunkZ + dirs[i][1];
      if (this.chunkMeshes[nx]?.[nz]) {
        this._meshQueue.push({ chunkX: nx, chunkZ: nz });
      }
    }
  }

  // ─── mesh helpers ─────────────────────────────────────────────────────────

  /**
   * Build (or rebuild) every material mesh for one chunk from its block data.
   *
   * Per-block face culling: a block is emitted as one InstancedMesh instance
   * (full BoxGeometry, 12 tris) iff at least one of its 6 neighbours is
   * absent. We tried per-face emission (one instance per exposed face) and
   * it regressed FPS: instance count grew 1.5-2× per visible block, and the
   * per-instance setup cost outweighed the triangle savings. Per-face only
   * pays off paired with greedy meshing + a texture atlas (TODO Fase 5).
   *
   * @param {number} chunkX
   * @param {number} chunkZ
   */
  _buildChunkMesh(chunkX, chunkZ) {
    const t0 = performance.now();
    const blocks = this.chunk[chunkX]?.[chunkZ];
    if (!blocks || blocks.length === 0) return;

    // LOD: chunks far from the player render only the topmost block of each
    // (x, z) column. Cliff-side / underground exposure is sacrificed for
    // distant terrain — the visual difference is minor (no z-fighting, just
    // missing cliff faces) and the instance count drops 30-40 % on a
    // typical hilly chunk. Track which LOD we built at so updateScroll +
    // setPlayerChunk can detect bracket transitions and queue a rebuild.
    const lod = this._chunkLOD(chunkX, chunkZ);
    if (!this.chunkLOD[chunkX]) this.chunkLOD[chunkX] = {};
    this.chunkLOD[chunkX][chunkZ] = lod;

    let blocksToMesh = blocks;
    if (lod === 'FAR') {
      // Per-column top Y + tree-material passthrough. Earlier we kept only
      // the topmost block per column, but that destroyed two things:
      //   1. Trees became floating leaf canopies because their wood trunks
      //      weren't the column top. Tree materials (OakWood, OakLeaves)
      //      are now passed through at full detail.
      //   2. Cliffs displayed as 1-block-tall edges because only the top
      //      block of each column was emitted, even when the neighbour
      //      column was several blocks lower. Now we keep the top block
      //      plus the 3 blocks immediately below it; the face-culling pass
      //      below drops the ones that are still fully neighboured (flat
      //      terrain stays at ~1 block per column), but cliffs render with
      //      their full visible height.
      // Compute top Y per (x, z) column from GROUND blocks only. Skipping
      // tree blocks here was the missing bit — when a tree sat in a column,
      // its leaf canopy at y ≈ grass+5 became the column "top", and the
      // 3-block fill window then started at canopy-3 instead of grass-3,
      // dropping the grass/dirt under the trunk and leaving a hole in the
      // terrain directly beneath every tree.
      /** @type {Map<number, number>} */
      const topYByCol = new Map();
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.material === 'OakWood' || b.material === 'OakLeaves') continue;
        const colKey = (b.x + 32768) * 65536 + (b.z + 32768);
        const prev = topYByCol.get(colKey);
        if (prev === undefined || b.y > prev) topYByCol.set(colKey, b.y);
      }
      const farBlocks = [];
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.material === 'OakWood' || b.material === 'OakLeaves') {
          farBlocks.push(b);
          continue;
        }
        const colKey = (b.x + 32768) * 65536 + (b.z + 32768);
        const top = topYByCol.get(colKey);
        if (top !== undefined && b.y >= top - 3) farBlocks.push(b);
      }
      blocksToMesh = farBlocks;
    }

    // Bit-packed (x, y, z) → Number occupancy key. Block coords have integer
    // x/z and half-integer y (n + 0.5 from chunkGen). Encoding:
    //   bits  0..7  : (y * 2 + Y_OFF)  → y ∈ [-8.5, 119.5]  (8 bits)
    //   bits  8..23 : (z + Z_OFF)      → z ∈ [-32768, 32767] (16 bits)
    //   bits 24..39 : (x + X_OFF)      → x ∈ [-32768, 32767] (16 bits)
    // Total 40 bits — fits in JS's safe integer range. Replaces a per-block
    // string concat (`x + ',' + y + ',' + z`) that allocated thousands of
    // throwaway strings during every chunk rebuild and the per-block
    // neighbour scan below; bit packing has no allocations, and Set<Number>
    // hashes faster than Set<String> in V8.
    const X_OFF = 32768, Z_OFF = 32768, Y_OFF = 17;
    const occupancy = new Set();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const neighbor = this.chunk[chunkX + dx]?.[chunkZ + dz];
        if (!neighbor) continue;
        for (let i = 0; i < neighbor.length; i++) {
          const b = neighbor[i];
          occupancy.add(
            ((b.x + X_OFF) * 65536 + (b.z + Z_OFF)) * 256 + ((b.y * 2) | 0) + Y_OFF,
          );
        }
      }
    }

    // Note: face culling iterates `blocksToMesh` (filtered to top-of-column
    // when LOD=FAR) but occupancy was built from the FULL `blocks` of this
    // chunk + neighbours. That's intentional — the top block's -Y face is
    // correctly hidden by the dirt directly under it (still present in the
    // occupancy set even though we won't emit it).
    /** @type {Record<string, Array<{x:number,y:number,z:number,material:string}>>} */
    const groups = {};
    for (let i = 0; i < blocksToMesh.length; i++) {
      const b = blocksToMesh[i];
      const bxz = (b.x + X_OFF) * 65536 + (b.z + Z_OFF);
      const by  = ((b.y * 2) | 0) + Y_OFF;
      // pre-compute components and inline the 6 neighbour keys: the deltas
      // touch one axis at a time, so most factors stay constant.
      if (
        !occupancy.has((bxz + 65536) * 256 + by)              ||  // +x
        !occupancy.has((bxz - 65536) * 256 + by)              ||  // -x
        !occupancy.has(bxz * 256 + by + 2)                    ||  // +y (y step = 1 → key step = 2)
        !occupancy.has(bxz * 256 + by - 2)                    ||  // -y
        !occupancy.has((bxz + 1) * 256 + by)                  ||  // +z
        !occupancy.has((bxz - 1) * 256 + by)                     // -z
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

    const dt = performance.now() - t0;
    this._buildTimeAvgMs = this._buildCount === 0
      ? dt
      : this._buildTimeAvgMs * 0.9 + dt * 0.1;
    this._buildCount++;
  }

  _createChunkMaterialMesh(chunkX, chunkZ, type, list) {
    // Bounding box of this material's instances → tight frustum sphere.
    // Centre the mesh on the bbox centre (not the arithmetic mean of block
    // positions) so the sphere can sit at the local origin with the
    // smallest possible radius.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.x < minX) minX = b.x; if (b.x > maxX) maxX = b.x;
      if (b.y < minY) minY = b.y; if (b.y > maxY) maxY = b.y;
      if (b.z < minZ) minZ = b.z; if (b.z > maxZ) maxZ = b.z;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // Clone the shared geometry so we can override its boundingSphere per
    // chunk without affecting other chunks of the same material. The clone
    // owns its own buffers; dispose it in _disposeChunkMesh below.
    const geo = this._geo[type].clone();
    const ex = (maxX - minX) / 2;
    const ey = (maxY - minY) / 2;
    const ez = (maxZ - minZ) / 2;
    // +0.87 ≈ half-diagonal of a single block (sqrt(3)/2). The bbox covers
    // block centres; adding this corner-margin guarantees the sphere
    // contains the full geometry, not just centre points.
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      Math.sqrt(ex * ex + ey * ey + ez * ez) + 0.87,
    );

    const mesh = new THREE.InstancedMesh(geo, this._mat[type], list.length);
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
  }

  _disposeChunkMesh(chunkX, chunkZ) {
    const col = this.chunkMeshes[chunkX];
    const chunkObj = col?.[chunkZ];
    if (!chunkObj) return;
    for (const type in chunkObj) {
      const mesh = chunkObj[type];
      this._scene.remove(mesh);
      // Per-chunk cloned geometry — release its GPU buffers too. The shared
      // material is owned by BlockRegistry and must NOT be disposed here.
      mesh.geometry.dispose();
      mesh.dispose();
    }
    delete col[chunkZ];
    // Drop the empty column object too — long-running sessions used to
    // accumulate hundreds of empty {} entries in chunkMeshes from chunks
    // the player walked past, slowing every iteration over chunkMeshes.
    for (const _ in col) return;
    delete this.chunkMeshes[chunkX];
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
    this._invalidateCollisionCache();
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
    // Seed player chunk so the spawn chunk + first init batch render at
    // NEAR LOD instead of FAR (default _playerChunk is (0,0) which would
    // mark the spawn chunk as `Math.floor(DR/2)` chunks away → FAR LOD).
    this._playerChunk.x = spawnCX;
    this._playerChunk.z = spawnCZ;

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
   * Drain pending mesh disposals + a few mesh builds from their queues.
   * Call once per frame.
   */
  tick() {
    // Disposals run first and on their own (~2 ms) budget so a deep
    // dispose backlog doesn't get starved when the build queue is also
    // full. Each mesh.dispose() releases GPU resources synchronously and
    // costs ~0.1 ms, so 2 ms ≈ 20 meshes per frame.
    if (this._disposeQueue.length > 0) {
      const dStart = performance.now();
      while (this._disposeQueue.length > 0 && performance.now() - dStart < 2) {
        const [cx, cz] = this._disposeQueue.shift();
        // Skip if the chunk was re-queued by updateScroll into the visible
        // window before we got here (mesh still wanted).
        if (this.chunkMeshes[cx]?.[cz]) this._disposeChunkMesh(cx, cz);
      }
    }

    if (this._meshQueue.length === 0) return;

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
    // No window-bound filter here: a chunk that's already meshed will be
    // disposed by updateScroll() if it's outside the visible range — but
    // silently dropping a queued build leaves a chunk with data and no
    // mesh, which is exactly what produces the "chunk pops in when you
    // walk past it" bug.
    const start = performance.now();
    while (this._meshQueue.length > 0 && performance.now() - start < 6) {
      const { chunkX, chunkZ } = this._meshQueue.shift();
      if (this.chunkMeshes[chunkX]?.[chunkZ]) continue;
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
    let moved = false;

    // Hysteresis around the midpoint. With an even-sized window (DR even)
    // midX/midZ land on a half-integer, so any integer player chunk is
    // strictly on one side of it. Without the ceil/floor band the window
    // would slide every single frame, ping-ponging between two states and
    // never giving workers time to actually mesh anything — chunks far
    // from spawn simply never appeared.
    const midX = (min.x + max.x) / 2;
    const midZ = (min.z + max.z) / 2;

    if (aux.z > Math.ceil(midZ))       { min.z++; max.z++; moved = true; }
    else if (aux.z < Math.floor(midZ)) { min.z--; max.z--; moved = true; }

    if (aux.x > Math.ceil(midX))       { min.x++; max.x++; moved = true; }
    else if (aux.x < Math.floor(midX)) { min.x--; max.x--; moved = true; }

    if (!moved) return false;

    // Queue (don't run) mesh disposals for chunks outside the new window+R.
    // Synchronous disposal here used to spike the scroll frame by 5-20 ms on
    // a wide DR (hundreds of meshes cleared in one go); deferring to the
    // tick loop spreads the cost over multiple frames. Scan chunkMeshes
    // keys directly (not old window bounds) because tick() may have built
    // meshes that arrived from workers after we'd already scrolled past.
    const R = ChunkManager.PRELOAD_RING;
    for (const xKey in this.chunkMeshes) {
      const i = +xKey;
      const col = this.chunkMeshes[xKey];
      for (const zKey in col) {
        const a = +zKey;
        if (i < min.x - R || i > max.x + R || a < min.z - R || a > max.z + R) {
          this._disposeQueue.push([i, a]);
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
   * Hide bulk (Stone / Dirt / Rock) meshes for chunks whose entire vertical
   * extent sits well below the player. When the player is on a hill / flying
   * / standing on top of a tall pillar, those bulk meshes are fully occluded
   * by the surface materials (Grass etc.) above them — the GPU still pays
   * the vertex cost for them, even with frustum + face culling, because the
   * top of each chunk still has SOME exposed faces that pass culling.
   *
   * Cheap O(chunks) per call; safe to invoke at the 30-frame cadence already
   * used by updateShadowCastersByDistance.
   *
   * @param {number} playerY
   * @param {number} [margin=10] hide when (playerY - chunkMaxY) > margin
   */
  updateUndergroundCull(playerY, margin = 10) {
    for (const xKey in this.chunkMeshes) {
      const maxYCol = this.chunkMaxY[xKey];
      const col = this.chunkMeshes[xKey];
      for (const zKey in col) {
        const maxY = maxYCol?.[zKey];
        const aboveAll = maxY !== undefined && (playerY - maxY) > margin;
        const types = col[zKey];
        for (const k in types) {
          const m = types[k];
          const t = m.userData.type;
          if (t === 'Stone' || t === 'Dirt' || t === 'Rock') {
            m.visible = !aboveAll;
          }
        }
      }
    }
  }

  /**
   * Toggle `castShadow` on chunk meshes by distance from the player chunk.
   * The sun's shadow camera frustum only covers ~3 chunks each way from the
   * player (see MyScene.createLights, shadowExtent=16), so any shadow caster
   * beyond that contributes zero pixels to the shadow map but still costs a
   * draw call in the shadow pass.
   *
   * Idempotent and cheap — iterates current meshes once, two abs subtractions
   * per mesh. Safe to call every N frames from the main loop.
   *
   * @param {number} worldX
   * @param {number} worldZ
   * @param {number} chunkRadius default 2 (covers shadowExtent / TC + slack)
   */
  updateShadowCastersByDistance(worldX, worldZ, chunkRadius = 2) {
    const pc = identifyChunk(worldX, worldZ, this.TAM_CHUNK);
    for (const xKey in this.chunkMeshes) {
      const ix = +xKey;
      const dx = Math.abs(ix - pc.x);
      const col = this.chunkMeshes[xKey];
      for (const zKey in col) {
        const iz = +zKey;
        const inRange = dx <= chunkRadius && Math.abs(iz - pc.z) <= chunkRadius;
        const types = col[zKey];
        for (const k in types) {
          const mesh = types[k];
          // Only toggle types that are shadow casters in the first place — we
          // never want to enable castShadow on Stone/Dirt/Rock bulk.
          if (mesh.userData.type && blockCastsShadow(mesh.userData.type)) {
            mesh.castShadow = inRange;
          }
        }
      }
    }
  }

  /**
   * Flat list of every InstancedMesh inside a chunk radius around a position.
   * Used for raycast targets — passes a much smaller candidate set to
   * THREE.Raycaster.intersectObjects than `allMeshes` (which spans the whole
   * render distance and is O(chunks * materials) — easily thousands at DR≥16).
   *
   * @param {number} worldX
   * @param {number} worldZ
   * @param {number} chunkRadius
   */
  getMeshesNear(worldX, worldZ, chunkRadius) {
    const pc = identifyChunk(worldX, worldZ, this.TAM_CHUNK);
    const out = [];
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      const col = this.chunkMeshes[pc.x + dx];
      if (!col) continue;
      for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
        const chunk = col[pc.z + dz];
        if (!chunk) continue;
        for (const k in chunk) out.push(chunk[k]);
      }
    }
    return out;
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
   *
   * Cached by integer (x, z) cell: physics queries this every frame, but the
   * 3×3 chunk neighbourhood only changes when the player moves a full block
   * in X or Z. Invalidation happens on any chunk-data edit
   * (`_invalidateCollisionCache`, called from `rebuildChunkMaterial` and the
   * worker storeChunkData path).
   *
   * @param {number} playerX
   * @param {number} playerZ
   */
  getPlayerCollisions(playerX, playerZ) {
    const ix = Math.floor(playerX);
    const iz = Math.floor(playerZ);
    if (this._collCacheKeyX === ix && this._collCacheKeyZ === iz && this._collCacheResult) {
      return this._collCacheResult;
    }
    const r = this.getCollisionsAround(
      identifyChunk(playerX, playerZ, this.TAM_CHUNK),
      3
    );
    this._collCacheKeyX = ix;
    this._collCacheKeyZ = iz;
    this._collCacheResult = r;
    return r;
  }

  _invalidateCollisionCache() {
    this._collCacheKeyX = null;
    this._collCacheKeyZ = null;
    this._collCacheResult = null;
  }

  /**
   * Update the cached player chunk used for LOD bracketing. Queues rebuilds
   * for any meshed chunks whose target LOD changed as a result. Call from
   * MyScene each time the player crosses a chunk boundary (updateScroll
   * already does this on slide; idle ticks should call it too in case the
   * window did not slide).
   *
   * @param {number} cx player chunk X
   * @param {number} cz player chunk Z
   */
  setPlayerChunk(cx, cz) {
    if (this._playerChunk.x === cx && this._playerChunk.z === cz) return;
    this._playerChunk.x = cx;
    this._playerChunk.z = cz;
    // Scan meshed chunks; queue rebuild for any whose LOD bracket flipped.
    for (const xKey in this.chunkMeshes) {
      const ix = +xKey;
      const col = this.chunkMeshes[xKey];
      for (const zKey in col) {
        const iz = +zKey;
        const target = this._chunkLOD(ix, iz);
        if (this.chunkLOD[xKey]?.[zKey] !== target) {
          this._meshQueue.push({ chunkX: ix, chunkZ: iz });
        }
      }
    }
  }

  /** @param {number} cx @param {number} cz @returns {'NEAR' | 'FAR'} */
  _chunkLOD(cx, cz) {
    const d = Math.max(
      Math.abs(cx - this._playerChunk.x),
      Math.abs(cz - this._playerChunk.z),
    );
    return d <= this.lodNearRadius ? 'NEAR' : 'FAR';
  }
}
