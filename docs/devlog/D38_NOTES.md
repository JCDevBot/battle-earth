# D38 — Canopy Authority Refactor

Goal: shift the experimental Planetary Computer/NAIP vegetation probe from an additive source into a placement authority for vegetation.

## What changed

- Added canopy-authority helpers in `MapFeatureBuilder`.
- When external canopy data is available, vegetation placement now checks the canopy mask before accepting candidate tree locations.
- OSM vegetation polygons now act more as biome/context classification, while canopy score influences whether trees actually appear at a candidate point.
- Street trees, canopy fringe trees, shoreline ecology, and riverbank trees now route through canopy-aware placement checks.
- Added D38 canopy authority diagnostics into the reconstruction zone stats, including accepted/rejected/low-score fallback counts.

## Important behavior

- If Planetary/NAIP canopy is unavailable, the map falls back to normal OSM/procedural vegetation behavior.
- This is still a research/prototype pass. The NAIP green-pixel classifier is not yet a true tree-crown detector.
- The code uses a small neighborhood max around canopy samples so the coarse grid does not reject trees because a crown falls across a grid-cell boundary.
- Low-score fallback is intentionally small and context-sensitive so maps do not become sterile if the external probe is imperfect.

## What to test

Generate the same 350m and 1000m map with:

1. `OSM + procedural`
2. `Experimental: Planetary Computer NAIP canopy probe`

Look for:

- Residential trees appearing closer to real canopy locations.
- Fewer random trees in empty lawns/open spaces.
- Stream and shoreline vegetation still present, but less randomly scattered.
- No major FPS regression.
- Canopy diagnostics showing accepted/rejected placement counts.

## Next likely work

- Improve canopy classification beyond simple green-pixel scoring.
- Add true canopy mask visualization/debug overlay.
- Add residential vegetation builder that uses canopy mask + building/road geometry.
- Bridge audit and visual bridge deck pass.
