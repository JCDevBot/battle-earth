# D80 Notes

This pass addresses the gap between D79 and the intended continuous-map Risk renderer.

## What changed

- Added continuous campaign map zoom controls directly on the strategic SVG map:
  - Zoom in
  - Zoom out
  - Focus selected
  - Reset theater
- Added scale labels so the map reports whether the current frame is operating at continent, country, state/province, city, or neighborhood scale.
- Changed blank-map clicks into map commands:
  - Clicking the map projects the click back to lon/lat.
  - The nearest generated region becomes the custom army destination.
  - If an army is selected, the click issues the move/expand/attack order.
- Fixed the flat green OSM fallback problem at continent/theater scale:
  - OSM live terrain no longer paints a plain green rectangle when the current view is too large for OSM detail fetching.
  - Strategic scale now falls back to the stylized theater terrain layer.
- Restored the game-map look closer to the concept images:
  - The theater feature layer now renders at strategic scale.
  - Rivers, mountain systems, strategic corridors, forests, and terrain zones render beneath ownership overlays.
  - Region terrain details now render inside clipped territory geometry.
- Updated labels and UI copy from D79 to D80.

## Important limitation

This is still an SVG strategic renderer, not yet a full 3D terrain mesh or Cesium-style continuous globe. It now behaves more like the intended continuous map, but the next leap should be a true camera-driven map engine where the same world renderer handles continent, country, state, city, and neighborhood LODs without switching rendering modes.

## Build

`npm run build` passes. Vite still reports the existing large bundle warning.
