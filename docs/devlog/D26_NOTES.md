# D26 Island Cleanup + Camera Containment

Built from `osm-tactical-map-d25-island-elevation-containment(1).zip`.

## Changes

- Removed the translucent island wet-bank overlay that could read as an unwanted light-green map layer.
- Removed the small hand-authored pond islet patches from the small-slice test map; only the main pond island is reconstructed until reliable OSM/imagery rings are available.
- Tightened island vegetation validation so tree crowns and trunks stay farther inside island land.
- Fixed the water-buffer exception around islands so island proximity no longer cancels the surrounding pond clearance buffer.
- Added a pointer-leave guard for camera edge panning: when the mouse leaves the map canvas, edge pan stops and pending hold previews are cancelled.
- Confirmed the tactical layer remains disabled by default in the visual layer defaults.

## Verification

- `npm run build` completes successfully.
- Vite reports the existing large bundle warning only.
