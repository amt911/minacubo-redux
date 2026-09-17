# MinaCubo Redux — Agent Guide

## Start here

Run `/graphify` before each session. The graph at `graphify-out/graph.json` maps module dependencies so you avoid re-reading the whole codebase every time.

## Agent compatibility — Codex and Claude Code

This file is `AGENTS.md`: the **one** instruction file for every coding agent in this repo. Codex reads
it directly; Claude Code reads `CLAUDE.md`, which only imports this file (`@AGENTS.md`) and holds what
applies to Claude alone. **Edit rules here, never in `CLAUDE.md`** — two copies of a rule drift apart
on the first edit, and each agent then obeys a different one.

| Concern | Claude Code | Codex |
| --- | --- | --- |
| Instruction file | `CLAUDE.md` → imports `AGENTS.md` | `AGENTS.md` (root down to the working directory) |
| Invoke a skill | `Skill` tool, or `/<skill>` | mention it (`$<skill>`), or let it trigger from its description |
| Skills on disk | `~/.claude/skills` (links into `~/.agents/skills`) | `.agents/skills`, then `~/.agents/skills` |
| superpowers | `superpowers@claude-plugins-official` (`/plugin install`) | `superpowers@openai-curated` (install from `/plugins`; that id is its key in `~/.codex/config.toml`) |
| MCP servers | `claude mcp add -s user <name> -- <cmd>` | `codex mcp add <name> -- <cmd>` (`~/.codex/config.toml`) |
| File size | imports load whole | `project_doc_max_bytes`, **32 KiB by default** — raise it when this file is bigger, or the tail is silently dropped |

- **Install shared skills once, for both agents:** `npx skills add <owner/repo> -g --skill <name>`
  writes to `~/.agents/skills` and links it for Claude Code, so both run the same version.
- **Names in this file are capabilities, not one agent's syntax.** "Invoke the `X` skill" means the
  `Skill` tool in Claude Code and a skill mention in Codex. An MCP server named here is used when it is
  registered for the agent you are running in; its absence never blocks ordinary work.
- **Modes, model caps and Git rules bind both agents.** "lite mode", "normal mode" and "modo
  desatendido" mean the same in Codex; a cap written as "no model above Sonnet" means "no model above
  the mid tier" there.
- **Claude-only commands** (`/graphify` and other slash commands that are not skills) are skipped by
  Codex unless the same capability is installed as a skill in `~/.agents/skills`.

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

## UI/UX workflow — stack-aware

**Wide latitude in how the UI is made, no latitude in whether it came out well.** The agent may
reach for any tool, library or technique below — or none of them — and may push the DOM chrome well
past a bare-HTML default look. What it may not do is call UI done before the **real rendered surface
has been observed, compared with the design context, critiqued, corrected and exercised end-to-end**.
A single prompt-to-code pass is not a design loop.

### Sources of truth

1. **`PRODUCT.md` + root `DESIGN.md` belong to Impeccable.** Neither exists in this repo yet — run
   `$impeccable teach` before the first UI-focused change; it explores the codebase and interviews you
   about the game's direction, audience and personality, then writes both. Don't hand-author them or
   let another tool overwrite them.
2. **`design-system.md` is the portable design contract** — semantic color/type/shape, components,
   states, motion and accessibility. It doesn't exist yet either; write it before treating any value
   in `estilo.css` as settled. It maps to plain CSS custom properties + classes here — no Tailwind, no
   component framework.
3. **Generated design documents never land on the root files.** A tool's own `extract-design-md` or
   similar writes its own `DESIGN.md`: save it below `docs/design/` with an explicit name and bring
   over only the decisions you keep.

### Creative latitude — the ceiling is the product, not the component library

- **There's no base component library to treat as a floor.** DOM chrome (lil-gui HUD, menus, overlays,
  `#pointer-lock-overlay`) is hand-rolled HTML/CSS in `index.html` + `estilo.css`; bespoke styling,
  animation and layout are the default, not an escape hatch. **Three.js and custom GLSL shaders are
  this repo's native medium for the 3D world**, not a stretch goal reserved for signature moments —
  Impeccable's `bolder`, `delight`, `animate`, `colorize`, `overdrive` apply to the DOM chrome the same
  way they would to a component-library UI; `quieter` and `distill` pull it back.
- **Three conditions still hold:** work derives from a documented token/convention where one exists
  (no `design-system.md` yet, see *Sources of truth* above) rather than a magic number scattered
  across `estilo.css`; motion honours `prefers-reduced-motion` and is never required to finish a task;
  and the result passes [UI done means observed](#ui-done-means-observed-not-generated).
- **Where bespoke code lives.** DOM chrome markup/styles live in `index.html` + `estilo.css`;
  expressive rendering (custom shaders, postprocessing, particle systems) lives beside the scene code
  in `src/`.
- **Generic is a defect.** An unstyled default `<input>`, a lil-gui panel with no visual identity, or a
  3D world that never diverges from Three.js example defaults are exactly the anti-patterns
  Impeccable's catalogue flags.

### Explore wide, then converge

For a **new HUD element, a redesign or a signature 3D moment**, render **two or three genuinely
different directions** (layout, type scale, density, motion — or, for the 3D world, lighting, palette,
camera framing) in the real stack before settling. Compare them against `PRODUCT.md` / `DESIGN.md`
once they exist, pick one, and write in the spec or PR why it won — the losers are deleted, not kept
as dead variants. Small changes to an existing screen skip this step. A hosted generator may seed a
direction only under the privacy rule below.

### Toolbox — capabilities, not dependencies

The agent chooses. Each row names a **default** and **when to reach for something else**; none is a
project dependency, and a missing one never blocks work — explain what it would add and ask before
installing it. MCP names are the ones used by `claude mcp add` / `codex mcp add`; skills install for
both agents with `npx skills add <owner/repo> -g --skill <name>` (see
[Agent compatibility](#agent-compatibility--codex-and-claude-code)).

**Privacy boundary:** never send source, screenshots, user data, unreleased product material or a
running private UI to a **hosted** service (Stitch, 21st, Figma's remote server, Gemini) without
explicit approval. Inspecting a local app with a local MCP server is not permission to upload it.
Chrome DevTools MCP collects usage statistics unless started with `--no-usage-statistics`.

**Coexistence:** one browser driver per session (Chrome DevTools MCP *or* Playwright MCP), and one
generator per component — never splice the output of two generators into one piece.

#### Web

| Role | Default | Reach for instead when… | Runs |
| --- | --- | --- | --- |
| Direction and taste | Impeccable (`shape`, `critique`, `bolder`, `delight`, `animate`, `overdrive`, `typeset`, `colorize`) | `frontend-design` (anthropics/skills) for a committed aesthetic push; `ui-ux-pro-max` to search palettes, font pairings and styles | local |
| DOM chrome markup/styles | hand-rolled HTML/CSS (`index.html`, `estilo.css`) — no component framework, no shadcn | a shadcn-compatible registry, only if the HUD ever migrates onto a component framework | local |
| Observe the real page | Chrome DevTools MCP (`chrome-devtools`) — screenshots, DOM and accessibility tree, computed styles, console, network, performance traces | Playwright MCP (`playwright`) for scripted multi-step flows, other engines, or drafting a Playwright spec | local |
| 3D scene / shaders | Three.js native APIs (`Scene`, `Material`, `ShaderMaterial` / GLSL) — this repo's native medium, not an escape hatch | `three/addons/` postprocessing passes for signature effects (bloom, outline) | local |
| UX and accessibility audit | `web-design-guidelines` + Impeccable `audit`, scoped to the DOM chrome (HUD, overlays, menus) — the WebGL canvas has no accessibility tree | — | local, fetches the ruleset |
| External references | the running game, screenshots the user supplied | Stitch MCP + `google-labs-code/stitch-skills`, 21st MCP, Figma MCP — **hosted, ask first** | hosted |
| Deterministic gate | **none today.** No committed Playwright (or other) E2E suite exists — say so rather than inventing one. The Vitest unit suite on pure logic (`chunkMath`, `colisiones`, `estructuras`, `noise`) is the only automated gate, and it never touches rendered UI | — | local |

### The loop

```text
PRODUCT.md + DESIGN.md + design-system.md (once they exist) + the change at hand
                        ↓
   explore wide (2–3 real directions) → converge, reasons written down
                        ↓
     build: hand-rolled DOM/CSS first, bespoke shaders where the scene needs it
                        ↓
          observe the REAL render (pixels + DOM/console/network)
                        ↓
  critique (Impeccable) → correct → observe again   ← repeat until it holds
                        ↓
            polish → performance measured → a11y audited (DOM chrome only)
                        ↓
   Vitest on pure logic (no deterministic E2E gate exists yet — see Toolbox above)
```

**Never accept the first render.** Inspect the primary HUD/overlay/menu plus its loading, empty,
error, disabled and validation states where they exist; every supported browser width; both day and
night lighting states; pointer-lock and keyboard/mouse behaviour; contrast; text overflow in the HUD
and menus. A UI that matches a screenshot but breaks at a different viewport, outside pointer-lock, or
at night is not polished.

### Web / Vanilla JS + Three.js

- **DOM chrome:** hand-roll markup in `index.html` and styles in `estilo.css`; no shadcn, no Next.js,
  no bundler — there is no primitive registry to search first, so `estilo.css` conventions **are** the
  design system until `design-system.md` exists.
- **Observe what shipped, not what the source implies:** screenshots at the supported widths, the DOM
  and accessibility tree for the chrome, console and network (an importmap 404 is silent otherwise —
  see [Real-environment verification](#real-environment-verification--what-no-in-process-test-can-prove)).
  When an interaction feels heavy, record a performance trace instead of guessing.
- **Chrome DevTools and Playwright MCP observe; nothing proves it yet.** There's no committed
  deterministic E2E suite — see the Toolbox's *Deterministic gate* row above and
  [Real-environment verification](#real-environment-verification--what-no-in-process-test-can-prove)
  for what closes that gap.

### UI done means observed, not generated

Before calling UI work complete, verify all of these that apply:

- the real render was inspected in the browser **after the final code change**, not only before it;
- for a new HUD element, overlay or signature 3D moment, directions were explored and the choice is
  written down;
- the DOM chrome was checked at the supported viewport widths;
- loading/empty/error/disabled/validation states were seen where they exist, not inferred from source;
- keyboard/pointer-lock behaviour and DOM chrome accessibility semantics are usable, and reduced
  motion is honoured;
- performance of the main interaction was measured (a Chrome DevTools trace, or `npm run bench`), not
  assumed;
- every new value exists as a token once `design-system.md` exists — until then, note the value's
  origin in the PR;
- the result was compared against `PRODUCT.md` + `DESIGN.md` once they exist, then critiqued and
  polished;
- **no deterministic E2E gate exists to close this loop today** — say so rather than claiming one
  passed.

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
- **The verdict reads structure too.** Besides the boot/smoke check, it names what the diff does to
  the [Design principles](#design-principles--solid-applied-with-judgement): a new violation (a DOM
  chrome function reaching into Three.js internals, one more branch in a growing block-type `switch`)
  or a new speculative abstraction. Findings, not a veto — like the rest of the pass.

## Design principles — SOLID, applied with judgement

SOLID is a list of **symptoms to look for**, not a pattern to apply. Every one of the five exists to
keep a change local: the useful question is *how many files does the next plausible change touch, and
how many of them do you have to understand first?* Applied by rote it produces the opposite — an
interface per class, a factory for one product, an eight-file feature — so here it is bounded by YAGNI
and by reuse-first judgement (search for the existing block type, helper or pure module before adding
a new one).

| Principle | Checkable smell | Usual fix |
| --- | --- | --- |
| **S — Single responsibility**: one reason to change | the description needs "and"; the file changes in PRs about unrelated features; a test mocks things unrelated to what it asserts; a component both fetches and lays out | split along the reason to change — IO, decision, presentation |
| **O — Open/closed**: extend without editing | adding a case edits a growing `switch`/`if` chain in several places; one boolean prop per variant | a variants map, strategy, slot or registry — introduced at the second real case, not the first |
| **L — Liskov substitution**: subtypes keep the contract | an override throws "not supported"; callers check the concrete type before calling; a variant drops the base's disabled, focus or semantics | narrow the base contract, or stop inheriting and compose |
| **I — Interface segregation**: clients see only what they use | a fake implements methods the test never calls; a whole entity is passed to read two fields; a `Service` with fifteen methods | split by client need; pass the fields, not the bag |
| **D — Dependency inversion**: policy does not import mechanism | domain or UI code imports `fetch`, the ORM, `Date.now()` or `fs` directly; a unit test needs a network or a database | depend on a port the caller owns (interface, function, hook); wire the adapter at the edge |

### In UI code

- **S:** a component **presents or orchestrates**, not both. `MyScene.js` already breaks this — it
  owns the game loop, chunk system, rendering and input handling at once — so a new feature is a
  reason to extract, not to add a sixteenth responsibility to the same class.
- **O:** a new block type or NPC is a **new class extending `Cubo` / composing shared behaviour**, not
  another branch inside `MyScene.js`'s update loop.
- **L:** every `Cubo` subtype keeps the base's guarantees — geometry, multi-material slots, the
  contract `colisiones.js` expects. A block that special-cases itself in the collision or render path
  is not a variant of `Cubo`; it is a regression wearing a subclass.
- **I:** narrow constructor args and method surfaces; never pass a whole `MyScene` reference to read
  one field.
- **D:** pure modules (`aabb.js`, `chunkMath.js`, `noise.js`) never import Three.js or touch the DOM;
  `MyScene.js` and the DOM chrome depend on them, not the other way round.

### Where the seams go, per stack

| Stack | Seams |
| --- | --- |
| Vanilla JS (Three.js) | scene/entity classes (`MyScene`, `Cubo` and its subtypes, `Esteban`, `Zombie`, `Cerdo`) own state and rendering; pure computation stays extracted (`aabb.js`, `chunkMath.js`, `noise.js`, `estructuras.js`); DOM chrome (`index.html` / `estilo.css`) reads game state through plain functions, never reaching into Three.js internals directly |

### Where SOLID stops

- **No interface, abstract class or factory without one of:** a second real implementation, an IO
  boundary (network, filesystem, clock, randomness, the DOM), or a test that cannot be written without
  the seam. "We might swap it later" is not on the list.
- **Reuse first beats speculative extension points:** add the parameter to the existing `Cubo` subtype
  or helper before inventing a plugin system for it.
- **Speculative abstraction is a review finding**, exactly like a violation: an interface with one
  implementation and no IO behind it gets inlined.
- **Refactor toward SOLID when a change hurts**, in the PR that felt the pain — not as a drive-by
  rewrite of code nobody is changing (`MyScene.js`'s god-class status is tracked, not rewritten,
  until a change actually needs the split).

## Working rules

- **Heavy or parallel jobs run inside a memory cgroup** — never launch a suite, build or
  fan-out on a bare estimate; wrap it in
  `systemd-run --user --scope -p MemoryHigh=5G -p MemoryMax=6G -p MemorySwapMax=0 -- <command>`
  and cap the tool's own concurrency too.
- **UI work → design context first, then wide latitude, then the observed-quality gate** — for any UI change (the DOM chrome: lil-gui HUD, menus, overlays — the 3D world is out of scope for this rule, though three.js/shaders are fair game as this repo's native medium, see [UI/UX workflow](#uiux-workflow--stack-aware)), invoke the `impeccable` skill. **If the project has no design context (`PRODUCT.md` / `DESIGN.md` at the repo root), run `$impeccable teach`** — it explores the codebase and interviews you about the project's direction, then writes `PRODUCT.md` + `DESIGN.md` (auto-migrating a legacy `.impeccable.md` → `PRODUCT.md`); never hand-author it. Follow [UI/UX workflow — stack-aware](#uiux-workflow--stack-aware) for the full loop — there's no deterministic E2E gate today, so say that rather than claiming one passed. Don't hand-roll UI without impeccable + superpowers.
- **SOLID where it pays, not by rote** — split by reason to change, extend through a new `Cubo`
  subtype or variant rather than another branch, keep subtypes honest, keep constructors/props narrow,
  and push IO (Three.js, the DOM, `Date.now()`) behind a seam only when there's a second implementation
  or a test needs it. No abstraction without a second implementation, an IO boundary or a test seam.
  See [Design principles](#design-principles--solid-applied-with-judgement).
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
