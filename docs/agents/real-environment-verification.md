# Real-environment verification

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
