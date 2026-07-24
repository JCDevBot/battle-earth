# D59 Geographic Hierarchy System

Goal: make the globe behave more like a strategic Earth sandbox while going beyond Google Earth by exposing continents as first-class selectable battle regions.

## Built

- Reworked admin display into a zoom-based geographic hierarchy.
- Planet view now shows continent boundaries and continent names.
- Country zoom shows country labels and boundaries while keeping parent continent outlines subdued.
- Region zoom shows state/region labels and boundaries while keeping parent country outlines subdued.
- City zoom shows city labels while keeping parent region outlines subdued.
- Added rough continent boundary outlines instead of only synthetic rectangular boxes.
- Restyled labels to be closer to Google Earth: lighter text, subtler backing, better shadowing.
- Updated globe instruction copy to explain the hierarchy: continents → countries → states/regions → cities.
- Admin labels and outlines still create BattleRequest objects.

## Important direction

This layer is intentionally not just Google Earth. It is a game navigation layer:

Earth
└─ Continent
   └─ Country
      └─ State / Region
         └─ City
            └─ Tactical Battle

## Current limitations

- Boundaries are still approximate and should be replaced with real Natural Earth / GeoJSON data later.
- Continents use rough polygons, not authoritative geodata.
- Only a starter set of countries, states, and cities is included.
- City-level neighborhood/district data is not implemented yet.

## Success check

At a high zoom, user should understand continents.
At a medium zoom, user should understand countries.
At a closer zoom, user should understand states/regions.
At city zoom, user should select cities or custom points for tactical battle generation.
