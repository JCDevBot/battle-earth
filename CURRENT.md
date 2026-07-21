# Current Work

Last updated: 2026-07-20

## Active objective

Deliver the **Replica Neighborhood Battle** product-validation slice: select a real location, generate a recognizable replica with a stylized miniature presentation, place a persistent player HQ, complete one tactical objective battle, and return to a macro representation with persistent consequences.

The active charter and fidelity contract are documented in [`docs/REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md`](docs/REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md).

## Active branch

`agent/initial-stabilization`

## Active pull request

#1 — Import and stabilize Battle Earth

The existing draft pull request remains the integration branch. Do not merge without explicit authorization and required local visual/gameplay review.

## Current status

- GitHub Actions CI passes on the current branch.
- Dependency installation, lint, deterministic tests, maintained-file formatting, production build, production-output smoke validation, and Chromium tactical smoke validation are established.
- Stage routing validates and normalizes selected locations before entering campaign or tactical views.
- Campaign and tactical stages are lazy-loaded and protected by a recoverable stage error boundary.
- Deterministic tactical startup and globe-to-tactical browser coverage exist.
- Issue #12, the vertical-slice charter and fidelity contract, is complete.
- Issue #13, the deterministic [`BattleSession` domain contract](docs/BATTLE_SESSION.md), is complete and validated by CI and browser smoke tests.
- Duplicate BattleSession issue #14 is closed in favor of issue #13.
- Issue #11, the vertical-slice Test Lab launcher, is complete. Development builds and `?dev=1` expose centralized full-flow and direct-battle entries using normal scenario, routing, and BattleSession contracts.
- Browser smoke validation exercises both Test Lab entries before running the complete deterministic globe-to-tactical command flow.

## Current task

Complete issue #10, **contextual overscan and playable-versus-rendered bounds**.

This task must:

- preserve the current playable bounds for deployment, commands, navigation, fog, territory, objectives, and camera constraints
- generate and render a larger geographic context around the playable battlefield
- continue terrain, roads, buildings, water, and vegetation through the playable boundary
- keep the context ring non-playable and free of additional objectives or battle-state effects
- remove or replace the visible flat out-of-bounds skirt
- measure generation-time and memory impact
- add deterministic bounds tests and visual/browser validation

## Ordered next work

1. Issue #10 — contextual overscan and playable-versus-rendered bounds
2. Replica Mode provenance and fidelity reporting
3. Miniature visual treatment that preserves source geometry
4. HQ profile import and valid snap placement
5. One deterministic capture-and-hold battle
6. Macro/micro persistence round trip
7. Automated, visual, performance, and human fidelity validation

## Human decisions required

None currently. Human review will be required before accepting visual fidelity, miniature art treatment, HQ placement feel, and the completed battle loop.

## Do not begin

- strategic renderer replacement
- networked multiplayer
- full campaign economy
- broad infantry combat-rule redesign
- monetization or purchases
- direct changes to `main`
- any visual treatment that alters source-backed footprints or spatial relationships
