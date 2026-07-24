# D35 Notes — Vegetation Density Normalization

## Goal
Keep the vegetation FPS safety cap while preventing small maps from receiving the same total tree budget as larger maps.

## Changes
- Added an area-normalized vegetation budget in `VegetationLODManager`.
- Tree budget now uses map area first, then applies a performance cap.
- Small slices such as 350m maps receive a smaller total tree budget than 1000m maps.
- Existing LOD and performance protections remain in place.
- Added internal vegetation stats fields: requested, accepted, capped, map size, area hectares, max trees.

## Expected Result
- 350 x 350 maps should no longer look over-planted compared with 1000 x 1000 maps using the same coordinates.
- 1000m maps should keep roughly the same readable density while still respecting the FPS cap.
