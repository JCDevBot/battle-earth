# D45 — Riparian Corridor Vegetation Authority

Starting point: D44-R.3 building batching/performance recovery build.

## Goal
Make rivers, streams, and creeks generate a readable riparian vegetation corridor even when adjacent OSM land is classified as park, grass, or unknown.

## Changes
- Added `getRiparianCorridorWidth()` to derive per-side vegetation influence from waterway type and channel width.
- Added `isRiparianPlacementLocation()` so riverbank vegetation is authorized by the river corridor itself instead of requiring canopy-probe approval.
- Rebuilt `scatterRiverbankTreesLOD()` to create a denser, two-band riparian corridor along water segments.
- Still respects hard exclusions through `isSmartLocation()`:
  - open water
  - roads/bridges
  - building footprints
  - map bounds
- Added generation diagnostics counters:
  - riparian candidates
  - riparian trees accepted

## Validation
Use the same creek/river screenshot area from D44-R.3. Expected result: a more continuous tree corridor following bends on both banks, including through park/grass/unknown areas, while roads and bridges remain clear.
