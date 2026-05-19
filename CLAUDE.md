# MinaCubo Redux — Claude Guide

## Start here

Run `/graphify` before each session. The graph at `graphify-out/graph.json` maps module dependencies so you avoid re-reading the whole codebase every time.

## ⚡ graphify — use every session

```
/graphify            # first run (builds graph)
/graphify --update   # incremental (after changes)
/graphify query "<pregunta>"    # architecture questions
/graphify explain "<symbol>"    # locate a concept
```

Outputs in `graphify-out/`: `graph.json`, `GRAPH_REPORT.md`, `graph.html`.

## Stack

- **Three.js** (r140) — `three` npm package, imported via importmap
- **Vanilla JS ES Modules + importmap** — no bundler, no build step. Deps resolved at runtime by browser via `<script type="importmap">` in `index.html` pointing at `/node_modules/...`
- **lil-gui** — runtime controls panel (sucesor mantenido de dat.GUI)
- **OrbitControls / Stats** — vía `three/addons/...`
- **noisejs** — procedural terrain, instanciado como `new Noise(seed)`. Cargado como global script tag (UMD)
- **@tweenjs/tween.js** — day/night cycle animation

Run:

- **Local rápido**: `npm run dev` → `serve -l 3000 .` en <http://localhost:3000>
- **Docker dev**: `make up` (o `npm run compose:up`) → <http://localhost:8080>, hot deps via named volume
- **Docker prod**: `make prod` (o `npm run compose:prod`) → nginx multi-stage en <http://localhost:8080>

Requires `npm install` first (deps en `node_modules/` servidas estáticamente).

## File map

| File | Role |
| --- | --- |
| `index.html` | Entry point. Loads scripts, defines DOM structure (WebGL output, tile bar, cursor) |
| `MyScene.js` | God class. Extends `THREE.Scene`. Owns game loop (`update()`), chunk system, rendering, input handling, NPC orchestration |
| `Cubo.js` | Block type classes: `Cubo` base, then `Hierba`, `Tierra`, `Piedra`, `Roca`, `MaderaRoble`, `PiedraBase`, `Cristal`, `PiedraLuminosa`, `HojaRoble` — each sets geometry + multi-material textures |
| `Esteban.js` | Player character (humanoid mesh, physics, camera attachment, movement via key map) |
| `Zombie.js` | NPC enemy — follows player, has bounding box for collision |
| `Cerdo.js` | NPC pig — waypoint-based patrol, physics |
| `estructuras.js` | Composite structures: `ArbolRoble` (oak tree) — arrays of block positions for trunk + leaves |
| `colisiones.js` | Collision detection utilities |
| `ParametrosMundo.js` | World constants. `PIXELES_ESTANDAR = 16` (pixels per block unit) |

## Architecture — non-obvious decisions

- **InstancedMesh per block type**: all blocks of the same material share one `THREE.InstancedMesh`. Adding/removing a block rebuilds the entire mesh for that type. This is the main perf bottleneck.
- **Chunk system**: world split into `TAM_CHUNK × TAM_CHUNK` columns. `chunk[x][z]` holds block array for that column. `chunkMinMax` tracks visible window. On scroll past midpoint, window shifts and new chunks are generated or retrieved.
- **Procedural terrain**: `this.noise.perlin2(xoff, zoff) * amplitud` gives height per column (`this.noise` = `new Noise(seed)` instance from noisejs). `amplitud` randomized each load so each session has different terrain.
- **Block coordinate system**: world units = block units × `16 / PIXELES_ESTANDAR` = 1. Blocks sit at `y = v - 8/16` (centered, since BoxGeometry is centered at origin).
- **Raycasting for interaction**: center-screen ray (`mouse = (0.5, 0.5)`). Face index 0–5 determines which side was hit, offset applied to get adjacent block position.
- **Day/night**: TWEEN animates fog color + hemisphere light intensity from sky blue to black and back, repeat+yoyo, 60s cycle.

## Tests

No test suite exists yet. Pure logic worth testing first:

| Module | What to test |
| --- | --- |
| `colisiones.js` | Collision detection functions — pure logic, no Three.js needed |
| `estructuras.js` | `ArbolRoble` block arrays — shape/count assertions |
| `ParametrosMundo.js` | Constants |
| `MyScene.js` helpers | `identificarChunk(x, z)` — pure math, extract and unit test |

Vitest ya configurado (`vitest.config.js`). Comandos:

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
```

Keep tests in `*.test.js` files beside the source. Three.js classes can be mocked — only test pure data transformations, not rendering.

### TDD

For new pure logic (chunk math, collision, structure generation):

1. **Red** — write failing test describing the behavior.
2. **Green** — minimal implementation to pass.
3. **Refactor** — clean up with tests green.

Don't TDD rendering code or Three.js scene construction — not testable without a WebGL context.

## Working rules

- **Deps via npm + importmap** — añadir un paquete: `npm install <pkg>` + entrada nueva en el importmap de `index.html` apuntando a `/node_modules/<pkg>/...`. Imports en JS usan bare specifiers (`import x from 'pkg'`).
- **No bundler** — el navegador resuelve módulos vía importmap. Vite/webpack romperían el modelo.
- **`PIXELES_ESTANDAR` is 16** — all size calculations derive from this. Don't hardcode `16` without referencing `PM.PIXELES_ESTANDAR`.
- **Chunk rebuild is expensive** — don't trigger `renderChunksAgain` unnecessarily. Block add/remove already rebuilds only the affected material mesh.
- **`estaColindando` / `estaEnArbol`** are O(n) scans on small lists — fine for current chunk sizes, but mark if chunk size grows significantly.
