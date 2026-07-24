# D32 Notes - OSM Broad Base Data Cleanup

## Main intent
D32 separates OSM data loading from visual/debug layer toggles.

## Changes
- Core / expanded / tactical presets now fetch the same broad base OSM selector set.
- Added `broadBase` preset as the new default.
- Cache key bumped to v2 so stale narrower OSM payloads are not reused.
- Renamed the user-facing data selector from "OSM profile" to "OSM data preset".
- Renamed the tactical layer label to "Tactical Overlay".
- Physical OSM features such as railways, barriers, and infrastructure are no longer classified under the tactical overlay layer.
- Tactical overlay toggle should now hide/show debug/gameplay overlays, not real map infrastructure.

## Important behavior
Bridges, tunnels, railways, barriers, waterways, buildings, landuse, natural areas, amenities, power/man_made/military/historic features are fetched by default in broad-base presets.

## Tester note
If map content looks stale, use "Clear Saved Maps" once because older local cache entries may have been generated under narrower profiles.
