# Agentic PR verification

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
  the [Design principles](design-principles.md#design-principles--solid-applied-with-judgement): a new violation (a DOM
  chrome function reaching into Three.js internals, one more branch in a growing block-type `switch`)
  or a new speculative abstraction. Findings, not a veto — like the rest of the pass.
