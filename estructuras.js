// @ts-check
import * as PM from './ParametrosMundo.js';

class ArbolRoble {
  constructor() {
    const altura = Math.floor(Math.random() * 2) + 4;

    this.bloquesmadera = [];
    this.bloqueshojas = [];

    for (let i = 0; i < altura; i++) {
      const coords = { x: 0, y: 8 / PM.PIXELES_ESTANDAR + i, z: 0 };
      this.bloquesmadera.push(coords);
    }

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = 2; k < altura + 1; k++) {
          if (i !== 0 || j !== 0 || k > altura - 1) {
            const coords = { x: i, y: 8 / PM.PIXELES_ESTANDAR + k, z: j };
            this.bloqueshojas.push(coords);
          }
        }
      }
    }
  }
}

export { ArbolRoble };
