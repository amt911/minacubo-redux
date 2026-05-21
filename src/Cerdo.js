import * as THREE from 'three';
import * as C from './colisiones.js';
import * as PM from './ParametrosMundo.js';
import { NPC } from './NPC.js';


class Pig extends NPC {
  constructor(gui,titleGui) {
    super();
    //this.camara3rdPerson=new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    // GUI panel — created first because other methods reference its variables

    this.createGUI(gui,titleGui);

    this.target=new THREE.Vector3(10, -5, 0);
    this.material = new THREE.MeshPhongMaterial({color: 0x2dc100});
        const textureLoader = new THREE.TextureLoader();

        this.physics=new C.Collisions(true, 0.8);

    //HOCICO

    const texturaHocico = [
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicoxpos.png"),
        }),
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicoxneg.png"),
        }),
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicoypos.png"),
        }),
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicoyneg.png"),
        }),
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicozpos.png"),
        }),
        new THREE.MeshStandardMaterial({
          map: textureLoader.load("./texturas/cerdo/hocicozneg.png"),
        }),
      ];
    var geometriahocico = new THREE.BoxGeometry(4/PM.PIXELES_ESTANDAR, 3/PM.PIXELES_ESTANDAR, 1/PM.PIXELES_ESTANDAR);

    var hocico = new THREE.Mesh(geometriahocico,texturaHocico);

    hocico.position.y=(2.5)/PM.PIXELES_ESTANDAR;
    hocico.position.z=4.5/PM.PIXELES_ESTANDAR;



    const texturaCabeza = [
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezaxpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezaxneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezaypos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezayneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezazpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cabezazneg.png"),
      }),
    ];
    
    //CABEZA CERDO
    var geometriaCabeza = new THREE.BoxGeometry(8/PM.PIXELES_ESTANDAR, 8/PM.PIXELES_ESTANDAR, 8/PM.PIXELES_ESTANDAR);

    var cabeza = new THREE.Mesh(geometriaCabeza,texturaCabeza);

    cabeza.position.y=4/PM.PIXELES_ESTANDAR;

    this.cabezaW1=new THREE.Object3D();
    this.cabezaW1.add(cabeza);
    this.cabezaW1.add(hocico);

    this.cabezaW1.position.y=(2+6)/PM.PIXELES_ESTANDAR;
    this.cabezaW1.position.z=10/PM.PIXELES_ESTANDAR;

    this.add(this.cabezaW1);

    //PATAS
    const texturaPataDerecha = [
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataxpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataxneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataypos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patayneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patazpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patazneg.png"),
      }),
    ];

    const texturaPataIzquierda = [
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataxneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataxpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/pataypos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patayneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patazpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/patazneg.png"),
      }),
    ];

    var geometriaExtremidad = new THREE.BoxGeometry(4/PM.PIXELES_ESTANDAR,6/PM.PIXELES_ESTANDAR,4/PM.PIXELES_ESTANDAR);
    var pataLD = new THREE.Mesh(geometriaExtremidad, texturaPataIzquierda);

    pataLD.position.y = -3/PM.PIXELES_ESTANDAR;
    var pataRD = pataLD.clone();


    pataRD.material = texturaPataDerecha;

    this.pataLeftDel = new THREE.Object3D();
    this.pataLeftDel.add(pataLD);
    this.pataLeftDel.position.y = 6/PM.PIXELES_ESTANDAR;
    this.pataLeftDel.position.x = (2+1)/PM.PIXELES_ESTANDAR;
    this.pataLeftDel.position.z = (2+3)/PM.PIXELES_ESTANDAR;


    this.pataRightDel = new THREE.Object3D();
    this.pataRightDel.add(pataRD);
    this.pataRightDel.position.y = 6/PM.PIXELES_ESTANDAR;
    this.pataRightDel.position.x = (-2-1)/PM.PIXELES_ESTANDAR;
    this.pataRightDel.position.z = (2+3)/PM.PIXELES_ESTANDAR;


    this.add(this.pataLeftDel);
    this.add(this.pataRightDel);


    //Izquierda
    var pataLT=new THREE.Mesh(geometriaExtremidad, texturaPataIzquierda);

    pataLT.position.y=-3/PM.PIXELES_ESTANDAR;
    var pataRT = pataLT.clone();
    pataRT.material = texturaPataDerecha;
    this.pataLeftTras=new THREE.Object3D();
    this.pataRightTras=new THREE.Object3D();

    this.pataLeftTras.add(pataLT);
    this.pataRightTras.add(pataRT);

    this.pataLeftTras.position.set((2+1)/PM.PIXELES_ESTANDAR, 6/PM.PIXELES_ESTANDAR , (-2-3)/PM.PIXELES_ESTANDAR);
    this.pataRightTras.position.set((-2-1)/PM.PIXELES_ESTANDAR, 6/PM.PIXELES_ESTANDAR , (-2-3)/PM.PIXELES_ESTANDAR);
    this.add(this.pataLeftTras);
    this.add(this.pataRightTras);

    const texturaCuerpo = [
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpoxpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpoxneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpoypos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpoyneg.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpozpos.png"),
      }),
      new THREE.MeshStandardMaterial({
        map: textureLoader.load("./texturas/cerdo/cuerpozneg.png"),
      }),
    ];
    //TORSO
    var geometriaTorso=new THREE.BoxGeometry(10/PM.PIXELES_ESTANDAR, 8/PM.PIXELES_ESTANDAR, 16/PM.PIXELES_ESTANDAR);

    var torso=new THREE.Mesh(geometriaTorso, texturaCuerpo);
    torso.position.y = (4+6)/PM.PIXELES_ESTANDAR;

    this.add(torso);



    this._initPhysics(
      new THREE.BoxGeometry(10 / PM.PIXELES_ESTANDAR, 32 / PM.PIXELES_ESTANDAR, 16 / PM.PIXELES_ESTANDAR),
      24 / PM.PIXELES_ESTANDAR,
      45
    );
    this.height=32;
  }

  createGUI (gui,titleGui) {
    // size, orientation, and position controls
    this.guiControls = {
      cabezaX: 0,
      cabezaY: 0,
      pataL: 0,
      pataR: 0,
      giroY: 0,
      brazoL: 0,
      brazoR: 0,

      // reset button

      reset : () => {
        this.guiControls.cabezaX=0;
        this.guiControls.cabezaY=0;
        this.guiControls.pataL=0;
        this.guiControls.pataR=0;
        this.guiControls.giroY=0;
        this.guiControls.brazoL=0;
        this.guiControls.brazoR=0;
      }
    }

    // controls section
    var folder = gui.addFolder (titleGui);
    // GUI sliders


    folder.add (this.guiControls, 'cabezaY', -Math.PI/2, Math.PI/2, 0.1).name ('Cabeza Y : ').listen();
    folder.add (this.guiControls, 'cabezaX', -Math.PI/2, Math.PI/2, 0.1).name ('Cabeza X : ').listen();

    folder.add (this.guiControls, 'pataL', -Math.PI/2, Math.PI/2, 0.1).name ('pata L : ').listen();
    folder.add (this.guiControls, 'pataR', -Math.PI/2, Math.PI/2, 0.1).name ('pata R : ').listen();

    folder.add (this.guiControls, 'brazoL', -Math.PI/2, Math.PI/2, 0.1).name ('Brazo L : ').listen();
    folder.add (this.guiControls, 'brazoR', -Math.PI/2, Math.PI/2, 0.1).name ('Brazo R : ').listen();

    folder.add (this.guiControls, 'giroY', -Math.PI/2, Math.PI/2, 0.1).name ('Giro cerdo: ').listen();

    folder.add (this.guiControls, 'reset').name ('[ Reset ]');
  }

  animacion(isForward, speed){
    const finalSpeed=(isForward)? speed : -speed;

    if (this.cambiarAnimacion) {
      this.pataLeftDel.rotation.x += finalSpeed
      this.pataRightDel.rotation.x -= finalSpeed
      this.pataLeftTras.rotation.x -= finalSpeed
      this.pataRightTras.rotation.x += finalSpeed

      if ((isForward && this.pataRightDel.rotation.x <= -this.maxMovimientoExt) || (!isForward && this.pataRightDel.rotation.x >= this.maxMovimientoExt)) {
        this.cambiarAnimacion = false;
      }
    }
    else {
      this.pataLeftDel.rotation.x += -finalSpeed
      this.pataRightDel.rotation.x -= -finalSpeed
      this.pataLeftTras.rotation.x -= -finalSpeed
      this.pataRightTras.rotation.x += -finalSpeed

      if ((isForward && this.pataRightDel.rotation.x >= this.maxMovimientoExt) || (!isForward && this.pataRightDel.rotation.x <= -this.maxMovimientoExt)) {
        this.cambiarAnimacion = true;
      }
    }
  }

  update(bloques, delta) {
    this._stepPhysics(bloques, delta);
  }
}

export { Pig };
export { Pig as Cerdo };
