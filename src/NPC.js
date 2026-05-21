// @ts-check
import * as THREE from 'three';

/**
 * Base class for all NPCs.
 * Handles physics / collision update; subclasses own mesh construction + animation.
 * Subclasses must set this.physics after calling _initPhysics.
 */
export class NPC extends THREE.Object3D {
  /**
   * @param {THREE.BoxGeometry} boundingBoxGeo
   * @param {number} boundingBoxYOffset world-units offset applied to boundingBox.position.y
   * @param {number} [maxAngleDeg=60] max limb rotation in degrees
   */
  _initPhysics(boundingBoxGeo, boundingBoxYOffset, maxAngleDeg = 60) {
    this.clock = new THREE.Clock();
    this.cambiarAnimacion = false;
    this.maxMovimientoExt = (maxAngleDeg * Math.PI) / 180;

    this.boundingBox = new THREE.Mesh(boundingBoxGeo, new THREE.MeshPhongMaterial());
    this.boundingBox.position.y += boundingBoxYOffset;
  }

  /**
   * Override in subclass to animate limbs.
   * @param {boolean} _isForward
   * @param {number} _speed
   */
  animacion(_isForward, _speed) {}

  /**
   * Shared movement + collision step.
   * @param {Array<{x:number,y:number,z:number,material:string}>} blocks
   * @param {number} delta
   */
  _stepPhysics(blocks, delta) {
    const speed = delta * 4.317;
    this.animacion(true, speed);
    const dir = new THREE.Vector3(0, 0, 1);
    this.translateOnAxis(dir.normalize(), speed);
    this.boundingBox.translateOnAxis(dir, speed);
    this.physics.update(blocks, this, this.boundingBox, null, dir, speed);
  }
}

// ─── Strategies ───────────────────────────────────────────────────────────────
// These are pure functions — no state. NPCManager calls lookAt before update(),
// so the NPC already faces its target when _stepPhysics runs.

/**
 * NPC faces and moves toward a dynamic target each frame.
 * Use by calling npc.lookAt(target) before npc.update(blocks).
 */
export class FollowStrategy {
  /** @param {NPC} npc */
  constructor(npc) { this._npc = npc; }
  /** @param {Array} blocks @param {number} delta */
  execute(blocks, delta) { this._npc._stepPhysics(blocks, delta); }
}

/**
 * NPC patrols waypoints. Waypoint selection is managed externally (NPCManager).
 * Use by calling npc.lookAt(waypoint) before npc.update(blocks, delta).
 */
export class PatrolStrategy {
  /** @param {NPC} npc */
  constructor(npc) { this._npc = npc; }
  /** @param {Array} blocks @param {number} delta */
  execute(blocks, delta) { this._npc._stepPhysics(blocks, delta); }
}

/**
 * NPC flees away from a target.
 * Use by calling npc.lookAt(opposite of target) before npc.update(blocks, delta).
 */
export class FleeStrategy {
  /** @param {NPC} npc */
  constructor(npc) { this._npc = npc; }
  /** @param {Array} blocks @param {number} delta */
  execute(blocks, delta) { this._npc._stepPhysics(blocks, delta); }
}
