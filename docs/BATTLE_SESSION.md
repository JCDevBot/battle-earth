# BattleSession Domain Contract

`BattleSession` is the versioned, renderer-independent record for one Replica Neighborhood Battle. It connects the Earth-selection flow, replica generation, player resources, HQ placement, tactical state, outcome recording, and the later macro persistence layer.

The implementation lives in [`src/domain/BattleSession.js`](../src/domain/BattleSession.js). The product and fidelity requirements are defined by the [Replica Neighborhood Battle vertical-slice charter](REPLICA_NEIGHBORHOOD_VERTICAL_SLICE.md).

## Boundary

The domain module must not import React, Three.js, browser storage, DOM APIs, or network clients. Renderers and stages consume the session; they do not own its identity or schema.

## Versioning

- Schema: `battle-earth/session`
- Current version: `1`
- Unsupported schemas and versions are rejected.
- Future breaking changes require an explicit version migration rather than silent reinterpretation.

## Stable identity

A session ID is derived deterministically from normalized setup inputs:

- schema and version
- seed
- geographic context
- playable and rendered-context bounds
- player-profile snapshot
- HQ plan
- friendly and enemy force packages
- objective
- environment

Mutable tactical progress, outcomes, and macro summaries do not change the session identity. Equivalent normalized setup input must produce the same ID.

## Contract areas

### Geographic context

Contains a stable location ID, display name, geographic hierarchy, latitude, and longitude. Coordinates are range-validated.

### Spatial bounds

`playableBounds` controls deployment, movement targets, objectives, navigation, fog, and tactical simulation.

`renderedContextBounds` controls the larger visible environment and must fully contain `playableBounds`. The context area may host visual continuity and later HQ staging, but it is not automatically playable.

### Replica fidelity

The session records Replica Mode provenance entries using one of four explicit classes:

- `source-exact`
- `high-confidence-derived`
- `low-confidence-inferred`
- `procedural-fallback`

Each entry identifies a feature type and source. Warnings remain visible rather than being converted into false precision.

### Player profile and HQ

The session stores a deterministic snapshot of the player profile needed for the battle, including the HQ asset, available resources, and relevant upgrades. It stores HQ placement status separately so placement can evolve without mutating the source profile.

### Forces

Friendly and enemy force packages contain stable package IDs and normalized unit records. The first development fixture uses two friendly infantry squads and one enemy infantry squad.

### Objective and environment

The first fixture defines one capture-and-hold objective plus deterministic environment settings. Later work may add additional fields through backward-compatible additions or schema migration.

### Battle, outcome, and macro state

- `battleState` tracks the current phase and elapsed simulation time.
- `outcome` records the resolved result, casualties, and resources spent.
- `macroState` summarizes remaining force strength, objective control, HQ state, and broad availability for the return to Earth view.

The first contract defines these records but does not implement storage or tactical-to-macro aggregation.

## Serialization

`serializeBattleSession` normalizes and converts a session to JSON. `restoreBattleSession` parses and validates JSON before returning a normalized session. Invalid JSON, coordinates, bounds, schema versions, provenance classes, and required force-package fields are rejected.

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

## Deferred work

This contract intentionally does not implement:

- browser persistence
- HQ placement scoring or snapping
- source ingestion and detailed fidelity reports
- tactical simulation changes
- campaign economy
- multiplayer synchronization

Those systems should consume or extend this domain record without embedding renderer objects into it.
