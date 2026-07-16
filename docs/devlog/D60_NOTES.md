# D60 — Real Geographic Boundaries

Goal: replace the D59 approximate/synthetic geographic boxes with actual map-entity boundary geometry where practical.

## Added

- Real country boundary loading from GeoJSON at runtime.
- Real US state boundary loading from GeoJSON at runtime.
- Boundary-aware selection: clicking the globe now resolves the active zoom-level entity using point-in-polygon checks instead of only raw coordinates.
- BattleRequest now includes:
  - `boundaryGeometry`
  - `boundaryBbox`
  - selected admin hierarchy
  - selection type from the selected real map entity
- Google Earth-style label simplification:
  - labels are lighter and less gamey
  - boundaries are subtler
  - active zoom level determines what labels are shown
- Fallback boundaries remain available if remote GeoJSON fails.

## Notes

Continent boundaries are still generalized hand-authored geographic shapes. This is intentional for now because continents are not true administrative entities and do not have one universally accepted polygon dataset. Countries and US states now use real GeoJSON boundaries when the browser can load them.

## Validation

- `npm run build` passes.
- Country and state boundary layer loads asynchronously and rebuilds the visible admin layer after data arrives.
- Known test locations infer admin context from loaded real boundaries when available.

## Next

D61 should either:

1. Bundle boundary datasets locally so the globe does not depend on external GeoJSON URLs, or
2. Add a proper geography data service with caching, simplification, and progressive loading.

A future pass should also add real admin-1 regions globally, not only US states.
