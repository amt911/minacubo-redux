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

- **Three.js** (r140, ES module, local at `libs/three.module.js`) — core rendering
- **Vanilla JS ES Modules** — no bundler, no npm, no build step
- **dat.GUI** (`libs/dat.gui.module.js`) — runtime controls panel
- **OrbitControls** (`libs/OrbitControls.js`) — camera orbit around player
- **Perlin noise** (`libs/perlin.js`) — procedural terrain via `noise.perlin2()`
- **TWEEN** (`libs/tween.esm.js`) — day/night cycle animation
- **jQuery** (`libs/jquery.js`) — DOM manipulation and stats mount
- **Stats** (`libs/stats.module.js`) — FPS counter

Run via any static file server (e.g. `npx serve .` or Live Server in VS Code). No `npm install`.

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
- **Procedural terrain**: `noise.perlin2(xoff, zoff) * amplitud` gives height per column. `amplitud` randomized each load so each session has different terrain.
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

Recommended setup when adding tests:

```bash
npm init -y
npm install -D vitest
```

`vitest.config.js`:
```js
export default { test: { environment: 'node' } }
```

Keep tests in `*.test.js` files beside the source. Three.js classes can be mocked — only test pure data transformations, not rendering.

### TDD

For new pure logic (chunk math, collision, structure generation):

1. **Red** — write failing test describing the behavior.
2. **Green** — minimal implementation to pass.
3. **Refactor** — clean up with tests green.

Don't TDD rendering code or Three.js scene construction — not testable without a WebGL context.

## Working rules

- **No npm packages without asking** — libs are vendored in `libs/`. Adding a package means a new `.js` file there, not an `npm install`.
- **No bundler** — imports must be relative paths or bare `../libs/` paths. No `import from 'three'`.
- **`PIXELES_ESTANDAR` is 16** — all size calculations derive from this. Don't hardcode `16` without referencing `PM.PIXELES_ESTANDAR`.
- **Chunk rebuild is expensive** — don't trigger `renderChunksAgain` unnecessarily. Block add/remove already rebuilds only the affected material mesh.
- **`estaColindando` / `estaEnArbol`** are O(n) scans on small lists — fine for current chunk sizes, but mark if chunk size grows significantly.
