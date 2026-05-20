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
- [ ] Mejorar la lógica por completo de colisiones. Ahora mismo va muy mal (si se pone debajo de un árbol y se salta se sube automáticamente a la copa, si se colisiona contra un cubo y se sigue andando tiembla, etc)
- [ ] Mejorar la iluminación, ahora mismo es plana.
- [x] Revisar el algoritmo de ruido perlin y usar mejor un paquete npm.
- [x] Extraer AABB de `colisiones.js` a función pura testable
- [x] Escribir `colisiones.test.js` (overlap total, tangente, eje único, sin overlap)
- [x] Tests `ParametrosMundo.js` (snapshot constantes)
- [x] Extraer `ArbolRoble` a función pura → `estructuras.test.js` (shape, conteo tronco/hojas)
- [x] Extraer `chunkMath.js` de `MyScene.js` (identificarChunk, world↔chunk coords)
- [x] Tests `chunkMath` (bordes, negativos, midpoint shift)
- [x] Seed determinista Perlin (param opcional, fallback random)
- [x] Tests terrain con seed fijo (snapshot heightmap)
- [ ] Hacer el feedback muchísimo más eficiente para que esté siempre activo y no consuma tantos recursos.
- [x] Mejorar la distribución de los archivos, ahora mismo están todos al tuntún.

## Fase 3 — Refactor god class

Romper `MyScene.js` (1105 líneas):

- [ ] Extraer `ChunkManager.js`
- [ ] Extraer `InputHandler.js`
- [ ] Extraer `NPCManager.js`
- [ ] Extraer `DayNightCycle.js`
- [ ] Extraer `RaycastInteraction.js`
- [ ] Extraer `BlockRegistry.js` (catálogo Cubo subclases)
- [ ] Event bus mini (mitt vendored o 20-line custom) en `libs/`
- [ ] Clase base `NPC` + strategies (Follow, Patrol, Flee)
- [ ] Convertir todos los archivos y código al inglés.

## Fase 4 — Features juego

- [ ] Health/Damage Esteban con barra HUD
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

## Fase 5 — Performance

- [ ] Frustum culling chunks fuera de cámara
- [ ] Generación chunks en Web Worker
- [ ] Greedy meshing (bloques contiguos misma cara → quad único)
- [ ] LOD chunks lejanos (geometría simplificada)

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
