# D55 Notes — Vegetation Fidelity & Aerial Canopy LOD

## North Star
Replica first. Tactical second. Performant always.

The map should look close to Google Earth when zoomed out, become interesting at tactical zoom, and eventually support first-person viewing without destroying FPS.

## What Changed

### Aerial Canopy Mass
Added `buildAerialCanopyMass()` to `VegetationLODManager`.

Each vegetation chunk now creates a merged, low-opacity, horizontal canopy silhouette from the generated tree positions. This gives overhead views a stronger Google Earth style canopy footprint without needing thousands of extra tree meshes.

### Distance Behavior
- Near camera: individual tree LOD0 only
- Mid camera: LOD1 plus canopy mass
- Far camera: LOD2 plus canopy mass

This means close tactical views keep readable individual trees, while zoomed-out views read as continuous tree cover.

## Why This Matters
The Bryant Park comparison showed that our biggest visual gap was not only missing trees, but missing the *mass* of urban canopy. Real residential blocks read as roofs embedded in trees, not roofs sitting on empty green ground.

## Validation
Compare D55 to D54 using the Bryant Park/Lyndale location:

- Do residential blocks look more tree-covered from above?
- Do parks and pond edges feel fuller?
- Do buildings still remain readable at close tactical zoom?
- Does performance remain acceptable because canopy mass is merged per chunk?

## Next Recommended Slice
D56 should move to exact OSM building footprints and building type visuals.

Focus:
- preserve real OSM building geometry
- remove footprint inflation artifacts
- classify `building=*` tags into visual types
- make houses, garages, commercial, warehouse, school, and utility buildings look meaningfully different

## D55 Hotfix A - OSM 429 + geometry merge stability

User reported two runtime issues after D55:

1. `OSM API error: 429`
2. `THREE.BufferGeometryUtils: .mergeGeometries() failed ... compatible attributes / index attribute`

Fixes applied:

- OSMService now uses Overpass endpoint failover.
- 429, 502, 503, and 504 responses now back off and try another endpoint before failing.
- Retry-After headers are respected when present.
- Geometry merge paths now normalize indexed geometries to non-indexed before merging.
- Applied safe merge normalization in:
  - MapFeatureBuilder
  - VegetationLODManager
  - BuildingLODManager

Build verified with `npm run build`.
