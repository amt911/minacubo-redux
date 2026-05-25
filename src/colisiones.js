// @ts-check
import * as THREE from 'three';
import * as PM from './ParametrosMundo.js';
import { resolveMovement, blockCentersToAABBs } from './voxelPhysics.js';

/**
 * Character collision against world blocks. Detailed physics logic
 * (axis-separated sweep, sub-stepping, face snap) lives in `voxelPhysics.js`
 * as a pure testable function. This class is only the adapter between the
 * game world (entity, boundingBox, gravity, jump) and that function.
 */
class Collisions {
  constructor(autojump, half) {
    this.autojump = autojump;
    this.half = half;
    this.clock = new THREE.Clock();
    this.fallVel = -1;
    this.fallAcc = -42;
  }

  /**
   * Advance one physics frame for an entity.
   *
   * @param {Array<{x:number,y:number,z:number}>} blocks nearby solid blocks (centers).
   * @param {THREE.Object3D & {canJump?: boolean, height?: number}} entity
   * @param {THREE.Object3D} boundingBox visual AABB of the entity.
   * @param {Object<string, boolean>} keysPressed keyboard state map.
   * @param {THREE.Vector3} moveDir XZ movement direction (unnormalized).
   * @param {number} speed horizontal step magnitude this frame.
   */
  update(blocks, entity, boundingBox, keysPressed, moveDir, speed) {
    const delta = this.clock.getDelta();

    if (entity.canJump && keysPressed != null && keysPressed[' ']) {
      this.fallVel = 10;
      entity.canJump = false;
    }

    const finalSpeed = keysPressed && keysPressed['SHIFT'] ? speed * 2 : speed;
    const dir = moveDir.clone().normalize();
    const moveDelta = {
      x: dir.x * finalSpeed,
      y: this.fallVel * delta,
      z: dir.z * finalSpeed,
    };

    // entity AABB in world space (boundingBox: 8/16 × 32/16 × 8/16)
    const halfExtents = this._getHalfExtents(boundingBox);
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

    const blockAABBs = blockCentersToAABBs(blocks);
    const result = resolveMovement(playerAABB, moveDelta, blockAABBs);

    const newBBox = result.aabb;
    boundingBox.position.x = (newBBox.min.x + newBBox.max.x) / 2;
    boundingBox.position.y = (newBBox.min.y + newBBox.max.y) / 2;
    boundingBox.position.z = (newBBox.min.z + newBBox.max.z) / 2;

    // boundingBox = entity.position.y + height/PM/2 (1u for height=32)
    const entityYOffset = entity.height ? entity.height / PM.PIXELES_ESTANDAR / 2 : 1;
    entity.position.x = boundingBox.position.x;
    entity.position.y = boundingBox.position.y - entityYOffset;
    entity.position.z = boundingBox.position.z;

    if (result.onGround) {
      this.fallVel = 0;
      entity.canJump = true;
    } else {
      this.fallVel += this.fallAcc * delta;
      if (result.hitCeiling && this.fallVel > 0) this.fallVel = 0;
    }

    // Autojump: NPCs (zombies, pigs) hop over 1-block obstacles automatically
    // when their forward movement gets blocked by a wall. Without this the
    // pathing-less NPCs just grind into the first hill they meet.
    if (this.autojump && entity.canJump && (result.hitWallX || result.hitWallZ)) {
      this.fallVel = 10;
      entity.canJump = false;
    }
  }

  _getHalfExtents(boundingBox) {
    const g = boundingBox.geometry;
    if (g.parameters) {
      return {
        x: g.parameters.width / 2,
        y: g.parameters.height / 2,
        z: g.parameters.depth / 2,
      };
    }
    g.computeBoundingBox();
    const bb = g.boundingBox;
    return {
      x: (bb.max.x - bb.min.x) / 2,
      y: (bb.max.y - bb.min.y) / 2,
      z: (bb.max.z - bb.min.z) / 2,
    };
  }
}

export { Collisions };
export { Collisions as Colisiones };
