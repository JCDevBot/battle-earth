const BROAD_BASE_OSM_SELECTORS = [
  'way["building"]',
  'way["highway"]',
  'way["bridge"]',
  'way["tunnel"]',
  'way["railway"]',
  'way["waterway"]',
  'way["water"]',
  'way["natural"]',
  'way["landuse"]',
  'way["leisure"]',
  'way["barrier"]',
  'way["amenity"]',
  'way["man_made"]',
  'way["power"]',
  'way["aeroway"]',
  'way["military"]',
  'way["historic"]',
  'way["tourism"]',
  'way["sport"]',
  'way["shop"]',
  'node["natural"="peak"]',
  'node["amenity"]',
  'node["man_made"]',
  'way["natural"="cliff"]',
  'way["natural"="bare_rock"]',
  'way["natural"="scree"]',
  'way["natural"="wetland"]',
  'way["natural"="ridge"]',
  'way["natural"="valley"]',
  'relation["natural"="water"]',
  'relation["water"]',
  'relation["natural"="wetland"]',
  'relation["landuse"]',
  'relation["leisure"]',
  'relation["amenity"]',
  'relation["boundary"]'
];

const TERRAIN_OSM_SELECTORS = [
  'way["waterway"]',
  'way["water"]',
  'way["natural"]',
  'way["landuse"]',
  'way["leisure"]',
  'node["natural"="peak"]',
  'way["natural"="cliff"]',
  'way["natural"="bare_rock"]',
  'way["natural"="scree"]',
  'way["natural"="wetland"]',
  'way["natural"="ridge"]',
  'way["natural"="valley"]',
  'relation["natural"="water"]',
  'relation["water"]',
  'relation["natural"="wetland"]',
  'relation["landuse"]',
  'relation["leisure"]'
];

export const OSM_FEATURE_PROFILES = {
  // D32: these three names are kept for backwards compatibility with cached
  // settings, but they now all fetch the same broad base set. Layer toggles now
  // control rendering/debug overlays, not whether core OSM infrastructure exists.
  core: BROAD_BASE_OSM_SELECTORS,
  expanded: BROAD_BASE_OSM_SELECTORS,
  tactical: BROAD_BASE_OSM_SELECTORS,
  broadBase: BROAD_BASE_OSM_SELECTORS,

  // Still available as an explicit performance/debug escape hatch.
  terrainOnly: TERRAIN_OSM_SELECTORS
};
