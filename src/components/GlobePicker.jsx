import { useEffect, useRef, useState } from "react";
import { buildWorldEnginePlan, REGION_DENSITY_MODES, WORLD_ENGINE_TAGLINE } from "../world/WorldEngine";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const EARTH_RADIUS = 5;
const TEXTURE_URL = "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg";
const NIGHT_TEXTURE_URL = "https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg";
const CLOUD_TEXTURE_URL = "https://unpkg.com/three-globe@2.31.1/example/img/fair_clouds_4k.png";
const DEFAULT_USER_LOCATION = { lat: 44.9778, lon: -93.265, label: "Minnesota" };

const COUNTRY_GEOJSON_URL = "/data/admin/countries.geojson";
const US_STATES_GEOJSON_URL = "/data/admin/us-states.geojson";
const GLOBAL_ADMIN1_GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const GLOBAL_CITIES_GEOJSON_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson";

const KNOWN_LOCATIONS = [
  { id: "small-slice-test-map", name: "Small Slice Test Map", region: "Minnesota, USA", lat: 44.849758, lon: -93.289793, sizeMeters: 350, note: "350m pond/neighborhood visual polish test slice" },
  { id: "default-test-site", name: "Default Test Site", region: "Minnesota, USA", lat: 44.8500907, lon: -93.2885465, sizeMeters: 1000, note: "Original repeatable map generation test site" },
  { id: "minneapolis-river", name: "Minneapolis Riverfront", region: "Minnesota, USA", lat: 44.9819, lon: -93.2618, note: "Urban river, bridges, dense streets" },
  { id: "st-paul-harriet", name: "St. Paul / Harriet Island", region: "Minnesota, USA", lat: 44.9362, lon: -93.0977, note: "River edge, roads, parks, buildings" },
  { id: "duluth-harbor", name: "Duluth Harbor", region: "Minnesota, USA", lat: 46.7797, lon: -92.1005, note: "Water, industrial, shoreline" },
  { id: "chicago-loop", name: "Chicago Loop", region: "Illinois, USA", lat: 41.8789, lon: -87.6359, note: "Dense urban high-rise test" },
  { id: "nyc-manhattan", name: "Lower Manhattan", region: "New York, USA", lat: 40.7075, lon: -74.0113, note: "Dense buildings and water edges" },
  { id: "london-thames", name: "London / Thames", region: "United Kingdom", lat: 51.5074, lon: -0.1278, note: "Historic city, river, bridges" },
  { id: "paris-seine", name: "Paris / Seine", region: "France", lat: 48.8566, lon: 2.3522, note: "Dense blocks, river, landmark roads" },
  { id: "tokyo-station", name: "Tokyo Station", region: "Japan", lat: 35.6812, lon: 139.7671, note: "Very dense urban grid" },
  { id: "rural-test", name: "Rural Farmland Test", region: "Minnesota, USA", lat: 44.5659, lon: -92.5367, note: "Roads, fields, sparse buildings" }
];

const SANDBOX_MODES = [
  { id: "sandbox", label: "Sandbox", description: "Play both sides and test battle feel." },
  { id: "pvai", label: "PvAI", description: "Stub only. AI opponent will come later." },
  { id: "pvp", label: "PvP", description: "Stub only. Multiplayer rules will come later." }
];

const BATTLE_SCALES = [
  { id: "neighborhood", label: "Neighborhood", ew: 800, ns: 1200, sizeMeters: 1200, aspect: "operational" },
  { id: "district", label: "District", ew: 900, ns: 1400, sizeMeters: 1400, aspect: "deep" },
  { id: "testSlice", label: "Small test slice", ew: 350, ns: 350, sizeMeters: 350, aspect: "square" }
];

const GAME_MODES = [
  { id: "freeplay", label: "Freeplay" },
  { id: "control", label: "Control" },
  { id: "rush", label: "Rush" },
  { id: "risk", label: "Risk-style" }
];

const ADMIN_LEVELS = {
  continent: { label: "Continents", minDistance: 19.5 },
  country: { label: "Countries", minDistance: 11.75 },
  region: { label: "States / Regions", minDistance: 8.65 },
  city: { label: "Cities", minDistance: 0 }
};

const ADMIN_LEVEL_ORDER = ["continent", "country", "region", "city"];

// D60: continent outlines remain hand-authored generalized geography because there is no universal
// administrative continent boundary dataset. Countries and US states are loaded from real GeoJSON.
const CONTINENT_FEATURES = [
  { id: "continent-north-america", level: "continent", name: "North America", lat: 48, lon: -102, hierarchy: ["Earth", "North America"], bbox: { s: 6, n: 84, w: -170, e: -50 }, geometry: polygon([[-168,72],[-150,60],[-128,52],[-118,34],[-100,16],[-84,9],[-75,19],[-82,30],[-66,49],[-60,70],[-88,83],[-132,76],[-168,72]]) },
  { id: "continent-south-america", level: "continent", name: "South America", lat: -18, lon: -60, hierarchy: ["Earth", "South America"], bbox: { s: -58, n: 13, w: -90, e: -30 }, geometry: polygon([[-81,12],[-76,5],[-80,-8],[-70,-20],[-65,-38],[-70,-55],[-56,-52],[-48,-36],[-40,-20],[-35,-5],[-50,8],[-81,12]]) },
  { id: "continent-europe", level: "continent", name: "Europe", lat: 52, lon: 15, hierarchy: ["Earth", "Europe"], bbox: { s: 34, n: 72, w: -25, e: 45 }, geometry: polygon([[-24,71],[-10,60],[0,54],[-9,43],[0,36],[20,35],[32,42],[45,50],[38,61],[30,70],[-24,71]]) },
  { id: "continent-africa", level: "continent", name: "Africa", lat: 2, lon: 20, hierarchy: ["Earth", "Africa"], bbox: { s: -35, n: 37, w: -20, e: 52 }, geometry: polygon([[-17,35],[10,31],[32,37],[52,15],[43,-10],[25,-34],[18,-35],[10,-25],[-5,-10],[-15,5],[-17,20],[-17,35]]) },
  { id: "continent-asia", level: "continent", name: "Asia", lat: 42, lon: 88, hierarchy: ["Earth", "Asia"], bbox: { s: -10, n: 82, w: 26, e: 180 }, geometry: polygon([[30,78],[60,70],[100,60],[150,65],[178,52],[140,30],[110,8],[95,-7],[70,5],[45,25],[30,40],[26,58],[30,78]]) },
  { id: "continent-oceania", level: "continent", name: "Oceania", lat: -25, lon: 134, hierarchy: ["Earth", "Oceania"], bbox: { s: -48, n: 2, w: 110, e: 180 }, geometry: polygon([[112,-8],[150,-10],[174,-25],[168,-47],[112,-45],[112,-28],[112,-8]]) }
];

const CITY_FEATURES = [
  { id: "city-minneapolis", level: "city", name: "Minneapolis", lat: 44.9778, lon: -93.2650, hierarchy: ["Earth", "North America", "United States", "Minnesota", "Minneapolis"], bbox: { s: 44.85, n: 45.08, w: -93.35, e: -93.19 } },
  { id: "city-st-paul", level: "city", name: "St. Paul", lat: 44.9537, lon: -93.09, hierarchy: ["Earth", "North America", "United States", "Minnesota", "St. Paul"], bbox: { s: 44.84, n: 45.05, w: -93.23, e: -92.96 } },
  { id: "city-duluth", level: "city", name: "Duluth", lat: 46.7867, lon: -92.1005, hierarchy: ["Earth", "North America", "United States", "Minnesota", "Duluth"], bbox: { s: 46.65, n: 46.9, w: -92.25, e: -91.9 } },
  { id: "city-chicago", level: "city", name: "Chicago", lat: 41.8781, lon: -87.6298, hierarchy: ["Earth", "North America", "United States", "Illinois", "Chicago"], bbox: { s: 41.64, n: 42.03, w: -87.94, e: -87.52 } },
  { id: "city-new-york", level: "city", name: "New York City", lat: 40.7128, lon: -74.006, hierarchy: ["Earth", "North America", "United States", "New York", "New York City"], bbox: { s: 40.49, n: 40.92, w: -74.27, e: -73.68 } },
  { id: "city-london", level: "city", name: "London", lat: 51.5074, lon: -0.1278, hierarchy: ["Earth", "Europe", "United Kingdom", "London"], bbox: { s: 51.28, n: 51.70, w: -0.52, e: 0.25 } },
  { id: "city-paris", level: "city", name: "Paris", lat: 48.8566, lon: 2.3522, hierarchy: ["Earth", "Europe", "France", "Paris"], bbox: { s: 48.80, n: 48.91, w: 2.22, e: 2.47 } },
  { id: "city-tokyo", level: "city", name: "Tokyo", lat: 35.6762, lon: 139.6503, hierarchy: ["Earth", "Asia", "Japan", "Tokyo"], bbox: { s: 35.50, n: 35.82, w: 139.45, e: 139.92 } }
];

function polygon(lonLatRing) {
  return { type: "Polygon", coordinates: [lonLatRing] };
}

function normalizeLon(lon) {
  return ((lon + 540) % 360) - 180;
}

function levelRank(level) {
  return { continent: 1, country: 2, region: 3, city: 4 }[level] ?? 0;
}

function zoomLevelFromDistance(distance) {
  if (distance > ADMIN_LEVELS.continent.minDistance) return "continent";
  if (distance > ADMIN_LEVELS.country.minDistance) return "country";
  if (distance > ADMIN_LEVELS.region.minDistance) return "region";
  return "city";
}

function parentAdminLevel(level) {
  if (level === "country") return "continent";
  if (level === "region") return "country";
  if (level === "city") return "region";
  return null;
}

function levelIndex(level) {
  return ADMIN_LEVEL_ORDER.indexOf(level);
}

function isFeatureVisibleAtZoom(feature, activeLevel) {
  const activeIndex = levelIndex(activeLevel);
  const featureIndex = levelIndex(feature.level);
  if (featureIndex < 0 || activeIndex < 0) return false;

  // Keep the current geography level visible, plus one parent context level.
  // This produces Google Earth style progressive disclosure without drowning the globe.
  return featureIndex === activeIndex || featureIndex === activeIndex - 1;
}

function featuresForZoom(level, features) {
  return features.filter((feature) => isFeatureVisibleAtZoom(feature, level));
}

function shouldRenderFeatureLabel(feature, activeLevel) {
  if (feature.level === activeLevel) return true;
  // At state zoom, keep country labels out of the way; at city zoom, show state labels as faint context only through boundaries.
  return false;
}

function visibleCountsForZoom(level, features, context = null) {
  const visible = context ? featuresForZoomContext(level, features, context) : featuresForZoom(level, features);
  return {
    continents: visible.filter((f) => f.level === "continent").length,
    countries: visible.filter((f) => f.level === "country").length,
    regions: visible.filter((f) => f.level === "region").length,
    cities: visible.filter((f) => f.level === "city").length
  };
}

function findContainingFeatureAtLevel(loc, features, level) {
  return features.find((feature) => feature.level === level && (feature.geometry ? pointInGeometry(loc, feature.geometry) : pointInBbox(loc, feature.bbox))) ?? null;
}

function centeredFeatureForLevel(loc, features, level) {
  const exact = findContainingFeatureAtLevel(loc, features, level);
  if (exact) return exact;

  // At closer zoom tiers, a user may be centered between city/admin polygons. Fall back
  // to the most specific parent so the view still gets a meaningful name.
  if (level === "city") return findContainingFeatureAtLevel(loc, features, "region") ?? findContainingFeatureAtLevel(loc, features, "country") ?? findContainingFeatureAtLevel(loc, features, "continent");
  if (level === "region") return findContainingFeatureAtLevel(loc, features, "country") ?? findContainingFeatureAtLevel(loc, features, "continent");
  if (level === "country") return findContainingFeatureAtLevel(loc, features, "continent");
  return null;
}

function viewLabelForLevel(level) {
  return { continent: "Continent View", country: "Country View", region: "Region View", city: "City View" }[level] ?? "Earth View";
}

function cityImportance(feature) {
  const pop = feature.population ?? 0;
  if (pop >= 10000000) return 5;
  if (pop >= 5000000) return 4;
  if (pop >= 2000000) return 3;
  if (pop >= 750000) return 2;
  return 1;
}

function cityVisibilityRules(cameraDistance) {
  // D62.1: progressive city reveal. At wider country/region views, only show
  // the highest-importance cities for the country under the camera. Local and
  // regional cities appear only as the user zooms closer to that country/region.
  if (cameraDistance > 7.4) return { minPopulation: 5000000, maxCities: 8, scope: "country" };
  if (cameraDistance > 6.3) return { minPopulation: 2000000, maxCities: 14, scope: "country" };
  if (cameraDistance > 5.2) return { minPopulation: 750000, maxCities: 24, scope: "country" };
  return { minPopulation: 250000, maxCities: 36, scope: "region" };
}

function featuresForZoomContext(level, features, context = {}) {
  const base = features.filter((feature) => isFeatureVisibleAtZoom(feature, level));
  const { focusCountry, focusRegion, cameraDistance = 12 } = context;

  if (level === "region") {
    // When zooming into a country, reveal only that country's admin-1 layer.
    // Otherwise global admin-1 labels would overwhelm the globe.
    return base.filter((feature) => {
      if (feature.level !== "region") return true;
      return focusCountry ? feature.parentCountry === focusCountry.name : false;
    });
  }

  if (level !== "city") return base;

  const rules = cityVisibilityRules(cameraDistance);
  const regions = base.filter((feature) => {
    if (feature.level !== "region") return false;
    return focusCountry ? feature.parentCountry === focusCountry.name : false;
  });
  const nonCities = base.filter((feature) => feature.level !== "city" && feature.level !== "region");

  let cities = base.filter((feature) => feature.level === "city");
  if (rules.scope === "region" && focusRegion) {
    cities = cities.filter((city) => city.parentCountry === focusRegion.parentCountry && city.parentRegion === focusRegion.name);
  } else if (focusCountry) {
    cities = cities.filter((city) => city.parentCountry === focusCountry.name);
  } else {
    cities = cities.filter((city) => (city.population ?? 0) >= 10000000);
  }

  cities = cities
    .filter((city) => (city.population ?? 0) >= rules.minPopulation || cityImportance(city) >= 4)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, rules.maxCities);

  return [...nonCities, ...regions, ...cities];
}

function featureNameFromProperties(properties = {}) {
  return properties.name || properties.NAME || properties.name_en || properties.NAME_1 || properties.admin || properties.NAME_EN || properties.name_local || "Unnamed";
}

function propertyValue(properties = {}, keys = []) {
  for (const key of keys) {
    const value = properties[key];
    if (value !== undefined && value !== null && `${value}`.trim() !== "") return value;
  }
  return null;
}

function safeIdPart(value = "item") {
  return `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function isUsefulAdmin1Feature(properties = {}) {
  const type = `${propertyValue(properties, ["type", "TYPE", "featurecla", "FEATURECLA"]) ?? ""}`.toLowerCase();
  const name = featureNameFromProperties(properties);
  if (!name || name === "Unnamed") return false;
  if (type.includes("disputed") || type.includes("breakaway") || type.includes("overlay")) return false;
  return true;
}

function cityPopulation(properties = {}) {
  return Number(propertyValue(properties, ["POP_MAX", "pop_max", "POP_MIN", "POP_OTHER", "population"]) ?? 0) || 0;
}

function isUsefulCityFeature(properties = {}) {
  const pop = cityPopulation(properties);
  const featureClass = `${propertyValue(properties, ["FEATURECLA", "featurecla"]) ?? ""}`.toLowerCase();
  return pop >= 500000 || featureClass.includes("admin-0") || featureClass.includes("admin-1") || featureClass.includes("capital");
}

function bboxFromGeometry(geometry) {
  const coords = flattenLonLat(geometry);
  if (!coords.length) return null;
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [lonRaw, lat] of coords) {
    const lon = normalizeLon(lonRaw);
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return { s, n, w, e };
}

function centroidFromGeometry(geometry, fallback = { lat: 0, lon: 0 }) {
  const coords = flattenLonLat(geometry);
  if (!coords.length) return fallback;
  let latSum = 0;
  let lonSum = 0;
  for (const [lonRaw, lat] of coords) {
    latSum += lat;
    lonSum += normalizeLon(lonRaw);
  }
  return { lat: latSum / coords.length, lon: lonSum / coords.length };
}

function flattenLonLat(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function pointInBbox(loc, bbox) {
  if (!loc || !bbox) return false;
  return loc.lat >= bbox.s && loc.lat <= bbox.n && loc.lon >= bbox.w && loc.lon <= bbox.e;
}

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = normalizeLon(ring[i][0]);
    const yi = ring[i][1];
    const xj = normalizeLon(ring[j][0]);
    const yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(loc, geometry) {
  if (!loc || !geometry) return false;
  const lon = normalizeLon(loc.lon);
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    if (!pointInRing(loc.lat, lon, outer)) return false;
    return !holes.some((hole) => pointInRing(loc.lat, lon, hole));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) => pointInGeometry(loc, { type: "Polygon", coordinates: poly }));
  }
  return false;
}

function findContainingFeature(loc, features, level) {
  const rank = levelRank(level);
  const candidates = features
    .filter((feature) => levelRank(feature.level) <= rank && (feature.geometry ? pointInGeometry(loc, feature.geometry) : pointInBbox(loc, feature.bbox)))
    .sort((a, b) => levelRank(b.level) - levelRank(a.level));
  return candidates[0] ?? null;
}

function inferAdminContext(loc, activeLevel = "city", features = [...CONTINENT_FEATURES, ...CITY_FEATURES]) {
  const rank = levelRank(activeLevel);
  const matches = features
    .filter((feature) => levelRank(feature.level) <= rank && (feature.geometry ? pointInGeometry(loc, feature.geometry) : pointInBbox(loc, feature.bbox)))
    .sort((a, b) => levelRank(b.level) - levelRank(a.level));
  const selected = matches[0] ?? null;
  const hierarchy = selected?.hierarchy ?? ["Earth", "Custom Location"];
  return { selected, matches, hierarchy };
}

function continentForLoc(loc) {
  return CONTINENT_FEATURES.find((feature) => pointInGeometry(loc, feature.geometry))?.name ?? "Earth";
}

function createCountryFeature(geoFeature) {
  const name = featureNameFromProperties(geoFeature.properties);
  const geometry = geoFeature.geometry;
  const bbox = bboxFromGeometry(geometry);
  const center = centroidFromGeometry(geometry);
  const continent = continentForLoc(center);
  return {
    id: `country-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    level: "country",
    name,
    lat: center.lat,
    lon: center.lon,
    hierarchy: ["Earth", continent, name],
    bbox,
    geometry,
    source: "real-geojson-country"
  };
}

function createRegionFeature(geoFeature, countries = []) {
  const properties = geoFeature.properties ?? {};
  const name = featureNameFromProperties(properties);
  const geometry = geoFeature.geometry;
  const bbox = bboxFromGeometry(geometry);
  const center = centroidFromGeometry(geometry);
  const adminName = propertyValue(properties, ["admin", "ADMIN", "adm0_name", "ADM0_NAME", "geonunit", "GEOUNIT", "sovereignt", "SOVEREIGNT"]) ?? "Unknown Country";
  const country = countries.find((feature) => feature.name === adminName || feature.name === properties.admin || feature.name === properties.geonunit)
    ?? countries.find((feature) => feature.geometry ? pointInGeometry(center, feature.geometry) : pointInBbox(center, feature.bbox));
  const continent = country?.hierarchy?.[1] ?? continentForLoc(center);
  const countryName = country?.name ?? adminName;
  const iso = propertyValue(properties, ["iso_3166_2", "ISO_3166_2", "gn_id", "GN_ID"]) ?? name;
  return {
    id: `region-${safeIdPart(countryName)}-${safeIdPart(iso)}-${safeIdPart(name)}`,
    level: "region",
    name,
    lat: center.lat,
    lon: center.lon,
    hierarchy: ["Earth", continent, countryName, name],
    bbox,
    geometry,
    parentCountry: countryName,
    source: countryName === "United States" ? "real-geojson-us-state" : "real-geojson-global-admin1"
  };
}

function createCityFeature(geoFeature, countries = [], regions = []) {
  const properties = geoFeature.properties ?? {};
  const name = featureNameFromProperties(properties);
  const coords = geoFeature.geometry?.coordinates ?? [];
  const lon = normalizeLon(Number(coords[0] ?? propertyValue(properties, ["LONGITUDE", "longitude"]) ?? 0));
  const lat = Number(coords[1] ?? propertyValue(properties, ["LATITUDE", "latitude"]) ?? 0);
  const loc = { lat, lon };
  const countryName = propertyValue(properties, ["ADM0NAME", "adm0name", "admin", "ADMIN"]) ?? null;
  const regionName = propertyValue(properties, ["ADM1NAME", "adm1name", "region", "REGION"]) ?? null;
  const country = countries.find((feature) => feature.name === countryName)
    ?? countries.find((feature) => feature.geometry ? pointInGeometry(loc, feature.geometry) : pointInBbox(loc, feature.bbox));
  const region = regions.find((feature) => feature.parentCountry === (country?.name ?? countryName) && (feature.name === regionName || (feature.geometry ? pointInGeometry(loc, feature.geometry) : pointInBbox(loc, feature.bbox))));
  const continent = country?.hierarchy?.[1] ?? continentForLoc(loc);
  const resolvedCountry = country?.name ?? countryName ?? "Unknown Country";
  const resolvedRegion = region?.name ?? regionName;
  const hierarchy = ["Earth", continent, resolvedCountry, ...(resolvedRegion ? [resolvedRegion] : []), name];
  const spread = 0.12;
  return {
    id: `city-${safeIdPart(resolvedCountry)}-${safeIdPart(name)}`,
    level: "city",
    name,
    lat,
    lon,
    hierarchy,
    bbox: { s: lat - spread, n: lat + spread, w: lon - spread, e: lon + spread },
    population: cityPopulation(properties),
    parentCountry: resolvedCountry,
    parentRegion: resolvedRegion,
    source: "real-geojson-populated-place"
  };
}

async function loadRealAdminFeatures() {
  const loaded = [...CONTINENT_FEATURES];
  const errors = [];
  const diagnostics = {
    countries: 0, realCountries: 0,
    regions: 0, realRegions: 0, globalRegions: 0, usRegions: 0,
    cities: 0, realCities: 0, staticCities: CITY_FEATURES.length,
    fallbackCountries: 0, fallbackRegions: 0,
    countrySource: COUNTRY_GEOJSON_URL,
    regionSource: GLOBAL_ADMIN1_GEOJSON_URL,
    citySource: GLOBAL_CITIES_GEOJSON_URL
  };
  let countries = [];
  let regions = [];

  try {
    const countryRes = await fetch(COUNTRY_GEOJSON_URL);
    if (!countryRes.ok) throw new Error(`countries ${countryRes.status}`);
    const countryJson = await countryRes.json();
    countries = (countryJson.features ?? []).map(createCountryFeature);
    diagnostics.countries = countries.length;
    diagnostics.realCountries = countries.filter((f) => f.source?.startsWith("real")).length;
    loaded.push(...countries);
  } catch (error) {
    errors.push(`Country boundaries unavailable: ${error.message}`);
    countries = fallbackCountryFeatures();
    diagnostics.fallbackCountries = countries.length;
    loaded.push(...countries);
  }

  try {
    const adminRes = await fetch(GLOBAL_ADMIN1_GEOJSON_URL);
    if (!adminRes.ok) throw new Error(`global admin-1 ${adminRes.status}`);
    const adminJson = await adminRes.json();
    regions = (adminJson.features ?? [])
      .filter((feature) => isUsefulAdmin1Feature(feature.properties))
      .map((feature) => createRegionFeature(feature, countries));
    diagnostics.globalRegions = regions.length;
  } catch (error) {
    errors.push(`Global admin-1 boundaries unavailable: ${error.message}`);
  }

  // Always merge bundled US states so the US remains available offline and at high quality.
  try {
    const stateRes = await fetch(US_STATES_GEOJSON_URL);
    if (!stateRes.ok) throw new Error(`states ${stateRes.status}`);
    const stateJson = await stateRes.json();
    const usRegions = (stateJson.features ?? []).map((feature) => createRegionFeature({ ...feature, properties: { ...(feature.properties ?? {}), admin: "United States" } }, countries));
    const existingUs = new Set(usRegions.map((feature) => feature.name));
    regions = [...regions.filter((feature) => !(feature.parentCountry === "United States" && existingUs.has(feature.name))), ...usRegions];
    diagnostics.usRegions = usRegions.length;
  } catch (error) {
    errors.push(`US state boundaries unavailable: ${error.message}`);
    const fallbackRegions = fallbackRegionFeatures();
    diagnostics.fallbackRegions = fallbackRegions.length;
    regions.push(...fallbackRegions);
  }

  diagnostics.regions = regions.length;
  diagnostics.realRegions = regions.filter((f) => f.source?.startsWith("real")).length;
  loaded.push(...regions);

  let cities = [...CITY_FEATURES];
  try {
    const cityRes = await fetch(GLOBAL_CITIES_GEOJSON_URL);
    if (!cityRes.ok) throw new Error(`cities ${cityRes.status}`);
    const cityJson = await cityRes.json();
    const globalCities = (cityJson.features ?? [])
      .filter((feature) => feature.geometry?.type === "Point" && isUsefulCityFeature(feature.properties))
      .map((feature) => createCityFeature(feature, countries, regions))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 1400);
    const knownCityIds = new Set(cities.map((city) => `${safeIdPart(city.name)}-${Math.round(city.lat * 10)}-${Math.round(city.lon * 10)}`));
    cities = [
      ...cities,
      ...globalCities.filter((city) => !knownCityIds.has(`${safeIdPart(city.name)}-${Math.round(city.lat * 10)}-${Math.round(city.lon * 10)}`))
    ];
    diagnostics.realCities = globalCities.length;
  } catch (error) {
    errors.push(`Global city layer unavailable: ${error.message}`);
  }
  diagnostics.cities = cities.length;
  loaded.push(...cities);

  return { features: loaded, errors, diagnostics };
}

function fallbackCountryFeatures() {
  return [
    { id: "country-united-states", level: "country", name: "United States", lat: 39.5, lon: -98.35, hierarchy: ["Earth", "North America", "United States"], bbox: { s: 24.4, n: 49.4, w: -124.8, e: -66.9 }, geometry: polygon([[-124.8,24.4],[-124.8,49.4],[-66.9,49.4],[-66.9,24.4],[-124.8,24.4]]), source: "fallback" },
    { id: "country-canada", level: "country", name: "Canada", lat: 57, lon: -106, hierarchy: ["Earth", "North America", "Canada"], bbox: { s: 42, n: 70, w: -141, e: -52 }, geometry: polygon([[-141,42],[-141,70],[-52,70],[-52,42],[-141,42]]), source: "fallback" },
    { id: "country-mexico", level: "country", name: "Mexico", lat: 23, lon: -102, hierarchy: ["Earth", "North America", "Mexico"], bbox: { s: 14.5, n: 32.7, w: -118.5, e: -86.5 }, geometry: polygon([[-118.5,14.5],[-118.5,32.7],[-86.5,32.7],[-86.5,14.5],[-118.5,14.5]]), source: "fallback" }
  ];
}

function fallbackRegionFeatures() {
  return [
    { id: "region-minnesota", level: "region", name: "Minnesota", lat: 46.3, lon: -94.2, hierarchy: ["Earth", "North America", "United States", "Minnesota"], bbox: { s: 43.5, n: 49.4, w: -97.2, e: -89.5 }, geometry: polygon([[-97.2,43.5],[-97.2,49.4],[-89.5,49.4],[-89.5,43.5],[-97.2,43.5]]), source: "fallback" }
  ];
}

function createLabelSprite(text, color = "#dbeafe", level = "country") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const fontSize = level === "continent" ? 30 : level === "country" ? 18 : level === "region" ? 16 : 15;
  const paddingX = 12;
  context.font = `800 ${fontSize}px system-ui, sans-serif`;
  const width = Math.ceil(context.measureText(text).width + paddingX * 2);
  canvas.width = Math.min(512, Math.max(96, width));
  canvas.height = 52;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = "rgba(0,0,0,0.95)";
  context.shadowBlur = 6;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 2;
  context.fillStyle = color;
  context.font = `800 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "middle";
  context.fillText(text, paddingX, 26);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const base = level === "continent" ? 1.2 : level === "country" ? 0.65 : level === "region" ? 0.52 : 0.42;
  sprite.scale.set((canvas.width / 128) * base, base * 0.42, 1);
  return sprite;
}

function latLonToVec3(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function vec3ToLatLon(point) {
  const normalized = point.clone().normalize();
  const lat = 90 - Math.acos(normalized.y) * (180 / Math.PI);
  const lon = Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI) - 180;
  return { lat, lon: normalizeLon(lon) };
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000);
}

function sunSubsolarPoint(date = new Date()) {
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const doy = dayOfYear(date);
  const declination = 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365.2422);
  const lon = normalizeLon(180 - hours * 15);
  return { lat: declination, lon };
}

function sunDirectionFromDate(date = new Date()) {
  const subsolar = sunSubsolarPoint(date);
  return latLonToVec3(subsolar.lat, subsolar.lon, 1).normalize();
}

function createEarthMaterial(dayTexture, nightTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      nightStrength: { value: 1.55 },
      twilightWidth: { value: 0.25 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      uniform float nightStrength;
      uniform float twilightWidth;
      varying vec2 vUv;
      varying vec3 vNormalW;
      void main() {
        vec3 n = normalize(vNormalW);
        float sunDot = dot(n, normalize(sunDirection));
        float dayMix = smoothstep(-twilightWidth, 0.16, sunDot);
        float duskGlow = 1.0 - smoothstep(0.0, 0.34, abs(sunDot));
        vec3 dayColor = texture2D(dayTexture, vUv).rgb;
        vec3 nightColor = texture2D(nightTexture, vUv).rgb * nightStrength;
        vec3 twilightTint = vec3(1.0, 0.48, 0.18) * duskGlow * 0.18;
        vec3 color = mix(nightColor, dayColor, dayMix) + twilightTint;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      glowColor: { value: new THREE.Color(0x7dd3fc) }
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 glowColor;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        float rim = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewW)), 0.0), 2.1);
        float sunSide = smoothstep(-0.35, 0.65, dot(normalize(vNormalW), normalize(sunDirection)));
        float alpha = rim * mix(0.18, 0.58, sunSide);
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide
  });
}

function cityTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function createBoundaryLines(feature, color = 0x7dd3fc, radius = EARTH_RADIUS + 0.045, options = {}) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: options.opacity ?? 0.7,
    depthTest: true,
    depthWrite: false
  });
  const addRing = (ring) => {
    const points = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      const distance = Math.max(Math.abs(lon2 - lon1), Math.abs(lat2 - lat1));
      const steps = Math.max(1, Math.min(16, Math.ceil(distance / 1.5)));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const lon = lon1 + (lon2 - lon1) * t;
        const lat = lat1 + (lat2 - lat1) * t;
        points.push(latLonToVec3(lat, lon, radius));
      }
    }
    if (points.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material.clone());
      line.userData = { adminFeature: feature };
      group.add(line);
    }
  };

  if (feature.geometry?.type === "Polygon") {
    feature.geometry.coordinates.forEach(addRing);
  } else if (feature.geometry?.type === "MultiPolygon") {
    feature.geometry.coordinates.forEach((poly) => poly.forEach(addRing));
  }
  group.userData = { adminFeature: feature };
  return group;
}

function createBattleRequest(location, options) {
  const scale = BATTLE_SCALES.find((item) => item.id === options.scale) ?? BATTLE_SCALES[0];
  return {
    version: 2,
    playerMode: options.playerMode,
    gameMode: options.gameMode,
    scale: options.scale,
    selectionType: location?.adminFeature ? location.adminFeature.level : (location?.id ? "known-location" : "point"),
    selectedName: location?.adminFeature?.name ?? location?.name ?? "Custom Location",
    region: location?.region ?? location?.adminContext?.hierarchy?.join(" / ") ?? "Custom globe point",
    adminContext: location?.adminContext ?? null,
    boundaryGeometry: location?.adminFeature?.geometry ?? null,
    boundaryBbox: location?.adminFeature?.bbox ?? null,
    lat: location.lat,
    lon: location.lon,
    sizeMeters: scale.sizeMeters,
    mapAspect: scale.aspect,
    mapWidthMeters: scale.ew,
    mapDepthMeters: scale.ns,
    initialView: "tactical-replica",
    sandbox: {
      enabled: options.playerMode === "sandbox",
      allowBothSides: true,
      allowManualDeployment: true,
      destructionEnabledByDefault: false,
      overlaysEnabledByDefault: false
    }
  };
}

function formatLocationLabel(location) {
  return location?.name ? `${location.name} · ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
}



const WORLD_ENTITY = {
  id: "world",
  level: "world",
  name: "World",
  lat: 20,
  lon: 0,
  hierarchy: ["Earth"],
  source: "strategic-root"
};

function battleLevelLabel(level = "world") {
  return {
    world: "World",
    continent: "Continent",
    country: "Country",
    region: "State / Region",
    city: "City"
  }[level] ?? "Location";
}

function primaryActionLabel(level = "world") {
  if (level === "world") return "Generate World Campaign →";
  if (level === "continent") return "Generate Continental Campaign →";
  if (level === "country") return "Generate Country Campaign →";
  if (level === "region") return "Generate Regional Operation →";
  if (level === "city") return "Generate City Battle →";
  return "Generate Sandbox Battle →";
}

function availableGameModesForLevel(level = "world") {
  if (level === "world") return ["risk", "control", "sandbox"];
  if (level === "continent") return ["risk", "control", "rush", "sandbox"];
  if (level === "country") return ["control", "rush", "risk", "sandbox"];
  if (level === "region") return ["control", "rush", "sandbox"];
  return ["freeplay", "control", "rush", "sandbox"];
}

function gameModeDisplay(modeId) {
  return {
    sandbox: "Sandbox",
    freeplay: "Freeplay",
    control: "Control",
    rush: "Rush",
    risk: "Risk-style"
  }[modeId] ?? modeId;
}

function entityStats(entity, features = [], diagnostics = null) {
  const level = entity?.level ?? "world";
  if (level === "world") {
    return [
      { label: "Continents", value: CONTINENT_FEATURES.length },
      { label: "Countries", value: diagnostics?.realCountries ?? diagnostics?.countries ?? features.filter((f) => f.level === "country").length },
      { label: "Regions", value: diagnostics?.realRegions ?? diagnostics?.regions ?? features.filter((f) => f.level === "region").length },
      { label: "Cities", value: diagnostics?.cities ?? features.filter((f) => f.level === "city").length }
    ];
  }
  if (level === "continent") {
    const countries = features.filter((f) => f.level === "country" && f.hierarchy?.[1] === entity.name).length;
    return [
      { label: "Battle Level", value: "Continent" },
      { label: "Countries", value: countries || "—" },
      { label: "Strategic Role", value: "Theater" }
    ];
  }
  if (level === "country") {
    const regions = features.filter((f) => f.level === "region" && f.parentCountry === entity.name).length;
    const cities = features.filter((f) => f.level === "city" && f.parentCountry === entity.name).length;
    return [
      { label: "Battle Level", value: "Country" },
      { label: "Regions", value: regions || "—" },
      { label: "Major Cities", value: cities || "—" }
    ];
  }
  if (level === "region") {
    const cities = features.filter((f) => f.level === "city" && f.parentCountry === entity.parentCountry && f.parentRegion === entity.name).length;
    return [
      { label: "Battle Level", value: "Region" },
      { label: "Country", value: entity.parentCountry ?? "—" },
      { label: "Major Cities", value: cities || "—" }
    ];
  }
  if (level === "city") {
    return [
      { label: "Battle Level", value: "City" },
      { label: "Country", value: entity.parentCountry ?? "—" },
      { label: "Population", value: entity.population ? entity.population.toLocaleString() : "—" }
    ];
  }
  return [{ label: "Battle Level", value: battleLevelLabel(level) }];
}

function tacticalLaunchPointForEntity(entity) {
  const loc = entity ?? WORLD_ENTITY;
  return {
    lat: loc.lat ?? 20,
    lon: loc.lon ?? 0,
    name: loc.name ?? "World",
    region: loc.hierarchy?.join(" / ") ?? loc.name ?? "World",
    adminFeature: loc.level === "world" ? null : loc,
    adminContext: { selected: loc.level === "world" ? null : loc, hierarchy: loc.hierarchy ?? [loc.name ?? "World"] }
  };
}


function childLevelForEntity(level = "world") {
  if (level === "world") return "continent";
  if (level === "continent") return "country";
  if (level === "country") return "region";
  if (level === "region") return "city";
  return null;
}

function playableChildLevelForEntity(level = "world", gameMode = "risk") {
  // Navigation layers and playable layers are intentionally separate.
  // Example: World is navigated by continents, but Risk-style World campaigns
  // are played country-vs-country rather than continent-vs-continent.
  if (gameMode === "risk") {
    if (level === "world") return "country";
    if (level === "continent") return "country";
    if (level === "country") return "region";
    if (level === "region") return "city";
    if (level === "city") return "district";
  }
  if (level === "world") return "country";
  return childLevelForEntity(level);
}

function parentEntityFor(entity, features = []) {
  const level = entity?.level ?? "world";
  const hierarchy = entity?.hierarchy ?? ["Earth"];
  if (level === "world") return null;
  if (level === "continent") return WORLD_ENTITY;
  if (level === "country") {
    const continentName = hierarchy[1];
    return features.find((f) => f.level === "continent" && f.name === continentName) ?? WORLD_ENTITY;
  }
  if (level === "region") {
    const countryName = entity.parentCountry ?? hierarchy[2];
    return features.find((f) => f.level === "country" && f.name === countryName) ?? null;
  }
  if (level === "city") {
    if (entity.parentRegion) {
      const region = features.find((f) => f.level === "region" && f.parentCountry === entity.parentCountry && f.name === entity.parentRegion);
      if (region) return region;
    }
    return features.find((f) => f.level === "country" && f.name === entity.parentCountry) ?? null;
  }
  return null;
}

function childrenForEntity(entity, features = [], limit = 14) {
  const level = entity?.level ?? "world";
  const childLevel = childLevelForEntity(level);
  return entityChildrenByLevel(entity, features, childLevel, limit);
}

function entityChildrenByLevel(entity, features = [], childLevel = null, limit = 14) {
  const level = entity?.level ?? "world";
  if (!childLevel) return { items: [], total: 0, level: null };

  let items = [];
  if (level === "world") {
    items = features.filter((f) => f.level === childLevel);
  } else if (level === "continent") {
    items = features.filter((f) => f.level === childLevel && f.hierarchy?.[1] === entity.name);
  } else if (level === "country") {
    items = features.filter((f) => f.level === childLevel && f.parentCountry === entity.name);
  } else if (level === "region") {
    items = features.filter((f) => f.level === childLevel && f.parentCountry === entity.parentCountry && f.parentRegion === entity.name);
  }

  const sorted = [...items].sort((a, b) => {
    if (childLevel === "city") return (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
  return { items: sorted.slice(0, limit), total: sorted.length, level: childLevel };
}

function playableChildrenForEntity(entity, features = [], gameMode = "risk", limit = 600) {
  const level = entity?.level ?? "world";
  const childLevel = playableChildLevelForEntity(level, gameMode);
  return entityChildrenByLevel(entity, features, childLevel, limit);
}

function breadcrumbEntitiesFor(entity, features = []) {
  const level = entity?.level ?? "world";
  if (level === "world") return [WORLD_ENTITY];
  const hierarchy = entity?.hierarchy ?? ["Earth"];
  const crumbs = [WORLD_ENTITY];
  const continentName = hierarchy[1];
  if (continentName) {
    const continent = features.find((f) => f.level === "continent" && f.name === continentName);
    if (continent) crumbs.push(continent);
  }
  const countryName = entity.parentCountry ?? hierarchy[2];
  if (["country", "region", "city"].includes(level) && countryName) {
    const country = features.find((f) => f.level === "country" && f.name === countryName);
    if (country && !crumbs.some((c) => c.id === country.id)) crumbs.push(country);
  }
  const regionName = entity.parentRegion ?? (level === "region" ? entity.name : hierarchy[3]);
  if (level === "region" || level === "city") {
    const region = features.find((f) => f.level === "region" && f.parentCountry === countryName && f.name === regionName);
    if (region && !crumbs.some((c) => c.id === region.id)) crumbs.push(region);
  }
  if (level === "city" && entity) crumbs.push(entity);
  if (["continent", "country", "region"].includes(level) && entity && !crumbs.some((c) => c.id === entity.id)) crumbs.push(entity);
  return crumbs;
}

function cameraDistanceForEntity(level = "world") {
  return {
    world: 22.5,
    continent: 19.25,
    country: 11.3,
    region: 7.45,
    city: 5.1
  }[level] ?? 12;
}

function childSectionLabel(level) {
  return {
    continent: "Continents",
    country: "Countries",
    region: "States / Regions",
    city: "Cities"
  }[level] ?? "Places";
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
async function checkOsmCoverage(lat, lon) {
  const offset = 0.0045;
  const bbox = `${lat - offset},${lon - offset},${lat + offset},${lon + offset}`;
  const query = `[out:json][timeout:10];(way["building"](${bbox});way["highway"](${bbox}););out count;`;
  try {
    const res = await fetch(OVERPASS_URL, { method: "POST", body: `data=${encodeURIComponent(query)}` });
    const json = await res.json();
    const count = parseInt(json.elements?.[0]?.tags?.total ?? "0", 10);
    return count;
  } catch {
    return -1;
  }
}

export function GlobePicker({ onSelect }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const adminFeaturesRef = useRef([...CONTINENT_FEATURES, ...CITY_FEATURES]);
  const selectedAdminRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [picked, setPicked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState(null);
  const [selectedKnownId, setSelectedKnownId] = useState(null);
  const [activeAdminLevel, setActiveAdminLevel] = useState("continent");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [geoVisibility, setGeoVisibility] = useState({ continents: 0, countries: 0, regions: 0, cities: 0 });
  const [boundaryStatus, setBoundaryStatus] = useState("Loading bundled real boundaries…");
  const [boundaryDiagnostics, setBoundaryDiagnostics] = useState(null);
  const [earthLighting, setEarthLighting] = useState({ realTime: true, hourOffset: 0, idleRotation: true });
  const [sunInfo, setSunInfo] = useState({ time: cityTimeLabel(new Date()), subsolar: sunSubsolarPoint(new Date()) });
  const [centerContext, setCenterContext] = useState({ level: "continent", name: "North America", hierarchy: ["Earth", "North America"] });
  const [centeredAdmin, setCenteredAdmin] = useState(null);
  const [globeInteracting, setGlobeInteracting] = useState(false);
  const [lobbyVisible, setLobbyVisible] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const pointerSessionRef = useRef({ x: 0, y: 0, t: 0, moved: false });
  const suppressClickUntilRef = useRef(0);
  const earthLightingRef = useRef({ realTime: true, hourOffset: 0, idleRotation: true });
  const labelOpacityRef = useRef({ current: 1, target: 1 });
  const userInteractingRef = useRef(false);
  const [battleOptions, setBattleOptions] = useState({ playerMode: "sandbox", gameMode: "freeplay", scale: "neighborhood", regionDensity: "recommended" });

  useEffect(() => {
    earthLightingRef.current = earthLighting;
  }, [earthLighting]);

  useEffect(() => {
    if (sceneRef.current.knownMarkerGroup) {
      sceneRef.current.knownMarkerGroup.visible = devMode;
    }
  }, [devMode]);


  useEffect(() => {
    if (globeInteracting) {
      setLobbyVisible(false);
      return undefined;
    }
    const delay = hasUserInteracted || selectedAdmin ? 1700 : 3200;
    const timer = window.setTimeout(() => setLobbyVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [globeInteracting, centerContext.name, selectedAdmin, hasUserInteracted]);

  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070816);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.copy(latLonToVec3(DEFAULT_USER_LOCATION.lat, DEFAULT_USER_LOCATION.lon, 21.5));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 25;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;

    const geo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const textureLoader = new THREE.TextureLoader();
    const dayTexture = textureLoader.load(TEXTURE_URL);
    const nightTexture = textureLoader.load(NIGHT_TEXTURE_URL);
    const mat = createEarthMaterial(dayTexture, nightTexture);
    const globe = new THREE.Mesh(geo, mat);
    scene.add(globe);

    const cloudTexture = textureLoader.load(CLOUD_TEXTURE_URL);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.26,
      depthWrite: false
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS + 0.035, 96, 96), cloudMaterial);
    scene.add(clouds);

    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS + 0.22, 128, 128), createAtmosphereMaterial());
    atmosphere.renderOrder = 1;
    scene.add(atmosphere);

    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    const sun = new THREE.DirectionalLight(0xffffff, 2.25);
    scene.add(sun);

    const knownMarkerGroup = new THREE.Group();
    const knownMarkerGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const knownMarkerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const location of KNOWN_LOCATIONS) {
      const knownMarker = new THREE.Mesh(knownMarkerGeo, knownMarkerMat);
      knownMarker.position.copy(latLonToVec3(location.lat, location.lon, EARTH_RADIUS + 0.075));
      knownMarker.userData = { knownLocation: location };
      knownMarkerGroup.add(knownMarker);
    }
    knownMarkerGroup.visible = false;
    scene.add(knownMarkerGroup);

    const adminGroup = new THREE.Group();
    scene.add(adminGroup);

    const updateAdminLabelOpacity = () => {
      adminGroup.traverse((child) => {
        if (child.userData?.adminLabel && child.material) {
          child.material.opacity = child.userData.baseOpacity * labelOpacityRef.current.current;
        }
      });
    };

    const rebuildAdminLayer = (level) => {
      adminGroup.clear();
      const cameraCenter = vec3ToLatLon(camera.position);
      const cameraDistance = camera.position.length();
      const focusCountry = findContainingFeatureAtLevel(cameraCenter, adminFeaturesRef.current, "country") ?? (selectedAdminRef.current?.level === "country" ? selectedAdminRef.current : null);
      const focusRegion = findContainingFeatureAtLevel(cameraCenter, adminFeaturesRef.current, "region") ?? (selectedAdminRef.current?.level === "region" ? selectedAdminRef.current : null);
      const visibilityContext = { cameraCenter, cameraDistance, focusCountry, focusRegion, selectedAdmin: selectedAdminRef.current };
      const visible = featuresForZoomContext(level, adminFeaturesRef.current, visibilityContext);
      const selectedId = selectedAdminRef.current?.id;
      setGeoVisibility(visibleCountsForZoom(level, adminFeaturesRef.current, visibilityContext));

      const acceptedLabelPositions = [];
      const sortedVisible = [...visible].sort((a, b) => {
        const levelDelta = levelRank(a.level) - levelRank(b.level);
        if (levelDelta !== 0) return levelDelta;
        return (b.population ?? 0) - (a.population ?? 0);
      });

      for (const feature of sortedVisible) {
        const featureRank = levelRank(feature.level);
        const isActive = feature.level === level;
        const isSelected = feature.id === selectedId;
        const color = feature.level === "continent" ? 0x94a3b8 : feature.level === "country" ? 0xffffff : feature.level === "region" ? 0xfde68a : 0xbbf7d0;

        // Continents are strategic labels, not hard geography. Country/state boundaries carry the real map.
        const drawBoundary = feature.geometry && feature.level !== "city" && feature.level !== "continent";
        if (drawBoundary) {
          const lineGroup = createBoundaryLines(feature, isSelected ? 0x38bdf8 : color, EARTH_RADIUS + 0.055 + featureRank * 0.012, { opacity: isSelected ? 0.95 : (isActive ? 0.6 : 0.18) });
          lineGroup.traverse((child) => {
            if (child.material) {
              child.material.opacity = isSelected ? 0.95 : (isActive ? 0.6 : 0.18);
            }
          });
          adminGroup.add(lineGroup);
        }

        if (shouldRenderFeatureLabel(feature, level)) {
          const labelWorldPosition = latLonToVec3(feature.lat, feature.lon, EARTH_RADIUS + 0.22 + featureRank * 0.055);
          const projected = labelWorldPosition.clone().project(camera);
          const screenX = (projected.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const screenY = (-projected.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          const minSpacing = feature.level === "city" ? 64 : feature.level === "region" ? 76 : 96;
          const tooClose = acceptedLabelPositions.some((pos) => Math.hypot(pos.x - screenX, pos.y - screenY) < minSpacing);
          if (tooClose && feature.level === "city") continue;
          acceptedLabelPositions.push({ x: screenX, y: screenY, level: feature.level });

          const label = createLabelSprite(
            feature.name,
            feature.level === "continent" ? "#f8fafc" : feature.level === "country" ? "#f1f5f9" : feature.level === "region" ? "#fde68a" : "#bbf7d0",
            feature.level
          );
          label.position.copy(labelWorldPosition);
          const baseOpacity = feature.level === "continent" ? 0.96 : feature.level === "country" ? 0.88 : feature.level === "region" ? 0.8 : 0.76;
          label.material.opacity = baseOpacity * labelOpacityRef.current.current;
          label.userData = { adminFeature: feature, adminLabel: true, baseOpacity };
          adminGroup.add(label);
        }
      }
    };
    rebuildAdminLayer("continent");

    sceneRef.current = { renderer, scene, camera, controls, globe, clouds, atmosphere, knownMarkerGroup, adminGroup, rebuildAdminLayer, updateAdminLabelOpacity, activeAdminLevel: "continent" };

    loadRealAdminFeatures().then(({ features, errors, diagnostics }) => {
      adminFeaturesRef.current = features;
      rebuildAdminLayer(zoomLevelFromDistance(camera.position.length()));
      const countryCount = features.filter((f) => f.level === "country" && f.source?.startsWith("real")).length;
      const regionCount = features.filter((f) => f.level === "region" && f.source?.startsWith("real")).length;
      setBoundaryDiagnostics(diagnostics);
      setBoundaryStatus(errors.length ? `Loaded bundled boundaries with fallback: ${errors.join("; ")}` : `Boundaries loaded: ${countryCount} countries, ${regionCount} regions, ${features.filter((f) => f.level === "city").length} cities · global admin on`);
      const level = zoomLevelFromDistance(camera.position.length());
      const cameraCenter = vec3ToLatLon(camera.position);
      const centered = centeredFeatureForLevel(cameraCenter, features, level);
      setCenterContext({ level, name: centered?.name ?? "Earth", hierarchy: centered?.hierarchy ?? ["Earth"], lat: cameraCenter.lat, lon: cameraCenter.lon });
      setCenteredAdmin(centered ?? null);
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.08;
    const mouse = new THREE.Vector2();

    const setMouse = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
    };

    const onPointerMove = (e) => {
      const session = pointerSessionRef.current;
      if (session.t && Math.hypot(e.clientX - session.x, e.clientY - session.y) > 7) {
        session.moved = true;
      }
      setMouse(e);
      const hits = raycaster.intersectObject(globe);
      setHovered(hits.length > 0 ? vec3ToLatLon(hits[0].point) : null);
    };

    const pickAdminFeature = (loc, activeLevel) => {
      return findContainingFeature(loc, adminFeaturesRef.current, activeLevel);
    };

    const onClick = (e) => {
      if (Date.now() < suppressClickUntilRef.current) return;
      setMouse(e);
      const adminHits = raycaster.intersectObjects(adminGroup.children, true).filter((hit) => hit.object.userData?.adminFeature);
      if (adminHits.length > 0) {
        setHasUserInteracted(true);
        const feature = adminHits[0].object.userData.adminFeature;
        const loc = { lat: feature.lat, lon: feature.lon, name: feature.name, region: feature.hierarchy.join(" / "), adminFeature: feature, adminContext: { selected: feature, hierarchy: feature.hierarchy } };
        setPicked(loc);
        setSelectedKnownId(null);
        selectedAdminRef.current = feature;
        setSelectedAdmin(feature);
        sceneRef.current.rebuildAdminLayer?.(sceneRef.current.activeAdminLevel ?? activeAdminLevel);
        setWarning(null);
        return;
      }

      const knownHits = raycaster.intersectObjects(knownMarkerGroup.children);
      if (knownHits.length > 0) {
        setHasUserInteracted(true);
        const loc = knownHits[0].object.userData.knownLocation;
        const adminContext = inferAdminContext(loc, "city", adminFeaturesRef.current);
        setPicked({ ...loc, adminContext, adminFeature: adminContext.selected });
        setSelectedKnownId(loc.id);
        selectedAdminRef.current = adminContext.selected;
        setSelectedAdmin(adminContext.selected);
        sceneRef.current.rebuildAdminLayer?.(sceneRef.current.activeAdminLevel ?? activeAdminLevel);
        setWarning(null);
        return;
      }

      const hits = raycaster.intersectObject(globe);
      if (hits.length > 0) {
        setHasUserInteracted(true);
        const loc = vec3ToLatLon(hits[0].point);
        const level = zoomLevelFromDistance(camera.position.length());
        const selected = pickAdminFeature(loc, level);
        const hierarchy = selected?.hierarchy ?? inferAdminContext(loc, level, adminFeaturesRef.current).hierarchy;
        const adminContext = { selected, hierarchy };
        setPicked({ ...loc, name: selected?.name, region: hierarchy.join(" / "), adminContext, adminFeature: selected });
        setSelectedKnownId(null);
        selectedAdminRef.current = selected;
        setSelectedAdmin(selected);
        sceneRef.current.rebuildAdminLayer?.(sceneRef.current.activeAdminLevel ?? activeAdminLevel);
        setWarning(null);
      }
    };

    const updateCenterContext = () => {
      const level = zoomLevelFromDistance(camera.position.length());
      const cameraCenter = vec3ToLatLon(camera.position);
      const centered = centeredFeatureForLevel(cameraCenter, adminFeaturesRef.current, level);
      setCenterContext({
        level,
        name: centered?.name ?? "Earth",
        hierarchy: centered?.hierarchy ?? ["Earth"],
        lat: cameraCenter.lat,
        lon: cameraCenter.lon
      });
      setCenteredAdmin(centered ?? null);
    };

    const onPointerDown = (e) => {
      pointerSessionRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
      setHasUserInteracted(true);
      userInteractingRef.current = true;
      labelOpacityRef.current.target = 0.12;
      setGlobeInteracting(true);
      setEarthLighting((current) => ({ ...current, idleRotation: false }));
    };

    const onPointerUp = () => {
      const session = pointerSessionRef.current;
      const heldMs = session.t ? Date.now() - session.t : 0;
      if (session.moved || heldMs > 300) {
        suppressClickUntilRef.current = Date.now() + 220;
      }
      pointerSessionRef.current = { x: 0, y: 0, t: 0, moved: false };
      userInteractingRef.current = false;
      labelOpacityRef.current.target = 1;
      setGlobeInteracting(false);
      updateCenterContext();
      rebuildAdminLayer(zoomLevelFromDistance(camera.position.length()));
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("click", onClick);

    let animId;
    let frameCount = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      const lighting = earthLightingRef.current;
      const now = new Date();
      const simulatedTime = lighting.realTime ? now : new Date(now.getTime() + lighting.hourOffset * 3600000);
      const sunDirection = sunDirectionFromDate(simulatedTime);
      const subsolar = sunSubsolarPoint(simulatedTime);
      sun.position.copy(sunDirection.clone().multiplyScalar(18));
      mat.uniforms.sunDirection.value.copy(sunDirection);
      atmosphere.material.uniforms.sunDirection.value.copy(sunDirection);
      controls.autoRotate = Boolean(lighting.idleRotation);
      clouds.rotation.y += 0.00022;
      if (frameCount % 45 === 0) {
        setSunInfo({ time: cityTimeLabel(simulatedTime), subsolar });
        if (!userInteractingRef.current) {
          const level = zoomLevelFromDistance(camera.position.length());
          const cameraCenter = vec3ToLatLon(camera.position);
          const centered = centeredFeatureForLevel(cameraCenter, adminFeaturesRef.current, level);
          setCenterContext({ level, name: centered?.name ?? "Earth", hierarchy: centered?.hierarchy ?? ["Earth"], lat: cameraCenter.lat, lon: cameraCenter.lon });
      setCenteredAdmin(centered ?? null);
        }
      }
      labelOpacityRef.current.current += (labelOpacityRef.current.target - labelOpacityRef.current.current) * 0.08;
      updateAdminLabelOpacity();
      frameCount++;
      const nextLevel = zoomLevelFromDistance(camera.position.length());
      if (sceneRef.current.activeAdminLevel !== nextLevel) {
        sceneRef.current.activeAdminLevel = nextLevel;
        rebuildAdminLayer(nextLevel);
        setActiveAdminLevel(nextLevel);
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("click", onClick);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const selectKnownLocation = (location) => {
    setHasUserInteracted(true);
    const adminContext = inferAdminContext(location, "city", adminFeaturesRef.current);
    setPicked({ ...location, adminContext, adminFeature: adminContext.selected });
    setSelectedKnownId(location.id);
    selectedAdminRef.current = adminContext.selected;
    setSelectedAdmin(adminContext.selected);
    sceneRef.current.rebuildAdminLayer?.(sceneRef.current.activeAdminLevel ?? activeAdminLevel);
    setWarning(null);
  };


  const focusStrategicEntity = (entity) => {
    const nextEntity = entity?.level === "world" ? WORLD_ENTITY : entity;
    const scene = sceneRef.current;

    setHasUserInteracted(nextEntity.level !== "world");
    setSelectedKnownId(null);
    setWarning(null);

    if (nextEntity.level === "world") {
      selectedAdminRef.current = null;
      setSelectedAdmin(null);
      setPicked(null);
      setCenterContext({ level: "world", name: "World", hierarchy: ["Earth"], lat: WORLD_ENTITY.lat, lon: WORLD_ENTITY.lon });
    } else {
      const loc = tacticalLaunchPointForEntity(nextEntity);
      selectedAdminRef.current = nextEntity;
      setSelectedAdmin(nextEntity);
      setPicked(loc);
      setCenterContext({ level: nextEntity.level, name: nextEntity.name, hierarchy: nextEntity.hierarchy ?? [nextEntity.name], lat: nextEntity.lat, lon: nextEntity.lon });
    }

    if (scene?.camera && scene?.controls) {
      const distance = cameraDistanceForEntity(nextEntity.level);
      const target = latLonToVec3(nextEntity.lat ?? 20, nextEntity.lon ?? 0, distance);
      scene.camera.position.copy(target);
      scene.camera.lookAt(0, 0, 0);
      scene.controls.update();
      const level = zoomLevelFromDistance(scene.camera.position.length());
      scene.rebuildAdminLayer?.(level);
    } else {
      scene?.rebuildAdminLayer?.(scene.activeAdminLevel ?? activeAdminLevel);
    }
  };

  const currentStrategicEntity = selectedAdmin ?? (hasUserInteracted ? centeredAdmin : WORLD_ENTITY) ?? WORLD_ENTITY;
  const currentEntityName = currentStrategicEntity?.name ?? "World";
  const currentLevel = currentStrategicEntity?.level ?? "world";
  const availableModeIds = availableGameModesForLevel(currentLevel);
  const activeGameMode = availableModeIds.includes(battleOptions.gameMode) ? battleOptions.gameMode : availableModeIds[0];
  const currentStats = entityStats(currentStrategicEntity, adminFeaturesRef.current, boundaryDiagnostics);
  const currentHierarchy = currentStrategicEntity?.hierarchy ?? ["Earth"];
  const currentLaunchLocation = tacticalLaunchPointForEntity(currentStrategicEntity);
  const currentParentEntity = parentEntityFor(currentStrategicEntity, adminFeaturesRef.current);
  const currentChildren = childrenForEntity(currentStrategicEntity, adminFeaturesRef.current);
  const currentBreadcrumbEntities = breadcrumbEntitiesFor(currentStrategicEntity, adminFeaturesRef.current);

  const launchCurrentEntity = async () => {
    setChecking(true);
    setWarning(null);
    const launchOptions = { ...battleOptions, gameMode: activeGameMode };
    const battleRequest = createBattleRequest(currentLaunchLocation, launchOptions);
    battleRequest.selectionType = currentLevel;
    battleRequest.selectedName = currentEntityName;
    battleRequest.strategicEntity = {
      id: currentStrategicEntity?.id,
      name: currentEntityName,
      level: currentLevel,
      hierarchy: currentHierarchy,
      lat: currentStrategicEntity?.lat,
      lon: currentStrategicEntity?.lon,
      bbox: currentStrategicEntity?.bbox,
      source: currentStrategicEntity?.source ?? "center-context"
    };

    // D65: non-city selections launch a generated campaign board first.
    // Tactical map generation is now a conflict-resolution path rather than the default
    // output for world/continent/country/region game modes.
    const campaignChildBundle = playableChildrenForEntity(currentStrategicEntity, adminFeaturesRef.current, activeGameMode, 900);
    battleRequest.childLevel = campaignChildBundle.level;
    battleRequest.navigationChildLevel = childLevelForEntity(currentLevel);
    battleRequest.regionDensity = launchOptions.regionDensity ?? "recommended";
    battleRequest.worldEnginePlan = buildWorldEnginePlan({
      entity: currentStrategicEntity,
      gameMode: activeGameMode,
      playableChildLevel: campaignChildBundle.level,
      childCount: campaignChildBundle.total || campaignChildBundle.items.length,
      density: battleRequest.regionDensity
    });
    battleRequest.playableScaleRule = `${currentLevel}/${activeGameMode} → ${campaignChildBundle.level ?? "none"}`;
    battleRequest.childEntities = campaignChildBundle.items.map((child) => ({
      id: child.id,
      name: child.name,
      level: child.level,
      hierarchy: child.hierarchy,
      lat: child.lat,
      lon: child.lon,
      bbox: child.bbox,
      parentCountry: child.parentCountry,
      parentRegion: child.parentRegion,
      population: child.population,
      source: child.source,
      geometry: child.geometry
    }));
    battleRequest.launchType = currentLevel === "city" || activeGameMode === "freeplay" ? "tactical" : "campaign";
    battleRequest.initialView = battleRequest.launchType === "campaign" ? "strategic-campaign" : "tactical-replica";

    const count = battleRequest.launchType === "tactical" ? await checkOsmCoverage(currentLaunchLocation.lat, currentLaunchLocation.lon) : 10;
    setChecking(false);
    const launchLocation = { ...currentLaunchLocation, sizeMeters: battleRequest.sizeMeters, battleRequest };
    if (count === 0) setWarning("No real map data here. A procedural fallback will be used unless you deploy anyway.");
    else if (count > 0 && count < 5) setWarning("Sparse OSM data. The map will be supplemented with procedural content.");
    else onSelect(launchLocation);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div ref={mountRef} className="absolute inset-0 lg:left-[35%]" />

      <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-4 pt-4 md:pt-5 lg:left-[35%]">
        <div className={`max-w-[min(540px,88vw)] rounded-2xl border border-sky-500/30 bg-slate-950/55 px-5 py-3 text-center shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-500 ${globeInteracting ? "opacity-35 translate-y-[-6px]" : "opacity-100 translate-y-0"}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-sky-300">{battleLevelLabel(currentLevel)} View</div>
          <div className="mt-1 text-3xl font-black tracking-wide text-white drop-shadow-lg md:text-4xl">{currentEntityName}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-slate-400 md:text-xs">{currentHierarchy.join(" › ")}</div>
        </div>
      </div>

      <aside className={`pointer-events-auto absolute bottom-0 left-0 right-0 z-20 max-h-[58dvh] overflow-y-auto rounded-t-2xl border border-sky-500/30 bg-slate-950/90 p-4 text-slate-200 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-700 sm:bottom-3 sm:left-3 sm:right-3 sm:rounded-2xl lg:bottom-auto lg:left-5 lg:right-auto lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:w-[calc(35vw-2rem)] lg:max-w-[440px] ${lobbyVisible ? "opacity-100 translate-y-0 lg:translate-x-0" : "opacity-0 translate-y-6 pointer-events-none lg:-translate-x-4 lg:translate-y-0"}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">Campaign Lobby</div>
            <h1 className="mt-1 text-3xl font-black leading-tight text-white">{currentEntityName}</h1>
            <div className="mt-1 font-mono text-[11px] text-slate-400">{currentHierarchy.join(" › ")}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right">
            <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">Battle Level</div>
            <div className="text-sm font-bold text-amber-200">{battleLevelLabel(currentLevel)}</div>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/62 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Navigate</div>
          <div className="flex flex-wrap gap-1.5">
            {currentBreadcrumbEntities.map((crumb, index) => (
              <button
                key={`${crumb.id ?? crumb.name}-${index}`}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${crumb.id === currentStrategicEntity?.id || (crumb.level === "world" && currentLevel === "world") ? "border-sky-400 bg-sky-950/80 text-sky-100" : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-sky-500 hover:text-white"}`}
                onClick={() => focusStrategicEntity(crumb)}
                title={`Go to ${crumb.name}`}
              >
                {crumb.name === "World" ? "Earth" : crumb.name}
              </button>
            ))}
          </div>
          {currentParentEntity && (
            <button
              className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950/65 px-3 py-2 text-left text-xs transition hover:border-amber-400 hover:text-white"
              onClick={() => focusStrategicEntity(currentParentEntity)}
            >
              <span className="text-slate-400">↑ {battleLevelLabel(currentParentEntity.level)}</span>
              <span className="font-bold text-slate-100">{currentParentEntity.name === "World" ? "Earth" : currentParentEntity.name}</span>
            </button>
          )}
        </div>

        {currentChildren.items.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/62 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{childSectionLabel(currentChildren.level)}</div>
              <div className="font-mono text-[10px] text-slate-500">{currentChildren.items.length}/{currentChildren.total}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {currentChildren.items.map((child) => (
                <button
                  key={child.id}
                  className="rounded-lg border border-slate-700 bg-slate-950/65 px-3 py-2 text-left transition hover:border-sky-400 hover:bg-sky-950/50"
                  onClick={() => focusStrategicEntity(child)}
                  title={`Select ${child.name}`}
                >
                  <div className="truncate text-xs font-bold text-slate-100">{child.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    {child.level === "city" && child.population ? `${child.population.toLocaleString()} people` : battleLevelLabel(child.level)}
                  </div>
                </button>
              ))}
            </div>
            {currentChildren.total > currentChildren.items.length && (
              <div className="mt-2 text-[10px] text-slate-500">Showing the most relevant {currentChildren.items.length}. Zoom closer or use globe selection for more.</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {currentStats.map((fact) => (
            <div key={`${fact.label}-${fact.value}`} className="rounded-xl border border-slate-800 bg-slate-900/78 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{fact.label}</div>
              <div className="mt-1 truncate text-lg font-black text-slate-100">{fact.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Player Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {SANDBOX_MODES.map((mode) => (
              <button key={mode.id} className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${battleOptions.playerMode === mode.id ? "border-sky-400 bg-sky-900/80 text-white" : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-sky-500 hover:text-sky-100"}`} onClick={() => setBattleOptions((current) => ({ ...current, playerMode: mode.id }))} title={mode.description}>{mode.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Game Modes Available for {battleLevelLabel(currentLevel)}</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {availableModeIds.map((modeId) => (
              <button key={modeId} className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${activeGameMode === modeId ? "border-emerald-400 bg-emerald-900/70 text-white" : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-emerald-500 hover:text-emerald-100"}`} onClick={() => setBattleOptions((current) => ({ ...current, gameMode: modeId }))}>{gameModeDisplay(modeId)}</button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">World Engine</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-300">{WORLD_ENGINE_TAGLINE}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"><b className="text-slate-100">{battleLevelLabel(currentLevel)}</b><br />Current LOD</div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"><b className="text-slate-100">{playableChildLevelForEntity(currentLevel, activeGameMode) ?? "—"}</b><br />Playable layer</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Region Density</label>
          <div className="grid grid-cols-2 gap-2">
            {REGION_DENSITY_MODES.map((mode) => (
              <button key={mode.id} className={`rounded-lg border px-2 py-2 text-left text-xs transition ${battleOptions.regionDensity === mode.id ? "border-cyan-400 bg-cyan-950/70 text-white" : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-cyan-500"}`} onClick={() => setBattleOptions((current) => ({ ...current, regionDensity: mode.id }))} title={mode.description}>
                <span className="block font-bold">{mode.label}</span>
                <span className="block text-[10px] text-slate-500">{mode.id === "recommended" ? "natural" : `${Math.round(mode.multiplier * 100)}%`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Starting Tactical Scale</label>
          <div className="space-y-2">
            {BATTLE_SCALES.map((scale) => (
              <button key={scale.id} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${battleOptions.scale === scale.id ? "border-amber-400 bg-amber-950/70 text-white" : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-amber-500"}`} onClick={() => setBattleOptions((current) => ({ ...current, scale: scale.id }))}>
                <span className="font-bold">{scale.label}</span><span className="font-mono text-[10px] text-slate-500">{scale.ew}×{scale.ns}m</span>
              </button>
            ))}
          </div>
        </div>

        <button className="mt-4 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-500 disabled:opacity-50" disabled={checking} onClick={launchCurrentEntity}>{checking ? "Checking map data…" : primaryActionLabel(currentLevel)}</button>

        {warning && (
          <div className="mt-3 rounded-xl border border-amber-700/50 bg-amber-950/45 p-3 text-xs text-amber-200">
            {warning}
            <button className="ml-2 font-bold underline hover:text-white" onClick={() => { const battleRequest = createBattleRequest(currentLaunchLocation, { ...battleOptions, gameMode: activeGameMode }); onSelect({ ...currentLaunchLocation, sizeMeters: battleRequest.sizeMeters, battleRequest }); }}>Deploy anyway</button>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-slate-950/55 p-3 text-[11px] leading-relaxed text-slate-500">
          This panel follows the geography under the camera. Spin the globe to choose a theater, then select a mode and generate the starting view.
        </div>
      </aside>

      <div className="pointer-events-auto absolute left-3 top-3 z-20 rounded-xl bg-slate-950/78 px-3 py-2 text-xs font-mono text-slate-300 shadow-xl backdrop-blur sm:left-5 sm:top-auto sm:bottom-5 lg:left-[calc(35%+1.25rem)]">
        {hovered ? `${hovered.lat.toFixed(4)}, ${hovered.lon.toFixed(4)}` : "Hover to see coordinates"}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/72 px-3 py-2 text-xs text-slate-300 shadow-xl backdrop-blur md:flex lg:left-[67.5%]">
        <div className="pr-2">
          <div className="font-bold uppercase tracking-wide text-sky-300">Real-Time Earth</div>
          <div className="font-mono text-[10px] text-slate-500">{sunInfo.time} · sun {sunInfo.subsolar.lat.toFixed(1)}°, {sunInfo.subsolar.lon.toFixed(1)}°</div>
        </div>
        <button className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${earthLighting.realTime ? "border-emerald-400 bg-emerald-950 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400"}`} onClick={() => setEarthLighting((current) => ({ ...current, realTime: !current.realTime }))}>{earthLighting.realTime ? "Live" : "Debug"}</button>
        <button className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${earthLighting.idleRotation ? "border-sky-500 bg-sky-950 text-sky-200" : "border-slate-700 bg-slate-900 text-slate-400"}`} onClick={() => setEarthLighting((current) => ({ ...current, idleRotation: !current.idleRotation }))}>Rotate {earthLighting.idleRotation ? "on" : "off"}</button>
      </div>

      <div className="pointer-events-auto absolute right-3 top-3 z-30 flex flex-col items-end gap-2 md:right-5 md:top-5">
        <button
          className={`rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wide shadow-xl backdrop-blur transition ${devMode ? "border-amber-400 bg-amber-950/90 text-amber-100" : "border-slate-700/80 bg-slate-950/78 text-slate-300 hover:border-sky-500 hover:text-white"}`}
          onClick={() => setDevMode((value) => !value)}
          title="Toggle developer tools"
        >
          {devMode ? "Dev Mode On" : "Settings"}
        </button>
        {devMode && (
          <aside className="max-h-[calc(100vh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-amber-500/40 bg-slate-950/88 p-3 text-xs text-slate-300 shadow-2xl shadow-black/45 backdrop-blur-xl">
            <div className="mb-3 rounded-xl border border-amber-700/40 bg-amber-950/30 p-3">
              <div className="font-black uppercase tracking-wide text-amber-200">Developer Tools</div>
              <div className="mt-1 text-[11px] text-slate-400">Test locations, diagnostics, and debug helpers are hidden from the default player view.</div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2"><span className="text-slate-500">View</span><br /><b>{battleLevelLabel(activeAdminLevel)}</b></div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2"><span className="text-slate-500">Visible</span><br /><b>C {geoVisibility.countries} · R {geoVisibility.regions} · Ci {geoVisibility.cities}</b></div>
              <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2"><span className="text-slate-500">Boundaries</span><br /><b>{boundaryStatus}</b></div>
            </div>
            <div className="mb-2 font-black uppercase tracking-wide text-sky-300">Known Test Locations</div>
            <div className="space-y-2">
              {KNOWN_LOCATIONS.map((location) => (
                <button key={location.id} className={`w-full rounded-xl border p-3 text-left transition hover:border-sky-500 hover:bg-slate-800 ${selectedKnownId === location.id ? "border-sky-400 bg-sky-950/70 ring-1 ring-sky-400" : "border-slate-800 bg-slate-900/80"}`} onClick={() => selectKnownLocation(location)}>
                  <div className="font-bold text-slate-100">{location.name}</div>
                  <div className="text-[11px] text-slate-400">{location.region}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{location.note}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-500">{location.lat.toFixed(4)}, {location.lon.toFixed(4)}{location.sizeMeters ? ` · ${location.sizeMeters}m` : ""}</div>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {devMode && (
        <div className="pointer-events-none absolute right-3 bottom-3 z-20 max-w-[300px] rounded-xl bg-slate-950/72 px-3 py-2 text-[11px] text-slate-500 backdrop-blur md:right-5 md:bottom-5">
          Dev Mode: test locations and debug diagnostics are visible. Short-click selects geography; drag/long press navigates without leaving markers.
        </div>
      )}
    </div>
  );
}
