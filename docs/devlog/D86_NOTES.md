# D86 Notes

Focus: fix the real strategic-scale map generation blocker discovered in D85 logs.

Changes:
- Added renderable-feature counting in MapEngine so structural OSM nodes do not trick the renderer into thinking sparse data is usable.
- Strategic scales now always receive scale-aware terrain/entity fill.
- Sparse city/neighborhood OSM now triggers procedural supplementation based on tagged renderable ways/nodes, not raw element count.
- Procedural strategic fill can now render the selected boundary and child entities from the GlobePicker battle request.
- Battle request now carries selected entity geometry/bbox into the map engine.
- Camera far plane, near plane, and OrbitControls max distance now scale with continent/country/state/city/neighborhood extents.

Expected result:
- Continent/country/state maps should no longer be empty or clipped because of tactical camera limits.
- Continent maps should render the selected land entity plus playable child entities before neighborhood OSM detail exists.
- Logs should now show renderable feature counts and augmented totals.
