# D41 — Classified Item Pipeline + Terrain-Draped Debug

## Goal
Move the map toward a classify-first / generate-second / decorate-third architecture so vegetation and man-made features are resolved from shared map intent rather than one-off rendering passes.

## Added

### Classified item indexes
- `naturalClassifiedItems`
- `manMadeClassifiedItems`
- `resolvedSurfaceItems`

These collect normalized map intent from OSM ground polygons, water, roads/bridges, buildings, and inferred residential greenspace.

### Inferred residential greenspace
Residential yard/block areas are now inferred around small home-like buildings when the area does not already sit inside explicit OSM natural/water classes.

This directly addresses inspector results like:

- `Ground class: UNKNOWN`
- `No containing OSM feature`
- `Building buffer: YES`

The debug layer can now report:

- `RESIDENTIAL GREENSPACE`
- `Source: inferred-residential`
- `Vegetation rule: sparse yard/street décor candidates`

### Residential decoration vegetation
Added a residential greenspace tree pass after street trees. It places sparse yard/front/back residential trees using canopy score as an authority/modifier while respecting water, road, and building exclusions.

### Terrain-draped classification overlays
Classification polygon fills and outlines now sample terrain height per vertex instead of rendering as a single flat sheet at centroid height.

This prevents debug coverage from visually floating across gorges, creek banks, and steep terrain.

### Draped chunk grid
The debug chunk grid is now sampled along terrain instead of drawn as perfectly flat line segments.

## Notes
This is the first architectural pass. It does not fully replace the old generation pipeline yet, but creates the structure needed to make those passes consume resolved map intent in future updates.
