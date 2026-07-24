# Phase 9B Performance Recovery

This pass stops the Phase 9A world-detail layer from creating thousands of unique meshes.

## Main changes

- Residential fence rails are merged into one batched mesh.
- Residential fence posts are merged into one batched mesh.
- Driveways are merged into one batched surface mesh.
- Parking pads are merged into one batched surface mesh.
- Parked cars are now one global `InstancedMesh` instead of one instanced mesh per parking lot.
- Existing streetlight/utility pole instancing is preserved.
- Batched props still register with the destruction/tactical systems as coarse batched features.

## Expected result

The exact FPS depends on the loaded map and camera angle, but the important recovery should be:

- far fewer draw calls
- far fewer geometries
- far fewer visible objects
- triangle count may remain similar, which is fine

## Test checklist

1. Load the same map used for the 6 FPS screenshot.
2. Compare debug stats with Props enabled.
3. Toggle Props off/on.
4. Test grenade/shell/airstrike near fences, parking, and cars.
5. Confirm tactical overlays still show prop contributions.

## Known tradeoff

Batched fences/driveways/parking are now coarse destructible objects rather than each small prop being individually destructible. This is intentional for recovery. Later phases can use chunk-level batching to recover finer destruction without returning to thousands of draw calls.
