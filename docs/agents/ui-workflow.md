# UI/UX workflow — stack-aware

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
[Agent compatibility](agent-compatibility.md#agent-compatibility--codex-and-claude-code)).

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
  see [Real-environment verification](real-environment-verification.md#real-environment-verification--what-no-in-process-test-can-prove)).
  When an interaction feels heavy, record a performance trace instead of guessing.
- **Chrome DevTools and Playwright MCP observe; nothing proves it yet.** There's no committed
  deterministic E2E suite — see the Toolbox's *Deterministic gate* row above and
  [Real-environment verification](real-environment-verification.md#real-environment-verification--what-no-in-process-test-can-prove)
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
