# D68 Notes - Living Strategic Theater

## Goal
Move the generated campaign board from a flat diagnostic-style map toward a rich strategic war-table presentation.

## Added
- First-pass living strategic theater renderer inside `CampaignStage.jsx`.
- Rich ocean background with depth gradient and subtle water-line texture.
- Biome-style terrain fills for campaign regions.
- Pseudo-3D raised terrain extrusion using per-region relief offsets.
- Raised political borders with selected-region glow.
- Faction influence tint layered over terrain instead of replacing terrain color.
- Command-node markers on owned regions.
- Army markers upgraded from simple circles to banners with strength badges and movement trail hints.
- Conflict markers upgraded to elevated beacons.
- First-pass mountain ridge decoration for large North America-style theater maps.
- War-table legend callout to clarify the new renderer.

## Design Direction
The strategic map should become visually distinct from both the globe lobby and the tactical battlefield:

- Globe: cinematic Earth selection layer.
- Strategic Theater: stylized war table for command decisions.
- Tactical Battlefield: detailed destructible OSM terrain.

## Known Limitations
- This is still an SVG-based strategic renderer, not a true Three.js terrain mesh yet.
- Relief is stylized/pseudo-3D rather than actual DEM terrain.
- Biome detection is heuristic and based on region name/location.
- Mountain ridges are first-pass decorative lines, currently tuned for North America-style views.
- Strategic POIs are still represented through POI counts and command nodes, not real rendered POI objects.

## Next Recommended Step
D68.1 or D69 should either:

1. Convert the strategic theater to a true Three.js renderer, or
2. Continue improving the SVG war-table style with better POIs, roads, rivers, capitals, and influence animation.

The most valuable next gameplay milestone remains Living Frontline: influence spread, supply lines, movement trails, and automatic conflict generation that feels alive on the campaign map.
