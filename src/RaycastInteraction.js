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
   * }} opts
   */
  constructor(opts) {
    this._camera         = opts.camera;
    this._chunkManager   = opts.chunkManager;
    this._blockTypes     = opts.blockTypes;
    this._getObjeto      = opts.getObjeto;
    this._scene          = opts.scene;
    this._TAM_CHUNK      = opts.TAM_CHUNK;

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
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** @param {{x:number,z:number}} coord */
  _identifyChunk(coord) {
    return identifyChunk(coord.x, coord.z, this._TAM_CHUNK);
  }

  /**
   * @param {THREE.Intersection} hit
   * @param {boolean} forRemoval
   */
  _blockCenterFromHit(hit, forRemoval) {
    const p = hit.point;
    const n = hit.face.normal;
    const sign = forRemoval ? -1 : 1;

    if (Math.abs(n.x) > 0.5) {
      return { x: p.x + n.x * 0.5 * sign, y: Math.floor(p.y) + 0.5, z: Math.round(p.z) };
    } else if (Math.abs(n.y) > 0.5) {
      return { x: Math.round(p.x), y: p.y + n.y * 0.5 * sign, z: Math.round(p.z) };
    } else {
      return { x: Math.round(p.x), y: Math.floor(p.y) + 0.5, z: p.z + n.z * 0.5 * sign };
    }
  }

  /**
   * Raycast against every live chunk mesh. Returns nearest hit within 20 units
   * with the block type it belongs to.
   * @param {THREE.Raycaster} raycaster
   * @param {boolean} forRemoval
   */
  _nearestHit(raycaster, forRemoval) {
    const meshes = this._chunkManager.allMeshes;
    const hits = raycaster.intersectObjects(meshes, false);
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
    if (event.which === 3) {
      this._rightDragStart = { x: event.clientX, y: event.clientY };
      return;
    }

    if (event.which !== 1) return;

    const mouse = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);

    const hit = this._nearestHit(raycaster, true);
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
    if (event.which !== 3) return;
    if (!this._rightDragStart) return;

    const dx = event.clientX - this._rightDragStart.x;
    const dy = event.clientY - this._rightDragStart.y;
    this._rightDragStart = null;

    if (dx * dx + dy * dy > 25) return; // drag, not click

    const mouse = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);

    const hit = this._nearestHit(raycaster, false);
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
