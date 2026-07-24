# Phase 10G.2 Persistent Battlefield Representation

Goal: stop neighborhoods, forests, terrain color, and core map features from disappearing or changing abruptly while zooming or panning.

## Changes

- Disabled the experimental multi-ring TerrainLOD renderer by default.
  - The single authoritative TerrainSystem mesh is now the visible battlefield surface.
  - This prevents the broad color and material shifts caused by altitude-based terrain LOD swaps.
- Tightened the tactical camera depth range from 1-100000 to 2-8000.
  - This improves depth precision and reduces shimmer.
- Increased terrain mesh detail dynamically based on map size.
  - Terrain now uses up to 256 segments instead of a fixed 128.
- Widened building LOD thresholds.
  - Buildings now remain represented much farther from the camera.
  - The far LOD footprint is treated as a persistent representation, not a culling fallback.
- Widened vegetation LOD thresholds.
  - Forests remain represented as simplified far vegetation much farther from the camera.
- Disabled frustum culling on building and vegetation LOD groups.
  - This reduces mistaken disappearance when chunk bounds are imperfect.

## Testing Notes

Test by zooming in and out over a dense neighborhood.

Expected behavior:

- Buildings should simplify, not vanish.
- Forests should simplify, not vanish.
- Ground color should remain stable.
- Entire feature layers should not disappear at a zoom threshold.

Known limitation:

- This does not yet create true forest canopy masses or better building archetypes. It is an engine stability pass so future visual passes have a stable base.
