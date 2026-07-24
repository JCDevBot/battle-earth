# D57.1 Replica Mode + Operational Battlefield

Purpose: make the default startup view useful for judging Google Earth style replica fidelity before tactical/debug overlays are enabled.

Implemented:
- Default map preset now uses an operational rectangle: 800m east-west by 1200m north-south.
- Added configurable aspect presets in the config panel: Square, Operational, Deep.
- OSM bounding box now supports separate width/depth so the source query can cover a north-south operational area.
- Terrain generation receives width/depth separately.
- Startup camera frames the longer battlefield from a higher tactical angle.
- Replica Mode defaults are applied after generation:
  - ON: terrain, roads, buildings, vegetation, water, props, units
  - OFF: tactical buildings, territory heatmap, frontline, strategic POIs, objective hierarchy, influence rings, battlefield grid, tactical overlay, classification debug, fog

Notes:
- Some older managers still use a single sizeMeters value internally. For D57.1 this is intentionally the max dimension so tactical systems still cover the full area while we test the presentation feel.
- Future pass should make bounds, grid, navigation, fog, and territory fully width/depth aware if we keep rectangular maps.
