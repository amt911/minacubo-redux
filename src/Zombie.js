import * as THREE from 'three'
import * as PM from './ParametrosMundo.js'
import * as C from './colisiones.js'
import { NPC } from './NPC.js'
import { getZombieAssets } from './zombieAssets.js'

class Zombie extends NPC {
  constructor(gui, titleGui) {
    super();

    this.createGUI(gui, titleGui);

    // All zombies share one geometry + one material set. Pre-fix each zombie
    // built 36 fresh MeshStandardMaterial instances; with a horde of 25 that
    // was 900 PBR shaders compiled and 900 uniform blocks updated per render
    // pass. Lambert is also ~half the per-pixel cost of Standard.
    const A = getZombieAssets();
    const P = PM.PIXELES_ESTANDAR;

    // HEAD
    const cabeza = new THREE.Mesh(A.geo.cabeza, A.mat.cabeza);
    cabeza.position.y = 4 / P;
    this.cabezaW1 = new THREE.Object3D();
    this.cabezaW1.add(cabeza);
    this.cabezaW1.position.y = 24 / P;

    // ARMS — left arm gets pre-rotated -π/2 around X (zombie outstretched-arm pose)
    const brazoL = new THREE.Mesh(A.geo.extremidad, A.mat.brazoL);
    brazoL.position.y = -4 / P;
    const brazoR = new THREE.Mesh(A.geo.extremidad, A.mat.brazoR);
    brazoR.position.y = -4 / P;

    this.brazoLeft = new THREE.Object3D();
    this.brazoLeft.add(brazoL);
    this.brazoLeft.rotation.set(-Math.PI / 2, 0, 0);
    this.brazoLeft.position.y = 22 / P;

    this.brazoLeftW1 = new THREE.Object3D();
    this.brazoLeftW1.position.x = +6 / P;
    this.brazoLeftW1.add(this.brazoLeft);

    this.brazoRight = new THREE.Object3D();
    this.brazoRight.add(brazoR);
    this.brazoRight.rotation.set(-Math.PI / 2, 0, 0);
    this.brazoRight.position.y = 22 / P;

    this.brazoRightW1 = new THREE.Object3D();
    this.brazoRightW1.position.x = -6 / P;
    this.brazoRightW1.add(this.brazoRight);

    // LEGS
    const piernaL = new THREE.Mesh(A.geo.extremidad, A.mat.piernaL);
    const piernaR = new THREE.Mesh(A.geo.extremidad, A.mat.piernaR);
    piernaL.position.y = -6 / P;
    piernaR.position.y = -6 / P;

    this.piernaLW1 = new THREE.Object3D();
    this.piernaRW1 = new THREE.Object3D();
    this.piernaLW1.add(piernaL);
    this.piernaRW1.add(piernaR);
    this.piernaLW1.position.set(2 / P, 12 / P, 0);
    this.piernaRW1.position.set(-2 / P, 12 / P, 0);

    // TORSO
    const torso = new THREE.Mesh(A.geo.torso, A.mat.cuerpo);
    torso.position.y = 18 / P;

    // Wrapper for the whole body — strafe animations rotate this.
    this.wrapperFinal = new THREE.Object3D();
    this.wrapperFinal.add(this.cabezaW1);
    this.wrapperFinal.add(this.brazoLeftW1);
    this.wrapperFinal.add(this.brazoRightW1);
    this.wrapperFinal.add(this.piernaLW1);
    this.wrapperFinal.add(this.piernaRW1);
    this.wrapperFinal.add(torso);

    this.add(this.wrapperFinal);

    this._initPhysics(A.geo.boundingBox, 16 / P);
    // Override colision with zombie-specific params (autojump=true).
    this.physics = new C.Collisions(true, 0.8);
    this.height = 32;

    // Named refs to each rendered body part — HordeRenderer pulls
    // matrixWorld from these to populate its InstancedMesh slots.
    this._parts = { cabeza, brazoL, brazoR, piernaL, piernaR, torso };

    // Cache the rendered sub-meshes so NPCManager can toggle castShadow in
    // O(1) per zombie instead of re-traversing the body graph every cull tick.
    /** @type {THREE.Mesh[]} */
    this._renderMeshes = [cabeza, brazoL, brazoR, piernaL, piernaR, torso];
    // Track current shadow state so we only mutate on transitions.
    this._castShadow = true;
  }

  createGUI(gui, titleGui) {
    this.guiControls = {
      moviendose: false,   // off by default — enable via GUI to make the zombie chase
      reset: () => { this.guiControls.moviendose = false; },
    };

    // Horde zombies are created with gui=null to skip adding a folder per zombie.
    if (!gui) return;

    const folder = gui.addFolder(titleGui);
    folder.add(this.guiControls, 'moviendose').name('Movimiento');
  }

  resetPosicion() {}

  animacion(isForward, speed) {
    const finalSpeed = (isForward) ? speed : -speed;

    if (this.cambiarAnimacion) {
      this.piernaLW1.rotation.x += finalSpeed
      this.piernaRW1.rotation.x -= finalSpeed

      if ((isForward && this.piernaRW1.rotation.x <= -this.maxMovimientoExt) || (!isForward && this.piernaRW1.rotation.x >= this.maxMovimientoExt)) {
        this.cambiarAnimacion = false;
      }
    }
    else {
      this.piernaLW1.rotation.x += -finalSpeed
      this.piernaRW1.rotation.x -= -finalSpeed

      if ((isForward && this.piernaRW1.rotation.x >= this.maxMovimientoExt) || (!isForward && this.piernaRW1.rotation.x <= -this.maxMovimientoExt)) {
        this.cambiarAnimacion = true;
      }
    }
  }

  /**
   * @param {Array} bloques
   * @param {number} [delta] optional shared delta; if omitted falls back to
   *   internal clock (kept for backwards compatibility with the GUI toggle).
   */
  update(bloques, delta) {
    if (!this.guiControls.moviendose) return;
    const dt = delta ?? this.clock.getDelta();
    this._stepPhysics(bloques, dt);
  }
}

export { Zombie };
