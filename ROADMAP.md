# Battle Earth Roadmap

This roadmap replaces the stale session notes that previously described D77 as future work even though development had reached D87.

## Current baseline

- Latest historical milestone: D87
- Production build: passing
- Globe renderer: Three.js
- Tactical renderer: Three.js
- Strategic campaign renderer: SVG, retained as a transitional implementation
- Automated checks: lint, deterministic unit tests, maintained-file formatting check, production build

## Phase 1: Repository stabilization

Status: implemented in the initial repository stabilization pull request.

- Import the project without `node_modules` or generated `dist` output.
- Remove duplicate root-level development notes and retain one copy under `docs/devlog`.
- Replace the accumulated README with one authoritative project overview.
- Add `.gitignore`, editor settings, contribution guidance, tests, linting, formatting tools, and CI.
- Add route-level lazy loading for campaign and tactical stages.
- Record the current renderer boundary as an architecture decision.

## Phase 2: Map builder decomposition

Goal: reduce the 4,000-plus-line `MapFeatureBuilder.js` without changing rendered behavior.

Recommended extraction order:

1. Pure feature classification and tag interpretation.
2. Building geometry and roof construction.
3. Roads, railways, and linear infrastructure.
4. Water and terrain-region surfaces.
5. Vegetation and tactical overlays.
6. A thin `MapFeatureCoordinator` that owns shared context and dispatch.

Each extraction should include unit tests for pure calculations and a before-and-after visual validation checklist.

## Phase 3: Infantry decomposition

Separate simulation state from presentation and Three.js object management:

- Squad and soldier state model
- Orders and movement
- Combat contact and casualties
- Morale and suppression
- Selection and command input
- Rendering and animation

The first extraction should define stable data contracts without changing gameplay values.

## Phase 4: Renderer convergence decision

Before replacing the campaign renderer, define parity requirements for:

- Region selection and labels
- Ownership and influence overlays
- Army placement and movement trails
- Conflict visualization
- Campaign performance at continental scale
- Accessibility and low-end hardware fallback

Then either complete the strategic Three.js migration or formally support the SVG campaign renderer as a separate optimized view.

## Phase 5: Browser and rendering validation

- Add component tests for campaign state transitions.
- Add browser smoke tests for globe-to-campaign and globe-to-tactical flows.
- Add screenshot-based visual checks for representative urban, rural, water, and large-scale maps.
- Add deterministic fixtures for OSM and procedural fallback generation.

## Working rule

Do not add another large gameplay subsystem until the current phase has a clear owner, acceptance criteria, and automated or visual regression coverage.
