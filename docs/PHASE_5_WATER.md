# Phase 5 — Water System v1

This phase upgrades water from a flat material into a simple animated tactical water system.

## Added

- Animated shader-based water material
- Waterway classification widths for rivers, canals, streams, ditches, and drains
- Wet bank strips around rivers and waterways
- Shoreline/bank materials for lakes and water polygons
- Water edge vegetation hints by feeding shoreline segments into the existing riverbank vegetation pass
- Runtime water animation update from `MapEngine.animate`

## Test

```bash
npm install
npm run dev
```

Load a map with a river/lake/canal and check:

- water has subtle animated ripple movement
- river widths vary by OSM `waterway`
- banks are darker/wetter around water
- shoreline areas attract vegetation
- FPS remains stable
