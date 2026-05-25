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
    /** @type {number[]} consecutive frames the zombie moved < expected */
    this._zombieStuckCount = [0];
    /** @type {number[]} remaining frames to detour around an obstacle */
    this._zombieWanderFrames = [0];
    /** @type {number[]} ±1: which side to detour (set on stuck trigger) */
    this._zombieWanderSign = [1];
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
    this._zombieStuckCount.push(0);
    this._zombieWanderFrames.push(0);
    this._zombieWanderSign.push(1);
  }

  // Stuck → wander tuning. Pathing is reactive (no A*): if a zombie hasn't
  // moved much for STUCK_FRAMES, it rotates its chase heading by ±60° and
  // commits to that detour for WANDER_FRAMES. Long enough to clear a tree
  // trunk, short enough that it re-acquires the player promptly.
  static STUCK_FRAMES = 10;
  static WANDER_FRAMES = 30;
  static WANDER_ANGLE = Math.PI / 3;     // 60°
  static WANDER_TARGET_DIST = 5;

  // Distance-based LOD for hordes. Past SHADOW_RANGE we stop casting shadows
  // (the shadow pass is the single most expensive renderer cost per mesh).
  // Past FREEZE_RANGE we skip physics + animation entirely — the zombie
  // freezes in place. Both are squared to avoid sqrt per zombie per frame.
  static SHADOW_RANGE_SQ = 32 * 32;
  static FREEZE_RANGE_SQ = 60 * 60;

  /**
   * @param {number} delta
   */
  update(delta) {
    const player = this._getPlayerPos();
    const playerObj = this._getPlayer ? this._getPlayer() : null;

    // Pre-build the zombie soft-collider snapshot once per frame, reusing a
    // pool of objects. Pre-pool each per-zombie loop did
    //   zCols.slice() + (N-1) push({x,y,z,material:''})
    // — for a 20-zombie horde that's 380 fresh objects + 20 array copies
    // every frame, classic GC stutter material.
    if (!this._softPool) this._softPool = [];
    while (this._softPool.length < this._zombies.length) {
      this._softPool.push({ x: 0, y: 0, z: 0, material: '' });
    }
    const softs = this._softPool;
    for (let i = 0; i < this._zombies.length; i++) {
      const o = this._zombies[i].boundingBox.position;
      softs[i].x = o.x; softs[i].y = o.y; softs[i].z = o.z;
    }

    // All zombies — face, chase (with detour if stuck), and attack the player
    for (let i = 0; i < this._zombies.length; i++) {
      const z = this._zombies[i];

      // Distance-based culling: toggle shadow casting on transition only, and
      // skip the whole update for zombies past FREEZE_RANGE (out of meaningful
      // gameplay range, the frozen pose isn't noticeable from that far away).
      const distSqToPlayer =
        (z.position.x - player.x) ** 2 + (z.position.z - player.z) ** 2;

      const wantShadow = distSqToPlayer < NPCManager.SHADOW_RANGE_SQ;
      if (z._castShadow !== wantShadow && z._renderMeshes) {
        for (const m of z._renderMeshes) m.castShadow = wantShadow;
        z._castShadow = wantShadow;
      }

      if (distSqToPlayer > NPCManager.FREEZE_RANGE_SQ) continue;

      // Pick body-facing target: real player most of the time, but a rotated
      // detour target when stuck on something. Head always tracks the player
      // — only the walking direction detours.
      let targetX = player.x;
      let targetZ = player.z;
      if (this._zombieWanderFrames[i] > 0) {
        const ang = Math.atan2(player.z - z.position.z, player.x - z.position.x);
        const newAng = ang + this._zombieWanderSign[i] * NPCManager.WANDER_ANGLE;
        targetX = z.position.x + Math.cos(newAng) * NPCManager.WANDER_TARGET_DIST;
        targetZ = z.position.z + Math.sin(newAng) * NPCManager.WANDER_TARGET_DIST;
        this._zombieWanderFrames[i]--;
      }

      z.cabezaW1.lookAt(player.x, player.y, player.z);
      z.lookAt(targetX, z.position.y, targetZ);
      z.boundingBox.lookAt(targetX, z.boundingBox.position.y, targetZ);

      // Melee attack — uses real player distance, not detour target
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
      // getCollisionsAround returns a fresh array — own it, push soft
      // colliders directly instead of slicing.
      const blocks = this._chunkManager.getCollisionsAround(zChunk, NPCManager.NPC_PHYSICS_RADIUS);
      for (let j = 0; j < softs.length; j++) {
        if (j === i) continue;
        blocks.push(softs[j]);
      }

      // Stuck detection: capture pre-update position, compare post-update.
      const preX = z.position.x;
      const preZ = z.position.z;
      z.update(blocks, delta);

      // Expected horizontal step ≈ speed = delta * 4.317. We compare squared
      // distances to skip the sqrt; threshold = 25% of expected² ≈ "moved
      // less than half a normal step." Wander state also resets stuck count
      // so we don't immediately re-trigger after coming out of a detour.
      const movedSq = (z.position.x - preX) ** 2 + (z.position.z - preZ) ** 2;
      const expected = delta * 4.317;
      const threshold = expected * expected * 0.25;
      if (this._zombieWanderFrames[i] === 0 && movedSq < threshold) {
        this._zombieStuckCount[i]++;
        if (this._zombieStuckCount[i] >= NPCManager.STUCK_FRAMES) {
          this._zombieWanderFrames[i] = NPCManager.WANDER_FRAMES;
          this._zombieWanderSign[i] = Math.random() < 0.5 ? -1 : 1;
          this._zombieStuckCount[i] = 0;
        }
      } else {
        this._zombieStuckCount[i] = 0;
      }
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
