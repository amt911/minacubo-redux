import * as THREE from 'three'
import * as PM from './ParametrosMundo.js'

/**
 * Reorder BoxGeometry index buffer so face groups are contiguous, then
 * assign custom groups. Reduces draw calls from 6 (one per face) to the
 * number of entries in faceGroups.
 *
 * @param {THREE.BoxGeometry} geo
 * @param {{faces: number[], materialIndex: number}[]} faceGroups
 *   faces: 0=+x, 1=-x, 2=+y, 3=-y, 4=+z, 5=-z
 */
function consolidateBoxGroups(geo, faceGroups) {
  const src = geo.index.array;
  const newIdx = [];
  const groups = [];
  let offset = 0;
  for (const g of faceGroups) {
    const start = offset;
    for (const f of g.faces) {
      for (let j = 0; j < 6; j++) newIdx.push(src[f * 6 + j]);
      offset += 6;
    }
    groups.push({ start, count: offset - start, materialIndex: g.materialIndex });
  }
  geo.setIndex(newIdx);
  geo.clearGroups();
  for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
}

class Cubo {
  constructor() {
    this.geometria = new THREE.BoxGeometry(16/PM.PIXELES_ESTANDAR, 16/PM.PIXELES_ESTANDAR, 16/PM.PIXELES_ESTANDAR);
    /** @type {THREE.Material | THREE.Material[]} */
    this.material = new THREE.MeshPhongMaterial({color: 0xCF0000});
  }
}

class Hierba extends Cubo {
  constructor() {
    super();
    const loader = new THREE.TextureLoader();
    const ladoTex = loader.load('./texturas/hierba/ladocubo.png');

    // Consolidate: sides (0 draw call) + top (1) + bottom (2) = 3 draw calls vs 6
    consolidateBoxGroups(this.geometria, [
      { faces: [0, 1, 4, 5], materialIndex: 0 },
      { faces: [2],          materialIndex: 1 },
      { faces: [3],          materialIndex: 2 },
    ]);

    this.material = [
      new THREE.MeshPhongMaterial({ map: ladoTex }),
      new THREE.MeshPhongMaterial({ map: loader.load('./texturas/hierba/top.png'), color: 0xa2ff6e }),
      new THREE.MeshPhongMaterial({ map: loader.load('./texturas/hierba/bottom.png') }),
    ];
  }
}

class Tierra extends Cubo {
  constructor() {
    super();
    // All faces same texture — single material = 1 draw call (vs 6)
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/tierra/tierra.png')
    });
  }
}

class MaderaRoble extends Cubo {
  constructor() {
    super();
    const loader = new THREE.TextureLoader();

    // Consolidate: sides (0) + top+bottom (1) = 2 draw calls vs 6
    consolidateBoxGroups(this.geometria, [
      { faces: [0, 1, 4, 5], materialIndex: 0 },
      { faces: [2, 3],       materialIndex: 1 },
    ]);

    this.material = [
      new THREE.MeshPhongMaterial({ map: loader.load('./texturas/maderaroble/maderaroblelado.png') }),
      new THREE.MeshPhongMaterial({ map: loader.load('./texturas/maderaroble/maderarobletop.png') }),
    ];
  }
}

class HojaRoble extends Cubo {
  constructor() {
    super();
    // All faces same texture — single material = 1 draw call (vs 6)
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/hojaroble/hoja.png'),
      alphaTest: 0.5,
      color: 0x345345,
    });
  }
}

class Piedra extends Cubo {
  constructor() {
    super();
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/piedra/piedra.png')
    });
  }
}

class Roca extends Cubo {
  constructor() {
    super();
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/roca/roca.png')
    });
  }
}

class PiedraBase extends Cubo {
  constructor() {
    super();
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/bedrock.png')
    });
  }
}

class PiedraLuminosa extends Cubo {
  constructor() {
    super();
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/glowstone.png')
    });
  }
}

class Cristal extends Cubo {
  constructor() {
    super();
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('./texturas/cristal.png'),
      alphaTest: 0.5,
    });
  }
}

export {Hierba, Tierra, Roca, Piedra, HojaRoble, MaderaRoble, PiedraBase, Cristal, PiedraLuminosa};
