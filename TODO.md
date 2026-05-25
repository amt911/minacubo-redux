# TODO — MinaCubo Redux

Roadmap para robustez (Docker, tests, TDD) y mejoras de juego.

## Fase 1 — Tooling base

- [x] Crear `.gitignore` (node_modules, coverage, .DS_Store)
- [x] Inicializar `package.json` con scripts `dev` / `test` / `lint` / `format`
- [x] Instalar Vitest + jsdom como devDependencies
- [x] Crear `vitest.config.js` (environment node, coverage v8)
- [x] Configurar ESLint flat config + reglas básicas
- [x] Configurar Prettier (`.prettierrc`) + `.prettierignore`
- [x] Añadir `jsconfig.json` con `checkJs` + paths
- [x] Añadir `// @ts-check` a archivos JS principales
- [x] Crear `Dockerfile` (nginx:alpine sirviendo estáticos)
- [x] Crear `docker-compose.yml` con volume mount dev
- [x] Crear `.dockerignore`
- [x] Crear `.devcontainer/devcontainer.json`
- [x] Crear `.github/workflows/ci.yml` (lint + test en push/PR)
- [x] Añadir badge CI + cobertura al README

## Fase 2 — TDD lógica pura

- [x] Usar npm para los paquetes, ahora mismo están copiados a lo cutre
- [x] Mejorar la lógica por completo de colisiones. Ahora mismo va muy mal (si se pone debajo de un árbol y se salta se sube automáticamente a la copa, si se colisiona contra un cubo y se sigue andando tiembla, etc)
- [x] Mejorar la iluminación, ahora mismo es plana.
- [x] Revisar el algoritmo de ruido perlin y usar mejor un paquete npm.
- [x] Extraer AABB de `colisiones.js` a función pura testable
- [x] Escribir `colisiones.test.js` (overlap total, tangente, eje único, sin overlap)
- [x] Tests `ParametrosMundo.js` (snapshot constantes)
- [x] Extraer `ArbolRoble` a función pura → `estructuras.test.js` (shape, conteo tronco/hojas)
- [x] Extraer `chunkMath.js` de `MyScene.js` (identificarChunk, world↔chunk coords)
- [x] Tests `chunkMath` (bordes, negativos, midpoint shift)
- [x] Seed determinista Perlin (param opcional, fallback random)
- [x] Tests terrain con seed fijo (snapshot heightmap)
- [x] Hacer el feedback muchísimo más eficiente para que esté siempre activo y no consuma tantos recursos.
- [x] Mejorar la distribución de los archivos, ahora mismo están todos al tuntún.
- [x] Mejorar controles juego, ahora mismo para mover la cámara se hace con la rueda del ratón pulsándola y no se puede hacer nada más. Asimismo, si se mueve la cámara hace clip por debajo del terreno. Lo que quiero es algo como minecraft porque ademas no se puede mover la camara y mover al jugador al mismo tiempo, provoca que se quede pillado moviendose en las ultimas teclas pulsadas.
- [x] Cambiar y usar TypeScript 
- [x] Mejorar cámara, quiero que cuando se mueva lo más abajo posible no clipee con el suelo, pero esto quiere decir que cuando haya algún suelo más abajo, debe bajar la cámara más, así como si hay montañas. En el caso de las montañas, lo suyo es acercar la cámara para no ver el interior de las mismas.
- [x] Limpiar funciones y paquetes deprecated (por ejemplo, tween.update)

## Fase 3 — Refactor god class

Romper `MyScene.js` (1105 líneas):

- [x] Extraer `ChunkManager.js`
- [x] Extraer `InputHandler.js`
- [x] Extraer `NPCManager.js`
- [x] Extraer `DayNightCycle.js`
- [x] Extraer `RaycastInteraction.js`
- [x] Extraer `BlockRegistry.js` (catálogo Cubo subclases)
- [x] Event bus mini (mitt vendored o 20-line custom) en `libs/`
- [x] Clase base `NPC` + strategies (Follow, Patrol, Flee)
- [x] Convertir todos los archivos y código al inglés.
- [x] Mejorar el feedback del cubo que se va a crear/eliminar (ahora mismo es muy fino y tiene una linea en el cuadrado)

Mejorar la gestión de chunks:

- [x] Hacer el algoritmo más eficiente. → Ver Fase 5: per-chunk bounding sphere, bit-packed occupancy, deferred dispose, LOD distant chunks, adaptive LOD, LRU eviction, worker pool dinámico. **build_avg 4.94 → 0.72ms (-85%)**.
- [x] Hacer que se generen chunks en ejes negativos (ahora mismo no se generan y el personaje se puede caer).
- [x] Intentar quitar la niebla → Fog OFF por defecto + GUI toggle `Niebla (edge fog)`. Con LOD + perf, pop-in mínimo sin niebla.

**Fase 3 cerrada.** Refactor MyScene → módulos completo, gestión chunks eficiente, niebla opcional.

## Fase 4 — Features juego

- [x] Health/Damage Esteban con barra HUD
- [ ] Save/Load chunks en IndexedDB (serializar bloques + seed)
- [ ] Inventario real con contadores + hotkeys 1-9
- [ ] Crafting grid 2x2 + tabla recetas JSON
- [ ] Web Audio API (pasos, romper bloque, ambiente)
- [ ] Nuevos mobs (vaca, esqueleto, pollo) usando NPC base
- [ ] Biomas vía 2do canal Perlin (desierto, nieve, bosque)
- [ ] Cuevas con Perlin 3D (huecos en terreno)
- [ ] Iluminación dinámica antorchas + `PiedraLuminosa` (PointLight)
- [ ] Controles touch/mobile (joystick virtual + botones)
- [ ] Ver alguna forma de hostearlo (quizás con vercel)
- [ ] Ajustes de gráficos del juego
- [ ] Añadir generador de niveles como en minecraft
- [ ] Añadir fisica de agua.

## Fase 5 — Performance (cerrada por ahora — todo lo restante son refactors grandes deferidos)

- [x] Frustum culling chunks fuera de cámara
- [x] Face culling: blocks with all 6 neighbours occupied are skipped (~50-70% drop)
- [x] Generación chunks en Web Worker
- [x] Cap renderer.pixelRatio (HiDPI screens render at 4× cost)
- [x] MeshPhong → MeshLambert (cheaper per-pixel)
- [x] Preload 1-chunk ring around visible window (chunk-cross no longer lags)
- [x] Time-budgeted mesh tick + nearest-first ordering
- [x] Shrink sun shadow camera frustum (~30% shadow-pass cost)
- [x] Cache getPlayerCollisions cuando player no cambia de bloque entero (skip ~12k-block scan/frame)
- [x] Raycast (block break/place + springarm) limitado a 3×3 chunks alrededor del player (era O(allMeshes))
- [x] Bounding sphere chunk corregido (20→60, montañas ya no over-culled — revertido a 20, ver per-chunk abajo)
- [x] Dedupe gens en el worker pool + tick siempre construye queued chunks + dispose scan completo
- [x] Hysteresis en window slide (DR par ya no oscila cada frame)
- [x] HUD métricas in-game (calls, tris, meshes, instances, queue, build avg ms)
- [x] Bench harness in-page + puppeteer-core runner + CI workflow (.github/workflows/bench.yml) con baseline.json + diff vs baseline
- [x] Bit-packed occupancy keys (Int32 hash → 0 alloc en hot path, **build -84.5%** según bench)
- [x] Deferred dispose queue (drain across frames, no hitch en scroll)
- [x] Distance-based shadow casting (toggle castShadow por distancia, throttle 30 frames)
- [x] Per-chunk bounding sphere real via geometry.clone() (**calls -55%, tris -61%** según bench)
- [x] Pool de THREE.Vector2/Raycaster en RaycastInteraction
- [x] Skip raycast feedback cuando idle (interval 100ms→500ms sin keys + sin pointer-lock)
- [x] chunkCollision leak fixed (replaced array con counter monotónico)
- [x] Drop dead allMeshes Array + cleanup empty chunkMeshes[xKey] tras dispose
- [x] Rebuild chunk mesh on cardinal neighbour load (face culling refreshes en boundary)
- [x] Worker pool dinámico (`hardwareConcurrency - 2`, cap [2..8]) en lugar de fijo 4
- [x] Underground bulk cull (Stone/Dirt/Rock hidden cuando playerY > chunkMaxY + 10)
- [x] raycaster.far = 20 en RaycastInteraction (short-circuit per-triangle tests más allá)
- [x] Shadow map needsUpdate cada 6 frames en vez de 3 (sun mueve lento, ~100ms lag invisible) — revertido a 3 + slider
- [x] GUI sliders para todo: shadowExtent (8..96), shadowRefreshFrames (1..10), shadowCasterRange (0..8), shadowResolution + opción 4096, [Reset] button restaura defaults
- [x] Render distance cap subido 32 → 64
- [x] LOD chunks distantes (FAR ring emite solo top-of-column, **fps +12%, p99 -25%, tris -27%** según bench)
- [x] Adaptive LOD (auto-tune lodNearRadius por FPS: shrink si <30, grow si >55, cooldown 3s)
- [x] HUD muestra LOD radius + adaptive on/off
- [x] mesh.matrixAutoUpdate=false en chunk meshes (no se mueven, evita updateMatrix per-frame)
- [x] LRU eviction de chunk block data lejana (memory leak fix — worker re-gen on return)
- [x] Skip shadow pass cuando sun.intensity < 0.65 (noche = shadows imperceptibles vs ambient)
- [x] Tree-hole bug fixed (topYByCol excluye leaves/wood — grass bajo trunk se mantiene en LOD FAR)
- [x] LOD FAR mejora visual: keep top + 3 abajo (cliff faces correctos) + trees full detail (no leaves flotando)

**Cumulative bench impact (initial → final, headless software GL, DR=12):**
- fps_avg `3.41 → 5.06` **(+48%)**
- frame_avg_ms `293 → 198` **(-32%)**
- max_calls `329 → 151` **(-54%)**
- max_tris `197k → 113k` **(-43%)**
- build_avg_ms `4.94 → 0.81` **(-84%)**

### Pendiente (orden ROI estimado, todo refactor grande)

- [ ] **Texture atlas + greedy meshing** (multi-step pero win gigante; bloquea per-face culling útil)
- [ ] **Move mesh-build occupancy + grouping a worker** (offload main thread; complica plumbing porque worker necesita 3×3 chunk data o SharedArrayBuffer)
- [ ] **Pre-allocate InstancedMesh capacity** (block break/place rebuilea chunk entero hoy; pre-alloc + count bump = edit barato)
- [ ] **Per-face culling** (reintentar tras atlas+greedy; sin atlas hace instance overhead > savings)
- [ ] **CSM (cascaded shadow maps)** (sombras nítidas cerca + baratas lejos; Three.js addon disponible)
- [ ] **Octree / grid spatial index para raycast** (getMeshesNear ya mitiga; sólo relevante si DR sube ≥30 o features tipo arrows trazadoras)
- [ ] Front-to-back depth pre-pass (eliminar overdraw fragment cost para terrain complejo)
- [ ] Web worker para terrain noise generation parallelization (ya en worker, pero podrían generar región pre-emptive)
- [ ] Compressed textures (KTX2 + Basis Universal) — menos VRAM, faster sampling
- [ ] Frustum & occlusion query (WebGL2 BeginQuery EXT_disjoint_timer_query) para sólo dibujar chunks no ocluidos
- [ ] DR adaptativo: si fps < 30, bajar DR temporalmente; si > 55, subir
- [ ] OffscreenCanvas: render en worker (Chrome/Firefox support, no Safari aún)
- [ ] Material/shader instancing: GrassSide+GrassTop+GrassBottom como sub-mesh con custom shader que sample texture por face → un solo material por block type

### Nuevas ideas (brainstorm reciente)

- [ ] **TypedArray block storage** (reemplazar `{x,y,z,material}` objects con parallel Int16Array(x), Int16Array(z), Int8Array(y2), Uint8Array(materialIdx). 4 bytes/block vs ~100. Memory + cache locality + transferable via worker)
- [ ] **Combine all chunks of same material into one mega-mesh** (1 draw call por material global. Loses per-chunk culling pero brutalmente menos draw calls)
- [ ] **Worker mesh-prep pipeline**: worker genera blocks + pre-groups + pre-computes occupancy. Main thread sólo InstancedMesh alloc + setMatrixAt. Requiere TypedArray storage primero.
- [ ] **Block edits as instance count tweaks**: pre-alloc InstancedMesh con capacity > exact count, on add/remove bump count + setMatrixAt slot único (no full rebuild)
- [ ] **Lazy chunk gen direccional**: solo gen chunks en cono frontal del player (180°). Reduce queue 50%.
- [ ] **Pool block objects en chunkGen** (alloc once, reuse across chunks via free list)
- [ ] **Pre-gen pre-emptive**: worker genera 1 ring extra mientras idle, jugador no espera al llegar
- [ ] **NPC update skip cuando lejos/invisible**: zombie + pig sólo animate si dentro de frustum + radius limit
- [ ] **DR cap dinámico (max safe DR)** detectar GPU tier (renderer.info de primera frame), settear DR sensible
- [ ] **GUI toggle "skip night shadows"** (actual hardcoded threshold 0.65, podría ser slider)
- [ ] **PR comment con tabla diff** (workflow_dispatch "promote" para actualizar bench/baseline.json automáticamente)

## Fase 6 — Ambicioso

- [ ] Multiplayer: WebSocket server Node sincronizando bloques

## Fase 7 — Docs

- [ ] Actualizar `CLAUDE.md` con nueva arquitectura modular
- [ ] Actualizar `README.md` con instrucciones Docker + tests + dev

---

## Orden recomendado arranque

1. Fase 1 completa (1h aprox) — verde antes tocar código juego.
2. Fase 2 (TDD práctica con lógica pura existente).
3. Fase 3 (refactor con tests cubriendo).
4. Fase 4+ según prioridad personal.
