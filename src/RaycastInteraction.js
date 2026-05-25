// @ts-check
import * as THREE from 'three';
import { identifyChunk } from './chunkMath.js';

export class RaycastInteraction {
  /**
   * @param {{
   *   camera: THREE.Camera,
   *   chunkManager: import('./ChunkManager.js').ChunkManager,
   *   blockTypes: string[],
   *   getObjeto: () => number,
   *   scene: THREE.Scene,
   *   TAM_CHUNK: number,
   *   getPlayerPosition: () => {x:number, y:number, z:number},
   * }} opts
   */
  constructor(opts) {
    this._camera           = opts.camera;
    this._chunkManager     = opts.chunkManager;
    this._blockTypes       = opts.blockTypes;
    this._getObjeto        = opts.getObjeto;
    this._scene            = opts.scene;
    this._TAM_CHUNK        = opts.TAM_CHUNK;
    this._getPlayerPosition = opts.getPlayerPosition;

    this._rightDragStart = null;

    // Selection highlight: EdgesGeometry lines + semi-transparent fill.
    const highlightGeo = new THREE.BoxGeometry(1, 1, 1);
    const SCALE = 1.005;

    const fill = new THREE.Mesh(
      highlightGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      })
    );
    fill.scale.setScalar(SCALE);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(highlightGeo),
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    edges.scale.setScalar(SCALE);

    this.selectionBox = new THREE.Group();
    this.selectionBox.add(fill, edges);
    this.selectionBox.visible = false;
    this._scene.add(this.selectionBox);

    this._feedbackRaycaster = new THREE.Raycaster();
    this._feedbackMouse = new THREE.Vector2(0, 0);
    // Pooled — click handlers were allocating a fresh Raycaster + Vector2 per
    // mousedown/up.
    this._clickRaycaster = new THREE.Raycaster();
    this._clickMouse = new THREE.Vector2(0, 0);
    this._instanceMatrix = new THREE.Matrix4();
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** @param {{x:number,z:number}} coord */
  _identifyChunk(coord) {
    return identifyChunk(coord.x, coord.z, this._TAM_CHUNK);
  }

  /**
   * Block centre from a raycast intersection.
   *
   * Uses hit.instanceId + the instance matrix to read the hit block's exact
   * world position. Previously we derived (x, y, z) from hit.point + face
   * normal, which floated by ~1e-7 due to ray-triangle precision; that was
   * enough to break the strict-equality findIndex against stored block
   * coordinates (so left-click silently did nothing).
   *
   * @param {THREE.Intersection} hit
   * @param {boolean} forRemoval  true → return the hit block, false → adjacent
   */
  _blockCenterFromHit(hit, forRemoval) {
    const mesh = /** @type {THREE.InstancedMesh} */ (hit.object);
    this._instanceMatrix.identity();
    mesh.getMatrixAt(hit.instanceId, this._instanceMatrix);
    // Instance matrices store positions relative to mesh.position. Sum, then
    // snap to the block grid: x/z are integers, y is a half-integer (n + 0.5).
    // The snap is required because InstancedMesh.instanceMatrix is Float32 —
    // the round-trip through it loses precision and strict-equality findIndex
    // against the stored coords would otherwise miss.
    const rawX = this._instanceMatrix.elements[12] + mesh.position.x;
    const rawY = this._instanceMatrix.elements[13] + mesh.position.y;
    const rawZ = this._instanceMatrix.elements[14] + mesh.position.z;
    const wx = Math.round(rawX);
    const wy = Math.round(rawY - 0.5) + 0.5;
    const wz = Math.round(rawZ);

    if (forRemoval) {
      return { x: wx, y: wy, z: wz };
    }
    // Placement: step one block along the hit face normal (axis-aligned ±1).
    const n = hit.face.normal;
    return { x: wx + n.x, y: wy + n.y, z: wz + n.z };
  }

  /**
   * Raycast against every live chunk mesh. Returns nearest hit within 20 units
   * with the block type it belongs to.
   * @param {THREE.Raycaster} raycaster
   * @param {boolean} forRemoval
   */
  _nearestHit(raycaster, forRemoval) {
    // Raycast distance cap is 20 units — that's < 2 chunks (TAM_CHUNK = 12).
    // Filter meshes to a 2-chunk radius around the player so we hand
    // Raycaster a few dozen meshes instead of the full render-distance list,
    // and set raycaster.far so per-triangle intersection tests short-circuit
    // beyond 20 units instead of computing the hit and discarding it later.
    const prevFar = raycaster.far;
    raycaster.far = 20;
    const p = this._getPlayerPosition();
    const meshes = this._chunkManager.getMeshesNear(p.x, p.z, 2);
    const hits = raycaster.intersectObjects(meshes, false);
    raycaster.far = prevFar;
    for (const hit of hits) {
      if (hit.distance > 20) break;
      const tipo = hit.object.userData.type;
      if (!tipo) continue;
      return { tipo, coordenada: this._blockCenterFromHit(hit, forRemoval), distancia: hit.distance };
    }
    return null;
  }

  // ─── mouse handlers ────────────────────────────────────────────────────────

  /** @param {MouseEvent} event */
  onMouseDown(event) {
    // event.button: 0 = left, 1 = middle, 2 = right. event.which is deprecated.
    if (event.button === 2) {
      this._rightDragStart = { x: event.clientX, y: event.clientY };
      return;
    }

    if (event.button !== 0) return;

    this._clickRaycaster.setFromCamera(this._clickMouse, this._camera);

    const hit = this._nearestHit(this._clickRaycaster, true);
    if (!hit) return;

    const { tipo, coordenada } = hit;
    const aux = this._identifyChunk(coordenada);
    const col = this._chunkManager.chunk[aux.x]?.[aux.z];
    if (!col) return;

    const idx = col.findIndex(b => b.x === coordenada.x && b.y === coordenada.y && b.z === coordenada.z);
    if (idx === -1) return;
    col.splice(idx, 1);

    this._chunkManager.rebuildChunkMaterial(aux.x, aux.z, tipo);
  }

  /** @param {MouseEvent} event */
  onMouseUp(event) {
    if (event.button !== 2) return;
    if (!this._rightDragStart) return;

    const dx = event.clientX - this._rightDragStart.x;
    const dy = event.clientY - this._rightDragStart.y;
    this._rightDragStart = null;

    if (dx * dx + dy * dy > 25) return; // drag, not click

    this._clickRaycaster.setFromCamera(this._clickMouse, this._camera);

    const hit = this._nearestHit(this._clickRaycaster, false);
    if (!hit) return;

    const { coordenada } = hit;
    const selectedType = this._blockTypes[this._getObjeto()];
    const aux = this._identifyChunk(coordenada);

    if (!this._chunkManager.chunk[aux.x]) this._chunkManager.chunk[aux.x] = [];
    if (!this._chunkManager.chunk[aux.x][aux.z]) this._chunkManager.chunk[aux.x][aux.z] = [];

    this._chunkManager.chunk[aux.x][aux.z].push({ material: selectedType, ...coordenada });
    this._chunkManager.rebuildChunkMaterial(aux.x, aux.z, selectedType);
  }

  // ─── feedback (call at ~10Hz) ──────────────────────────────────────────────

  updateFeedback() {
    const raycaster = this._feedbackRaycaster;
    raycaster.setFromCamera(this._feedbackMouse, this._camera);

    const hit = this._nearestHit(raycaster, true);
    if (hit) {
      this.selectionBox.position.set(hit.coordenada.x, hit.coordenada.y, hit.coordenada.z);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }

  hideSelectionBox() {
    this.selectionBox.visible = false;
  }
}
