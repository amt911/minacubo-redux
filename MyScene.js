
// Clases de la biblioteca

import * as THREE from '../libs/three.module.js'
import { GUI } from '../libs/dat.gui.module.js'
import { OrbitControls } from '../libs/OrbitControls.js'
import { Stats } from '../libs/stats.module.js'
import * as TWEEN from "../libs/tween.esm.js"
// Clases de mi proyecto

import { Esteban } from './Esteban.js'
import { Zombie } from './Zombie.js'
import { Cerdo } from './Cerdo.js'

import * as cubos from './Cubo.js'
import * as estructuras from './estructuras.js'

import * as PM from './ParametrosMundo.js'

/// La clase fachada del modelo
/**
 * Usaremos una clase derivada de la clase Scene de Three.js para llelet el control de la escena y de todo lo que ocurre en ella.
 */

function estaColindando(posx, posz, lista){
//detecta si posx, posy esta colindando con alguno de los elementos de la lista
  for(let i = 0; i < lista.length; i++){
    if(Math.abs(posx - lista[i].x) <= 2 && Math.abs(posz - lista[i].z) <= 2){
      return true;
    }
  }  
  return false;
}

function estaEnArbol(posx, posz, lista){
  //detecta si posx, posy esta colindando con alguno de los elementos de la lista
    for(let i = 0; i < lista.length; i++){
      if(posx == lista[i].x && posz == lista[i].z){
        return true;
      }
    }  
    return false;
  }
class MyScene extends THREE.Scene {
  constructor(myCanvas) {
    super();

    this.clock=new THREE.Clock();

    this.tiempoCerdo = 200;

    //this.fog= new THREE.Fog(0xffffff, 0.1, 100);
    this.movt = "parado";
    this.mapTeclas = {
      "W": false,
      "A": false,
      "D": false,
      "S": false,
      " ": false,
      "SHIFT": false
    };

    this.myCanvasName = myCanvas;
    // Lo primero, crear el visualizador, pasándole el lienzo sobre el que realizar los renderizados.
    this.renderer = this.createRenderer(myCanvas);

    // Se añade a la gui los controles para manipular los elementos de esta clase
    this.gui = this.createGUI();

    this.initStats();

    // Construimos los distinos elementos que tendremos en la escena

    // Todo elemento que se desee sea tenido en cuenta en el renderizado de la escena debe pertenecer a esta. Bien como hijo de la escena (this en esta clase) o como hijo de un elemento que ya esté en la escena.
    // Tras crear cada elemento se añadirá a la escena con   this.add(letiable)
    this.createLights();


    // Y unos ejes. Imprescindibles para orientarnos sobre dónde están las cosas
    this.axis = new THREE.AxesHelper(55);
    this.add(this.axis);
    this.poscerdo = 0;

    // Por último creamos el modelo.
    // El modelo puede incluir su parte de la interfaz gráfica de usuario. Le pasamos la referencia a
    // la gui y el texto bajo el que se agruparán los controles de la interfaz que añada el modelo.
    this.model = new Esteban(this.gui, "Esteban");
    this.createCamera();


    this.add(this.model);

    this.zombie = new Zombie(this.gui, "Zombie");

    this.zombie.position.y+=10;
    this.zombie.boundingBox.position.y+=10;

    this.chunkCollision = [];   //Almacena chunks
    this.chunk = [];

    this.TAM_CHUNK = 12;
    this.DISTANCIA_RENDER = 7;
    //this.TAM_CHUNK = 2;
    //this.DISTANCIA_RENDER = 5;    
    this.h = new cubos.Hierba();
    let matrix = new THREE.Matrix4();
    noise.seed(Math.random());
    this.amplitud = 1 + (Math.random() * 45);
    let inc = 0.02;
    let xoff = 0;
    let zoff = 0;


    //this.puntoscerdos = [[]];
this.puntoscerdos = [];
    


    this.p = new cubos.Piedra();
    this.t = new cubos.Tierra();

    this.model.position.x = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2
    this.model.position.z = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2
    this.model.boundingBox.position.x = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.boundingBox.position.z = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.boundingBox.position.y = this.model.position.y + 16 / PM.PIXELES_ESTANDAR;
    this.objeto = 0;
    this.bloqueSeleccionado = [
      "Hierba",
      "Tierra",
      "Roca",
      "Piedra",
      "MaderaRoble",
      "PiedraBase",
      "Cristal",
      "PiedraLuminosa",
      "HojasRoble"];

    this.materialesText = {
      "Hierba": new cubos.Hierba().material,
      "Tierra": new cubos.Tierra().material,
      "Roca": new cubos.Roca().material,
      "Piedra": new cubos.Piedra().material,
      "MaderaRoble": new cubos.MaderaRoble().material,
      "PiedraBase": new cubos.PiedraBase().material,
      "Cristal": new cubos.Cristal().material,
      "PiedraLuminosa": new cubos.PiedraLuminosa().material,
      "HojasRoble": new cubos.HojaRoble().material
    }

    this.sizeIMesh = {
      "Hierba": 5 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER,
      "Tierra": 5 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER,
      "Roca": 0,
      "Piedra": 5 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER,
      "MaderaRoble": 1 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER,
      "PiedraBase": 1 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER,
      "Cristal": 1,
      "PiedraLuminosa": 1,
      "HojasRoble": 1 * this.TAM_CHUNK * this.TAM_CHUNK * this.DISTANCIA_RENDER * this.DISTANCIA_RENDER
    }

    this.mesh = {
      "Hierba": new THREE.InstancedMesh(this.h.geometria, this.materialesText["Hierba"], this.sizeIMesh["Hierba"]),
      "Tierra": new THREE.InstancedMesh(this.t.geometria, this.materialesText["Tierra"], this.sizeIMesh["Tierra"]),
      "Roca": new THREE.InstancedMesh(this.p.geometria, this.materialesText["Roca"], this.sizeIMesh["Roca"]),
      "Piedra": new THREE.InstancedMesh(this.p.geometria, this.materialesText["Piedra"], this.sizeIMesh["Piedra"]),
      "MaderaRoble": new THREE.InstancedMesh(this.h.geometria, this.materialesText["MaderaRoble"], this.sizeIMesh["MaderaRoble"]),
      "PiedraBase": new THREE.InstancedMesh(this.p.geometria, this.materialesText["PiedraBase"], this.sizeIMesh["PiedraBase"]),
      "Cristal": new THREE.InstancedMesh(this.p.geometria, this.materialesText["Cristal"], this.sizeIMesh["Cristal"]),
      "PiedraLuminosa": new THREE.InstancedMesh(this.p.geometria, this.materialesText["PiedraLuminosa"], this.sizeIMesh["PiedraLuminosa"]),
      "HojasRoble": new THREE.InstancedMesh(this.h.geometria, this.materialesText["HojasRoble"], this.sizeIMesh["HojasRoble"])
    }

    let k = 0;

    let contador = 0;
    let contador2 = 0;
    let contador3 = 0;
    let contador4 = 0;
    let zombiex = 0;
    let zombiey = 0;
    let zombiez = 0;  
    for (let i = 0; i < this.DISTANCIA_RENDER; i++) {   //PLANO XZ DE CHUNKS
      for (let j = 0; j < this.DISTANCIA_RENDER; j++) {
        let bloques = [];
        var n_arboles = Math.floor(Math.random() * this.TAM_CHUNK/5)+1;
        var n_puntoscerdo = Math.floor(Math.random() * this.TAM_CHUNK/4)+2;
        var list_arboles = [];

        for (let m = 0; m < n_arboles; m++) {
          let posx =  Math.floor(Math.random()* this.TAM_CHUNK);
          let posz = Math.floor(Math.random() * this.TAM_CHUNK);
          while(estaColindando(posx,posz,list_arboles)){
           posx =  Math.floor(Math.random()* this.TAM_CHUNK);
           posz = Math.floor(Math.random() * this.TAM_CHUNK);
          }
          list_arboles.push({ x: posx, y: 10, z: posz });
        }

        if(i == 0 && j == 0){
          zombiex = Math.floor(Math.random() * this.TAM_CHUNK);
          zombiez = Math.floor(Math.random()* this.TAM_CHUNK);
          //Añadir n coordenadas x,y,z random a puntoscerdos
          for(let m = 0; m < n_puntoscerdo; m++){
            let posx =  Math.floor(Math.random()* this.TAM_CHUNK);
            let posz = Math.floor(Math.random() * this.TAM_CHUNK);
            while(estaEnArbol(posx,posz,list_arboles)){
             posx =  Math.floor(Math.random()* this.TAM_CHUNK);
             posz = Math.floor(Math.random() * this.TAM_CHUNK);
            }
            this.puntoscerdos.push({ x: posx, y: 10, z: posz });
          }        
  
        }


        for (let x = i * this.TAM_CHUNK; x < (i * this.TAM_CHUNK) + this.TAM_CHUNK; x++) {   //PARA GENERAR LOS BLOQUES DE UN CHUNK
          for (let z = j * this.TAM_CHUNK; z < (j * this.TAM_CHUNK) + this.TAM_CHUNK; z++) {
            xoff = inc * x;
            zoff = inc * z;

            let v = Math.round(noise.perlin2(xoff, zoff) * this.amplitud);
            if(i == 0 && j == 0){
              if(zombiex + i*this.TAM_CHUNK == x && zombiez + j*this.TAM_CHUNK == z){
                zombiey = v;
              }
              }
            matrix.setPosition(x * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR, z * 16 / PM.PIXELES_ESTANDAR);
            this.mesh["Hierba"].setMatrixAt(k, matrix);


            bloques.push({ x: x * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR, z: z * 16 / PM.PIXELES_ESTANDAR, material: "Hierba" });
            k++;
            for (let indice_arbol = 0; indice_arbol < list_arboles.length; indice_arbol++) {
              if (list_arboles[indice_arbol].x + i * this.TAM_CHUNK == x && list_arboles[indice_arbol].z + j * this.TAM_CHUNK == z) {
                list_arboles[indice_arbol].y = v + 0.5;
                list_arboles[indice_arbol].x = list_arboles[indice_arbol].x + i * this.TAM_CHUNK;
                list_arboles[indice_arbol].z = list_arboles[indice_arbol].z + j * this.TAM_CHUNK;
              }
            }
            //si algun punto de puntoscerdo coincide con x y z, entonces asigno v a y
            for (let indice_puntoscerdo = 0; indice_puntoscerdo < this.puntoscerdos.length; indice_puntoscerdo++) {
              if (this.puntoscerdos[indice_puntoscerdo].x + i * this.TAM_CHUNK == x && this.puntoscerdos[indice_puntoscerdo].z + j * this.TAM_CHUNK == z) {
                this.puntoscerdos[indice_puntoscerdo].y = v;
                this.puntoscerdos[indice_puntoscerdo].x = this.puntoscerdos[indice_puntoscerdo].x + i * this.TAM_CHUNK;
                this.puntoscerdos[indice_puntoscerdo].z = this.puntoscerdos[indice_puntoscerdo].z + j * this.TAM_CHUNK;
              }
            }

            for (let s = 0; s < 3; s++) {
              matrix.setPosition(x * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR - s - 1, z * 16 / PM.PIXELES_ESTANDAR);
              this.mesh["Tierra"].setMatrixAt(contador, matrix);


              bloques.push({ x: x * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR - s - 1, z: z * 16 / PM.PIXELES_ESTANDAR, material: "Tierra" });
              contador++;
            }
            /* */
            for (let r = 3; r < 8; r++) {
              matrix.setPosition(x * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR - r - 1, z * 16 / PM.PIXELES_ESTANDAR);
              this.mesh["Piedra"].setMatrixAt(contador2, matrix);


              bloques.push({ x: x * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR - r - 1, z: z * 16 / PM.PIXELES_ESTANDAR, material: "Piedra" });
              contador2++;
            }
          }
        }
        for (let indice_arbol = 0; indice_arbol < list_arboles.length; indice_arbol++) {
          let arbol = new estructuras.ArbolRoble();

          for (let r = 0; r < arbol.bloqueshojas.length; r++) {
            matrix.setPosition(list_arboles[indice_arbol].x + arbol.bloqueshojas[r].x, list_arboles[indice_arbol].y + arbol.bloqueshojas[r].y - 0.5, list_arboles[indice_arbol].z + arbol.bloqueshojas[r].z);
            this.mesh["HojasRoble"].setMatrixAt(contador3, matrix);
            bloques.push({ x: list_arboles[indice_arbol].x + arbol.bloqueshojas[r].x, y: list_arboles[indice_arbol].y + arbol.bloqueshojas[r].y -0.5, z: list_arboles[indice_arbol].z  + arbol.bloqueshojas[r].z, material: "HojasRoble" });
            contador3++;
          }

          for (let r = 0; r < arbol.bloquesmadera.length; r++) {
            matrix.setPosition(list_arboles[indice_arbol].x + arbol.bloquesmadera[r].x, list_arboles[indice_arbol].y + arbol.bloquesmadera[r].y -0.5, list_arboles[indice_arbol].z + arbol.bloquesmadera[r].z);
            this.mesh["MaderaRoble"].setMatrixAt(contador4, matrix);
            bloques.push({ x: list_arboles[indice_arbol].x + arbol.bloquesmadera[r].x, y: list_arboles[indice_arbol].y + arbol.bloquesmadera[r].y -0.5, z: list_arboles[indice_arbol].z + arbol.bloquesmadera[r].z, material: "MaderaRoble" });
            contador4++;
          }
        }
        this.chunkCollision.push(bloques);
        let chunkIndex = this.identificarChunk(bloques[0].x, bloques[0].z);

        if (this.chunk[chunkIndex.x] == undefined)
          this.chunk[chunkIndex.x] = [];

        this.chunk[chunkIndex.x][chunkIndex.z] = bloques;
      }
    }

    for (let aux in this.mesh) {
      this.add(this.mesh[aux]);
    }

    this.chunkMinMax = {
      min: { x: 0, z: 0 },
      max: { x: this.DISTANCIA_RENDER - 1, z: this.DISTANCIA_RENDER - 1 }
    };

    this.zombie.position.set(this.zombie.position.x+zombiex, this.zombie.position.y+zombiey+0.1, this.zombie.position.z+zombiez);
    this.zombie.boundingBox.position.set(this.zombie.boundingBox.position.x+zombiex, this.zombie.boundingBox.position.y+zombiey+0.1, this.zombie.boundingBox.position.z+zombiez);    
    this.add(this.zombie);


    //Creacion del cerdo
    this.cerdo = new Cerdo(this.gui, "Cerdo");
    this.cerdo.position.set(this.cerdo.position.x+this.puntoscerdos[0].x, this.cerdo.position.y + this.puntoscerdos[0].y+0.1, this.cerdo.position.z + this.puntoscerdos[0].z);
    this.cerdo.boundingBox.position.set(this.cerdo.boundingBox.position.x+this.puntoscerdos[0].x,this.cerdo.boundingBox.position.y+ this.puntoscerdos[0].y+0.1, this.cerdo.boundingBox.position.z + this.puntoscerdos[0].z);
    this.add(this.cerdo);

    //Creacion del feedback
    let cajaSeleccionada = new THREE.BoxGeometry(1, 1, 1);
    this.cajaSeleccionada = new THREE.Mesh(cajaSeleccionada);

    this.add(this.cajaSeleccionada);

    this.cajaSeleccionada.material.wireframe = true;
    this.cajaSeleccionada.material.wireframeLinewidth = 3;
    this.cajaSeleccionada.material.color.set(0x333333);
    this.cajaSeleccionada.visible = false;

    //Creacion del fog, el cielo y su animacion
    this.fog= new THREE.Fog(0x87CEEB, this.TAM_CHUNK*(this.DISTANCIA_RENDER/2)-4, this.TAM_CHUNK*(this.DISTANCIA_RENDER/2));
    this.background= new THREE.Color(0x87CEEB);

    let colorInicial=new THREE.Color(0x87CEEB);
    let colorFinal=new THREE.Color(0x000000);

    let rgbInicial={r: colorInicial.r, g: colorInicial.g, b: colorInicial.b, intensidad: 1}
    let rgbFinal={r: colorFinal.r, g: colorFinal.g, b: colorFinal.b, intensidad: 0};

    this.anim=new TWEEN.Tween(rgbInicial).to(rgbFinal,60000);
    this.anim.onUpdate(()=>{
      this.fog.color.r=rgbInicial.r;
      this.fog.color.g=rgbInicial.g;
      this.fog.color.b=rgbInicial.b;

      this.background=new THREE.Color(rgbInicial.r,rgbInicial.g,rgbInicial.b);

      this.spotLight.intensity=rgbInicial.intensidad;

    }).yoyo(true).repeat(Infinity).start();
  }

  identificarChunk(x, z) {
    let res = {
      x: Math.round((x - (x % this.TAM_CHUNK)) / this.TAM_CHUNK),
      z: Math.round((z - (z % this.TAM_CHUNK)) / this.TAM_CHUNK)
    }

    return res;
  }


  initStats() {

    let stats = new Stats();

    stats.setMode(0); // 0: fps, 1: ms

    // Align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';

    $("#Stats-output").append(stats.domElement);

    this.stats = stats;
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(this.model.position.x, this.model.position.y + 10, this.model.position.z - 10);

    this.vector = new THREE.Vector3();
    this.cameraControl = new OrbitControls(this.camera, this.renderer.domElement);
    this.cameraControl.target.set(this.model.position.x, this.model.position.y, this.model.position.z)
    this.cameraControl.enablePan = false;
    this.cameraControl.enableZoom = false;
    this.cameraControl.rotateSpeed = 5;
    this.cameraControl.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    }

    this.model.addCamara(this.cameraControl);
  }

  createGUI() {
    let gui = new GUI();

    this.guiControls = {
      // En el contexto de una función   this   alude a la función
      axisOnOff: true,
      activarWireframe: false
    }

    let folder = gui.addFolder('Ayudas');


    folder.add(this.guiControls, 'axisOnOff')
      .name('Mostrar ejes : ')
      .onChange((value) => this.setAxisVisible(value));

    folder.add(this.guiControls, 'activarWireframe')
      .name('Mostrar feedback (mejora los FPS si se desactiva): ');

    return gui;
  }

  createLights() {
    let ambientLight = new THREE.AmbientLight(0xccddee, 0.35);
    this.add(ambientLight);

    this.spotLight = new THREE.HemisphereLight(0xfdfbd3, 0xfdfbd3, this.guiControls.lightIntensity)
    this.spotLight.position.set(0, 60, 0);
    this.add(this.spotLight);
  }

  setLightIntensity(valor) {
    this.spotLight.intensity = valor;
  }

  setAxisVisible(valor) {
    this.axis.visible = valor;
  }

  createRenderer(myCanvas) {
    // Se recibe el lienzo sobre el que se van a hacer los renderizados. Un div definido en el html.

    // Se instancia un Renderer   WebGL
    let renderer = new THREE.WebGLRenderer();

    // Se establece un color de fondo en las imágenes que genera el render
    renderer.setClearColor(new THREE.Color(0xEEEEEE), 1.0);

    // Se establece el tamaño, se aprovecha la totalidad de la ventana del navegador
    renderer.setSize(window.innerWidth, window.innerHeight);

    // La visualización se muestra en el lienzo recibido
    $(myCanvas).append(renderer.domElement);

    return renderer;
  }

  getCamera() {
    // En principio se devuelve la única cámara que tenemos
    // Si hubiera letias cámaras, este método decidiría qué cámara devuelve cada vez que es consultado
    return this.camera;
  }

  setCameraAspect(ratio) {
    // Cada vez que el usuario modifica el tamaño de la ventana desde el gestor de ventanas de
    // su sistema operativo hay que actualizar el ratio de aspecto de la cámara
    this.camera.aspect = ratio;
    // Y si se cambia ese dato hay que actualizar la matriz de proyección de la cámara
    this.camera.updateProjectionMatrix();
  }

  onWindowResize() {
    // Este método es llamado cada vez que el usuario modifica el tamapo de la ventana de la aplicación
    // Hay que actualizar el ratio de aspecto de la cámara
    this.setCameraAspect(window.innerWidth / window.innerHeight);

    // Y también el tamaño del renderizador
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onDocumentMouseDown(event) {

    if (event.which == 3) {
      let mouse = new THREE.Vector2();

      mouse.x = (0.5) * 2 - 1;
      mouse.y = 1 - 2 * (0.5);

      let raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      let objetosIntersecados = [];
      for (let tipo in this.mesh) {
        let objetos = raycaster.intersectObject(this.mesh[tipo], true);

        if (objetos[0] != undefined && objetos.length > 0 && objetos[0].distance <= 20) {
          let index = objetos[0].face.materialIndex;
          let posicion = objetos[0].point;
          let coord = { x: 0, y: 0, z: 0 };

          switch (index) {
            case 0: //derecha (x pos)
              coord = {
                x: posicion.x + 0.5,
                y: (posicion.y | 0) + 0.5,// + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 1: //izquierda (x neg)
              coord = {
                x: posicion.x - 0.5,
                y: (posicion.y | 0) + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 2: //arriba (y pos)
              coord = {
                x: Math.round(posicion.x),
                y: (posicion.y | 0) + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 3: //abajo (y neg)
              coord = {
                x: Math.round(posicion.x),
                y: (posicion.y | 0) - 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 4: //frente (z pos)
              coord = {
                x: Math.round(posicion.x),
                y: (posicion.y | 0) + 0.5,// + 0.5,
                z: posicion.z + 0.5
              }
              break;
            case 5: //detras (z neg)
              coord = {
                x: Math.round(posicion.x),
                y: (posicion.y | 0) + 0.5,
                z: posicion.z - 0.5
              }
              break;
          }
          if (posicion.y < 0) {
            coord.y = Math.floor(posicion.y) + 0.5;
          }

          objetosIntersecados.push({ tipo: tipo, coordenada: coord, distancia: objetos[0].distance });

        }

      }

      //ordena objetos intersecados segun distancia
      objetosIntersecados.sort(function (a, b) {
        return a.distancia - b.distancia;
      });


      if(objetosIntersecados[0]!=undefined){  
        let aux = this.identificarChunk(objetosIntersecados[0].coordenada.x, objetosIntersecados[0].coordenada.z);
        this.chunk[aux.x][aux.z].push({ material: this.bloqueSeleccionado[this.objeto], x: objetosIntersecados[0].coordenada.x, y: objetosIntersecados[0].coordenada.y, z: objetosIntersecados[0].coordenada.z });
        this.remove(this.mesh[this.bloqueSeleccionado[this.objeto]]);

        let matrix = new THREE.Matrix4();
        let l = 0;

        this.mesh[this.bloqueSeleccionado[this.objeto]] = new THREE.InstancedMesh(this.h.geometria, this.materialesText[this.bloqueSeleccionado[this.objeto]], ++this.sizeIMesh[this.bloqueSeleccionado[this.objeto]]);

        for (let a = this.chunkMinMax.min.z; a <= this.chunkMinMax.max.z; a++) {
          for (let i = this.chunkMinMax.min.x; i <= this.chunkMinMax.max.x; i++) {
            for (let j = 0; j < this.chunk[i][a].length; j++) {
              if (this.chunk[i][a][j].material == this.bloqueSeleccionado[this.objeto]) {//objetosIntersecados[0].tipo){
                matrix.setPosition(this.chunk[i][a][j].x, this.chunk[i][a][j].y, this.chunk[i][a][j].z);
                this.mesh[this.bloqueSeleccionado[this.objeto]].setMatrixAt(l, matrix);
                l++;
              }
            }
          }
        }

        this.add(this.mesh[this.bloqueSeleccionado[this.objeto]]);
      }
    }

    else if (event.which == 1) {
      let mouse = new THREE.Vector2();

      mouse.x = (0.5) * 2 - 1;
      mouse.y = 1 - 2 * (0.5);

      let raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      let objetosIntersecados = [];
      for (let tipo in this.mesh) {
        let objetos = raycaster.intersectObject(this.mesh[tipo], true);

        if (objetos[0] != undefined && objetos.length > 0 && objetos[0].distance <= 20) {
          let index = objetos[0].face.materialIndex;
          let posicion = objetos[0].point;
          let coord = { x: 0, y: 0, z: 0 };

          //IMPORTANTE REVISAR 0 Y 5 (LOS INCREMENTOS)
          switch (index) {
            case 0: //derecha (x pos)
              coord = {
                x: posicion.x - 0.5,
                //y: Math.round(posicion.y)+0.5,
                y: (posicion.y | 0) + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 1: //izquierda (x neg)
              coord = {
                x: posicion.x + 0.5,
                //y: Math.round(posicion.y)+0.5,
                y: (posicion.y | 0) + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 2: //arriba (y pos) ok
              coord = {
                x: Math.round(posicion.x),
                y: posicion.y - 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 3: //abajo (y neg)
              coord = {
                x: Math.round(posicion.x),
                y: posicion.y + 0.5,
                z: Math.round(posicion.z)
              }
              break;
            case 4: //frente (z pos)
              coord = {
                x: Math.round(posicion.x),
                //y: Math.round(posicion.y)+0.5,
                y: (posicion.y | 0) + 0.5,
                z: posicion.z - 0.5
              }
              break;
            case 5: //detras (z neg)
              coord = {
                x: Math.round(posicion.x),
                //y: Math.round(posicion.y)+0.5,
                y: (posicion.y | 0) + 0.5,
                z: posicion.z + 0.5
              }
              break;
          }

          if (posicion.y < 0 && index != 3 && index != 2) {
            coord.y = Math.floor(posicion.y) + 0.5;
          }

          let redondeo = Math.round(coord.y);

          coord.y = (redondeo > coord.y) ? redondeo - 0.5 : redondeo + 0.5;

          objetosIntersecados.push({ tipo: tipo, coordenada: coord, distancia: objetos[0].distance });



        }

      }

      //ordena objetos intersecados segun distancia
      objetosIntersecados.sort(function (a, b) {
        return a.distancia - b.distancia;
      });

      if(objetosIntersecados[0]!=undefined){
        let aux = this.identificarChunk(objetosIntersecados[0].coordenada.x, objetosIntersecados[0].coordenada.z);
        this.remove(this.mesh[objetosIntersecados[0].tipo]);

        let indice = this.chunk[aux.x][aux.z].findIndex(i => i.x == objetosIntersecados[0].coordenada.x && i.y == objetosIntersecados[0].coordenada.y && i.z == objetosIntersecados[0].coordenada.z);   //SUponemos que no puede haber dos bloques en la misma posicion

        if (indice != -1)
          this.chunk[aux.x][aux.z].splice(indice, 1);

        let matrix = new THREE.Matrix4();

        let l = 0;
        this.mesh[objetosIntersecados[0].tipo] = new THREE.InstancedMesh(this.h.geometria, this.materialesText[objetosIntersecados[0].tipo], --this.sizeIMesh[objetosIntersecados[0].tipo]);


        for (let a = this.chunkMinMax.min.z; a <= this.chunkMinMax.max.z; a++) {
          for (let i = this.chunkMinMax.min.x; i <= this.chunkMinMax.max.x; i++) {
            for (let j = 0; j < this.chunk[i][a].length; j++) {
              if (this.chunk[i][a][j].material == objetosIntersecados[0].tipo) {
                matrix.setPosition(this.chunk[i][a][j].x, this.chunk[i][a][j].y, this.chunk[i][a][j].z);
                this.mesh[objetosIntersecados[0].tipo].setMatrixAt(l, matrix);
                l++;
              }
            }
          }
        }

        this.add(this.mesh[objetosIntersecados[0].tipo]);
    }
    }

  }

  actualizarFeedback() {
    let mouse = new THREE.Vector2();

    mouse.x = (0.5) * 2 - 1;
    mouse.y = 1 - 2 * (0.5);

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    let objetosSeleccionados = [];

    for (let aux in this.mesh) {
      let objetos = raycaster.intersectObject(this.mesh[aux], true);

      if (objetos[0] != undefined && objetos.length > 0 && objetos[0].distance <= 20) {
        let index = objetos[0].face.materialIndex;
        let posicion = objetos[0].point;
        let coord = { x: 0, y: 0, z: 0 };

        switch (index) {
          case 0: //derecha (x pos)
            coord = {
              x: posicion.x - 0.5,
              y: (posicion.y | 0) + 0.5,
              z: Math.round(posicion.z)
            }
            break;
          case 1: //izquierda (x neg)
            coord = {
              x: posicion.x + 0.5,
              y: (posicion.y | 0) + 0.5,
              z: Math.round(posicion.z)
            }
            break;
          case 2: //arriba (y pos) ok
            coord = {
              x: Math.round(posicion.x),
              y: posicion.y - 0.5,
              z: Math.round(posicion.z)
            }
            break;
          case 3: //abajo (y neg)
            coord = {
              x: Math.round(posicion.x),
              y: posicion.y + 0.5,
              z: Math.round(posicion.z)
            }
            break;
          case 4: //frente (z pos)
            coord = {
              x: Math.round(posicion.x),
              y: (posicion.y | 0) + 0.5,
              z: posicion.z - 0.5
            }
            break;
          case 5: //detras (z neg)
            coord = {
              x: Math.round(posicion.x),
              y: (posicion.y | 0) + 0.5,
              z: posicion.z + 0.5
            }
            break;
        }

        if (posicion.y < 0 && index != 3 && index != 2) {
          coord.y = Math.floor(posicion.y) + 0.5;
        }

        objetosSeleccionados.push({ objeto: objetos[0], coordenadas: coord });
      }
    }

    //Ordena objetosSeleccionados por distancia
    objetosSeleccionados.sort(function (a, b) {
      return a.objeto.distance - b.objeto.distance;
    });

    if (objetosSeleccionados.length > 0) {
      this.cajaSeleccionada.position.set(objetosSeleccionados[0].coordenadas.x, objetosSeleccionados[0].coordenadas.y, objetosSeleccionados[0].coordenadas.z);
      this.cajaSeleccionada.visible = true;
    }
    else {
      //Pone la caja seleccionada invisible
      this.cajaSeleccionada.visible = false;
    }
  }

  update() {
    if (this.stats) this.stats.update();

    let delta=this.clock.getDelta();

    TWEEN.update();

    // Se actualizan los elementos de la escena para cada frame
    // Se actualiza la posición de la cámara según su controlador    
    this.vector.subVectors(this.camera.position, this.cameraControl.target)

    let valores = new THREE.Vector3(this.model.position.x, this.model.position.y + 36 / PM.PIXELES_ESTANDAR, this.model.position.z);
    this.cameraControl.object.position.copy(valores).add(this.vector);
    this.cameraControl.target.copy(valores);

    this.cameraControl.update();

    // Le decimos al renderizador "visualiza la escena que te indico usando la cámara que te estoy pasando"
    this.renderer.render(this, this.getCamera());
    let aux = this.identificarChunk(this.model.position.x, this.model.position.z);

    let renderChunksAgain = false;
    if (aux.z > (this.chunkMinMax.min.z + this.chunkMinMax.max.z) / 2) {
      //Movemos los limites
      this.chunkMinMax.min.z++;
      this.chunkMinMax.max.z++;
      renderChunksAgain = true;
    }

    //Revisar el >=0
    if (aux.z < (this.chunkMinMax.min.z + this.chunkMinMax.max.z) / 2 && aux.z >= 0) {
      this.chunkMinMax.min.z--;
      this.chunkMinMax.max.z--;
      renderChunksAgain = true;
    }

    //Parte para las x
    if (aux.x > (this.chunkMinMax.min.x + this.chunkMinMax.max.x) / 2) {
      //Movemos los limites
      this.chunkMinMax.min.x++;
      this.chunkMinMax.max.x++;
      renderChunksAgain = true;
    }

    if (aux.x < (this.chunkMinMax.min.x + this.chunkMinMax.max.x) / 2 && aux.x >= 0) {
      this.chunkMinMax.min.x--;
      this.chunkMinMax.max.x--;
      renderChunksAgain = true;
    }

    if (renderChunksAgain) {
      for (let tipo in this.mesh) {
        this.remove(this.mesh[tipo]);
        this.mesh[tipo] = new THREE.InstancedMesh(this.h.geometria, this.materialesText[tipo], this.sizeIMesh[tipo]);
      }


      let l = {
        "Hierba": 0,
        "Tierra": 0,
        "Piedra": 0,
        "MaderaRoble": 0,
        "HojasRoble": 0,
        "Roca": 0,
        "PiedraBase": 0,
        "PiedraLuminosa": 0,
        "Cristal": 0
      };

      let inc = 0.02;
      let xoff = 0;
      let zoff = 0;
      let matrix = new THREE.Matrix4();
      let contador=0, contador2=0, contador3=0, contador4=0;

      for (let a = this.chunkMinMax.min.z; a <= this.chunkMinMax.max.z; a++) {
        for (let i = this.chunkMinMax.min.x; i <= this.chunkMinMax.max.x; i++) {
          if (this.chunk[i] != undefined && this.chunk[i][a] != undefined) {
            for (let j = 0; j < this.chunk[i][a].length; j++) {
              matrix.setPosition(this.chunk[i][a][j].x, this.chunk[i][a][j].y, this.chunk[i][a][j].z);
              this.mesh[this.chunk[i][a][j].material].setMatrixAt(l[this.chunk[i][a][j].material], matrix);
              l[this.chunk[i][a][j].material]++;
            }
          }
          else {
            if (this.chunk[i] == undefined)
              this.chunk[i] = [];
            //Genera el chunk que no existia
            var n_arboles = Math.floor(Math.random() * this.TAM_CHUNK/5);
            var list_arboles = [];
    
            for (let m = 0; m < n_arboles; m++) {
              let posx =  Math.floor(Math.random()* this.TAM_CHUNK);
              let posz = Math.floor(Math.random() * this.TAM_CHUNK);
              while(estaColindando(posx,posz,list_arboles)){
               posx =  Math.floor(Math.random()* this.TAM_CHUNK);
               posz = Math.floor(Math.random() * this.TAM_CHUNK);
              }
              list_arboles.push({ x: posx, y: 10, z: posz });
            }

            let bloques = [];
            for (let x = a * this.TAM_CHUNK; x < a * this.TAM_CHUNK + this.TAM_CHUNK; x++) {
              for (let z = i * this.TAM_CHUNK; z < i * this.TAM_CHUNK + this.TAM_CHUNK; z++) {
                xoff = inc * z;
                zoff = inc * x;

                let v = Math.round(noise.perlin2(xoff, zoff) * this.amplitud);
                matrix.setPosition(z * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR, x * 16 / PM.PIXELES_ESTANDAR);
                this.mesh["Hierba"].setMatrixAt(l["Hierba"], matrix);

                bloques.push({ x: z * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR, z: x * 16 / PM.PIXELES_ESTANDAR, material: "Hierba" });
                l["Hierba"]++;

                for (let indice_arbol = 0; indice_arbol < list_arboles.length; indice_arbol++) {
                  if (list_arboles[indice_arbol].x + i * this.TAM_CHUNK == z && list_arboles[indice_arbol].z + a * this.TAM_CHUNK == x) {
                    list_arboles[indice_arbol].y = v + 0.5;
                    list_arboles[indice_arbol].x = list_arboles[indice_arbol].x + i * this.TAM_CHUNK;
                    list_arboles[indice_arbol].z = list_arboles[indice_arbol].z + a * this.TAM_CHUNK;
                  }
                }
                for (let s = 0; s < 3; s++) {
                  matrix.setPosition(z * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR - s - 1, x * 16 / PM.PIXELES_ESTANDAR);
                  this.mesh["Tierra"].setMatrixAt(contador, matrix);
    
    
                  bloques.push({ x: z * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR - s - 1, z: x * 16 / PM.PIXELES_ESTANDAR, material: "Tierra" });
                  contador++;
                  
                }

                for (let r = 3; r < 8; r++) {
                  matrix.setPosition(z * 16 / PM.PIXELES_ESTANDAR, v - 8 / PM.PIXELES_ESTANDAR - r - 1, x * 16 / PM.PIXELES_ESTANDAR);
                  this.mesh["Piedra"].setMatrixAt(contador2, matrix);
    
    
                  bloques.push({ x: z * 16 / PM.PIXELES_ESTANDAR, y: v - 8 / PM.PIXELES_ESTANDAR - r - 1, z: x * 16 / PM.PIXELES_ESTANDAR, material: "Piedra" });
                  contador2++;
                }
              }
            }
            for (let indice_arbol = 0; indice_arbol < list_arboles.length; indice_arbol++) {
              let arbol = new estructuras.ArbolRoble();
    
              for (let r = 0; r < arbol.bloqueshojas.length; r++) {
                matrix.setPosition(list_arboles[indice_arbol].x + arbol.bloqueshojas[r].x, list_arboles[indice_arbol].y + arbol.bloqueshojas[r].y - 0.5, list_arboles[indice_arbol].z + arbol.bloqueshojas[r].z);
                this.mesh["HojasRoble"].setMatrixAt(contador3, matrix);
                bloques.push({ x: list_arboles[indice_arbol].x + arbol.bloqueshojas[r].x, y: list_arboles[indice_arbol].y + arbol.bloqueshojas[r].y -0.5, z: list_arboles[indice_arbol].z  + arbol.bloqueshojas[r].z, material: "HojasRoble" });
                contador3++;
              }
    
              for (let r = 0; r < arbol.bloquesmadera.length; r++) {
                matrix.setPosition(list_arboles[indice_arbol].x + arbol.bloquesmadera[r].x, list_arboles[indice_arbol].y + arbol.bloquesmadera[r].y -0.5, list_arboles[indice_arbol].z + arbol.bloquesmadera[r].z);
                this.mesh["MaderaRoble"].setMatrixAt(contador4, matrix);
                bloques.push({ x: list_arboles[indice_arbol].x + arbol.bloquesmadera[r].x, y: list_arboles[indice_arbol].y + arbol.bloquesmadera[r].y -0.5, z: list_arboles[indice_arbol].z + arbol.bloquesmadera[r].z, material: "MaderaRoble" });
                contador4++;
              }
            }
            this.chunkCollision.push(bloques);
            let chunkIndex = this.identificarChunk(bloques[0].x, bloques[0].z);

            if (this.chunk[chunkIndex.x] == undefined)
              this.chunk[chunkIndex.x] = [];

            this.chunk[chunkIndex.x][chunkIndex.z] = bloques;
          }

        }
      }

      for (let tipo in this.mesh) {
        this.add(this.mesh[tipo])
      }

    }


    //Lanza Raycaster para poner el cubo wireframe en el lugar correcto
    if (this.guiControls.activarWireframe) {
      this.actualizarFeedback();
    }
    else {
      //Se pone el cubo no visible
      this.cajaSeleccionada.visible = false;
    }

    //Se eligen todos los bloques de la distancia de renderizado para el calculo de fisicas, solo para el personaje
    let colisiones =[];

    for(let i =this.chunkMinMax.min.x; i<this.chunkMinMax.max.x; i++){
      for(let j =this.chunkMinMax.min.z; j<this.chunkMinMax.max.z; j++){
        if(this.chunk[i]!=undefined && this.chunk[i][j]!=undefined){
          colisiones = colisiones.concat(this.chunk[i][j]);
        }
      }
    }

    this.model.update(colisiones, this.mapTeclas);


    this.zombie.cabezaW1.lookAt(this.model.position.x, this.model.position.y,this.model.position.z);
    this.zombie.lookAt(this.model.position.x, this.zombie.position.y,this.model.position.z);
    this.zombie.boundingBox.lookAt(this.model.position.x, this.zombie.boundingBox.position.y,this.model.position.z)

    //Se escoge el chunk en el que esta el zombie
    let zombieChunk = this.identificarChunk(this.zombie.position.x, this.zombie.position.z);

    let zombieColisiones=[];
    for(let i=(zombieChunk.x-this.DISTANCIA_RENDER/2)|0; i<=(zombieChunk.x+this.DISTANCIA_RENDER/2)|0; i++){
      for(let j=(zombieChunk.z-this.DISTANCIA_RENDER/2)|0; j<=(zombieChunk.z+this.DISTANCIA_RENDER/2)|0; j++){
        if(this.chunk[i]!=undefined && this.chunk[i][j]!=undefined){
          zombieColisiones = zombieColisiones.concat(this.chunk[i][j]);
        }
      }
    }

    this.zombie.update(zombieColisiones);


    //el cerdo mira a la primera posicion de puntoscerdos
    this.cerdo.lookAt(this.puntoscerdos[this.poscerdo].x, this.cerdo.position.y, this.puntoscerdos[this.poscerdo].z);
    this.cerdo.boundingBox.lookAt(this.puntoscerdos[this.poscerdo].x, this.cerdo.boundingBox.position.y, this.puntoscerdos[this.poscerdo].z);
  

    
    //el cerdo para de moverse durante 2 segundos

    if(this.tiempoCerdo<=0) {

      if(Math.abs(this.cerdo.position.x - this.puntoscerdos[this.poscerdo].x) <= 1 && Math.abs(this.cerdo.position.z - this.puntoscerdos[this.poscerdo].z) <= 1){
        this.poscerdo = (this.poscerdo + 1) % this.puntoscerdos.length;
        this.tiempoCerdo = 200;
      }

          let cerdoChunk= this.identificarChunk(this.cerdo.position.x, this.cerdo.position.z);

          let cerdoColisiones=[];
          for(let i=(cerdoChunk.x-this.DISTANCIA_RENDER/2)|0; i<=(cerdoChunk.x+this.DISTANCIA_RENDER/2)|0; i++){
            for(let j=(cerdoChunk.z-this.DISTANCIA_RENDER/2)|0; j<=(cerdoChunk.z+this.DISTANCIA_RENDER/2)|0; j++){
              if(this.chunk[i]!=undefined && this.chunk[i][j]!=undefined){
                cerdoColisiones = cerdoColisiones.concat(this.chunk[i][j]);
              }
            }
          }          

          this.cerdo.update(cerdoColisiones, delta);
}
    else{
          this.tiempoCerdo -= 1;

    }
    
    // Este método debe ser llamado cada vez que queramos visualizar la escena de nuevo.
    // Literalmente le decimos al navegador: "La próxima vez que haya que refrescar la pantalla, llama al método que te indico".
    // Si no existiera esta línea,  update()  se ejecutaría solo la primera vez.
    requestAnimationFrame(() => this.update())
  }

  onDocumentWheel(event) {
    let tiles = document.getElementsByClassName("tile");

    tiles[this.objeto].style.border = "";

    if (event.deltaY > 0) {
      this.objeto = (this.objeto + 1) % tiles.length;
    }
    else {
      if (this.objeto == 0)
        this.objeto = tiles.length - 1;
      else
        this.objeto--;
    }

    tiles[this.objeto].style.border = "3px solid black";
  }
}


/// La función   main
$(function () {
  // Se instancia la escena pasándole el  div  que se ha creado en el html para visualizar
  let scene = new MyScene("#WebGL-output");
  const canvas = scene.renderer.domElement

  // Se añaden los listener de la aplicación. En este caso, el que va a comprobar cuándo se modifica el tamaño de la ventana de la aplicación.
  window.addEventListener("resize", () => scene.onWindowResize());

  window.addEventListener("keydown", (event) => {
    let tecla = event.key.toUpperCase();

    scene.mapTeclas[tecla] = true;
  });


  window.addEventListener("keyup", (event) => {
    scene.mapTeclas[event.key.toUpperCase()] = false;

    event.stopImmediatePropagation()

    let allFalse = true;

    for (let aux in scene.mapTeclas) {
      if (scene.mapTeclas[aux])
        allFalse = false;
    }

    if (allFalse) {
      scene.model.resetPosicion()
    }
  });

  //----------------------------------------------------------------------------------------
  window.addEventListener("mousedown", (event) => scene.onDocumentMouseDown(event));
  window.addEventListener("wheel", (event) => scene.onDocumentWheel(event));
  // Que no se nos olvide, la primera visualización.
  scene.update();
});