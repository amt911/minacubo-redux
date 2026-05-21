// @ts-check
import * as THREE from 'three';
import { identifyChunk } from './chunkMath.js';
import { blockCastsShadow } from './BlockRegistry.js';

export class RaycastInteraction {
  /**
   * @param {{
   *   camera: THREE.Camera,
   *   mesh: Record<string, THREE.InstancedMesh>,
   *   blockGeometries: Record<string, THREE.BufferGeometry>,
   *   blockMaterials: Record<string, THREE.Material | THREE.Material[]>,
   *   sizeIMesh: Record<string, number>,
   *   chunk: Array<Array<Array<{x:number,y:number,z:number,material:string}>>>,
   *   chunkMinMax: {min:{x:number,z:number}, max:{x:number,z:number}},
   *   blockTypes: string[],
   *   getObjeto: () => number,
   *   scene: THREE.Scene,
   *   TAM_CHUNK: number,
   * }} opts
   */
  constructor(opts) {
    this._camera        = opts.camera;
    this._mesh          = opts.mesh;
    this._geo           = opts.blockGeometries;
    this._mat           = opts.blockMaterials;
    this._sizeIMesh     = opts.sizeIMesh;
    this._chunk         = opts.chunk;
    this._chunkMinMax   = opts.chunkMinMax;
    this._blockTypes    = opts.blockTypes;
    this._getObjeto     = opts.getObjeto;
    this._scene         = opts.scene;
    this._TAM_CHUNK     = opts.TAM_CHUNK;

    this._rightDragStart = null;

    // Selection highlight: EdgesGeometry lines + semi-transparent fill
    // Both scaled slightly above 1 to avoid z-fighting with the block face.
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

  /** @param {THREE.InstancedMesh} mesh @param {string} type */
  _applyMeshShadows(mesh, type) {
    mesh.castShadow = blockCastsShadow(type);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  }

  _rebuildMesh(tipo) {
    this._scene.remove(this._mesh[tipo]);
    this._mesh[tipo] = new THREE.InstancedMesh(
      this._geo[tipo], this._mat[tipo], this._sizeIMesh[tipo]
    );
    this._applyMeshShadows(this._mesh[tipo], tipo);

    const matrix = new THREE.Matrix4();
    let l = 0;
    const { min, max } = this._chunkMinMax;
    for (let a = min.z; a <= max.z; a++) {
      for (let i = min.x; i <= max.x; i++) {
        if (!this._chunk[i]?.[a]) continue;
        for (const blk of this._chunk[i][a]) {
          if (blk.material === tipo) {
            matrix.setPosition(blk.x, blk.y, blk.z);
            this._mesh[tipo].setMatrixAt(l++, matrix);
          }
        }
      }
    }
    this._scene.add(this._mesh[tipo]);
  }

  // ─── mouse handlers ────────────────────────────────────────────────────────

  /** @param {MouseEvent} event */
  onMouseDown(event) {
    if (event.which === 3) {
      this._rightDragStart = { x: event.clientX, y: event.clientY };
      return;
    }

    if (event.which !== 1) return;

    const mouse = new THREE.Vector2((0.5) * 2 - 1, 1 - 2 * 0.5);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);

    const hits = [];
    for (const tipo in this._mesh) {
      const res = raycaster.intersectObject(this._mesh[tipo], true);
      if (res[0] && res[0].distance <= 20) {
        hits.push({ tipo, coordenada: this._blockCenterFromHit(res[0], true), distancia: res[0].distance });
      }
    }
    hits.sort((a, b) => a.distancia - b.distancia);

    if (!hits[0]) return;

    const { tipo, coordenada } = hits[0];
    const aux = this._identifyChunk(coordenada);
    const col = this._chunk[aux.x]?.[aux.z];
    if (!col) return;

    const idx = col.findIndex(b => b.x === coordenada.x && b.y === coordenada.y && b.z === coordenada.z);
    if (idx !== -1) col.splice(idx, 1);

    this._sizeIMesh[tipo]--;
    this._rebuildMesh(tipo);
  }

  /** @param {MouseEvent} event */
  onMouseUp(event) {
    if (event.which !== 3) return;
    if (!this._rightDragStart) return;

    const dx = event.clientX - this._rightDragStart.x;
    const dy = event.clientY - this._rightDragStart.y;
    this._rightDragStart = null;

    if (dx * dx + dy * dy > 25) return; // drag, not click

    const mouse = new THREE.Vector2((0.5) * 2 - 1, 1 - 2 * 0.5);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this._camera);

    const hits = [];
    for (const tipo in this._mesh) {
      const res = raycaster.intersectObject(this._mesh[tipo], true);
      if (res[0] && res[0].distance <= 20) {
        hits.push({ tipo, coordenada: this._blockCenterFromHit(res[0], false), distancia: res[0].distance });
      }
    }
    hits.sort((a, b) => a.distancia - b.distancia);

    if (!hits[0]) return;

    const { coordenada } = hits[0];
    const selectedType = this._blockTypes[this._getObjeto()];
    const aux = this._identifyChunk(coordenada);

    if (!this._chunk[aux.x]) this._chunk[aux.x] = [];
    if (!this._chunk[aux.x][aux.z]) this._chunk[aux.x][aux.z] = [];

    this._chunk[aux.x][aux.z].push({ material: selectedType, ...coordenada });

    this._sizeIMesh[selectedType]++;
    this._rebuildMesh(selectedType);
  }

  // ─── feedback (call at ~10Hz) ──────────────────────────────────────────────

  updateFeedback() {
    const raycaster = this._feedbackRaycaster;
    raycaster.setFromCamera(this._feedbackMouse, this._camera);

    let bestHit = null;
    let bestCoord = null;

    for (const aux in this._mesh) {
      const mesh = this._mesh[aux];
      if (mesh.count === 0) continue;
      const hits = raycaster.intersectObject(mesh, false);
      const hit = hits[0];
      if (!hit || hit.distance > 20) continue;
      if (bestHit && hit.distance >= bestHit.distance) continue;
      bestHit = hit;
      bestCoord = this._blockCenterFromHit(hit, true);
    }

    if (bestCoord) {
      this.selectionBox.position.set(bestCoord.x, bestCoord.y, bestCoord.z);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }

  hideSelectionBox() {
    this.selectionBox.visible = false;
  }
}
