# MinaCubo Redux — Agent Guide

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

## Rules by topic — what always binds, and where the detail lives

This file fits in the 32 KiB Codex reads by default (`wc -c AGENTS.md` ≤ 32768; when it grows, move
detail to `docs/agents/`, never raise the limit). The detail of each topic was moved verbatim to
`docs/agents/` on 2026-10-04. **The lines below bind even if you never open the document; open it
before working on that topic.** A rule is edited in its document, not here and there at once —
except for its one-line summary in this list.

- **UI/UX workflow** → [docs/agents/ui-workflow.md](docs/agents/ui-workflow.md), before touching the
  DOM chrome or the 3D look. `impeccable` first; `PRODUCT.md` / `DESIGN.md` never by hand; nothing is
  done until the real render was observed after the last change (widths, day and night, pointer-lock);
  never send source or screenshots to a hosted service without explicit approval.
- **Real-environment verification** →
  [docs/agents/real-environment-verification.md](docs/agents/real-environment-verification.md). What
  no in-process test can prove (the importmap, WebGL on a real GPU, more than one browser) gets a
  committed boot script; every new check is seen failing once; never assert on a count you cannot
  predict; a test never writes into anything the browser reads.
- **Agentic PR verification (mandatory)** → [docs/agents/pr-verification.md](docs/agents/pr-verification.md).
  Every PR gets the verdict of a pass that drives the running game as a PR comment; it never merges.
- **Design principles (SOLID)** → [docs/agents/design-principles.md](docs/agents/design-principles.md).
  No abstraction without a second implementation, an IO boundary or a test seam.
- **Codex and Claude Code** → [docs/agents/agent-compatibility.md](docs/agents/agent-compatibility.md).
  Rules are edited in `AGENTS.md` (or its `docs/agents/` document), never in `CLAUDE.md`.

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

- **Storybook**: `npm run storybook` (dev server, :6006) · `npm run build-storybook` (static
  build). Its MCP server (`@storybook/addon-mcp`) is registered in `.mcp.json` (Claude Code) and
  `.codex/config.toml` (Codex) at `http://localhost:6006/mcp`; needs `storybook dev` running.
- **E2E smoke (Playwright)**: `npm run test:e2e` — boots its own `serve` on port 3010 (never 3000
  or 8080), asserts the page loads, the WebGL canvas is present and no console errors fired.

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

**Mutation gate: 60% floor — owed, and blocked on there being a suite at all.** Once the pure-logic
tests above exist, coverage will say how much of that logic ran and still nothing will say whether
those tests *verify* anything: a test with no assert reports 100% coverage. The gate that answers
that is **Stryker** with the vitest runner, `mutate` scoped to exactly the modules in the table
(collision, chunk math, structure arrays — never the Three.js/rendering side, which cannot be
mutated honestly without a WebGL context), `thresholds.break` set to the **measured** score rounded
down and never below 60. It runs last in a `pre-push` hook — this repo has none yet — and as a
PR-only advisory job in `ci.yml`. **Measure before writing any number:** a threshold nobody measured
is a gate that has never been tested. Note `npm test` currently passes with `--passWithNoTests`, so
today it proves nothing at all.

### TDD

For new pure logic (chunk math, collision, structure generation):

1. **Red** — write failing test describing the behavior.
2. **Green** — minimal implementation to pass.
3. **Refactor** — clean up with tests green.

Don't TDD rendering code or Three.js scene construction — not testable without a WebGL context.

### The pyramid per feature — one E2E per journey, the rest in Vitest

**Rule since 2026-10-04**, ported from the Android client, where E2E ate days of agent time. A new
feature gets **one Playwright spec per main journey** (`e2e/*.spec.ts`, `npm run test:e2e`) — boot,
do the one thing the feature is for, see the result — and no more than one extra for what only the
real browser shows. Everything else — collision and chunk maths, voxel physics, noise and seed
determinism, structure arrays, any pure value the HUD computes — goes one layer down, in Vitest on
the pure module (`src/*.test.js`), which costs milliseconds and needs no WebGL.

- **When one more E2E is right:** what no in-process test can answer — the page boots over the real
  importmap, WebGL is available, pointer-lock and keyboard/mouse behaviour, a layout that hides a
  control, a console error or a 404 on a served module. The spec's header says why it is not a Vitest.
- **A bug still gets its failing test first**, at the lowest layer that reproduces it; in E2E only
  when it is on the list above.
- **Existing specs are not migrated for this rule.** It applies to new work and to what a change
  touches (the current smoke spec, with its `waitForTimeout`, stays as it is until it is touched).

### Running the suites — the whole suite once at the end, only the reds in between

- **While working:** only the tests of what you touched — `npx vitest related --run <files>`, or
  `npx vitest run src/<module>.test.js`. A Playwright spec only when you touched its journey:
  `npx playwright test e2e/<file>.spec.ts`.
- **The full run happens once, at the end of the branch, alone** — `npm test`, then
  `npm run test:e2e` — in the background while you write the PR, under
  `timeout --kill-after=60s <limit>` inside the memory cgroup above. Push and PR only after it is green.
- **Red pass → only the reds** until they are green or proven red on the base commit too:
  `npx playwright test --last-failed` for E2E; Vitest has no last-failed flag, so rerun the red
  files by path. Then **one** full confirmation pass, the one that catches a fix breaking another test.
- **Three reds in a row on one test → stop** and read the evidence (the trace, the console and
  network log, the screenshot Playwright keeps on failure) before a fourth change.
- **No fixed sleeps** — wait on the state (`expect(...).toBeAttached()`, a console or network event),
  never `waitForTimeout`. **Every heavy command** (full suite, coverage, Playwright) runs under
  `timeout --kill-after=60s <limit>`, inside the cgroup.

## Docker — the prod image

`Dockerfile.prod` builds the static site and serves it with `nginx:alpine`; `Dockerfile.dev` is the
watcher. They are separate files, so "`prod` is the last stage" is guaranteed by construction — keep
it that way rather than merging them into one multi-stage file with `dev` at the end (a build with
no `--target` would ship the watcher; that bug reached production in `calorie-monitor-api`).
Canonical text: `claude-md` `docs/starter-kit/AGENTS.template.md` § *Docker & deploy*.

- **Healthcheck on every service.** Coolify (and plain Docker) use the image's `HEALTHCHECK`;
  Traefik stops routing to an unhealthy container and rolling updates wait for the new one to be
  healthy. `nginx:alpine` ships busybox `wget`, so: `HEALTHCHECK CMD wget -q --spider
  http://127.0.0.1/ || exit 1`.

**State on `main` (2026-09-27):** no `HEALTHCHECK` in `Dockerfile.prod` yet.

## Working rules

- **Heavy or parallel jobs run inside a memory cgroup** — never launch a suite, build or
  fan-out on a bare estimate; wrap it in
  `systemd-run --user --scope -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>`
  and cap the tool's own concurrency too.
- **UI work → design context first, then wide latitude, then the observed-quality gate** — for any UI change (the DOM chrome: lil-gui HUD, menus, overlays — the 3D world is out of scope for this rule, though three.js/shaders are fair game as this repo's native medium, see [UI/UX workflow](docs/agents/ui-workflow.md#uiux-workflow--stack-aware)), invoke the `impeccable` skill. **If the project has no design context (`PRODUCT.md` / `DESIGN.md` at the repo root), run `$impeccable teach`** — it explores the codebase and interviews you about the project's direction, then writes `PRODUCT.md` + `DESIGN.md` (auto-migrating a legacy `.impeccable.md` → `PRODUCT.md`); never hand-author it. Follow [UI/UX workflow — stack-aware](docs/agents/ui-workflow.md#uiux-workflow--stack-aware) for the full loop — there's no deterministic E2E gate today, so say that rather than claiming one passed. Don't hand-roll UI without impeccable + superpowers.
- **SOLID where it pays, not by rote** — split by reason to change, extend through a new `Cubo`
  subtype or variant rather than another branch, keep subtypes honest, keep constructors/props narrow,
  and push IO (Three.js, the DOM, `Date.now()`) behind a seam only when there's a second implementation
  or a test needs it. No abstraction without a second implementation, an IO boundary or a test seam.
  See [Design principles](docs/agents/design-principles.md#design-principles--solid-applied-with-judgement).
- **Deps via npm + importmap; pregunta antes de añadir una** — añadir un paquete está permitido cuando hace falta de verdad, pero pregunta antes de instalarlo (cuál, por qué, qué sustituye) y espera el visto bueno. Después: `npm install <pkg>` + entrada nueva en el importmap de `index.html` apuntando a `/node_modules/<pkg>/...`. Imports en JS usan bare specifiers (`import x from 'pkg'`).
- **No bundler** — el navegador resuelve módulos vía importmap. Vite/webpack romperían el modelo.
- **`PIXELES_ESTANDAR` is 16** — all size calculations derive from this. Don't hardcode `16` without referencing `PM.PIXELES_ESTANDAR`.
- **Reutiliza antes de escribir** — antes de crear una clase o un helper, mira qué hay ya (`rg -n "^(export )?(class|function)" src/`). Un tipo de bloque nuevo **extiende `Cubo`**, no se copia; la física/geometría repetida entre `Esteban`, `Zombie` y `Cerdo` sube a un helper compartido en vez de vivir tres veces; los cálculos puros ya tienen sitio (`aabb.js`, `chunkMath.js`, `noise.js`) y las constantes están en `ParametrosMundo.js`. A la tercera copia se extrae en el mismo cambio, migrando los call sites y borrando las copias. `MyScene.js` ya es una god class: cada bloque de lógica duplicada que aterriza ahí la empeora.
- **Chunk rebuild is expensive** — don't trigger `renderChunksAgain` unnecessarily. Block add/remove already rebuilds only the affected material mesh.
- **`estaColindando` / `estaEnArbol`** are O(n) scans on small lists — fine for current chunk sizes, but mark if chunk size grows significantly.

## Git & GitHub

- **Commits and branches OK** — create commits and new branches whenever it makes sense, without asking first.
- **Never push** — no `git push` under any circumstance, and never `git push --force` / `--force-with-lease`. Leave pushing to the user.
- **Never merge — no permission** — no `git merge`, no fast-forward integration, no `gh pr merge`, and no merging of any pull request. Leave every merge to the user.
- **GitHub via `gh`** — open PRs, issues, comments, and labels over branches the user has already pushed.
