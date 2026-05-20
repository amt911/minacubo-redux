// @ts-check

/**
 * @typedef {{x: number, y: number, z: number}} Vec3
 * @typedef {{min: Vec3, max: Vec3}} AABB
 */

// Espesor de la "sonda" para detectar suelo justo debajo de los pies. No
// es un EPS de snap: snap se hace a la cara exacta (sin offset) para que
// un hueco de exactamente la altura del jugador deje pasar al andar y
// bloquee al saltar. La sonda solo sirve para que `onGround` siga true
// cuando el jugador descansa sobre un bloque sin movimiento en Y.
const GROUND_PROBE = 1e-4;

const cloneAABB = (a) => ({
  min: { x: a.min.x, y: a.min.y, z: a.min.z },
  max: { x: a.max.x, y: a.max.y, z: a.max.z },
});

const shiftAABB = (a, axis, amount) => {
  a.min[axis] += amount;
  a.max[axis] += amount;
};

/**
 * Interseccion AABB-AABB ESTRICTA: caras coincidentes NO cuentan como
 * colision. Diferente al `aabbIntersect` general de `aabb.js` (que cuenta
 * tangencia como interseccion). Aqui necesitamos estricta para que el
 * player pueda pasar por debajo de un techo cuya cara inferior esta
 * exactamente al nivel de su cabeza — situacion comun en estructuras de
 * 2 bloques de altura sobre suelo plano (e.g. hojas inferiores de arbol
 * a y=2.5 cuando el player de 2 bloques tiene la cabeza en y=2).
 */
const aabbIntersectStrict = (a, b) =>
  a.min.x < b.max.x && a.max.x > b.min.x &&
  a.min.y < b.max.y && a.max.y > b.min.y &&
  a.min.z < b.max.z && a.max.z > b.min.z;

/**
 * Axis-separated AABB collision resolution against a list of solid block
 * AABBs. The player AABB is moved one axis at a time: any intersection
 * detected after a single-axis move is resolved by snapping back to the
 * face of the offending block on that same axis.
 *
 * The technique is standard for voxel/grid games (Minecraft-style): it
 * sidesteps "tunneling" through corners that swept-AABB has on diagonals,
 * is stable against jitter (no double-correction), and naturally produces
 * sliding along walls when moving diagonally.
 *
 * @param {AABB} currentAABB player AABB at the start of the step
 * @param {Vec3} delta movement intent for the step (post-gravity for y)
 * @param {AABB[]} blocks solid block AABBs nearby (caller filters)
 * @returns {{ aabb: AABB, onGround: boolean, hitWallX: boolean, hitWallZ: boolean, hitCeiling: boolean }}
 */
const MAX_STEP = 0.5;

export function resolveMovement(currentAABB, delta, blocks) {
  const aabb = cloneAABB(currentAABB);
  const sizeX = currentAABB.max.x - currentAABB.min.x;
  const sizeY = currentAABB.max.y - currentAABB.min.y;
  const sizeZ = currentAABB.max.z - currentAABB.min.z;

  // Sub-stepping: si el delta es mayor que medio bloque, lo dividimos en
  // sub-pasos. Sin esto, una caida rapida (delta.y muy negativo) o un
  // ataque diagonal a alta velocidad pueden "tunelar" — el AABB se shiftea
  // tan lejos en un paso que pasa por encima del bloque sin intersectar.
  // 0.5 unidades = medio bloque, garantiza que cualquier bloque entre la
  // posicion previa y la nueva sea detectado.
  const maxAbs = Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z));
  const steps = Math.max(1, Math.ceil(maxAbs / MAX_STEP));
  const dx = delta.x / steps;
  const dy = delta.y / steps;
  const dz = delta.z / steps;

  let hitWallX = false;
  let hitWallZ = false;
  let hitCeiling = false;

  for (let s = 0; s < steps; s++) {
    // X axis
    if (dx !== 0) {
      shiftAABB(aabb, 'x', dx);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dx > 0) {
          aabb.max.x = b.min.x;
          aabb.min.x = aabb.max.x - sizeX;
        } else {
          aabb.min.x = b.max.x;
          aabb.max.x = aabb.min.x + sizeX;
        }
        hitWallX = true;
      }
    }

    // Y axis
    if (dy !== 0) {
      shiftAABB(aabb, 'y', dy);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dy < 0) {
          aabb.min.y = b.max.y;
          aabb.max.y = aabb.min.y + sizeY;
        } else {
          aabb.max.y = b.min.y;
          aabb.min.y = aabb.max.y - sizeY;
          hitCeiling = true;
        }
      }
    }

    // Z axis
    if (dz !== 0) {
      shiftAABB(aabb, 'z', dz);
      for (const b of blocks) {
        if (!aabbIntersectStrict(aabb, b)) continue;
        if (dz > 0) {
          aabb.max.z = b.min.z;
          aabb.min.z = aabb.max.z - sizeZ;
        } else {
          aabb.min.z = b.max.z;
          aabb.max.z = aabb.min.z + sizeZ;
        }
        hitWallZ = true;
      }
    }
  }

  // Ground probe: sonda fina justo debajo de los pies. Sin esto, tras
  // aterrizar en una cara exacta (sin EPS), strict intersect ya no detecta
  // contacto con el suelo en frames idle (dy=0 → eje Y omitido). Probar un
  // slab de GROUND_PROBE de alto separa la deteccion de suelo de la del
  // resto de colisiones.
  let onGround = false;
  const probe = {
    min: { x: aabb.min.x, y: aabb.min.y - GROUND_PROBE, z: aabb.min.z },
    max: { x: aabb.max.x, y: aabb.min.y, z: aabb.max.z },
  };
  for (const b of blocks) {
    if (aabbIntersectStrict(probe, b)) {
      onGround = true;
      break;
    }
  }

  return { aabb, onGround, hitWallX, hitWallZ, hitCeiling };
}

/**
 * Build an AABB from a center point + half-extents.
 *
 * @param {Vec3} center
 * @param {Vec3} halfExtents
 * @returns {AABB}
 */
export function aabbFromCenterSize(center, halfExtents) {
  return {
    min: {
      x: center.x - halfExtents.x,
      y: center.y - halfExtents.y,
      z: center.z - halfExtents.z,
    },
    max: {
      x: center.x + halfExtents.x,
      y: center.y + halfExtents.y,
      z: center.z + halfExtents.z,
    },
  };
}

/**
 * Convert a list of block centers (`{x, y, z}`) to a list of unit-cube
 * AABBs (each block is 1x1x1 centered at the given point). Useful to
 * adapt the legacy `bloques` array into the input expected by
 * `resolveMovement`.
 *
 * @param {Vec3[]} blocks
 * @returns {AABB[]}
 */
export function blockCentersToAABBs(blocks) {
  const HE = { x: 0.5, y: 0.5, z: 0.5 };
  const result = new Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    result[i] = aabbFromCenterSize(blocks[i], HE);
  }
  return result;
}
