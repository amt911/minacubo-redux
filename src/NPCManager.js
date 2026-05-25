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

  // Inter-zombie separation. Was implemented as 1×1×1 soft AABB colliders in
  // the physics blocks list, but that triggered the wall-hit autojump path
  // when zombies overlapped (autojump fires on hitWallX/Z) — symptom was
  // zombies launching straight up off each other. Post-physics pairwise
  // separation pushes them apart horizontally only, no autojump bait, no
  // contribution to the per-zombie collision N×blocks workload.
  //
  // SEPARATION_MAX_STEP caps the total per-zombie push per frame. Without it,
  // a zombie pinned at the centre of a 20-strong horde could accumulate
  // ~19 × 0.4 = 7.6 units of push in a single frame — fast enough to fly the
  // horde past FREEZE_RANGE in under a second and "disappear" while frozen
  // in place far from the player.
  static SEPARATION_DIST = 0.8;
  static SEPARATION_DIST_SQ = 0.8 * 0.8;
  static SEPARATION_PUSH_FACTOR = 0.2;   // softer per-pair push (was 0.5)
  static SEPARATION_MAX_STEP = 0.25;     // hard cap on |Δ| per zombie per frame

  /**
   * @param {number} delta
   */
  update(delta) {
    const player = this._getPlayerPos();
    const playerObj = this._getPlayer ? this._getPlayer() : null;

    // (Inter-zombie separation now happens post-physics, see end of this
    // method. The soft-AABB-collider approach was causing zombies to autojump
    // off each other and launch into the air.)

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
      const blocks = this._chunkManager.getCollisionsAround(zChunk, NPCManager.NPC_PHYSICS_RADIUS);
      // Note: previously filtered blocks to the zombie's vertical band as a
      // perf optimisation, but spawn positions where terrain top sits below
      // the filter range produced 0 blocks → zombie freefell through the
      // world. Cost of the unfiltered list is small enough not to be worth
      // the failure mode — keep the full neighbourhood.

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

    // Pairwise inter-zombie separation. Two-phase: accumulate per-zombie
    // pushes into a scratch buffer, then apply with a per-zombie magnitude
    // cap. Horizontal-only (Y untouched) so it can't trigger jumps or fall
    // through floors. The cap is the critical safety: with N pairs touching
    // a single zombie, the raw sum can rocket the zombie ~N×push_factor
    // units in one frame — past the FREEZE_RANGE in seconds, after which
    // the zombie just sits invisible-to-physics far from the player.
    const N = this._zombies.length;
    const MIN = NPCManager.SEPARATION_DIST;
    const MIN_SQ = NPCManager.SEPARATION_DIST_SQ;
    const F = NPCManager.SEPARATION_PUSH_FACTOR;
    const MAX_STEP = NPCManager.SEPARATION_MAX_STEP;

    if (!this._sepDx || this._sepDx.length < N) {
      this._sepDx = new Float32Array(N * 2);
      this._sepDz = new Float32Array(N * 2);
    } else {
      this._sepDx.fill(0, 0, N);
      this._sepDz.fill(0, 0, N);
    }

    for (let i = 0; i < N; i++) {
      const a = this._zombies[i];
      for (let j = i + 1; j < N; j++) {
        const b = this._zombies[j];
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq >= MIN_SQ || dSq < 1e-6) continue;
        const dist = Math.sqrt(dSq);
        const push = (MIN - dist) * F;
        const nx = (dx / dist) * push;
        const nz = (dz / dist) * push;
        this._sepDx[i] += nx; this._sepDz[i] += nz;
        this._sepDx[j] -= nx; this._sepDz[j] -= nz;
      }
    }

    const MAX_SQ = MAX_STEP * MAX_STEP;
    for (let i = 0; i < N; i++) {
      let dx = this._sepDx[i];
      let dz = this._sepDz[i];
      const magSq = dx * dx + dz * dz;
      if (magSq < 1e-8) continue;
      if (magSq > MAX_SQ) {
        const scale = MAX_STEP / Math.sqrt(magSq);
        dx *= scale; dz *= scale;
      }
      const z = this._zombies[i];
      z.position.x += dx; z.position.z += dz;
      z.boundingBox.position.x += dx; z.boundingBox.position.z += dz;
    }

    // Defensive: a non-finite position (NaN/Inf from anywhere — physics div
    // by zero, degenerate lookAt) makes the InstancedMesh slot render at NaN
    // — Three.js silently skips that instance, looking like the zombie
    // "disappeared". Snap back to the player as a last resort. Cheap O(N)
    // scan, never fires in normal play.
    for (let i = 0; i < N; i++) {
      const z = this._zombies[i];
      const p = z.position;
      if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) continue;
      p.set(player.x, player.y, player.z);
      z.boundingBox.position.set(player.x, player.y + 16 / 16, player.z);
      z.physics.fallVel = -1;
      this._zombieStuckCount[i] = 0;
      this._zombieWanderFrames[i] = 0;
      console.warn('[NPCManager] zombie position went non-finite, snapped to player');
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
