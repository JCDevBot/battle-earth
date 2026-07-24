# D44 – Natural Water Bathymetry + Residential Block Inference

## Summary
D44 tightens two systems uncovered by D43 testing:

1. Water basins now use a simple bathymetry model instead of a mostly uniform cut.
2. Residential neighborhoods without OSM landuse polygons now infer block-level residential greenspace from clusters of home-like buildings.

## Water changes
- Still-water features now default to zero flow speed unless OSM tags explicitly provide flow/speed.
- Pond/lake basin modifiers now use distance from the nearest shoreline, including island holes, to shape depth.
- Basin cuts are shallow near shore and deepen toward the interior.
- Island holes remain unmodified and act as shoreline boundaries for depth falloff.
- Water inspector includes bathymetry metadata groundwork:
  - `bathymetryModel`
  - `maxInteriorDistance`

## Residential inference changes
- Added inferred residential block zones from clusters of small home-like buildings.
- Residential block inference fills UNKNOWN neighborhood fabric where OSM does not provide `landuse=residential`.
- Existing building, road, and water exclusions still win; the block inference only authorizes sparse yard/street vegetation in otherwise unknown areas.
- Classification overlays include inferred residential block areas using the residential greenspace color.

## Intended debug result
Clicking open yard space in a neighborhood block should now report:

- Ground class: `RESIDENTIAL-GREENSPACE`
- Source: `inferred-residential-block`
- Vegetation rule: sparse yard/street décor candidates

Clicking inside a pond should show positive point depth. Clicking an island inside a pond should remain depth 0 and modifier delta 0.
