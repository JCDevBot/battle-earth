# D71 - Scale-Aware 3D Theater Renderer

Goal: Move the campaign map toward the same readable 3D generated-map language as the neighborhood OSM view, while keeping content appropriate to strategic scale.

Added in this pass:
- D71 labeling and notes.
- Scale-aware feature logic for campaign theaters.
- Strategic rivers rendered on the theater map.
- Strategic roads/movement corridors rendered between regions.
- Forest and mountain decorations based on terrain/biome profile.
- Feature footer describing the active scale.
- Preserved D69/D70 army selection, influence paint, movement trails, region cards, events, conflicts, and tactical launch hook.

Design principle:
- Neighborhood scale renders buildings and detailed OSM features.
- Country/state/continent scale renders borders, rivers, forests, mountain systems, capitals, roads/corridors, strategic POIs, armies, and influence.

Next recommended step:
- Convert this SVG war-table renderer into a true Three.js theater scene, reusing more of the tactical map camera/material language.
- Add real DEM/terrain sampling for mountain relief when available.
- Add real rivers/roads from Natural Earth/OSM at the selected theater scale.
