# Design principles — SOLID, applied with judgement

> Moved verbatim out of `AGENTS.md` on 2026-10-04 so that file fits the 32 KiB Codex reads
> by default. Its rules still bind: `AGENTS.md` lists the hard ones inline and says when to
> read this file. Edit the rule here, not a copy of it.

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
