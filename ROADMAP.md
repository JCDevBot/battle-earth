# Battle Earth Roadmap

This roadmap replaces the stale session notes that previously described D77 as future work even though development had reached D87.

## Current baseline

- Latest historical milestone: D87
- Production build: passing
- Globe renderer: Three.js
- Tactical renderer: Three.js
- Strategic campaign renderer: SVG, retained as a transitional implementation
- Automated checks: lint, deterministic unit tests, maintained-file formatting check, production build, browser smoke validation

## Product-validation objective

The active product-validation slice is the **Replica Neighborhood Battle**.

Battle Earth must prove that a player can select a real location on Earth, generate a recognizable replica with a stylized miniature presentation, place a persistent HQ and forces into that environment, complete one tactical objective battle, and return to a macro representation where resources and consequences persist.

The governing fidelity rule is:

> Stylize the appearance, not the arrangement.

See [`docs/REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md`](docs/REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md) for the player journey, fidelity contract, benchmark strategy, scope, non-goals, and slice-level definition of done.

## Phase 1: Repository stabilization

Status: implemented in the initial repository stabilization pull request.

- Import the project without `node_modules` or generated `dist` output.
- Remove duplicate root-level development notes and retain one copy under `docs/devlog`.
- Replace the accumulated README with one authoritative project overview.
- Add `.gitignore`, editor settings, contribution guidance, tests, linting, formatting tools, and CI.
- Add route-level lazy loading for campaign and tactical stages.
- Record the current renderer boundary as an architecture decision.
- Add deterministic tactical and globe-to-tactical browser smoke paths.

## Phase 2: Replica Neighborhood Battle vertical slice

Status: active.

Delivery order:

1. Define and test the `BattleSession` contract.
2. Add the vertical-slice Test Lab launcher using normal routing and session contracts.
3. Separate playable bounds from rendered context bounds and eliminate visible map edges.
4. Add Replica Mode source classification, provenance, confidence, and fidelity reporting.
5. Apply a cohesive miniature visual treatment without changing source geometry.
6. Import the development-profile HQ and implement valid snap placement.
7. Complete one deterministic capture-and-hold battle.
8. Persist tactical results into the macro representation and restore them after reload.
9. Add automated browser, screenshot, performance, and human fidelity validation.

Each step must have explicit acceptance criteria and deterministic, browser, visual, or human validation appropriate to its risk. Avoid introducing a second implementation path solely for testing.

## Phase 3: Map builder decomposition

Goal: reduce the 4,000-plus-line `MapFeatureBuilder.js` without changing rendered behavior, while enabling the Replica Mode work above.

Recommended extraction order:

1. Pure feature classification and tag interpretation.
2. Building geometry and roof construction.
3. Roads, railways, and linear infrastructure.
4. Water and terrain-region surfaces.
5. Vegetation and tactical overlays.
6. A thin `MapFeatureCoordinator` that owns shared context and dispatch.

Each extraction should include unit tests for pure calculations and a before-and-after visual validation checklist. Keep this work incremental and tied to an active product-facing need rather than pausing the vertical slice for an unbounded rewrite.

## Phase 4: Infantry decomposition

Separate simulation state from presentation and Three.js object management:

- Squad and soldier state model
- Orders and movement
- Combat contact and casualties
- Morale and suppression
- Selection and command input
- Rendering and animation

The first extraction should define stable data contracts without changing gameplay values. Prioritize boundaries required for deterministic objective-battle and persistence work.

## Phase 5: Renderer convergence decision

Before replacing the campaign renderer, define parity requirements for:

- Region selection and labels
- Ownership and influence overlays
- Army placement and movement trails
- Conflict visualization
- Campaign performance at continental scale
- Accessibility and low-end hardware fallback

Then either complete the strategic Three.js migration or formally support the SVG campaign renderer as a separate optimized view. Strategic renderer replacement is not part of the Replica Neighborhood Battle slice.

## Phase 6: Browser and rendering validation

- Add component tests for campaign and BattleSession state transitions.
- Maintain browser smoke tests for globe-to-campaign and globe-to-tactical flows.
- Add screenshot-based visual checks for representative urban, rural, water, and large-scale maps.
- Add deterministic fixtures for OSM and procedural fallback generation.
- Capture benchmark generation time, memory impact, and tactical frame-rate evidence.

## Working rule

Do not add another large gameplay subsystem until the current phase has a clear owner, acceptance criteria, and automated or visual regression coverage. Preserve source-backed geography during visual work, and do not merge changes requiring human fidelity or gameplay judgment until that testing is complete.
