# D43 — Water Feature Terrain Interaction

## Goal
Move water from a purely visual layer toward a terrain-aware gameplay feature.

## Changes
- Added `WaterFeature` metadata for polygon water:
  - water type
  - area
  - surface elevation
  - terrain min/max/average
  - estimated depth
  - actual depth after basin modifier
  - flow speed
  - flow vector
  - terrain modified flag
- Added shallow water basin modifiers to `TerrainSystem`.
  - Pond/lake-style water now cuts a shallow basin into the terrain.
  - Linear water/rivers use a smaller channel modifier.
  - Islands/holes are excluded from basin cuts.
- Updated `getHeight()` / `getWorldHeight()` to include terrain modifier deltas.
- Applied water terrain modifiers before roads, buildings, vegetation, and decorations are generated.
- Updated water surfaces after terrain modification so the water sits at its calculated surface elevation.
- Expanded Classification Inspector with:
  - Water feature panel
  - Terrain sample panel
  - base height
  - final height
  - modifier delta
  - water point depth
  - flow vector/speed

## Why
This helps verify whether ponds/rivers are just decals or whether they are affecting the terrain surface. It also creates the foundation for fordability, vehicle bogging, river crossing logic, wetland depth, bridges, and tactical water rules.

## Known Limits
- This is still heightmap-style terrain modification, not voxels.
- Water bodies are still simple level surfaces; rivers are not yet hydraulically solved.
- Basin depth is inferred from OSM tags and heuristics unless explicit `depth=*` is present.
