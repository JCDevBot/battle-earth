# Phase 7 - Performance Foundation

This phase adds a first-pass performance system without changing the visual pipeline.

## Added

- `PerformanceManager`
  - indexes generated map objects after each build
  - assigns objects to 250m logical chunks
  - classifies render layers: terrain, roads, buildings, vegetation, water, tactical
  - applies distance-based LOD visibility checks on a throttled interval
  - reports visible objects, hidden-by-LOD count, hidden-by-layer count, and chunk count

- Debug panel layer toggles
  - terrain
  - roads
  - buildings
  - vegetation
  - water
  - tactical

- Expanded render stats
  - chunks
  - visible object count
  - LOD-hidden count
  - layer-hidden count

## Testing

1. Run `npm install`
2. Run `npm run dev`
3. Generate the default map
4. Use the right-side debug panel to toggle layers
5. Zoom/pan around the map and watch the visible object / hidden-by-LOD stats
6. Confirm destruction still works with grenade/shell/airstrike

## Notes

This is not final streaming yet. It is the foundation for chunk streaming and destruction-aware partial rebuilds.
