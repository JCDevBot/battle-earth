# D57 Notes — Building Attribution & Roof Diagnostics

## Goal
Improve OSM replica fidelity when building footprints come through as weak `building=yes` records, especially Microsoft BuildingFootprints imports.

D57 does not invent new buildings. It keeps exact OSM footprints and improves how weakly tagged footprints are interpreted.

## Added

- Context-aware classification for weak `building=yes` footprints.
- Classification uses nearby OSM context:
  - parking polygons
  - parking aisles
  - major roads
  - service roads
  - residential roads
  - developed/asphalt/concrete land surfaces
  - footprint area
- Better distinction between:
  - residential houses
  - garages/outbuildings
  - commercial roadside buildings
  - service/commercial buildings
  - industrial/large buildings
- Attribution diagnostics:
  - explicit tag classifications
  - inferred classifications
  - weak `building=yes` count
  - inference reasons
- Roof diagnostics:
  - roofs generated
  - residential roofs generated
  - roof shape counts

## Important Design Rule
OSM geometry remains the source of truth. D57 only enriches missing building type data when OSM tags are too weak to identify the real building use.

## Why This Matters
The Bryant Park test area shows nearly all buildings as `building=yes`, mostly from Microsoft footprints. That provides accurate geometry but weak type data. Without contextual attribution, the map over-classifies almost everything as residential.

## Expected Diagnostic Shift
Before D57, a typical test showed roughly:

- residential: 468
- garage: 25
- commercial: 3

After D57, we expect more context-derived commercial and garage classifications around parking, service roads, and major corridors.

## Next Check
Run Bryant Park again and inspect:

- D57 Building Classes
- D57 Attribution
- Roofs generated
- Residential roofs
- Inference reason counts

If commercial buildings are still under-detected, the next pass should add parcel-level grouping and nearby POI/name inference.
