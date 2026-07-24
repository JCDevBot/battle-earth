# D56.1 Hotfix — Residential Roof Visibility

## Goal
Residential homes must visibly read as houses from the tactical camera. The running D56 build showed flat-topped residential boxes even though the roof generation path existed.

## Fixes
- Forced low-rise residential buildings to receive pitched roofs when OSM roof tags are missing, weak, generic, unknown, or flat.
- Added `normalizeRoofShape()` to handle OSM variants like `gabled`, `hip`, `flat-roof`, and generic `yes`.
- Added `selectResidentialRoofShape()` to consistently choose gable/hipped silhouettes for homes.
- Increased residential roof ridge height so the roof is visible from overhead and oblique tactical views.
- Increased residential eave overhang.
- Cloned roof materials for pitched roofs and set `THREE.DoubleSide` so roof triangles cannot disappear due to winding/backface culling.
- Added polygon offset and render order to keep roofs from visually fighting with wall caps.
- Added ridge caps for residential gable/hip roofs.
- Added `d56_1VisibleResidentialRoof` metadata on visible residential roof meshes.

## Validation
- `npm run build` passes.
- Expected visual result: residential houses should no longer appear as beige flat-topped boxes. From the Bryant Park test view, homes should show dark/colored pitched roofs with visible ridges.

## Next Checks
- Verify in browser from multiple camera angles.
- If roofs still fail to show, inspect whether `BuildingLODManager.buildBatchedLOD0()` is dropping cloned roof materials or geometry during merge.
- Once visible, tune roof pitch/colors rather than changing generation logic.
