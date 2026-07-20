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

## Current task

Complete issue #11, the vertical-slice **Test Lab launcher**.

The launcher must:

- provide a one-click benchmark battle entry
- provide a one-click full globe-to-battle entry
- generate entries from one centralized scenario registry
- use normal `BattleSession`, stage-routing, tactical configuration, and persistence contracts
- keep scenarios deterministic and URL-addressable
- return direct launches to a defined prior stage or the Test Lab
- remain hidden from normal player UI unless explicitly enabled
- share scenario definitions with browser smoke tests

## Ordered next work

1. Issue #11 — vertical-slice Test Lab launcher
2. Issue #10 — contextual overscan and playable-versus-rendered bounds
3. Replica Mode provenance and fidelity reporting
4. Miniature visual treatment that preserves source geometry
5. HQ profile import and valid snap placement
6. One deterministic capture-and-hold battle
7. Macro/micro persistence round trip
8. Automated, visual, performance, and human fidelity validation

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
