# D77 - Terrain LOD Theater Renderer

Goal: push the strategic theater away from an infographic/painted board and closer to the OSM tactical map style, but at continent/country/state scale.

## Added

- Region-clipped procedural terrain detail layer.
- Biome-specific micro detail:
  - mountain regions get shaded ridge bands,
  - ice/tundra gets snow/ice streaks,
  - forest/boreal/tropical regions get organic vegetation masses,
  - desert regions get dune/contour strokes.
- Softer ownership/influence overlay so terrain reads first and faction color reads second.
- Reduced feature-label dominance so rivers/forests/mountains feel like physical map features instead of atlas labels.
- Kept borders, rivers, corridors, armies, influence paint, conflict beacons, and tactical hook.

## Notes

This is still SVG-based, not yet a true mesh/DEM renderer. The purpose of D77 is to test the visual direction: strategic maps should look like generated terrain models rather than symbolic political paintings. A later renderer should migrate this terrain language into Three.js mesh tiles shared with the tactical OSM renderer.
