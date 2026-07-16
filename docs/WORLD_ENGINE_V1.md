# World Engine v1

One continuous, scale-aware digital Earth for strategy gameplay from planetary level down to individual streets.

## Core idea

The globe, campaign map, operational map, and tactical battlefield are not separate games. They are levels of detail of one world model.

```text
Earth
  -> Continent / Theater
  -> Country
  -> State / Region
  -> City
  -> Neighborhood
  -> Streets / Buildings
```

## Scale rules

Risk-style gameplay uses the selected entity as the campaign root and then chooses a playable child scale.

- World -> countries
- Continent -> countries
- Country -> states, provinces, or generated strategic regions
- State / Region -> strategic control regions, cities, or counties
- City -> districts and neighborhoods
- Neighborhood -> buildings, roads, and tactical POIs

Continents are navigation and theater roots, not the playable units of a world Risk campaign.

## Region generation

The generator should suggest a natural region count from geography, population, infrastructure, hydrology, elevation, landcover, and strategic POIs. The player can choose sparse, recommended, dense, or custom complexity.

## Renderer rule

The renderer remains the same. Only data density changes.

- Planet: countries, oceans, major rivers, capitals
- Continent: countries, mountain systems, ports, major cities, corridors
- Country: admin regions, highways, rail, cities, forests, rivers
- State: strategic control regions, airports, rail, lakes, cities
- City: districts, arterials, parks, industry, bridges
- Neighborhood: OSM buildings, roads, trees, cover, destructible assets

## Tactical rule

Tactical battle generation is the highest-detail LOD of the same world. A conflict does not switch to a separate map concept. The camera descends and the world streams more detail.
