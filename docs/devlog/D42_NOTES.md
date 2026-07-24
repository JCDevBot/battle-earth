# D42 Water Layer Cleanup + Water Semantics

## Problem
When Terrain + Water were enabled, the map showed three water-looking layers:
- actual water surface
- shoreline strip
- wet-bank/riparian helper strip

For clipped or concave water polygons, the filled shoreline helper could self-intersect and render a large triangular artifact that did not match the OSM water geometry.

## Changes
- Water layer now renders only literal wetted water surfaces.
- Linear waterway helper strips are moved out of the water layer:
  - wet-bank => vegetation layer
  - shoreline => props layer
- Removed filled polygon shoreline/bank helper surfaces from broad water polygons.
- Kept shoreline detail via reeds/rocks/shrubs rather than filled blankets.
- Added water metadata on water meshes:
  - estimated depth
  - estimated flow speed
  - flow vector for linear waterways

## Design Direction
Water should become its own classified item with:
- surface polygon/channel geometry
- depth estimate
- flow vector/speed
- bank/shoreline context
- tactical rules for movement, LOS, crossing, and vehicles

## Next Candidates
- Add Water Inspector panel fields for depth/flow.
- Add water-depth visualization/debug layer.
- Add bridge crossing rules and ford/shallow crossing inference.
