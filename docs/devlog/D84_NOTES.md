# D84 Notes

## Goal
Add the first real continuous-world LOD pipeline so the generated map starts at the selected land entity scale and can later stream down toward neighborhood detail through camera zoom.

## What changed
- Added `src/world/WorldScaleConfig.js` with explicit render bands:
  - Continent
  - Country
  - State / Region
  - City
  - Neighborhood / Tactical
- `MapEngine.generateMap()` now enriches incoming map config with a `worldScale` before rendering.
- Large strategic views use terrain/roads/water/vegetation/POI layers and skip neighborhood-only systems.
- Neighborhood/city views keep the richer tactical renderer.
- OSM fallback is now scale-aware:
  - continent/country/state fallback creates broad rivers, terrain zones, mountain peaks, and major strategic corridors
  - neighborhood fallback still creates streets, blocks, parks, and buildings
- Planetary Computer NAIP canopy probing now only runs for neighborhood scale.
- Added `[WorldLOD]` logs so browser console/log panel should show what scale is being rendered and which layers are active.

## Why
The previous builds were trying to use the same tactical neighborhood renderer for continent scale. That made North America behave like a huge neighborhood map. D84 separates the render intent by scale while keeping the long-term goal of one continuous map.

## Build
`npm run build` passed. Existing Vite bundle-size warning remains.
