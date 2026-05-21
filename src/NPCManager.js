// @ts-check
import { identifyChunk } from './chunkMath.js';

export class NPCManager {
  /**
   * @param {{
   *   zombie: import('./Zombie.js').Zombie,
   *   pig: import('./Cerdo.js').Pig,
   *   pigWaypoints: Array<{x:number,y:number,z:number}>,
   *   chunkManager: import('./ChunkManager.js').ChunkManager,
   *   getPlayerPosition: () => {x:number,y:number,z:number},
   *   TAM_CHUNK: number,
   *   DISTANCIA_RENDER: number,
   * }} opts
   */
  constructor(opts) {
    this._zombie            = opts.zombie;
    this._pig             = opts.pig;
    this._pigWaypoints      = opts.pigWaypoints;
    this._chunkManager      = opts.chunkManager;
    this._getPlayerPos      = opts.getPlayerPosition;
    this._TAM_CHUNK         = opts.TAM_CHUNK;
    this._DISTANCIA_RENDER  = opts.DISTANCIA_RENDER;

    this._pigWaypointIndex  = 0;
    this._pigPauseTimer     = 200;
  }

  /**
   * @param {number} delta
   */
  update(delta) {
    const player = this._getPlayerPos();

    // Zombie — faces and chases player
    this._zombie.cabezaW1.lookAt(player.x, player.y, player.z);
    this._zombie.lookAt(player.x, this._zombie.position.y, player.z);
    this._zombie.boundingBox.lookAt(player.x, this._zombie.boundingBox.position.y, player.z);

    const zombieChunk = identifyChunk(this._zombie.position.x, this._zombie.position.z, this._TAM_CHUNK);
    const zombieCollisions = this._chunkManager.getCollisionsAround(zombieChunk, this._DISTANCIA_RENDER);
    this._zombie.update(zombieCollisions);

    // Pig — waypoint patrol
    const wp = this._pigWaypoints[this._pigWaypointIndex];
    this._pig.lookAt(wp.x, this._pig.position.y, wp.z);
    this._pig.boundingBox.lookAt(wp.x, this._pig.boundingBox.position.y, wp.z);

    if (this._pigPauseTimer <= 0) {
      const near = Math.abs(this._pig.position.x - wp.x) <= 1
                && Math.abs(this._pig.position.z - wp.z) <= 1;
      if (near) {
        this._pigWaypointIndex = (this._pigWaypointIndex + 1) % this._pigWaypoints.length;
        this._pigPauseTimer = 200;
      }
      const pigChunk = identifyChunk(this._pig.position.x, this._pig.position.z, this._TAM_CHUNK);
      const pigCollisions = this._chunkManager.getCollisionsAround(pigChunk, this._DISTANCIA_RENDER);
      this._pig.update(pigCollisions, delta);
    } else {
      this._pigPauseTimer--;
    }
  }
}
