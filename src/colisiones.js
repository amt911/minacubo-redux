// @ts-check
import * as THREE from 'three';
import * as PM from './ParametrosMundo.js';
import { resolveMovement, blockCentersToAABBs } from './voxelPhysics.js';

// Bloques que NO bloquean el movimiento del personaje. Las hojas son
// "atravesables" estilo Minecraft: el personaje pasa por ellas en lugar
// de quedarse atrapado contra la copa de un arbol cuya altura coincide
// con la suya.
const PASSABLE_MATERIALS = new Set(['HojasRoble']);

/**
 * Colisiones del personaje contra los bloques del mundo. La logica
 * detallada (axis-separated sweep, sub-stepping, snap por cara) vive en
 * `voxelPhysics.js` como funcion pura testeable. Esta clase es solo el
 * adaptador entre el mundo del juego (personaje, boundingBox, gravedad,
 * salto) y esa funcion.
 */
class Colisiones {
  constructor(autojump, mitad) {
    this.autojump = autojump;
    this.mitad = mitad;
    this.clock = new THREE.Clock();
    this.caidaVel = -1;
    this.caidaAcc = -42;
  }

  /**
   * Avanza un frame de fisica para el personaje.
   *
   * @param {Array<{x:number,y:number,z:number}>} bloques bloques solidos cercanos (centros).
   * @param {THREE.Object3D & {puedeSaltar?: boolean, altura?: number}} personaje
   * @param {THREE.Object3D} boundingBox AABB visual del personaje.
   * @param {Object<string, boolean>} teclasPulsadas mapa estado teclado.
   * @param {THREE.Vector3} vectorDir direccion XZ de movimiento (sin normalizar).
   * @param {number} velocidad magnitud del paso horizontal este frame.
   */
  update(bloques, personaje, boundingBox, teclasPulsadas, vectorDir, velocidad) {
    const delta = this.clock.getDelta();

    if (personaje.puedeSaltar && teclasPulsadas != null && teclasPulsadas[' ']) {
      this.caidaVel = 10;
      personaje.puedeSaltar = false;
    }

    // Construye delta de movimiento de este frame:
    //   XZ desde el input (vectorDir * velocidad)
    //   Y desde la gravedad (caidaVel * delta_t)
    const velocidadFinal = teclasPulsadas && teclasPulsadas['SHIFT'] ? velocidad * 2 : velocidad;
    const dir = vectorDir.clone().normalize();
    const moveDelta = {
      x: dir.x * velocidadFinal,
      y: this.caidaVel * delta,
      z: dir.z * velocidadFinal,
    };

    // AABB actual del personaje en world space (boundingBox es 0.5 ancho,
    // 2 alto, 0.5 fondo segun Esteban.js: 8/16 x 32/16 x 8/16).
    const halfExtents = this._extraerHalfExtents(boundingBox);
    const playerAABB = {
      min: {
        x: boundingBox.position.x - halfExtents.x,
        y: boundingBox.position.y - halfExtents.y,
        z: boundingBox.position.z - halfExtents.z,
      },
      max: {
        x: boundingBox.position.x + halfExtents.x,
        y: boundingBox.position.y + halfExtents.y,
        z: boundingBox.position.z + halfExtents.z,
      },
    };

    const solidBlocks = bloques.filter((b) => !PASSABLE_MATERIALS.has(b.material));
    const blockAABBs = blockCentersToAABBs(solidBlocks);
    const result = resolveMovement(playerAABB, moveDelta, blockAABBs);

    // Aplica posicion resultante al boundingBox y a personaje.position.
    // personaje.position.y se calcula manteniendo el offset original:
    // boundingBox = personaje.position.y + altura/PM/2 (1u para altura=32).
    const newBBox = result.aabb;
    boundingBox.position.x = (newBBox.min.x + newBBox.max.x) / 2;
    boundingBox.position.y = (newBBox.min.y + newBBox.max.y) / 2;
    boundingBox.position.z = (newBBox.min.z + newBBox.max.z) / 2;

    const offsetPersonajeY = personaje.altura ? personaje.altura / PM.PIXELES_ESTANDAR / 2 : 1;
    personaje.position.x = boundingBox.position.x;
    personaje.position.y = boundingBox.position.y - offsetPersonajeY;
    personaje.position.z = boundingBox.position.z;

    if (result.onGround) {
      this.caidaVel = 0;
      personaje.puedeSaltar = true;
    } else {
      this.caidaVel += this.caidaAcc * delta;
      if (result.hitCeiling && this.caidaVel > 0) this.caidaVel = 0;
    }
  }

  _extraerHalfExtents(boundingBox) {
    // BoxGeometry.parameters guarda width/height/depth originales.
    const g = boundingBox.geometry;
    if (g.parameters) {
      return {
        x: g.parameters.width / 2,
        y: g.parameters.height / 2,
        z: g.parameters.depth / 2,
      };
    }
    // Fallback al boundingBox geometrico.
    g.computeBoundingBox();
    const bb = g.boundingBox;
    return {
      x: (bb.max.x - bb.min.x) / 2,
      y: (bb.max.y - bb.min.y) / 2,
      z: (bb.max.z - bb.min.z) / 2,
    };
  }
}

export { Colisiones };
