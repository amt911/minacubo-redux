import * as THREE from 'three'
import * as PM from './ParametrosMundo.js'
import * as C from './colisiones.js'

// IMPORTANT: camera centers on head and pivots around it
class Player extends THREE.Object3D {
  degToRad(deg) {
    return deg * (Math.PI / 180)
  }

  radToDeg(rad) {
    return rad * (180 / Math.PI);
  }
  constructor(gui, titleGui) {
    super();

    this.clock = new THREE.Clock();

    this.flipAnim = false;
    this.maxLimbAngle = this.degToRad(60);

    // GUI panel — created first because other methods reference its variables

    this.createGUI(gui, titleGui);

    const textureLoader = new THREE.TextureLoader();
    const texturaCabeza = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezaypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezayneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezazpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cabezazneg.png"),
      }),
    ];

    // HEAD
    const geometriaCabeza = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR);

    const cabeza = new THREE.Mesh(geometriaCabeza, texturaCabeza);

    cabeza.position.y = 4 / PM.PIXELES_ESTANDAR;

    this.cabezaW1 = new THREE.Object3D();
    this.cabezaW1.add(cabeza);

    this.cabezaW1.position.y = 24 / PM.PIXELES_ESTANDAR;

    //this.add(this.cabezaW1);

    // ARMS AND LEGS

    const texturabrazoR = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoyneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazozpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazozneg.png"),
      }),
    ];


    const texturabrazoL = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoyneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazozposR.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/brazoznegR.png"),
      }),

    ];

    const geometriaExtremidad = new THREE.BoxGeometry(4 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 4 / PM.PIXELES_ESTANDAR);
    const brazoL = new THREE.Mesh(geometriaExtremidad, texturabrazoL);

    //brazo izquierdo
    brazoL.position.y = -4 / PM.PIXELES_ESTANDAR;
    const brazoR = brazoL.clone();
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

    // LEGS

    const texturaPiernaR = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernayneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernazpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernazneg.png"),
      }),
    ];

    const texturaPiernaL = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernaypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernayneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernazpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/piernazneg.png"),
      }),
    ];
    // LEFT
    const piernaL = new THREE.Mesh(geometriaExtremidad, texturaPiernaL);
    const piernaR = new THREE.Mesh(geometriaExtremidad, texturaPiernaR);

    piernaL.position.y = -6 / PM.PIXELES_ESTANDAR;
    piernaR.position.y = -6 / PM.PIXELES_ESTANDAR;

    this.piernaLW1 = new THREE.Object3D();
    this.piernaRW1 = new THREE.Object3D();

    this.piernaLW1.add(piernaL);
    this.piernaRW1.add(piernaR);

    this.piernaLW1.position.set(2 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 0);
    this.piernaRW1.position.set(-2 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 0);

    const texturaCuerpo = [
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoxpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoxneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoypos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpoyneg.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpozpos.png"),
      }),
      new THREE.MeshLambertMaterial({
        map: textureLoader.load("./texturas/esteban/cuerpozneg.png"),
      }),
    ];
    // TORSO
    const geometriaTorso = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 12 / PM.PIXELES_ESTANDAR, 4 / PM.PIXELES_ESTANDAR);

    const torso = new THREE.Mesh(geometriaTorso, texturaCuerpo);
    torso.position.y = 18 / PM.PIXELES_ESTANDAR;

    // required for strafe animation to work
    this.wrapperFinal = new THREE.Object3D();

    this.wrapperFinal.add(this.cabezaW1)
    this.wrapperFinal.add(this.brazoLeftW1)
    this.wrapperFinal.add(this.brazoRightW1)
    this.wrapperFinal.add(this.piernaLW1)
    this.wrapperFinal.add(this.piernaRW1)
    this.wrapperFinal.add(torso)

    this.add(this.wrapperFinal);

    const boundingBoxGeom = new THREE.BoxGeometry(8 / PM.PIXELES_ESTANDAR, 32 / PM.PIXELES_ESTANDAR, 8 / PM.PIXELES_ESTANDAR);
    this.boundingBox = new THREE.Mesh(boundingBoxGeom, new THREE.MeshLambertMaterial());
    this.boundingBox.position.y += 16 / PM.PIXELES_ESTANDAR

    this.position.y += 10;

    this.physics=new C.Collisions(false, 0.8);
    this.canJump=true;
    this.height=32;

    this.maxHealth = 20;
    this.health = this.maxHealth;
    this.isDead = false;
  }

  /**
   * @param {number} amount HP to subtract (integer, each heart = 2 HP)
   */
  takeDamage(amount) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.isDead = true;
  }

  /**
   * Reset to full health at the given world position.
   * @param {number} x @param {number} y @param {number} z
   */
  respawn(x, y, z) {
    this.health = this.maxHealth;
    this.isDead = false;
    this.clock.getDelta();            // drain accumulated dead-time
    this.physics.fallVel = -1;        // kill fall velocity
    this.position.set(x, y, z);
    this.boundingBox.position.set(x, y + 16 / PM.PIXELES_ESTANDAR, z);
  }

  addCamara(camara) {
    this.cameraControls = camara;
  }

  createGUI(_gui, _titleGui) {

  }

  resetPosicion() {
    this.piernaLW1.rotation.x = 0;
    this.piernaRW1.rotation.x = 0;
    this.brazoLeft.rotation.x = 0;
    this.brazoRight.rotation.x = 0;
    this.wrapperFinal.rotation.y = 0;
  }


  animacion(isForward, speed){
    const finalSpeed=(isForward)? speed : -speed;

    if (this.flipAnim) {
      this.piernaLW1.rotation.x += finalSpeed
      this.piernaRW1.rotation.x -= finalSpeed
      this.brazoLeft.rotation.x -= finalSpeed
      this.brazoRight.rotation.x += finalSpeed

      if ((isForward && this.piernaRW1.rotation.x <= -this.maxLimbAngle) || (!isForward && this.piernaRW1.rotation.x >= this.maxLimbAngle)) {
        this.flipAnim = false;
      }
    }
    else {
      this.piernaLW1.rotation.x += -finalSpeed
      this.piernaRW1.rotation.x -= -finalSpeed
      this.brazoLeft.rotation.x -= -finalSpeed
      this.brazoRight.rotation.x += -finalSpeed

      if ((isForward && this.piernaRW1.rotation.x >= this.maxLimbAngle) || (!isForward && this.piernaRW1.rotation.x <= -this.maxLimbAngle)) {
        this.flipAnim = true;
      }
    }
  }

  update(blocks, keysPressed) {
    // Clamp delta — long frames (shader compile, GC) otherwise turn into
    // huge fall velocities + instant fall damage on resume.
    const delta = Math.min(this.clock.getDelta(), 1 / 15);
    const speed = delta * 4.317;
    // Derive orientation from camera geometry — works regardless of whether
    // OrbitControls or pointer-lock mode is driving the camera.
    const cp = this.cameraControls.object.position;
    const ct = this.cameraControls.target;
    const dx = cp.x - ct.x;
    const dy = cp.y - ct.y;
    const dz = cp.z - ct.z;
    const dxz = Math.sqrt(dx * dx + dz * dz);
    this.cabezaW1.rotation.x = Math.PI / 2 - Math.atan2(dxz, dy);
    this.rotation.y = Math.atan2(-dx, -dz);
    this.boundingBox.rotation.y = - Math.PI + this.cameraControls.getAzimuthalAngle();


    const vectorDir=new THREE.Vector3(0, 0, 0);

    let moviendose=false;
    let isForward=true;
    
    if(keysPressed.W){
      vectorDir.z+=1;
      moviendose = true;
    }
    if(keysPressed.S){
      vectorDir.z-=1;
      moviendose = true;
      isForward=false;
    }
    if(keysPressed.A){
      vectorDir.x+=1;
      moviendose = true;
    }
    if(keysPressed.D){
      vectorDir.x-=1;
      moviendose = true;
    }

    if((keysPressed.A && keysPressed.W) || (keysPressed.D && keysPressed.S)){
      if (this.wrapperFinal.rotation.y < this.degToRad(45)) {
        this.wrapperFinal.rotation.y += 8*delta;
      }      
    }
    else if((keysPressed.A && keysPressed.S) || (keysPressed.D && keysPressed.W)){
      if (this.wrapperFinal.rotation.y > this.degToRad(-45)) {
        this.wrapperFinal.rotation.y -= 8*delta;
      }            
    }
    else if(keysPressed.A){
      if (this.wrapperFinal.rotation.y < this.degToRad(45)) {
        this.wrapperFinal.rotation.y += 8*delta;
      }      
    }
    else if(keysPressed.D){
      if (this.wrapperFinal.rotation.y > this.degToRad(-45)) {
        this.wrapperFinal.rotation.y -= 8*delta;
      }
    }
    else if(keysPressed.W){
      this.wrapperFinal.rotation.y = 0;
    }
    else if(keysPressed.S){
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

    const finalSpeed=(keysPressed["SHIFT"])? speed*2 : speed;

    if(moviendose)
      this.animacion(isForward, finalSpeed);

    // moveDir is in LOCAL space (W = +Z local). Collisions.update treats it


    // as a world-space delta, so rotate here — otherwise W stops meaning
    // como delta world, hay que rotarlo aqui o W deja de ser "hacia donde


    const worldDir = vectorDir.clone().applyQuaternion(this.quaternion);

    // Capture pre-landing state for fall damage calculation
    const prevFallVel = this.physics.fallVel;
    const prevCanJump = this.canJump;

    this.physics.update(blocks, this, this.boundingBox, keysPressed, worldDir, speed);

    // Fall damage: triggered on landing after significant fall.
    // fallAcc = -42 → v² = 2 * 42 * h → h = v²/84.
    // 3-block grace (Minecraft parity): first 3 blocks = no damage,
    // each extra block = 2 HP (1 heart). Normal jump peaks ~1.2 blocks → safe.
    if (!prevCanJump && this.canJump && prevFallVel < -15) {
      const height = (prevFallVel * prevFallVel) / 84;
      const damage = Math.floor(Math.max(0, height - 3)) * 2;
      if (damage > 0) this.takeDamage(damage);
    }
  }
}

export { Player };
export { Player as Esteban };
