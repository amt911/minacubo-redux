// @ts-check
import * as THREE from 'three';
import * as PM from './ParametrosMundo.js';

/**
 * Shared geometry + material cache for Zombie instances.
 *
 * Each Zombie used to construct 36 fresh `MeshStandardMaterial` instances and
 * 4 unique `BoxGeometry` per spawn. At 25 zombies that meant 900 materials
 * (each with its own PBR shader uniforms + texture references) and 100
 * geometry buffers — most of the cost duplicated for identical assets.
 *
 * Switching to `MeshLambertMaterial` also drops the per-pixel PBR cost (PBR
 * was unnecessary for the cartoon block aesthetic — the Player already uses
 * Lambert and looks consistent).
 */

/** @type {null | {geo: Record<string, THREE.BoxGeometry>, mat: Record<string, THREE.Material | THREE.Material[]>}} */
let _cache = null;

export function getZombieAssets() {
  if (_cache) return _cache;

  const loader = new THREE.TextureLoader();
  const M = (path) => new THREE.MeshLambertMaterial({ map: loader.load(path) });
  const P = PM.PIXELES_ESTANDAR;

  _cache = {
    geo: {
      cabeza: new THREE.BoxGeometry(8 / P, 8 / P, 8 / P),
      extremidad: new THREE.BoxGeometry(4 / P, 12 / P, 4 / P),
      torso: new THREE.BoxGeometry(8 / P, 12 / P, 4 / P),
      boundingBox: new THREE.BoxGeometry(8 / P, 32 / P, 8 / P),
    },
    mat: {
      cabeza: [
        M('./texturas/zombie/cabezaxpos.png'),
        M('./texturas/zombie/cabezaxneg.png'),
        M('./texturas/zombie/cabezaypos.png'),
        M('./texturas/zombie/cabezayneg.png'),
        M('./texturas/zombie/cabezazpos.png'),
        M('./texturas/zombie/cabezazneg.png'),
      ],
      brazoR: [
        M('./texturas/zombie/brazoxpos.png'),
        M('./texturas/zombie/brazoxneg.png'),
        M('./texturas/zombie/brazoypos.png'),
        M('./texturas/zombie/brazoyneg.png'),
        M('./texturas/zombie/brazozpos.png'),
        M('./texturas/zombie/brazozneg.png'),
      ],
      brazoL: [
        M('./texturas/zombie/brazoxneg.png'),
        M('./texturas/zombie/brazoxpos.png'),
        M('./texturas/zombie/brazoypos.png'),
        M('./texturas/zombie/brazoyneg.png'),
        M('./texturas/zombie/brazozposL.png'),
        M('./texturas/zombie/brazoznegL.png'),
      ],
      piernaR: [
        M('./texturas/zombie/piernaxpos.png'),
        M('./texturas/zombie/piernaxneg.png'),
        M('./texturas/zombie/piernaypos.png'),
        M('./texturas/zombie/piernayneg.png'),
        M('./texturas/zombie/piernazposR.png'),
        M('./texturas/zombie/piernazneg.png'),
      ],
      piernaL: [
        M('./texturas/zombie/piernaxneg.png'),
        M('./texturas/zombie/piernaxpos.png'),
        M('./texturas/zombie/piernaypos.png'),
        M('./texturas/zombie/piernayneg.png'),
        M('./texturas/zombie/piernazpos.png'),
        M('./texturas/zombie/piernazneg.png'),
      ],
      cuerpo: [
        M('./texturas/zombie/cuerpoxpos.png'),
        M('./texturas/zombie/cuerpoxneg.png'),
        M('./texturas/zombie/cuerpoypos.png'),
        M('./texturas/zombie/cuerpoyneg.png'),
        M('./texturas/zombie/cuerpozpos.png'),
        M('./texturas/zombie/cuerpozneg.png'),
      ],
      boundingBox: new THREE.MeshBasicMaterial(),
    },
  };
  return _cache;
}
