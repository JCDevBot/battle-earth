# D36 Tactical Metadata Pass

Purpose: begin moving generated map features from visual objects toward simulation objects.

## Added

- `src/map/engine/TacticalMetadata.js`
- Central tactical metadata resolver for registered features.
- Metadata now includes:
  - `material`
  - `cover`
  - `concealment`
  - `losBlock`
  - `movementBlock`
  - `movementPenalty`
  - `flammability`
  - `durability`
  - `destructible`
  - `occupiable`
  - `tacticalClass`
  - `label`

## Updated

- Tactical overlay now reads from the centralized metadata resolver instead of ad hoc category logic.
- Debug panel now reports concealment, occupiable objects, and destructible tactical objects.
- Existing overlay modes remain backward-compatible:
  - Cover
  - LOS
  - Movement

## Design Direction

This is the foundation for future behavior:

- buildings can be occupiable hard cover
- trees provide stronger concealment than hard cover
- roads are movement surfaces, not cover
- bridges are routes, not tactical overlays
- props vary by type instead of all being generic cover

Future passes should expand this metadata onto non-destructible terrain/ground-cover features and eventually drive combat, suppression, LOS, movement, and destruction from the same source of truth.
