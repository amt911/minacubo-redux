
// Clases de la biblioteca

import * as THREE from 'three'
import GUI from 'lil-gui'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import Stats from 'three/addons/libs/stats.module.js'
// Clases de mi proyecto

import { DayNightCycle } from './DayNightCycle.js'
import { Player } from './Esteban.js'
import { Zombie } from './Zombie.js'
import { Pig } from './Cerdo.js'
import { RaycastInteraction } from './RaycastInteraction.js'
import { InputHandler } from './InputHandler.js'
import { ChunkManager } from './ChunkManager.js'
import { NPCManager } from './NPCManager.js'

import { BLOCK_TYPES, blockMaterials, blockGeometries } from './BlockRegistry.js'
import * as PM from './ParametrosMundo.js'
import { identifyChunk } from './chunkMath.js'

/// La clase fachada del modelo
/**
 * Usaremos una clase derivada de la clase Scene de Three.js para llelet el control de la escena y de todo lo que ocurre en ella.
 */


class MyScene extends THREE.Scene {
  constructor(myCanvas) {
    super();

    this.clock=new THREE.Clock();


    this.movt = "parado";

    this.myCanvasName = myCanvas;
    // Create renderer, attach to canvas.
    this.renderer = this.createRenderer(myCanvas);

    // Add GUI controls for this class.
    this.gui = this.createGUI();

    this.initStats();

    // Constantes del mundo. Se asignan ANTES de createLights() porque
    // shadowExtent depende de TAM_CHUNK * DISTANCIA_RENDER. Si createLights
    // se llamaba antes, esos valores eran undefined → frustum NaN → shadow
    // map roto silenciosamente.
    this.TAM_CHUNK = 12;
    this.DISTANCIA_RENDER = MyScene._loadRenderDistance();

    // Construimos los distinos elementos que tendremos en la escena



    this.createLights();


    // Debug axes.
    this.axis = new THREE.AxesHelper(55);
    this.add(this.axis);




    this.model = new Player(this.gui, "Player");
    this.createCamera();
    this.setupPointerLock();

    this.enableShadowsOnSubtree(this.model);
    this.add(this.model);

    this.zombie = new Zombie(this.gui, "Zombie");
    this.enableShadowsOnSubtree(this.zombie);

    this.zombie.position.y+=10;
    this.zombie.boundingBox.position.y+=10;

    this.model.position.x = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.position.z = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.boundingBox.position.x = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.boundingBox.position.z = (this.DISTANCIA_RENDER * this.TAM_CHUNK) / 2;
    this.model.boundingBox.position.y = this.model.position.y + 16 / PM.PIXELES_ESTANDAR;
    this.blockTypes = BLOCK_TYPES;

    this.blockMaterials = blockMaterials;
    this.blockGeometries = blockGeometries;

    const seed = Math.floor(Math.random() * 0xffffffff);
    this.chunkManager = new ChunkManager({
      TAM_CHUNK:        this.TAM_CHUNK,
      DISTANCIA_RENDER: this.DISTANCIA_RENDER,
      seed,
      blockGeometries:  this.blockGeometries,
      blockMaterials:   this.blockMaterials,
      scene:            this,
    });

    const { zombieSpawn, pigWaypoints } = this.chunkManager.init();

    // Expose chunk data via proxy so existing code keeps working
    this.chunk       = this.chunkManager.chunk;
    this.chunkMinMax = this.chunkManager.chunkMinMax;

    this.zombie.position.set(
      this.zombie.position.x + zombieSpawn.x,
      this.zombie.position.y + zombieSpawn.y + 0.1,
      this.zombie.position.z + zombieSpawn.z
    );
    this.zombie.boundingBox.position.set(
      this.zombie.boundingBox.position.x + zombieSpawn.x,
      this.zombie.boundingBox.position.y + zombieSpawn.y + 0.1,
      this.zombie.boundingBox.position.z + zombieSpawn.z
    );
    this.add(this.zombie);

    this.pig = new Pig(this.gui, "Cerdo");
    this.enableShadowsOnSubtree(this.pig);
    const pig0 = pigWaypoints[0];
    this.pig.position.set(
      this.pig.position.x + pig0.x,
      this.pig.position.y + pig0.y + 0.1,
      this.pig.position.z + pig0.z
    );
    this.pig.boundingBox.position.set(
      this.pig.boundingBox.position.x + pig0.x,
      this.pig.boundingBox.position.y + pig0.y + 0.1,
      this.pig.boundingBox.position.z + pig0.z
    );
    this.add(this.pig);

    // Edge fog — hides chunk pop-in well inside the render window.
    // Starts 2 chunks before the visible edge, fully opaque 0.5 chunks before it.
    const fogNear = this.TAM_CHUNK * (this.DISTANCIA_RENDER / 2 - 2);
    const fogFar  = this.TAM_CHUNK * (this.DISTANCIA_RENDER / 2 - 0.5);
    this.fog = new THREE.Fog(0x87CEEB, fogNear, fogFar);
    this.background = new THREE.Color(0x87CEEB);

    this.dayNightCycle = new DayNightCycle(this, this.fog, this.spotLight, this.sunLight);

    this.raycast = new RaycastInteraction({
      camera:            this.camera,
      chunkManager:      this.chunkManager,
      blockTypes:        this.blockTypes,
      getObjeto:         () => this.objeto,
      scene:             this,
      TAM_CHUNK:         this.TAM_CHUNK,
      getPlayerPosition: () => this.model.position,
    });

    this.input = new InputHandler({
      onPlayerReset: () => this.model.resetPosicion(),
      onMouseDown:   (e) => this.onDocumentMouseDown(e),
      onMouseUp:     (e) => this.onDocumentMouseUp(e),
    });
    // Expose keyMap alias for update() callers
    Object.defineProperty(this, 'mapTeclas', { get: () => this.input.keyMap });
    Object.defineProperty(this, 'objeto', {
      get: () => this.input.selectedBlockIndex,
      set: (v) => { this.input.selectedBlockIndex = v; },
    });

    this.npcManager = new NPCManager({
      zombie:           this.zombie,
      pig:            this.pig,
      pigWaypoints:     pigWaypoints,
      chunkManager:     this.chunkManager,
      getPlayerPosition: () => this.model.position,
      TAM_CHUNK:        this.TAM_CHUNK,
    });

    if (new URLSearchParams(location.search).has('bench')) {
      this._setupBench();
    }
  }

  // ─── Benchmark harness ────────────────────────────────────────────────────
  // Triggered by `?bench=1`. Lets the scene settle, drives the player forward
  // for a fixed duration, samples renderer.info + chunk metrics each frame /
  // every 250ms, then writes a summary to `window.__benchReport` and sets
  // document.title to `BENCH_DONE` so a CDP-driven runner can read both.

  _setupBench() {
    const params  = new URLSearchParams(location.search);
    const SETTLE  = +(params.get('settle')   || 3000);
    const RECORD  = +(params.get('duration') || 30000);

    this._benchState      = 'settling';
    this._benchFrameTimes = [];
    this._benchSamples    = [];
    this._benchLastFrame  = performance.now();
    this._benchNextSample = 0;

    setTimeout(() => {
      this._benchState = 'recording';
      this._benchLastFrame = performance.now();
      // Drive forward walk via the input layer's key map (skips pointer-lock
      // requirement and works headless).
      this.input.keyMap['W'] = true;
    }, SETTLE);

    setTimeout(() => {
      this.input.keyMap['W'] = false;
      this._benchFinish();
      this._benchState = 'done';
    }, SETTLE + RECORD);

    const banner = document.createElement('div');
    banner.id = 'bench-banner';
    banner.style.cssText =
      'position:fixed;top:0;left:50%;transform:translateX(-50%);' +
      'background:#ff0;color:#000;padding:4px 12px;font:12px monospace;' +
      'z-index:99999;pointer-events:none';
    banner.textContent = `BENCH settling ${SETTLE}ms → recording ${RECORD}ms`;
    document.body.appendChild(banner);
    this._benchBanner = banner;
  }

  _benchTick() {
    if (!this._benchState || this._benchState === 'done') return;
    const now = performance.now();
    const dt = now - this._benchLastFrame;
    this._benchLastFrame = now;
    if (this._benchState === 'recording') {
      this._benchFrameTimes.push(dt);
    }
    if (now < this._benchNextSample) return;
    this._benchNextSample = now + 250;
    if (this._benchState !== 'recording') return;

    const info = this.renderer.info.render;
    let meshes = 0;
    let instances = 0;
    const cms = this.chunkManager.chunkMeshes;
    for (const xKey in cms) {
      const col = cms[xKey];
      for (const zKey in col) {
        const types = col[zKey];
        for (const k in types) {
          meshes++;
          instances += types[k].count;
        }
      }
    }
    this._benchSamples.push({
      calls: info.calls,
      tris: info.triangles,
      meshes,
      instances,
      queue: this.chunkManager._meshQueue.length,
      buildAvg: this.chunkManager._buildTimeAvgMs,
    });
  }

  _benchFinish() {
    const ft = this._benchFrameTimes.slice().sort((a, b) => a - b);
    const n = ft.length;
    const sum = ft.reduce((a, b) => a + b, 0);
    const pct = (p) => ft[Math.min(n - 1, Math.max(0, Math.floor(n * p)))];
    const max = (arr, key) => arr.length ? arr.reduce((m, s) => s[key] > m ? s[key] : m, -Infinity) : 0;
    const mean = (arr, key) => arr.length ? arr.reduce((a, s) => a + s[key], 0) / arr.length : 0;

    const report = {
      frames:        n,
      duration_ms:   +sum.toFixed(1),
      fps_avg:       +(n / (sum / 1000)).toFixed(2),
      frame_avg_ms:  +(sum / n).toFixed(3),
      frame_p50_ms:  +pct(0.50).toFixed(3),
      frame_p95_ms:  +pct(0.95).toFixed(3),
      frame_p99_ms:  +pct(0.99).toFixed(3),
      frame_max_ms:  +ft[n - 1].toFixed(3),
      max_calls:     max(this._benchSamples, 'calls'),
      max_tris:      max(this._benchSamples, 'tris'),
      max_meshes:    max(this._benchSamples, 'meshes'),
      max_instances: max(this._benchSamples, 'instances'),
      max_queue:     max(this._benchSamples, 'queue'),
      build_avg_ms:  +mean(this._benchSamples, 'buildAvg').toFixed(3),
      DR:            this.DISTANCIA_RENDER,
      TC:            this.TAM_CHUNK,
      ua:            navigator.userAgent,
    };

    /** @type {any} */ (window).__benchReport = report;
    document.title = 'BENCH_DONE';
    console.log('BENCH_REPORT', JSON.stringify(report));

    if (this._benchBanner) {
      this._benchBanner.style.background = '#0f0';
      this._benchBanner.textContent = 'BENCH done — see console / window.__benchReport';
    }

    const div = document.createElement('div');
    div.style.cssText =
      'position:fixed;top:60px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.85);color:#0f0;padding:16px;' +
      'font:12px/1.4 monospace;z-index:99999;white-space:pre';
    div.textContent = JSON.stringify(report, null, 2);
    document.body.appendChild(div);
  }

  /** @returns {{x: number, z: number}} */
  identifyChunk(x, z) {
    return identifyChunk(x, z, this.TAM_CHUNK);
  }


  initStats() {

    const stats = new Stats();

    stats.setMode(0); // 0: fps, 1: ms

    // Align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';

    document.querySelector('#Stats-output').appendChild(stats.domElement);

    this.stats = stats;

    // Perf overlay: draw calls, triangles, chunk mesh count, instance count,
    // average chunk-build time. Sits below Stats. Update throttled to 2 Hz
    // by _updatePerfPanel() so the DOM write doesn't compete for the frame.
    const panel = document.createElement('div');
    panel.style.cssText =
      'position:absolute;top:50px;left:0;background:rgba(0,0,0,0.6);' +
      'color:#0f0;font:11px/1.35 monospace;padding:4px 8px;' +
      'pointer-events:none;z-index:9999;white-space:pre;min-width:140px';
    panel.textContent = 'perf …';
    document.body.appendChild(panel);
    this._perfPanel = panel;
    this._perfNextMs = 0;
  }

  _updatePerfPanel() {
    const now = performance.now();
    if (now < this._perfNextMs) return;
    this._perfNextMs = now + 500;

    const info = this.renderer.info.render;

    let meshes = 0;
    let instances = 0;
    const cms = this.chunkManager.chunkMeshes;
    for (const xKey in cms) {
      const col = cms[xKey];
      for (const zKey in col) {
        const types = col[zKey];
        for (const k in types) {
          meshes++;
          instances += types[k].count;
        }
      }
    }

    const chunkCount = this.chunkManager.chunkCount;
    const queueLen = this.chunkManager._meshQueue.length;
    const pendingGens = this.chunkManager._pendingGens.size;
    const buildAvg = this.chunkManager._buildTimeAvgMs;

    this._perfPanel.textContent =
      `calls     ${info.calls}\n` +
      `tris      ${info.triangles.toLocaleString()}\n` +
      `meshes    ${meshes}\n` +
      `instances ${instances.toLocaleString()}\n` +
      `chunks    ${chunkCount}\n` +
      `queue     ${queueLen}\n` +
      `pending   ${pendingGens}\n` +
      `build avg ${buildAvg.toFixed(2)}ms`;
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(this.model.position.x, this.model.position.y + 10, this.model.position.z - 10);

    // Initial spherical camera angles — used by pointer-lock AND arrow-key
    // camera control. Pre-set so arrow keys work before the player touches
    // the mouse.
    this._camPhi = Math.PI * 0.3;
    this._camTheta = Math.PI;

    // Pre-allocated vectors reused every frame — eliminate per-frame GC pressure.
    this.vector = new THREE.Vector3();
    this._v3A = new THREE.Vector3();
    this._v3B = new THREE.Vector3();
    this._v3C = new THREE.Vector3();
    this._v3Head = new THREE.Vector3();

    this.cameraControl = new OrbitControls(this.camera, this.renderer.domElement);
    this.cameraControl.target.set(this.model.position.x, this.model.position.y, this.model.position.z)
    this.cameraControl.enablePan = false;
    this.cameraControl.enableZoom = false;
    this.cameraControl.rotateSpeed = 3;

    // Tope vertical: el springarm (_clampCamDist) se encarga de evitar
    // clipping con el terreno, por lo que podemos permitir que la camara
    // orbit hasta casi horizontal (PI*0.49 ≈ 88°). El tope superior evita
    // mirar completamente desde arriba (bird's eye extremo).
    this.cameraControl.minPolarAngle = Math.PI * 0.15;
    this.cameraControl.maxPolarAngle = Math.PI * 0.49;

    // Damping para que el movimiento no sea brusco al soltar el boton.
    // Requiere llamar a cameraControl.update() cada frame (ya se hace en
    // update() via el flujo de OrbitControls).
    this.cameraControl.enableDamping = true;
    this.cameraControl.dampingFactor = 0.08;

    // Click izq = romper bloque (mouseup), arrastrar der = rotar camara,
    // click der sin arrastrar = colocar bloque (mouseup con threshold).
    // El medio queda como alternativa para usuarios con rueda fisica.
    this.cameraControl.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.ROTATE
    }

    // Distancia deseada de la camara al objetivo (springarm). Se mantiene
    // fija entre frames; el springarm la recorta cuando hay terreno bloqueando.
    const headOffset = 36 / PM.PIXELES_ESTANDAR;
    const headPos = new THREE.Vector3(
      this.model.position.x,
      this.model.position.y + headOffset,
      this.model.position.z
    );
    this._cameraDesiredDist = this.camera.position.distanceTo(headPos);

    this.model.addCamara(this.cameraControl);
  }

  static _loadRenderDistance() {
    // URL `?DR=N` overrides localStorage so headless bench runs are
    // reproducible without preseeding localStorage. Range bounded the same
    // way as the GUI slider (3..32).
    try {
      const url = new URLSearchParams(location.search);
      if (url.has('DR')) {
        const u = parseInt(url.get('DR') ?? '', 10);
        if (Number.isFinite(u) && u >= 3 && u <= 32) return u;
      }
    } catch { /* location/URLSearchParams may be unavailable */ }
    try {
      const v = parseInt(localStorage.getItem('renderDistance') ?? '9', 10);
      if (Number.isFinite(v) && v >= 3 && v <= 32) return v;
    } catch { /* localStorage may be unavailable */ }
    return 9;
  }

  createGUI() {
    const gui = new GUI();

    this.guiControls = {
      axisOnOff: true,
      activarWireframe: true,
      shadowsEnabled: true,
      shadowResolution: 1024,
      cameraSensitivity: 1.0,
      renderDistance: MyScene._loadRenderDistance(),
    }

    const folder = gui.addFolder('Ayudas');

    folder.add(this.guiControls, 'axisOnOff')
      .name('Mostrar ejes : ')
      .onChange((value) => this.setAxisVisible(value));

    folder.add(this.guiControls, 'activarWireframe')
      .name('Mostrar feedback (raycast a 10Hz)');

    const graficos = gui.addFolder('Graphics');

    graficos.add(this.guiControls, 'shadowsEnabled')
      .name('Sombras')
      .onChange((v) => {
        this.renderer.shadowMap.enabled = v;
        this.sunLight.castShadow = v;
        if (this.sunLight.shadow.map) {
          this.sunLight.shadow.map.dispose();
          this.sunLight.shadow.map = null;
        }
        this.renderer.shadowMap.needsUpdate = true;
      });

    graficos.add(this.guiControls, 'shadowResolution', { '512': 512, '1024': 1024, '2048': 2048 })
      .name('Shadow resolution')
      .onChange((v) => {
        this.sunLight.shadow.mapSize.set(v, v);
        if (this.sunLight.shadow.map) {
          this.sunLight.shadow.map.dispose();
          this.sunLight.shadow.map = null;
        }
      });

    graficos.add(this.guiControls, 'cameraSensitivity', 0.1, 3.0, 0.05)
      .name('Camera sensitivity');

    graficos.add(this.guiControls, 'renderDistance', 3, 32, 1)
      .name('Render distance (reloads)')
      .onFinishChange((v) => {
        try { localStorage.setItem('renderDistance', String(v)); } catch { /* ignore */ }
        location.reload();
      });

    return gui;
  }

  setupPointerLock() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', () => {
      if (!document.pointerLockElement) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        document.body.classList.add('pointer-locked');
        // Disable OrbitControls while locked — otherwise its pointerdown
        // handler tries to setPointerCapture on a pointer that no longer
        // has an active pointer id, throwing InvalidStateError.
        this.cameraControl.enabled = false;
        // Sync angles from current camera–head offset so there's no jump.
        const head = new THREE.Vector3(
          this.model.position.x,
          this.model.position.y + 36 / PM.PIXELES_ESTANDAR,
          this.model.position.z
        );
        const offset = this.camera.position.clone().sub(head);
        const len = offset.length() || 1;
        this._camPhi = Math.acos(Math.max(-1, Math.min(1, offset.y / len)));
        this._camTheta = Math.atan2(offset.x, offset.z);
      } else {
        document.body.classList.remove('pointer-locked');
        this.cameraControl.enabled = true;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      const s = 0.002 * this.guiControls.cameraSensitivity;
      this._camTheta -= e.movementX * s;
      this._camPhi -= e.movementY * s;
      this._camPhi = Math.max(
        this.cameraControl.minPolarAngle,
        Math.min(this.cameraControl.maxPolarAngle, this._camPhi)
      );
    });
  }

  createLights() {
    // Ambient muy bajo: con ambient alto las caras en sombra reciben tanta
    // luz que el contraste con las iluminadas por el sol es invisible. 0.1
    // garantiza que la noche no sea negra puro, sin matar el contraste.
    const ambientLight = new THREE.AmbientLight(0xb0c4de, 0.1);
    this.add(ambientLight);

    // Hemisphere: cielo azul arriba, suelo calido marron abajo. Tinte
    // segun normal del bloque, contribucion baja para no compensar las
    // sombras del sol.
    this.spotLight = new THREE.HemisphereLight(0x87CEEB, 0x4a3520, 0.3);
    this.spotLight.position.set(0, 60, 0);
    this.add(this.spotLight);

    // DirectionalLight = sol. Con shadowMap habilitado proyecta sombras
    // duras de los cubos sobre el terreno. Sigue al jugador (ver
    // updateSunPosition) para que el frustum ortografico nunca pierda la
    // escena visible. Sin esto las sombras desaparecen al alejarse.
    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 1.6);
    // Offset bajo y lateral: angulo ~35° desde horizontal → sombras LARGAS
    // y bien visibles. Posicion (90,0) vertical 60° con sun alto producia
    // sombras minusculas (longitud ~0.5 bloques).
    this._sunOffset = new THREE.Vector3(60, 50, 20);
    this.sunLight.position.copy(this._sunOffset);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);

    // Tight ortho frustum centred on the player (updateSunPosition follows).
    // 16 units = ~3 chunks. Shadows beyond that distance are barely visible
    // anyway and the shadow pass cost scales with the ortho area + the
    // number of cubes inside it. Was 25 → ~40% fewer fragments in the
    // shadow pass and sharper near-shadows from a 1024² shadow map.
    const shadowExtent = 16;
    const cam = this.sunLight.shadow.camera;
    cam.left = -shadowExtent;
    cam.right = shadowExtent;
    cam.top = shadowExtent;
    cam.bottom = -shadowExtent;
    cam.near = 0.5;
    cam.far = 200;
    cam.updateProjectionMatrix();

    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.05;

    this.add(this.sunLight);
    this.add(this.sunLight.target);
  }

  // Recorre un Object3D arbitrario y activa cast + receive shadow en
  // cada Mesh hijo. Necesario para personajes/NPCs construidos como grupos
  // con cabeza/torso/extremidades separadas.
  enableShadowsOnSubtree(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }


  // Mantiene el sol y su target centrados sobre el jugador. Sin esto el
  // frustum ortografico del shadowMap, fijo en el espacio mundo, se queda
  // atras y las sombras desaparecen al moverse.
  updateSunPosition() {
    if (!this.sunLight || !this.model) return;
    const p = this.model.position;
    const o = this._sunOffset;
    this.sunLight.position.set(p.x + o.x, p.y + o.y, p.z + o.z);
    this.sunLight.target.position.set(p.x, p.y, p.z);
    this.sunLight.target.updateMatrixWorld();
  }

  setLightIntensity(valor) {
    this.spotLight.intensity = valor * 0.3;
    this.sunLight.intensity = 0.5 + valor * 1.1;
  }

  setAxisVisible(valor) {
    this.axis.visible = valor;
  }

  createRenderer(myCanvas) {
    // Se recibe el lienzo sobre el que se van a hacer los renderizados. Un div definido en el html.

    // Se instancia un Renderer   WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    // Sombras: PCF (no Soft) → bordes mas duros pero claramente visibles.
    // PCFSoft difuminaba tanto que con mapSize 2048 sobre 168x168 las
    // sombras pequenas desaparecian.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Manual shadow update — re-rendered every N frames in update() to amortise
    // shadow-pass cost across multiple frames.
    renderer.shadowMap.autoUpdate = false;

    renderer.setClearColor(new THREE.Color(0xEEEEEE), 1.0);

    // Cap devicePixelRatio: HiDPI/retina screens render at 4x cost otherwise.
    // 1.5 keeps text/UI sharp without the full retina hit.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    renderer.setSize(window.innerWidth, window.innerHeight);


    document.querySelector(myCanvas).appendChild(renderer.domElement);

    return renderer;
  }

  getCamera() {


    return this.camera;
  }

  setCameraAspect(ratio) {


    this.camera.aspect = ratio;

    this.camera.updateProjectionMatrix();
  }

  onWindowResize() {
    // Called on window resize — update camera aspect and renderer size.

    this.setCameraAspect(window.innerWidth / window.innerHeight);


    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onDocumentMouseDown(event) {
    this.raycast.onMouseDown(event);
  }

  onDocumentMouseUp(event) {
    this.raycast.onMouseUp(event);
  }

  _clampCamDist(target, dir, desired) {
    const MARGIN = 0.3;
    const MIN_DIST = 2;
    if (!this._springArmCaster) this._springArmCaster = new THREE.Raycaster();
    this._springArmCaster.set(target, dir);
    this._springArmCaster.near = 0.1;
    this._springArmCaster.far = desired;
    let safeDist = desired;
    // Springarm only reaches `desired` units (~camera distance, < 2 chunks).
    // Filtering candidate meshes to a 2-chunk radius drops the intersect
    // input from hundreds (allMeshes spans the whole render distance) to a
    // few dozen — huge win because this runs every 5 frames.
    const meshes = this.chunkManager.getMeshesNear(this.model.position.x, this.model.position.z, 2);
    const hits = this._springArmCaster.intersectObjects(meshes, false);
    if (hits.length > 0 && hits[0].distance < safeDist) {
      safeDist = Math.max(MIN_DIST, hits[0].distance - MARGIN);
    }
    return safeDist;
  }

  updateFeedback() {
    this.raycast.updateFeedback();
  }

  update() {
    if (this.stats) this.stats.update();
    this._updatePerfPanel();
    this._benchTick();

    const delta=this.clock.getDelta();

    this.dayNightCycle.update();
    this.updateSunPosition();

    // Reuse pre-allocated vectors — no per-frame allocation or GC.
    const head = this._v3Head.set(
      this.model.position.x,
      this.model.position.y + 36 / PM.PIXELES_ESTANDAR,
      this.model.position.z
    );

    // Arrow keys also rotate the camera — handy when the mouse isn't
    // available (KVM switches, etc.).
    const km = this.mapTeclas;
    const arrowsHeld = km['ARROWLEFT'] || km['ARROWRIGHT'] || km['ARROWUP'] || km['ARROWDOWN'];
    if (arrowsHeld) {
      const arrowSpeed = 0.025 * (this.guiControls.cameraSensitivity ?? 1) * 60 * delta;
      if (km['ARROWLEFT'])  this._camTheta += arrowSpeed;
      if (km['ARROWRIGHT']) this._camTheta -= arrowSpeed;
      if (km['ARROWUP'])    this._camPhi   -= arrowSpeed;
      if (km['ARROWDOWN'])  this._camPhi   += arrowSpeed;
      const minPhi = Math.PI * 0.15;
      const maxPhi = Math.PI * 0.49;
      this._camPhi = Math.max(minPhi, Math.min(maxPhi, this._camPhi));
    }

    const isLocked = document.pointerLockElement === this.renderer.domElement;
    // Use the spherical-angle camera path when pointer-locked OR when the
    // player is steering the camera with the arrow keys.
    const useManualCam = isLocked || arrowsHeld;

    if (useManualCam) {
      // Pointer-lock mode: drive camera directly from _camTheta/_camPhi angles.
      // Skip cameraControl.update() — it would override the position we set.
      const phi = this._camPhi ?? Math.PI * 0.3;
      const theta = this._camTheta ?? 0;
      this._v3A.set(
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.cos(theta)
      ).multiplyScalar(this._cameraDesiredDist);
      this.camera.position.copy(head).add(this._v3A);
      this.camera.lookAt(head);
      this.cameraControl.target.copy(head);
    } else {
      // OrbitControls mode: follow player head, preserve current orbit direction.
      this._v3A.copy(this.cameraControl.target);                     // prevTarget
      this._v3B.copy(this.camera.position).sub(this._v3A);           // prevOffset
      const prevDist = this._v3B.length();
      const prevDir = prevDist > 0
        ? this._v3C.copy(this._v3B).divideScalar(prevDist)
        : this._v3C.set(0, 0.6, -0.8).normalize();

      this.cameraControl.object.position.copy(head).addScaledVector(prevDir, this._cameraDesiredDist);
      this.cameraControl.target.copy(head);
      this.cameraControl.update();
    }

    // Springarm: si hay terreno entre la cabeza y la camara, acercarla.
    // Throttled a cada 3 frames — la camara no cambia radicalmente en 1 frame.
    this._v3A.copy(this.camera.position).sub(head);                  // postOffset
    const postDist = this._v3A.length();
    const postDir = postDist > 0
      ? this._v3B.copy(this._v3A).divideScalar(postDist)
      : this._v3B.set(0, 0.6, -0.8).normalize();
    if (!this._springArmFrame) this._springArmFrame = 0;
    this._springArmFrame++;
    if (this._springArmFrame % 5 === 0 || this._springArmCachedDist === undefined) {
      this._springArmCachedDist = this._clampCamDist(head, postDir, this._cameraDesiredDist);
    }
    if (this._springArmCachedDist < postDist) {
      this.camera.position.copy(head).addScaledVector(postDir, this._springArmCachedDist);
    }

    // Refresh shadow map every 3 frames — sun + scene move slowly, eye
    // doesn't notice a 50ms lag in shadow position. Roughly 3x cheaper than
    // re-rendering the shadow pass every frame.
    if (!this._shadowFrame) this._shadowFrame = 0;
    this._shadowFrame++;
    if (this._shadowFrame % 3 === 0) this.renderer.shadowMap.needsUpdate = true;

    // Cull distant shadow casters every 30 frames (~0.5 s). The shadow
    // camera frustum only covers ~3 chunks around the player so meshes
    // further away never write to the shadow map; toggling castShadow off
    // saves their per-mesh setup in the shadow pass.
    if (this._shadowFrame % 30 === 0) {
      this.chunkManager.updateShadowCastersByDistance(this.model.position.x, this.model.position.z);
    }

    this.renderer.render(this, this.getCamera());

    this.chunkManager.updateScroll(this.model.position.x, this.model.position.z);
    // Drain a few queued mesh builds (worker results land here).
    this.chunkManager.tick();


    // Feedback throttled a ~10Hz: el raycaster contra cada InstancedMesh
    // sigue siendo el coste mas alto del update. A 10Hz el highlight sigue
    // sintiendose instantaneo y el ahorro de FPS es enorme (de 60 raycasts/s
    // a 10/s).
    if (this.guiControls.activarWireframe) {
      const now = performance.now();
      if (!this._feedbackNext || now >= this._feedbackNext) {
        this.updateFeedback();
        this._feedbackNext = now + 100;
      }
    }
    else {
      this.raycast.hideSelectionBox();
    }

    const blocks = this.chunkManager.getPlayerCollisions(this.model.position.x, this.model.position.z);
    this.model.update(blocks, this.mapTeclas);

    this.npcManager.update(delta);
    



    requestAnimationFrame(() => this.update())
  }

}


// main
window.addEventListener('DOMContentLoaded', function () {
  const scene = new MyScene("#WebGL-output");
  window.addEventListener("resize", () => scene.onWindowResize());
  scene.update();
});