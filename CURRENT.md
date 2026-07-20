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

- GitHub Actions CI passes on the current branch baseline.
- Dependency installation, lint, deterministic tests, maintained-file formatting, production build, production-output smoke validation, and Chromium tactical smoke validation are established.
- Stage routing validates and normalizes selected locations before entering campaign or tactical views.
- Campaign and tactical stages are lazy-loaded and protected by a recoverable stage error boundary.
- Deterministic tactical startup and globe-to-tactical browser coverage exist.
- The Replica Neighborhood Battle charter defines the player journey, fidelity classes, source priority, inference rules, benchmark strategy, failure conditions, non-goals, ordered delivery plan, and measurable slice-level definition of done.

## Current task

Define the stable `BattleSession` contract that connects:

- geographic context
- playable and rendered-context bounds
- replica-source and fidelity reporting
- deterministic player-profile snapshot
- HQ plan
- friendly and enemy force packages
- objective and environment state
- tactical outcome
- macro persistence

The first implementation should remain small and domain-focused. It must serialize and restore deterministically without depending on React or Three.js.

## Ordered next work

1. `BattleSession` contract and deterministic tests
2. Issue #11 — vertical-slice Test Lab launcher
3. Issue #10 — contextual overscan and playable-versus-rendered bounds
4. Replica Mode provenance and fidelity reporting
5. Miniature visual treatment that preserves source geometry
6. HQ profile import and valid snap placement
7. One deterministic capture-and-hold battle
8. Macro/micro persistence round trip
9. Automated, visual, performance, and human fidelity validation

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
