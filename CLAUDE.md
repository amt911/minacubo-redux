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

## ⚡ superpowers — use whenever applicable

Always prefer **superpowers** skills over ad-hoc approaches. If there's even a small chance a skill
applies to the task, invoke it via the `Skill` tool before acting (including before clarifying
questions).

- **Process skills first** — `brainstorming` before creative/feature work, `systematic-debugging`
  before fixing bugs, `test-driven-development` before writing implementation.
- **Then implementation skills** — domain-specific skills guide execution.
- **Verify before claiming done** — `verification-before-completion` / `requesting-code-review`
  before merging.

User instructions always take precedence over skills; skills override default behavior. **Skills
refine *how* the work is done; they never override the rules in this file.**

### Mode switch

- **"lite mode"** — fully disables superpowers: no skill is invoked, not even the applicability
  check, until **"normal mode"** is said.
- **"normal mode"** (default) — standard superpowers behavior, plus: when delegating coding work,
  dispatch at most 1 **implementation** agent at a time (a read-only review agent runs alongside it
  — see **Agent orchestration**), and never use a model above Sonnet (no Opus).
- **"modo desatendido"** (unattended mode) — the user is away and delegates autonomy: work without
  waiting for confirmations and make reasonable decisions yourself instead of asking. In this mode you
  MAY **`git push` the feature branches you create** and **open PRs via `gh`** on your own, so the
  work is ready for review when the user returns. The hard limits still hold and are NOT lifted:
  **never merge anything** (no `git merge`, no fast-forward integration, no `gh pr merge`), **never
  push to `main`** or any protected/default branch directly, and **never** `git push --force` /
  `--force-with-lease`. Reverts to defaults on **"normal mode"**.

Confirm the switch briefly when it happens.

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

Six spec files sit beside the source in `src/` — `aabb`, `chunkMath`, `estructuras`, `noise`,
`ParametrosMundo`, `voxelPhysics` — 71 cases in total. Pure logic still untested:

| Module | What to test |
| --- | --- |
| `colisiones.js` | Collision detection functions — pure logic, no Three.js needed |

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

## Debugging — keep the loop from running away

What a bug costs is not the fix. It is how many times you go around
`build → deploy → reach the state → observe` before you know what to fix, times what one lap costs.
Every rule below carries the number it came from; the ones this repo has not measured are marked
`<!-- pendiente de medir -->` until someone does.

- **Measure before you ablate.** Ablation costs one lap per hypothesis and answers yes/no;
  instrumentation costs one lap total and answers *what is actually happening*. **Measured: 28
  ablations over 1 h 42 min moved nothing; one 13-min batch of probes changed the question and the
  bug fell on the next round.** The rule that came out of it: **if a pipeline completes every phase
  with non-empty output, the output exists** — stop asking "why doesn't it appear" and ask "where
  does it appear". Here that pipeline is `fetch → schema validation → serialization → render/hydration`.
- **Budget the lap, then attack the dominant term.** Time the four phases once and write the real
  seconds in; one dominates and the rest are noise. **If a bug needs more than three reproductions,
  write the shortcut before the fourth** — here that means
  a deep link to the route, a dev-only route that seeds the state, a fixture in the test DB.
  Commit it as `<scripts/repro-<bug>.sh>` and name it in `docs/FINDINGS.md` (create it from the starter kit if this repo has none yet).

  | Lap phase | Command here | Measured |
  | --- | --- | --- |
  | build | `<pnpm build>` | `<n s>` |
  | deploy / serve | `<pnpm dev · docker compose up>` | `<n s>` |
  | reach the state | `<log in + navigate to the route>` | `<n s>` |
  | observe | `<browser console · API logs>` | `<n s>` |

- **A review finding is not a reproduction.** Whoever reviewed read the code; they did not run it.
  Reproduce it yourself before sending anyone to fix it, and **if the implementer says they cannot
  reproduce it, believe the implementer** — one of them has the thing running. **Measured: 1 h 25 min
  chasing a bug that did not exist.**
- **A test that refuses to go red is data, not a failure.** The fourth failed attempt to pin down
  that non-existent bug is what uncovered the real one, pointing the opposite way. "I cannot make
  this fail" is a result and it gets reported; a green test papered over it throws the signal away.
- **Before demanding a red, ask whether the mechanism can produce one.** If another layer masks the
  effect there will be no red however hard you push, and the time goes into the test instead of the
  bug. **Measured: over 1 h on two structurally impossible reds.**
- **Assertions that are inert by construction** — none of these shows up as a failure, a warning or
  a coverage drop. **Every assertion is watched failing once**, and expected values are written by
  hand:

  | Inert by | What it looks like here |
  | --- | --- |
  | `console.assert` | never throws: it logs and the test stays green |
  | an unawaited promise | an `expect` inside a `.then()` that is never returned runs after the test already passed |
  | self-writing snapshots | `toMatchSnapshot()` records whatever came out on its first run and calls it expected |
  | permissive mocks | `jest.fn()` / `vi.fn()` return `undefined` without complaining; automatic `vi.mock` stubs the whole module |
  | expectation computed alike | the expected value comes out of the same helper the code under test uses |

- **Verify the resource limit reaches the process doing the work.** A job wrapped in a memory scope
  can hand the work to a daemon or worker pool living outside it, and the tool still reports the
  limit as applied — over a process that is idle. Check the **worker's** cgroup
  (`cat /proc/<worker-pid>/cgroup`), not the scope's.
- **Environment claims get measured or they don't get made.** "That heap sounds low" produced a
  recommendation that was simply wrong; measuring it — three runs per setting, not one — gave a
  **0.4% difference, below the run-to-run variance**. No performance tuning lands without a
  before/after over more than one run.
- **Locate which layer owns a rule before deciding which side gives.** A rule that lives in one
  layer and isn't shared by the others fails where the assumption breaks, not where it is written,
  which is why the fix keeps landing in the innocent layer.
- **Replacing a component can remove capabilities in silence.** When you swap one API for another,
  enumerate what the old one did that the new one does not, and say it in the PR — nothing will fail
  to compile. An optional parameter that defaults to off is a capability that only exists if the
  caller remembers it.

## Agent orchestration — parallel where it's free, batched where it's yours

Delegating to agents moves the bottleneck to **scheduling**: what waits on what, what each agent
re-derives, and which decisions quietly stop being yours. Same convention — every rule carries its
measured number.

- **Review is not on the critical path.** Reviewing task N and starting N+1 are independent when
  they touch different files. Serialized, review is **10-15% of the wall clock** and blocks
  everything behind it; in parallel it is free. **On receiving an implementation report, dispatch
  its review and the next implementation in the same turn.** This is the one exception to
  *"at most 1 agent at a time"*: the cap counts **implementation** agents — a review agent reads and
  reports, it writes nothing, so it cannot race the implementer. **The exclusive resource here is:**
  the dev database, the dev-server port and the Playwright browser
  — at most one agent touching it.
- **Keep one shared facts file.** Every fresh agent re-derives the same things: the real selector,
  which fake exists, what that helper accepts. Keep `docs/FACTS.md`, have each agent append to it
  when it finishes, and hand it to the next one in its dispatch. Only **facts verified against the
  repo or the running system**, with how they were verified. It is not the gotchas log: that holds
  what is *not* deducible from the code and outlives the branch; this holds what is perfectly
  deducible and merely expensive to look up, and it may die with the branch.
- **Plans carry contracts, not literal code.** The agent **trusts** the code in the plan; code you
  never compiled is an error wearing authority. **Measured: 4 wrong blocks, 15-40 min of detour
  each.** Write exact names, exact signatures and "mirror the shape of `<X>`" — claims the agent can
  check against the repo — and reserve literal code for what you have run.
- **Batch the discretionary decisions.** Work that appears along the way — a capability being
  dropped, a missing script, an adjacent bug — added **5-6 h of 15**. Each was justified; deciding
  them on the fly is what takes them away from you. Accumulate and ask **once per batch, with the
  estimated cost**. In **"modo desatendido"** the batch goes in the PR body instead, with its costs.
- **What never gets cut.** Review was **1.5 h of 15** and found a `create()` silently discarding
  fields, a 404 caused by SQL deduplication, a silent merge that corrupted data, a
  delete-and-recreate with no transaction, and several inert assertions. **Cutting review does not
  give time back; it defers it to production.** Cut reproduction (write the shortcut) and
  serialization (dispatch review in parallel) instead.

### Day one — the numbers that fill the blanks

1. **The lap** — time `build → deploy → reach the state → observe` once and write the seconds into
   the table above. The dominant phase gets the shortcut script; the rest stay unoptimized.
2. **The exclusive resource** — confirm the one named above is really the only one.
3. **The inert assertions** — break one assertion on purpose and run the suite; anything still green
   is inert. Then prune the table above to what this stack can actually produce.

## Working rules

- **UI work → design context first, then `impeccable` + superpowers** — for any UI change (the DOM chrome: lil-gui HUD, menus, overlays — the 3D world is out of scope), invoke the `impeccable` skill. **If the project has no design context (`PRODUCT.md` / `DESIGN.md` at the repo root), run `$impeccable teach`** — it explores the codebase and interviews you about the project's direction, then writes `PRODUCT.md` + `DESIGN.md` (auto-migrating a legacy `.impeccable.md` → `PRODUCT.md`); never hand-author it. Don't hand-roll UI without impeccable + superpowers.
- **Deps via npm + importmap** — añadir un paquete: `npm install <pkg>` + entrada nueva en el importmap de `index.html` apuntando a `/node_modules/<pkg>/...`. Imports en JS usan bare specifiers (`import x from 'pkg'`).
- **No bundler** — el navegador resuelve módulos vía importmap. Vite/webpack romperían el modelo.
- **`PIXELES_ESTANDAR` is 16** — all size calculations derive from this. Don't hardcode `16` without referencing `PM.PIXELES_ESTANDAR`.
- **Chunk rebuild is expensive** — don't trigger `renderChunksAgain` unnecessarily. Block add/remove already rebuilds only the affected material mesh.
- **`estaColindando` / `estaEnArbol`** are O(n) scans on small lists — fine for current chunk sizes, but mark if chunk size grows significantly.
- **Instrument before you ablate, budget the lap, and dispatch review in parallel** — a pipeline that completes with non-empty output produced output; more than three reproductions means you owe a shortcut script; a review finding is not a reproduction; and the review of task N runs alongside the implementation of N+1. See **Debugging** and **Agent orchestration** above.

## Git & GitHub

- **Commits and branches OK** — create commits and new branches whenever it makes sense, without asking first.
- **Never push** — no `git push` under any circumstance, and never `git push --force` / `--force-with-lease`. Leave pushing to the user.
- **Never merge — no permission** — no `git merge`, no fast-forward integration, no `gh pr merge`, and no merging of any pull request. Leave every merge to the user.
- **GitHub via `gh`** — open PRs, issues, comments, and labels over branches the user has already pushed.
