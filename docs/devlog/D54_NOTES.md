# D54 Notes — OSM Fidelity Surfaces & Canopy Pass

## North Star
Generate a destructible tactical replica from lat/lon OSM data. The map should look close to Google Earth when zoomed out, become tactically readable when zoomed in, and remain performance-safe for a possible future first-person view.

## What D54 Adds

### OSM surface rendering
- Added `resolveOsmSurfaceType(tags)` to classify non-building OSM polygons into visible surface types.
- Added `createOsmSurfaceRegion()` to render OSM-derived ground surfaces instead of leaving large polygons as generic grass.
- Supported first-pass surface types:
  - `amenity=parking`, `parking=*`, `landuse=parking`
  - `leisure=pitch`
  - `sport=tennis`
  - `sport=baseball` / `sport=softball`
  - `leisure=track`
  - `surface=asphalt`, `surface=paved`, `surface=concrete`
  - `landuse=commercial`, `landuse=retail`, `landuse=industrial` as developed paved land

### Parking lot detail
- Parking polygons now render as paved surfaces.
- Parking lots get procedural striping.
- Larger parking lots get a small number of parked-car props through the existing world-detail batch system.

### Sports surface detail
- Tennis, baseball, generic pitch, and track polygons now get visible surface treatment.
- Added simple line markings so fields/courts read from tactical altitude.

### Explicit OSM trees
- Added `createExplicitOsmTreeNodes()` for `natural=tree` nodes.
- These are treated as high-authority tree placements and bypass canopy-probability filtering while still respecting roads, buildings, and water.

### Residential canopy reconstruction
- Added `scatterResidentialCanopyClustersLOD()`.
- Uses inferred residential block zones to place additional large neighborhood canopy clusters.
- This is intentionally not a full satellite-canopy solution. It is a controlled OSM-derived approximation so residential blocks read closer to Google Earth from above.

### Diagnostics
Added generation diagnostics for:
- OSM surface ways
- OSM parking ways
- OSM sports ways
- rendered surfaces
- rendered parking polygons
- rendered sports polygons
- explicit OSM tree nodes
- inferred residential canopy trees

## Validation Focus
Use the Bryant Park comparison location again.

Look for:
1. Do commercial parking lots show up as asphalt instead of generic green?
2. Does the park show sports surfaces/court/field features if OSM includes them?
3. Does residential canopy better obscure/soften houses from zoomed-out view?
4. Are roads and buildings still readable?
5. Did FPS stay stable?

## Important Direction
Do not add new gameplay systems yet. Keep improving the replica layer until it looks recognizably closer to Google Earth.

Priority after D54:
1. Improve exact building classification visuals.
2. Add better parking lot orientation/striping from polygon longest axis.
3. Add sidewalks/path/driveway fidelity from OSM.
4. Add field/court-specific materials.
5. Add first destructible state data only after replica fidelity is stronger.
