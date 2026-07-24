# BattleSession Domain Contract

`BattleSession` is the versioned, renderer-independent record for one Replica Neighborhood Battle. It connects Earth selection, replica generation, player resources, HQ placement, tactical state, outcome recording, and the later macro persistence layer.

The implementation lives in [`src/domain/BattleSession.js`](../src/domain/BattleSession.js). The product and fidelity requirements are defined by the [Replica Neighborhood Battle vertical-slice charter](REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md).

## Boundary

The domain module must not import React, Three.js, browser storage, DOM APIs, or network clients. Renderers and stages consume the session; they do not own its identity or schema.

The first contract provides pure operations for:

- normalized creation and validation
- deterministic serialization and restoration
- ordered lifecycle transitions
- tactical outcome recording
- compact macro-summary projection

Storage, rendering, map generation, and tactical simulation remain outside this module.

## Versioning

- Schema: `battle-earth/session`
- Current version: `1`
- Unsupported schemas and versions are rejected.
- Future breaking changes require an explicit migration rather than silent reinterpretation.

## Stable identity

A session ID is derived deterministically from normalized setup inputs:

- schema and version
- seed
- geographic context
- playable and rendered-context bounds
- player-profile snapshot
- selected HQ asset
- initial friendly and enemy force packages
- objective identity, type, name, and position
- environment

Lifecycle phase, revision, HQ placement status, objective status, tactical progress, outcomes, and macro summaries do not change the session ID. Equivalent normalized setup input produces the same ID even when object keys arrive in a different order.

A supplied ID is validated against the normalized setup. This prevents stale IDs from being attached to materially different sessions.

## Contract areas

### Geographic context

Contains a stable location ID, display name, geographic hierarchy, latitude, and longitude. Latitude and longitude are finite and range-validated.

### Spatial bounds

`playableBounds` controls deployment, movement targets, objectives, navigation, fog, and tactical simulation.

`renderedContextBounds` controls the larger visible environment and must fully contain `playableBounds`.

Spatial invariants:

- rendered context fully contains playable bounds
- tactical objectives remain inside playable bounds
- HQ staging remains inside rendered context
- HQ staging may sit outside playable bounds
- coordinates and dimensions must be finite

These invariants establish the domain boundary required by contextual overscan and future HQ snapping.

### Replica fidelity

The session records Replica Mode provenance entries using one of four explicit classes:

- `source-exact`
- `high-confidence-derived`
- `low-confidence-inferred`
- `procedural-fallback`

Each entry identifies a feature type, source, count, and optional note. Warnings remain visible rather than being converted into false precision.

### Player profile and HQ

The session stores a deterministic snapshot of the player profile needed for the battle, including the HQ asset, available resources, and relevant upgrades.

`hqPlan` stores placement state separately:

- placement status
- selected HQ asset
- optional world-space placement
- optional battlefield entry route

Later HQ scoring and snapping code must produce values that satisfy the BattleSession spatial contract.

### Forces

Friendly and enemy force packages contain stable package IDs and normalized unit records. Unit strength cannot normalize below zero. The development fixture uses two friendly infantry squads and one enemy infantry squad.

The initial force allocation remains preserved when an outcome is recorded. Casualties and remaining strength are represented in outcome and macro state rather than rewriting the original allocation.

### Objective and environment

The first fixture defines one capture-and-hold objective plus deterministic environment settings. An objective with a position must remain inside playable bounds.

### Battle, outcome, and macro state

- `battleState` tracks lifecycle phase and elapsed simulation time.
- `outcome` records result, casualties, and resources spent.
- `macroState` records remaining force strength, objective control, HQ state, and broad battle availability.
- `revision` increments as lifecycle or outcome state advances.

## Lifecycle

The ordered lifecycle is:

1. `setup`
2. `replica-ready`
3. `hq-placed`
4. `deployed`
5. `active`
6. `resolved`
7. `summarized`

`transitionBattleSession` permits only the immediately following phase. It rejects skipped phases, regressions, repeated transitions, and unknown phases.

`recordBattleOutcome` is valid only from `active`. It moves the session to `resolved`, records casualties and resource use, updates objective and HQ summaries, calculates remaining friendly strength, and preserves the original player-profile and force-allocation snapshots.

The later persistence layer may transition `resolved` to `summarized` after the macro representation has consumed the outcome.

## Macro summary

`createBattleSessionMacroSummary` exposes a renderer-independent projection containing:

- session ID and revision
- location and hierarchy
- lifecycle phase and result
- casualties
- remaining force strength
- original profile resources
- resources spent
- objective control
- HQ state

The Earth or regional view can consume this summary without loading tactical renderer state.

## Serialization

`serializeBattleSession` normalizes and produces canonical JSON with stable key ordering. `restoreBattleSession` parses and validates JSON before returning a normalized session.

Invalid JSON, coordinates, bounds, schema versions, lifecycle phases, provenance classes, required force-package fields, HQ placement, and objective placement are rejected.

## Development fixture

`createDevelopmentBattleSession` provides the deterministic public fixture for St. Paul / Harriet Island. It establishes:

- fixed coordinates and geographic hierarchy
- a 350-meter square playable area
- a larger rendered-context area
- Replica Mode provenance
- a fixed development profile and HQ asset
- two friendly squads
- one enemy squad
- one capture-and-hold objective

The Test Lab and browser tests should consume this fixture through normal routing and session contracts rather than duplicate its values.

## Renderer and stage handoff

The intended handoff is:

1. Earth selection creates or selects the geographic context.
2. Replica generation fills provenance and moves the session to `replica-ready`.
3. HQ placement supplies a validated placement and advances to `hq-placed`.
4. Deployment advances through `deployed` to `active`.
5. Tactical systems record an outcome.
6. Macro presentation consumes the compact summary and later advances to `summarized`.

The Test Lab may begin at predefined checkpoints, but it must create those checkpoints through these same contracts rather than parallel test-only state.

## Deferred work

This contract intentionally does not implement:

- browser persistence
- HQ placement scoring or snapping
- source ingestion and detailed fidelity reports
- tactical simulation changes
- campaign economy
- multiplayer synchronization

Those systems should consume or extend this domain record without embedding renderer objects into it.
