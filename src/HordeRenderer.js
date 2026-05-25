// @ts-check
import * as THREE from 'three';
import { getZombieAssets } from './zombieAssets.js';

/**
 * Renders a horde of Zombies via 6 InstancedMesh objects (one per body part)
 * instead of 6 Mesh per zombie.
 *
 * Cost model:
 *   - Without instancing: N zombies × 6 body parts × 6 face materials =
 *     36N draw calls per render pass, doubled by the shadow pass → 72N.
 *     20 zombies = 1,440 draw calls just for the horde.
 *   - With instancing: 6 body parts × 6 face materials = 36 draw calls per
 *     render pass, doubled by shadow = 72 total. Constant in N.
 *
 * Each zombie keeps its own Object3D hierarchy (cabezaW1, brazoLeft, …) so
 * its body-part matrices keep updating from animacion() / lookAt /
 * translateOnAxis. We hide the per-zombie meshes (visible = false) and read
 * their matrixWorld once per frame into the InstancedMesh.
 *
 * Trade-off: horde zombies don't cast shadows (one castShadow flag for the
 * whole instance group; individual toggling isn't supported). The single
 * featured main zombie still has per-mesh shadows. Acceptable for a swarm
 * where shadow detail is invisible anyway.
 */

const PARTS = /** @type {const} */ ([
  ['cabeza',  'cabeza',     'cabeza'],
  ['brazoL',  'extremidad', 'brazoL'],
  ['brazoR',  'extremidad', 'brazoR'],
  ['piernaL', 'extremidad', 'piernaL'],
  ['piernaR', 'extremidad', 'piernaR'],
  ['torso',   'torso',      'cuerpo'],
]);

export class HordeRenderer {
  /**
   * @param {THREE.Scene} scene
   * @param {number} [maxInstances=128]
   */
  constructor(scene, maxInstances = 128) {
    const A = getZombieAssets();
    this._scene = scene;
    this._max = maxInstances;

    /** @type {Record<string, THREE.InstancedMesh>} */
    this._meshes = {};
    for (const [partKey, geoKey, matKey] of PARTS) {
      const im = new THREE.InstancedMesh(A.geo[geoKey], A.mat[matKey], maxInstances);
      im.count = 0;
      // The body-part instances are scattered across the world; one giant
      // bounding sphere would never cull anyway, and accurate per-instance
      // frustum testing would defeat the point of batching.
      im.frustumCulled = false;
      im.castShadow = false;     // horde-wide shadow off (see header)
      im.receiveShadow = false;
      this._meshes[partKey] = im;
      scene.add(im);
    }

    /** @type {import('./Zombie.js').Zombie[]} */
    this._zombies = [];
  }

  /**
   * Register a zombie into the instance pool. Hides its per-zombie meshes
   * and assigns it the next instance slot.
   *
   * @param {import('./Zombie.js').Zombie & {_parts?: any, _renderMeshes?: THREE.Mesh[]}} zombie
   * @returns {number} instance ID, or -1 if pool is full
   */
  add(zombie) {
    const id = this._zombies.length;
    if (id >= this._max) {
      console.warn('[HordeRenderer] max instances reached, dropping zombie');
      return -1;
    }
    if (!zombie._parts) {
      console.warn('[HordeRenderer] zombie missing _parts cache');
      return -1;
    }
    this._zombies.push(zombie);

    // Hide the rendered meshes — InstancedMesh now draws them. The Object3D
    // chain stays alive so matrixWorld keeps updating from physics + animacion.
    if (zombie._renderMeshes) {
      for (const m of zombie._renderMeshes) m.visible = false;
    }

    for (const [k] of PARTS) this._meshes[k].count = id + 1;
    return id;
  }

  /**
   * Sync each instance matrix from the corresponding body-part matrixWorld.
   * Call once per frame, after NPCManager.update() and before render.
   */
  update() {
    const zs = this._zombies;
    if (zs.length === 0) return;
    const cabeza  = this._meshes.cabeza;
    const brazoL  = this._meshes.brazoL;
    const brazoR  = this._meshes.brazoR;
    const piernaL = this._meshes.piernaL;
    const piernaR = this._meshes.piernaR;
    const torso   = this._meshes.torso;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      // (false) — only re-compose matrices where the dirty flag (set by
      // Object3D.updateMatrix when position/rotation change) demands it.
      // (true) was wasting work re-multiplying every parent matrix per zombie.
      z.updateMatrixWorld(false);
      const p = /** @type {any} */ (z)._parts;
      cabeza .setMatrixAt(i, p.cabeza.matrixWorld);
      brazoL .setMatrixAt(i, p.brazoL.matrixWorld);
      brazoR .setMatrixAt(i, p.brazoR.matrixWorld);
      piernaL.setMatrixAt(i, p.piernaL.matrixWorld);
      piernaR.setMatrixAt(i, p.piernaR.matrixWorld);
      torso  .setMatrixAt(i, p.torso.matrixWorld);
    }
    cabeza .instanceMatrix.needsUpdate = true;
    brazoL .instanceMatrix.needsUpdate = true;
    brazoR .instanceMatrix.needsUpdate = true;
    piernaL.instanceMatrix.needsUpdate = true;
    piernaR.instanceMatrix.needsUpdate = true;
    torso  .instanceMatrix.needsUpdate = true;
  }

  /** Enable/disable shadow casting for the whole horde. */
  setShadowsEnabled(enabled) {
    for (const [k] of PARTS) this._meshes[k].castShadow = enabled;
  }
}
