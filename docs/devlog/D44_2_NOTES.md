# D44.2 — Baseline Render Mode / LOD Disabled

Purpose: remove LOD/chunk/distance culling as a possible cause of missing roads, buildings, vegetation, and props while debugging the D44 classification + water bathymetry pipeline.

Changes:
- Disabled PerformanceManager distance culling and altitude culling.
- Layer checkboxes are now the only visibility gate for tracked world objects.
- BuildingLODManager now always renders LOD0/full-detail chunks when Buildings is enabled.
- VegetationLODManager now always renders LOD0/full-detail chunks when Vegetation is enabled.
- Hidden-by-LOD and hidden-by-altitude stats are forced to zero in baseline mode.

Debug expectation:
- If buildings/trees are still missing, the issue is generation, not LOD/culling.
- If they return, the issue was LOD/culling/altitude thresholds.
