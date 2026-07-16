# D70 - 3D Campaign Terrain Renderer

## Goal
Turn the generated campaign board into a more spacious 3D theater view and fix the campaign layout so the map and controls remain accessible on desktop, TV, and debug/responsive screen sizes.

## Added
- First-pass 3D/perspective strategic theater presentation.
- Campaign map now uses a perspective war-table tilt instead of a flat framed board.
- Larger theater viewport with the map promoted to the primary screen element.
- Stronger raised-terrain depth shadows and exaggerated terrain relief offsets.
- Richer 3D theater labels and HUD copy.
- Responsive campaign layout uses fixed viewport height, scrollable command sidebar, scrollable command cards, and scrollable event sections.
- Region cards and event logs no longer push core map interaction off-screen.
- Existing D69 systems retained: army banner selection, click-to-move, influence paint, movement trails, contested overlays, event log, and North America theater filtering.

## Design Direction
The campaign view is moving toward a generated strategic 3D map at the selected entity scale:

Globe Lobby -> 3D Strategic Theater -> Operational View -> Tactical OSM Battlefield

At each level, we should generate appropriate geographic features:
- World/continent: countries, capitals, mountain ranges, rivers, coastlines, supply corridors.
- Country/state: regions, cities, ports, airbases, highways, rivers, terrain barriers.
- City/neighborhood: roads, buildings, bridges, POIs, destruction-ready tactical objects.

## Still To Do
- Replace SVG perspective pass with true Three.js campaign terrain geometry.
- Add actual terrain elevation sampling or procedural height generation by biome and geography.
- Add real rivers, roads, capitals, and strategic POIs as 3D objects.
- Add orbit/pan/zoom camera controls to the campaign theater.
- Add influence as a continuous field rather than per-region tint.
- Add road-aware movement and supply.
