import * as THREE from '../libs/three.module.js'
import * as PM from './ParametrosMundo.js'
import * as C from './colisiones.js'

//IMPORTANTE: LA CAMARA SE CENTRA EN LA CABEZA Y PIVOTA ALREDEDOR DE LA MISMA
class Esteban extends THREE.Object3D {
  degToRad(deg) {
    return deg * (Math.PI / 180)
  }

  radToDeg(rad) {
    return rad * (180 / Math.PI);
  }
  constructor(gui, titleGui) {
    super();

    this.clock = new THREE.Clock();

    this.cambiarAnimacion = false;
    this.maxMovimientoExt = this.degToRad(60);

    // Se crea la parte de la interfaz que corresponde a la caja
    // Se crea primero porque otros métodos usan las letiables que se definen para la interfaz
    this.createGUI(gui, titleGui);

    const textureLoader = new THREE.TextureLoader();
    const texturaCabeza = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezayneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezazpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cabezazneg.png"),
      }),
    ];

    //CABEZA
    let geometriaCabeza = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR);

    let cabeza = new THREE.Mesh(geometriaCabeza, texturaCabeza);

    cabeza.position.y = 4 / PM.PIXELES_ESTANDAR;

    this.cabezaW1 = new THREE.Object3D();
    this.cabezaW1.add(cabeza);

    this.cabezaW1.position.y = 24 / PM.PIXELES_ESTANDAR;

    //this.add(this.cabezaW1);

    //BRAZOS Y PIERNAS

    const texturabrazoR = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoyneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazozpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazozneg.png"),
      }),
    ];


    const texturabrazoL = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoyneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazozposR.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/brazoznegR.png"),
      }),

    ];

    let geometriaExtremidad = new THREE.BoxGeometry(4 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 4 / PM.PIXELES_ESTANDAR);
    let brazoL = new THREE.Mesh(geometriaExtremidad, texturabrazoL);

    //brazo izquierdo
    brazoL.position.y = -4 / PM.PIXELES_ESTANDAR;
    let brazoR = brazoL.clone();
    brazoR.material = texturabrazoR;
    this.brazoLeft = new THREE.Object3D();
    this.brazoLeft.add(brazoL);
    this.brazoLeft.position.y = 22 / PM.PIXELES_ESTANDAR;

    this.brazoLeftW1 = new THREE.Object3D();
    this.brazoLeftW1.position.x = +6 / PM.PIXELES_ESTANDAR;
    this.brazoLeftW1.add(this.brazoLeft);

    this.brazoRight = new THREE.Object3D();
    this.brazoRight.add(brazoR);
    this.brazoRight.position.y = 22 / PM.PIXELES_ESTANDAR;

    this.brazoRightW1 = new THREE.Object3D();
    this.brazoRightW1.position.x = -6 / PM.PIXELES_ESTANDAR;
    this.brazoRightW1.add(this.brazoRight);

    //Piernas

    const texturaPiernaR = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernayneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernazpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernazneg.png"),
      }),
    ];

    const texturaPiernaL = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernaypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernayneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernazpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/piernazneg.png"),
      }),
    ];
    //Izquierda
    let piernaL = new THREE.Mesh(geometriaExtremidad, texturaPiernaL);
    let piernaR = new THREE.Mesh(geometriaExtremidad, texturaPiernaR);

    piernaL.position.y = -6 / PM.PIXELES_ESTANDAR;
    piernaR.position.y = -6 / PM.PIXELES_ESTANDAR;

    this.piernaLW1 = new THREE.Object3D();
    this.piernaRW1 = new THREE.Object3D();

    this.piernaLW1.add(piernaL);
    this.piernaRW1.add(piernaR);

    this.piernaLW1.position.set(2 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 0);
    this.piernaRW1.position.set(-2 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 0);

    const texturaCuerpo = [
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoxpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoxneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoypos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoyneg.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpozpos.png"),
      }),
      new THREE.MeshPhongMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpozneg.png"),
      }),
    ];
    //TORSO
    let geometriaTorso = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 4 / PM.PIXELES_ESTANDAR);

    let torso = new THREE.Mesh(geometriaTorso, texturaCuerpo);
    torso.position.y = 18 / PM.PIXELES_ESTANDAR;

    //ESTO ES NECESARIO PARA QUE FUNCIONE LA ANIMACION DE STRAFE
    this.wrapperFinal = new THREE.Object3D();

    this.wrapperFinal.add(this.cabezaW1)
    this.wrapperFinal.add(this.brazoLeftW1)
    this.wrapperFinal.add(this.brazoRightW1)
    this.wrapperFinal.add(this.piernaLW1)
    this.wrapperFinal.add(this.piernaRW1)
    this.wrapperFinal.add(torso)

    this.add(this.wrapperFinal);

    let boundingBoxGeom = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 32 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR);
    this.boundingBox = new THREE.Mesh(boundingBoxGeom, new THREE.MeshPhongMaterial());
    this.boundingBox.position.y += 16 / PM.PIXELES_ESTANDAR

    this.position.y += 10;

    this.colisiones=new C.Colisiones(false, 0.8);
    this.puedeSaltar=true;
    this.altura=32;
  }

  addCamara(camara) {
    this.cameraControls = camara;
  }

  createGUI(gui, titleGui) {

  }

  resetPosicion() {
    this.piernaLW1.rotation.x = 0;
    this.piernaRW1.rotation.x = 0;
    this.brazoLeft.rotation.x = 0;
    this.brazoRight.rotation.x = 0;
    this.wrapperFinal.rotation.y = 0;
  }


  animacion(esForward, velocidad){
    let velFinal=(esForward)? velocidad : -velocidad;

    if (this.cambiarAnimacion) {
      this.piernaLW1.rotation.x += velFinal
      this.piernaRW1.rotation.x -= velFinal
      this.brazoLeft.rotation.x -= velFinal
      this.brazoRight.rotation.x += velFinal

      if ((esForward && this.piernaRW1.rotation.x <= -this.maxMovimientoExt) || (!esForward && this.piernaRW1.rotation.x >= this.maxMovimientoExt)) {
        this.cambiarAnimacion = false;
      }
    }
    else {
      this.piernaLW1.rotation.x += -velFinal
      this.piernaRW1.rotation.x -= -velFinal
      this.brazoLeft.rotation.x -= -velFinal
      this.brazoRight.rotation.x += -velFinal

      if ((esForward && this.piernaRW1.rotation.x >= this.maxMovimientoExt) || (!esForward && this.piernaRW1.rotation.x <= -this.maxMovimientoExt)) {
        this.cambiarAnimacion = true;
      }
    }
  }

  update(bloques, teclasPulsadas) {
    let delta= this.clock.getDelta();
    let velocidad = delta * 4.317;
    this.cabezaW1.rotation.x = Math.PI / 2 - this.cameraControls.getPolarAngle();
    this.rotation.y = - Math.PI + this.cameraControls.getAzimuthalAngle();
    this.boundingBox.rotation.y = - Math.PI + this.cameraControls.getAzimuthalAngle();


    let vectorDir=new THREE.Vector3(0, 0, 0);

    let moviendose=false;
    let esForward=true;
    
    if(teclasPulsadas.W){
      vectorDir.z+=1;
      moviendose = true;
    }
    if(teclasPulsadas.S){
      vectorDir.z-=1;
      moviendose = true;
      esForward=false;
    }
    if(teclasPulsadas.A){
      vectorDir.x+=1;
      moviendose = true;
    }
    if(teclasPulsadas.D){
      vectorDir.x-=1;
      moviendose = true;
    }

    if((teclasPulsadas.A && teclasPulsadas.W) || (teclasPulsadas.D && teclasPulsadas.S)){
      if (this.wrapperFinal.rotation.y < this.degToRad(45)) {
        this.wrapperFinal.rotation.y += 8*delta;
      }      
    }
    else if((teclasPulsadas.A && teclasPulsadas.S) || (teclasPulsadas.D && teclasPulsadas.W)){
      if (this.wrapperFinal.rotation.y > this.degToRad(-45)) {
        this.wrapperFinal.rotation.y -= 8*delta;
      }            
    }
    else if(teclasPulsadas.A){
      if (this.wrapperFinal.rotation.y < this.degToRad(45)) {
        this.wrapperFinal.rotation.y += 8*delta;
      }      
    }
    else if(teclasPulsadas.D){
      if (this.wrapperFinal.rotation.y > this.degToRad(-45)) {
        this.wrapperFinal.rotation.y -= 8*delta;
      }
    }
    else if(teclasPulsadas.W){
      this.wrapperFinal.rotation.y = 0;
    }
    else if(teclasPulsadas.S){
      if (this.wrapperFinal.rotation.y < 0) {
        this.wrapperFinal.rotation.y += 8*delta;

        if (this.wrapperFinal.rotation.y > 0)
          this.wrapperFinal.rotation.y = 0;
      }
      else if (this.wrapperFinal.rotation.y > 0) {
        this.wrapperFinal.rotation.y -= 8*delta;

        if (this.wrapperFinal.rotation.y < 0)
          this.wrapperFinal.rotation.y = 0;
      }
    }

    let velocidadFinal=(teclasPulsadas["SHIFT"])? velocidad*2 : velocidad;

    this.translateOnAxis(vectorDir.normalize(), velocidadFinal);

    this.boundingBox.translateOnAxis(vectorDir, velocidadFinal);
    
    if(moviendose)
      this.animacion(esForward, velocidadFinal);
    
    this.colisiones.update(bloques, this, this.boundingBox, teclasPulsadas, vectorDir, velocidad);
  }
}

export { Esteban };
