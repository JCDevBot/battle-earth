# D46 — Strategic POI Phase 1

Goal: create the first vertical slice of strategic POI generation without turning it into full balance/scoring yet.

Implemented:
- Added `StrategicPOIManager`.
- Generates Phase 1 candidate POIs from already-built map features:
  - Bridge crossings as chokepoints.
  - Road junctions and major intersections.
  - Tagged/large buildings as logistics, infrastructure, or population/civic sites.
  - Terrain high-ground samples as observation points.
- Deduplicates nearby candidates and keeps the strongest visible set.
- Renders map-space POI pins with labels and type/priority values.
- Added a `strategic-pois` visual layer toggle.
- Added a Strategic POIs diagnostics section to the config panel with counts by type and top candidates with reason traces.

Notes:
- This is intentionally Phase 1 only: candidate generation and debug visibility.
- Priority values are rough heuristics, not yet final gameplay scoring.
- Next step should be Phase 2 scoring: centrality, accessibility, team fairness, capture radius, reward type, and HQ/objective selection.

Build:
- `npm run build` passes.
- Vite still warns that the main JS chunk is larger than 500 kB; this warning existed conceptually before and should be handled later with code splitting.
