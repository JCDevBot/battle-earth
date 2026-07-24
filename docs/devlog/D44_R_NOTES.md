# D44-R Recovery Build

Recovery branch created from D43 (`water-feature-terrain-interaction`) rather than continuing from the broken D44 line.

## Intent

Restore the known-good D43 visual generation path:

- terrain
- water
- roads
- buildings
- vegetation
- props

Then add diagnostics and classification-only residential inference without replacing or mutating source render collections.

## Added

### Generation Diagnostics

The config panel now includes a Generation Diagnostics section with counts for:

- OSM elements / ways
- OSM road ways
- generated road segments
- OSM building ways
- generated buildings
- building chunks
- water features
- vegetation zones
- trees generated
- residential blocks
- residential greenspaces
- props

This is intended to separate generation failures from rendering or visibility failures.

### Residential Block Inference

Added `residentialBlockZones` as an inspector/classification-only layer.

The inference looks for clusters of home-like buildings and creates an inferred `residential-block` classification polygon around the cluster.

Important: this does not replace roads, buildings, vegetation zones, or water collections. It only supplements classification/debug information.

### Inspector Behavior

When no explicit OSM classification is present, the inspector can now fall back to:

- `RESIDENTIAL-GREENSPACE`
- `RESIDENTIAL-BLOCK`

This helps diagnose neighborhoods that are visually residential but have no OSM `landuse=residential` polygon.

## Recovery Rule

Do not add new water, LOD, destruction, or decoration systems on top of this until the generation diagnostics confirm that roads, buildings, vegetation, water, and props are all being generated again.
