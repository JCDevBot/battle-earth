# D58.1 Administrative Geography Layer

## Goal
Add the first interactive administrative geography layer to the Earth sandbox so the globe feels less like a coordinate picker and more like a Google Earth style battle selection shell.

## Added
- Zoom-aware admin layer state:
  - Continents
  - Countries
  - States / Regions
  - Cities
- Approximate administrative features for the initial prototype:
  - Continents: North America, South America, Europe, Africa, Asia, Oceania
  - Countries: United States, Canada, Mexico, United Kingdom, France, Japan, India, China
  - Regions: Minnesota, Illinois, New York, California, Texas
  - Cities: Minneapolis, St. Paul, Duluth, Chicago, New York City, London, Paris, Tokyo
- Clickable labels and approximate boundary outlines.
- Selected location hierarchy panel:
  - Earth
  - Continent
  - Country
  - Region
  - City
- BattleRequest now carries `adminContext` and uses the selected admin feature as the selection type when available.
- Known test locations now infer admin context automatically.

## Important Limitations
This is a shell/prototype layer. Boundaries are intentionally approximate bounding outlines, not production-grade GIS polygons. The next step should replace these with real GeoJSON/Natural Earth/OSM admin boundary data.

## Validation
- Build verified with `npm run build`.
- Existing tactical sandbox and known location workflows preserved.

## Design Direction
The user should eventually be able to navigate Earth, click a meaningful place name like United States, Minnesota, or Minneapolis, configure the battle, and generate the appropriate strategic/operational/tactical view from that admin context.
