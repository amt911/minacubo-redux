import * as PM from './ParametrosMundo.js'

class ArbolRoble {
  constructor() {
    var altura = Math.random() + 4;

    var altura = Math.floor(Math.random() * 2) + 4;
    //console.log(altura);

    this.bloquesmadera = [];
    this.bloqueshojas = [];


    for (var i = 0; i < altura; i++) {
      let coords = { x: 0, y: 8 / PM.PIXELES_ESTANDAR + i, z: 0 };
      this.bloquesmadera.push(coords);
    }


    //let meshhojas = new THREE.InstancedMesh(hoja.geometria, hoja.material, 35);
    for (var i = -1; i <= 1; i++) {
      for (var j = -1; j <= 1; j++) {
        for (var k = 2; k < altura + 1; k++) {
          if (i != 0 || j != 0 || k > altura - 1) {
            let coords = { x: i, y: 8 / PM.PIXELES_ESTANDAR + k, z: j };
            this.bloqueshojas.push(coords);
          }
        }
      }
    }
  }


}


export { ArbolRoble };