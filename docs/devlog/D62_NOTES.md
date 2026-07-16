# D62 — Global Admin-1 Regions + City Reveal

## Goal
Extend D61's progressive geography system beyond US states so the globe can reveal administrative regions around the world and then reveal major cities at closer zoom.

## Added

- Global admin-1 boundary loading from Natural Earth GeoJSON.
- Bundled US state boundaries remain as the offline/high-confidence fallback for the United States.
- Global major city loading from Natural Earth populated places.
- City filtering by population/importance to avoid overwhelming the globe.
- Region feature creation now infers parent country and continent from real country polygons.
- City feature creation now infers parent country and parent region when possible.
- BattleRequest continues to carry selected geometry/bbox/admin hierarchy.
- Geography diagnostics now report countries, regions, cities, and fallback counts.

## Data Behavior

- Countries are bundled locally from `/data/admin/countries.geojson`.
- US states are bundled locally from `/data/admin/us-states.geojson`.
- Global admin-1 regions load from Natural Earth's public GeoJSON repository when available.
- Global cities load from Natural Earth's public GeoJSON repository when available.
- If remote global layers fail, the globe still works with countries, US states, and known test cities.

## Notes

This is the first global version of state/province/region reveal. The next likely improvement is local caching/bundling of simplified global admin-1 and cities so the entire geography stack works offline and avoids remote dependency.

## Success Criteria

- Zooming into countries other than the United States should reveal provinces/states/regions when the remote global admin-1 data loads.
- Zooming closer should reveal major cities.
- Selecting a country, admin-1 region, or city should populate the sandbox battle panel with a meaningful hierarchy.
