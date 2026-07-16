# D38.6 Floating Ground Overlay Cleanup

## Problem
D38.5 exposed a floating pale-green layer along creek/vegetation areas. The layer was not individual trees; it was flat polygon overlay geometry rendered at one centroid elevation above sloped terrain.

## Fix
- Vegetation/ground-classification OSM polygons no longer render as flat visible surfaces.
- Forest/wetland/scrub/park region polygons remain available as placement and tactical metadata only.
- Small-slice reconstruction surface zones are now metadata-only and no longer render translucent plates.
- Canopy ground-darkening decals are disabled until they can be properly draped to terrain.

## Preserved
- Water polygons still render.
- Vegetation zones still drive tree/shrub/reed placement.
- Canopy diagnostics and NAIP classifier work remains intact.
- Tactical metadata for zones remains available.

## Next
If we want visible ground-cover tinting later, implement it as a draped terrain mesh/texture sampled per vertex, not as a single flat ShapeGeometry.
