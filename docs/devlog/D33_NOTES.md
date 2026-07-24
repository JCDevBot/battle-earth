# D33 - Props/Ground Classification Cleanup

## Goal
Clean up broad OSM ingestion so large landcover polygons do not behave like props.

## Changes
- `PerformanceManager` now honors explicit `userData.layer` before falling back to feature-name classification.
- Vegetation/landcover feature names such as park, forest, scrub, wetland, and canopy now classify as `vegetation`, not `props`.
- Park/grass OSM polygons are now treated as ground-classification metadata rather than visible prop surfaces.
- Forest/wetland/scrub polygons still render as subtle vegetation surfaces and remain controlled by the vegetation layer.
- Water polygons remain visible water regions.

## Why
D32 broadened OSM fetching, which exposed some park/grass polygons that were rendered as large pale overlays. Because they fell through to `props`, toggling Props made entire park-sized ground plates appear/disappear. Parks are battlefield terrain metadata, not props.
