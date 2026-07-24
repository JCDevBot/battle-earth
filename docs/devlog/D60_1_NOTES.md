# D60.1 — Bundled Real Boundary Validation

Goal: stop relying on remote boundary fetches or bbox fallback for core admin geography.

## What changed
- Added bundled GeoJSON files under `public/data/admin/`:
  - `countries.geojson` from Natural Earth low resolution country polygons
  - `us-states.geojson` dissolved from US county boundaries into state polygons
- Updated `GlobePicker.jsx` to load boundaries from local app assets instead of remote GitHub URLs.
- Added boundary diagnostics to the selected-location panel.
- Selected admin features now show their source, such as `real-geojson-country` or `real-geojson-us-state`.
- BattleRequest continues to carry `boundaryGeometry` and `boundaryBbox` for selected admin entities.

## Why
D59/D60 could fall back to rectangular bbox outlines if remote GeoJSON failed or was unavailable. This build bundles real polygon data so country and US state outlines should render as real geographic shapes instead of rectangles.

## Validation checklist
- At country zoom, United States, Canada, Mexico, France, etc. should render as actual country outlines, not boxes.
- At US state zoom, Texas, Minnesota, California, etc. should render as actual state outlines, not boxes.
- The geography status banner should report bundled boundaries loaded.
- Selected Location panel should show polygon source and boundary counts.

## Known limitations
- Continents are still generalized hand-authored polygons.
- State/province boundaries are only bundled for the United States in this pass.
- City boundaries are still point/label based, not municipal polygons.
