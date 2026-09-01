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

## 🧠 Heavy jobs run inside a memory cgroup (MANDATORY)

**No exceptions:** any long or parallel job started here — the full test suite, coverage, mutation
testing, a production build, Playwright, a `turbo`/workspace fan-out, anything that spawns workers —
runs under a kernel-enforced memory ceiling:

```bash
systemd-run --user --scope --quiet -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>
```

**6 GB is the standing ceiling on this machine** (raised from 4 GB by the user on 2026-08-11); don't
exceed it without being told to. `MemoryHigh` throttles and reclaims, `MemoryMax` is the hard stop,
`MemorySwapMax=0` keeps the job from thrashing swap instead of respecting either. Verify it is
actually in force rather than assuming:
`systemctl --user show <scope> -p MemoryMax -p MemoryHigh -p MemoryCurrent`.

**Cap the tool too — but never *instead* of the cgroup.** Pass the tool's own concurrency limit
(`--concurrency`, `--maxWorkers`, `workers`, `--parallel`) so the job isn't throttled to a crawl by
the ceiling. A tool's default concurrency is not a budget, and an estimate of per-worker RSS is not a
ceiling. Only the cgroup is.

**Why this is a rule and not advice:** a mutation-testing run on this 24-core box sized its worker
pool from the core count and spawned **23 workers at ~2.3 GB each** — ~50 GB of demand on 31 GB of
RAM. It took the whole machine down hard enough that the user had to power-cycle it; `systemd-oomd`
did not save it. The run before that was wasted too: with the machine starving, **139 of the first
142 mutants "timed out"**, and a timeout is scored as *killed*, so the result came out inflated by
starvation and meant nothing. A job that OOMs the box doesn't merely fail — it also hands you
numbers you'd trust by mistake.

## Stack

- **Three.js** (r140) — `three` npm package, imported via importmap
- **Vanilla JS ES Modules + importmap** — no bundler, no build step. Deps resolved at runtime by browser via `<script type="importmap">` in `index.html` pointing at `/node_modules/...`
- **lil-gui** — runtime controls panel (sucesor mantenido de dat.GUI)
- **OrbitControls / Stats** — vía `three/addons/...`
- **simplex-noise** — ESM-native. Terrain via `src/noise.js` wrapper (`createTerrainNoise(seed?)`) que combina `createNoise2D` + Mulberry32 PRNG inline. Seed determinista, opcional.
- **@tweenjs/tween.js** — day/night cycle animation

Run:

- **Local rápido**: `npm run dev` → `serve -l 3000 .` en <http://localhost:3000>
- **Docker dev**: `make up` (o `npm run compose:up`) → <http://localhost:8080>, hot deps via named volume
- **Docker prod**: `make prod` (o `npm run compose:prod`) → nginx multi-stage en <http://localhost:8080>

Requires `npm install` first (deps en `node_modules/` servidas estáticamente).

**Dev server siempre corriendo en <http://localhost:8080> durante sesiones.** No levantar otro servidor (`npm run dev`, `serve`, etc.) — el usuario ya lo tiene abierto. Los cambios a `src/` se sirven en caliente; basta con que el usuario refresque el navegador para probar.

## File map

Todos los `.js` de aplicación viven en `src/`. Tests `*.test.js` viven junto al código fuente.

| File | Role |
| --- | --- |
| `index.html` | Entry point (root). Importmap + script tags + DOM. Carga `src/MyScene.js` como módulo. |
| `src/MyScene.js` | God class. Extends `THREE.Scene`. Owns game loop (`update()`), chunk system, rendering, input handling, NPC orchestration |
| `src/Cubo.js` | Block type classes: `Cubo` base, then `Hierba`, `Tierra`, `Piedra`, `Roca`, `MaderaRoble`, `PiedraBase`, `Cristal`, `PiedraLuminosa`, `HojaRoble` — each sets geometry + multi-material textures |
| `src/Esteban.js` | Player character (humanoid mesh, physics, camera attachment, movement via key map) |
| `src/Zombie.js` | NPC enemy — follows player, has bounding box for collision |
| `src/Cerdo.js` | NPC pig — waypoint-based patrol, physics |
| `src/estructuras.js` | Composite structures: `generarArbolRoble` pure fn + `ArbolRoble` class wrapper |
| `src/colisiones.js` | Collision detection — `Colisiones` class. Usa `aabb.js` para test AABB-AABB. |
| `src/aabb.js` | AABB pure: `aabbIntersect`, `aabbFromCenter`. Sin Three.js. |
| `src/chunkMath.js` | Chunk math pure: `identificarChunk`, `chunkToWorld`, `shiftMinMaxIfNeeded`. |
| `src/noise.js` | Terrain noise pure: `createTerrainNoise(seed?)` + `mulberry32` PRNG. Sin Three.js. |
| `src/ParametrosMundo.js` | World constants. `PIXELES_ESTANDAR = 16` (pixels per block unit) |

## Architecture — non-obvious decisions

- **InstancedMesh per block type**: all blocks of the same material share one `THREE.InstancedMesh`. Adding/removing a block rebuilds the entire mesh for that type. This is the main perf bottleneck.
- **Chunk system**: world split into `TAM_CHUNK × TAM_CHUNK` columns. `chunk[x][z]` holds block array for that column. `chunkMinMax` tracks visible window. On scroll past midpoint, window shifts and new chunks are generated or retrieved.
- **Procedural terrain**: `this.noise(xoff, zoff) * amplitud` gives height per column (`this.noise` = `createTerrainNoise()` que devuelve `noise2D` de simplex-noise seedado con Mulberry32). `amplitud` randomized each load. Pasar seed a `createTerrainNoise(seed)` reproduce el terreno.
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

## Real-environment verification — what no in-process test can prove

**There is no build step here.** Dependencies are resolved at runtime by the browser from the
`<script type="importmap">` in `index.html`. That means nothing — no bundler, no type-checker, no
Vitest run — ever validates an import path. A typo in a `three/addons/...` specifier is not a compile
error; it is a 404 at page load, and the page is blank. The unit suite stays green throughout.

The second gap is rendering. `## Tests` already says it: don't TDD Three.js scene construction, "not
testable without a WebGL context". And `## Agentic PR verification` already says the agent's reach is
a boot/smoke check because "there's no DOM accessibility tree inside the Three.js canvas". Both are
correct, and together they define exactly the hole this section fills.

**Write the boot check as a script, commit it, and name it here.** It runs by hand with no arguments,
prints a per-phase `PASS`/`FAIL`, and exits non-zero on the first failure.

What "real environment" means here, concretely:

- **A real GPU, not a software rasterizer.** Headless Chromium falls back to SwiftShader; it will
  happily "render" a scene at a frame rate that means nothing. Assert what you are actually running
  on — `gl.getParameter(gl.RENDERER)` — before trusting any visual result.
- **The page loaded over the dev server on `localhost:8080`**, which is already running (don't start
  another one). Assert **zero console errors and zero failed requests** — with an importmap, a failed
  request *is* the missing-dependency error you would otherwise get at build time.
- **More than one browser.** Import maps, ESM specifier resolution and WebGL extension availability
  differ per engine. What Chrome resolves, Firefox may not.
- **If this is ever wrapped for mobile** (Capacitor, a TWA, or a native shell), the engine for that
  build is **Maestro** — YAML flows in `.maestro/` against the real APK on an emulator, with
  `maestro hierarchy` and `maestro mcp` for discovery (`maestro studio` no longer exists in Maestro
  2.x) — never a Playwright `devices[...]` descriptor, which is a viewport and not a device. Note it
  buys less here than elsewhere: `maestro hierarchy` sees the WebView or the GL surface as **one
  opaque node**, exactly as the agentic pass already finds with the Three.js canvas. It would prove
  the app boots, gets a GL context and shows the HUD; the deterministic seed-to-terrain checks stay
  the real gate.
- **A fixed seed.** The terrain noise is deterministic (`createTerrainNoise(seed?)` = simplex +
  inline Mulberry32). That determinism is the only thing that makes a visual check meaningful.

### The names, so you can ask for them by name

| Name | What it means here |
| --- | --- |
| **E2E / boot-and-smoke acceptance test** | Loads the real page in a real browser and asserts on observable behaviour — the canvas has a GL context, the lil-gui HUD is present, zero console errors, zero failed requests — never on internals. |
| **Contract test** | Checks that assumptions about a dependency or the platform hold, which here is unusually load-bearing because *nothing is bundled*: does every bare specifier in the importmap actually resolve from `node_modules/` as served; does `three/addons/...` exist at the pinned r140 layout; is `simplex-noise` still ESM-native; does this engine expose the WebGL extensions the renderer asks for. Any of these fails at runtime only. |
| **Mutation testing** (in the browser: by hand) | Revert the fix, reload, confirm the check goes red, restore. **A check that has never failed has not been tested** — a "no console errors" assertion that has never seen a broken import proves nothing. |
| **State-invariant test** | Asserts a relationship **between two things** no unit test owns: the same seed must always produce the same terrain (hash the generated heightmap and compare), a chunk's collision geometry must match the mesh actually drawn, and the day/night tween's state must match the light it drives. Each side is individually fine; the pair is what breaks. |
| **Test pollution / isolation leak** | A test writing state that outlives it — into `node_modules/` (which is served statically here, so a write changes what the browser loads), into the named Docker volume, or by starting a second server on a port the user already has open. |

### Rules that came out of real bugs, not theory

- **Prove every new check can fail before you trust it green.** Revert the fix, reload, watch it go
  red, restore. A green you have never seen turn red is not evidence.
- **Never assert on a count you cannot predict.** Frame rate, triangle count, chunks loaded and draw
  calls all depend on the GPU, the driver and the window size — a threshold assertion ("above 55
  fps", "fewer than 300 draw calls") passes on your machine and reports PASS against a genuinely
  broken build on another. Assert the **invariant**: the same seed gives the same terrain hash; the
  player never falls through a solid block; a chunk boundary has no gap; there are **zero** console
  errors.
- **A cache or seed marker must die with the data it describes.** A cached chunk that outlives the
  seed that generated it produces a world that is silently inconsistent with itself — no crash, no
  log.
- **A test must not write into anything the browser reads.** `node_modules/` is served statically:
  writing there during a test changes the product under test. Use throwaway paths and restore in a
  teardown that runs even when the test fails.
- **Run it the way that actually works on this machine.** The dev server is already up on
  `localhost:8080` — reuse it, don't launch another. Reference screenshots are GPU-dependent, so
  record which machine and driver produced one next to the image, or the diff is noise:

  ```bash
  # dev server already running on :8080 — do not start another
  scripts/verify-boot.sh          # headed, real GPU: context, HUD, zero errors, zero 404s
  npm test                        # deterministic logic stays the hard gate
  ```

## Agentic PR verification (MANDATORY on every PR)

**Every PR MUST be verified end-to-end before merge, and the verdict MUST be posted as a PR
comment** via `gh pr comment`. A local headless `claude -p` agent drives the running game in a
browser (**Playwright MCP** against the dev server on `localhost:8080`) and posts the result; it
**never merges** — it waits for you. Running the pass and posting the verdict comment is **not
optional**. It catches what the diff and unit tests miss: missing buttons, unimplemented content,
dead flows, off-spec screens.

- **Engine + caveat for a WebGL canvas.** Playwright MCP against `localhost:8080`. There's no DOM
  accessibility tree inside the Three.js canvas, so the agent can't navigate 3D content by
  role/label — its reach is a **boot/smoke check** (page loads, canvas renders, no console errors,
  the lil-gui HUD is present) plus any DOM UI. Deep behavior stays with the deterministic unit tests.
- **Two layers.** The Vitest unit tests on pure logic (`chunkMath`, `colisiones`, `estructuras`,
  `noise`) stay the **hard merge gate**; the agentic pass (boot/smoke + a readable verdict) is
  advisory and never vetoes a merge on its own — but running it and posting the verdict comment
  is mandatory.
- **Hard limits.** The verdict awaits your close and the agent **never merges** (see *Git &
  GitHub*). Scope `--allowedTools`; use `--dangerously-skip-permissions` only in a controlled
  local env.

## Working rules

- **Heavy or parallel jobs run inside a memory cgroup** — never launch a suite, build or
  fan-out on a bare estimate; wrap it in
  `systemd-run --user --scope -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>`
  and cap the tool's own concurrency too.
- **UI work → design context first, then `impeccable` + superpowers** — for any UI change (the DOM chrome: lil-gui HUD, menus, overlays — the 3D world is out of scope), invoke the `impeccable` skill. **If the project has no design context (`PRODUCT.md` / `DESIGN.md` at the repo root), run `$impeccable teach`** — it explores the codebase and interviews you about the project's direction, then writes `PRODUCT.md` + `DESIGN.md` (auto-migrating a legacy `.impeccable.md` → `PRODUCT.md`); never hand-author it. Don't hand-roll UI without impeccable + superpowers.
- **Deps via npm + importmap** — añadir un paquete: `npm install <pkg>` + entrada nueva en el importmap de `index.html` apuntando a `/node_modules/<pkg>/...`. Imports en JS usan bare specifiers (`import x from 'pkg'`).
- **No bundler** — el navegador resuelve módulos vía importmap. Vite/webpack romperían el modelo.
- **`PIXELES_ESTANDAR` is 16** — all size calculations derive from this. Don't hardcode `16` without referencing `PM.PIXELES_ESTANDAR`.
- **Chunk rebuild is expensive** — don't trigger `renderChunksAgain` unnecessarily. Block add/remove already rebuilds only the affected material mesh.
- **`estaColindando` / `estaEnArbol`** are O(n) scans on small lists — fine for current chunk sizes, but mark if chunk size grows significantly.

## Git & GitHub

- **Commits and branches OK** — create commits and new branches whenever it makes sense, without asking first.
- **Never push** — no `git push` under any circumstance, and never `git push --force` / `--force-with-lease`. Leave pushing to the user.
- **Never merge — no permission** — no `git merge`, no fast-forward integration, no `gh pr merge`, and no merging of any pull request. Leave every merge to the user.
- **GitHub via `gh`** — open PRs, issues, comments, and labels over branches the user has already pushed.
