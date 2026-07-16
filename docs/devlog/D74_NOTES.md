# D74 - Scale-Aware World Generator Pass

## Goal
Move the strategic theater away from infographic/map-symbol rendering and toward the same generated-world language used by the tactical OSM maps.

## Added / Changed
- Reduced heavy faction paint so terrain remains the primary visual layer.
- Replaced mountain triangle icons with continuous shaded mountain ridges.
- Replaced tree-icon clusters with organic forest-zone terrain patches.
- Added subtle terrain contour/surface-flow lines.
- Kept rivers as carved/bright terrain features rather than simple labels.
- Preserved borders, command nodes, army banners, influence paint, conflicts, and tactical hooks.
- Updated theater copy and diagnostics to describe the scale-aware world generator direction.

## Direction
At large campaign scales, the renderer should generate:
- terrain surface
- borders
- rivers
- forests
- mountain ridges
- movement corridors
- command nodes
- armies
- influence overlays

At neighborhood scale, the same visual language should continue with roads, buildings, trees, POIs, and destructible objects.

## Build
Verified with `npm run build`.
