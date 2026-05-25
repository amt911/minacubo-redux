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
   *   getPlayer?: () => import('./Esteban.js').Player,
   *   onPlayerDamaged?: () => void,
   *   TAM_CHUNK: number,
   * }} opts
   */
  constructor(opts) {
    this._pig               = opts.pig;
    this._pigWaypoints      = opts.pigWaypoints;
    this._chunkManager      = opts.chunkManager;
    this._getPlayerPos      = opts.getPlayerPosition;
    this._getPlayer         = opts.getPlayer ?? null;
    this._onPlayerDamaged   = opts.onPlayerDamaged ?? (() => {});
    this._TAM_CHUNK         = opts.TAM_CHUNK;

    this._pigWaypointIndex  = 0;
    this._pigPauseTimer     = 200;

    /** @type {import('./Zombie.js').Zombie[]} */
    this._zombies = [opts.zombie];
    /** @type {number[]} per-zombie melee cooldowns */
    this._zombieAttackCooldowns = [0];
  }

  // 3x3 chunks around each NPC is plenty for collision detection.
  // Previously used DISTANCIA_RENDER (9) which scanned 9x9=81 chunks per NPC.
  static NPC_PHYSICS_RADIUS = 3;

  // Zombie melee: within 1.5 units centre-to-centre, 2 HP every 1 s.
  static ZOMBIE_ATTACK_RANGE = 1.5;
  static ZOMBIE_ATTACK_DAMAGE = 2;
  static ZOMBIE_ATTACK_COOLDOWN = 1.0; // seconds

  /**
   * Add a zombie to the managed pool (horde support).
   * @param {import('./Zombie.js').Zombie} zombie
   */
  addZombie(zombie) {
    this._zombies.push(zombie);
    this._zombieAttackCooldowns.push(0);
  }

  /**
   * @param {number} delta
   */
  update(delta) {
    const player = this._getPlayerPos();
    const playerObj = this._getPlayer ? this._getPlayer() : null;

    // All zombies — face, chase, and attack the player
    for (let i = 0; i < this._zombies.length; i++) {
      const z = this._zombies[i];

      z.cabezaW1.lookAt(player.x, player.y, player.z);
      z.lookAt(player.x, z.position.y, player.z);
      z.boundingBox.lookAt(player.x, z.boundingBox.position.y, player.z);

      // Melee attack — skip when player is already dead
      this._zombieAttackCooldowns[i] -= delta;
      if (playerObj && !playerObj.isDead && this._zombieAttackCooldowns[i] <= 0) {
        const dx = z.position.x - player.x;
        const dz = z.position.z - player.z;
        if (dx * dx + dz * dz <= NPCManager.ZOMBIE_ATTACK_RANGE ** 2) {
          playerObj.takeDamage(NPCManager.ZOMBIE_ATTACK_DAMAGE);
          this._onPlayerDamaged();
          this._zombieAttackCooldowns[i] = NPCManager.ZOMBIE_ATTACK_COOLDOWN;
        }
      }

      const zChunk = identifyChunk(z.position.x, z.position.z, this._TAM_CHUNK);
      const zCols = this._chunkManager.getCollisionsAround(zChunk, NPCManager.NPC_PHYSICS_RADIUS);
      z.update(zCols);
    }

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
      const pigCollisions = this._chunkManager.getCollisionsAround(pigChunk, NPCManager.NPC_PHYSICS_RADIUS);
      this._pig.update(pigCollisions, delta);
    } else {
      this._pigPauseTimer--;
    }
  }
}
