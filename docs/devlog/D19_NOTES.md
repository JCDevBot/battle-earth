# D19 Canopy Reconstruction Pass

This build expands the small slice reconstruction sandbox toward the Google Earth reference target.

## Main changes

- Added larger overlapping canopy reconstruction zones around the pond, island, south shoreline, rear residential lots, southwest block, east residential lots, apartment perimeter, and water tower area.
- Added zone density support to the vegetation LOD scatterer so reconstruction zones can intentionally generate heavier, more continuous canopy than generic OSM park/forest areas.
- Increased internal canopy structure for reconstruction zones with larger clumps, more mixed mature/medium/sapling trees, and less isolated tree placement.
- Increased small-slice boulevard/street tree density while preserving gaps near streets and yards.

## Intent

D18 introduced reconstruction zones as a framework. D19 uses those zones more aggressively so the small slice begins to read as houses and streets embedded within mature canopy rather than houses on open grass with trees sprinkled around them.

## Test location

Small Slice Test Map
- Latitude: 44.849758
- Longitude: -93.289793
- Size: 350m
