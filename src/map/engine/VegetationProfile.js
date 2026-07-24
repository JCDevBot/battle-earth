/**
 * VegetationProfile — Geography-aware vegetation species selection.
 *
 * Combines latitude (climate zone), elevation, OSM zone type, and proximity
 * context to produce a species mix with visual parameters for each tree type.
 *
 * Each species defines: shape (silhouette), color range, height range, crown style.
 */

const SPECIES = {
  // Boreal / Nordic
  spruce:     { shape: "cone",    crownColor: "#244828", trunkColor: "#4a3322", heightRange: [8, 16], crownScale: [0.6, 0.9], density: "dense" },
  pine:       { shape: "cone",    crownColor: "#31542e", trunkColor: "#5a3e28", heightRange: [7, 14], crownScale: [0.7, 1.1], density: "moderate" },
  birch:      { shape: "sphere",  crownColor: "#6f9f45", trunkColor: "#d0c8b8", heightRange: [6, 12], crownScale: [0.75, 1.15], density: "sparse" },

  // Temperate
  oak:        { shape: "sphere",  crownColor: "#3f6f32", trunkColor: "#5a4028", heightRange: [5, 11], crownScale: [1.15, 1.85], density: "moderate" },
  maple:      { shape: "sphere",  crownColor: "#4f7f38", trunkColor: "#4a3524", heightRange: [4.5, 10], crownScale: [1.05, 1.65], density: "moderate" },
  linden:     { shape: "sphere",  crownColor: "#7fa63a", trunkColor: "#5a4128", heightRange: [4.5, 9.5], crownScale: [1.0, 1.55], density: "moderate" },
  elm:        { shape: "sphere",  crownColor: "#446f35", trunkColor: "#5a4430", heightRange: [5.5, 11.5], crownScale: [1.15, 1.9], density: "moderate" },
  willow:     { shape: "weeping", crownColor: "#5f9641", trunkColor: "#5a4428", heightRange: [4.5, 9], crownScale: [1.15, 1.9], density: "sparse" },
  poplar:     { shape: "column",  crownColor: "#3d6b30", trunkColor: "#6a5438", heightRange: [8, 16], crownScale: [0.4, 0.6], density: "dense" },

  // Subtropical / Mediterranean
  palm:       { shape: "palm",    crownColor: "#3a8a2a", trunkColor: "#7a6a48", heightRange: [6, 12], crownScale: [0.6, 1.0], density: "sparse" },
  cypress:    { shape: "column",  crownColor: "#2a5a24", trunkColor: "#5a4430", heightRange: [7, 14], crownScale: [0.3, 0.5], density: "dense" },
  eucalyptus: { shape: "sphere",  crownColor: "#5a9a50", trunkColor: "#8a7a58", heightRange: [8, 18], crownScale: [0.6, 0.9], density: "sparse" },

  // Riparian / Wetland
  alder:      { shape: "sphere",  crownColor: "#406d35", trunkColor: "#4a3422", heightRange: [4.5, 9], crownScale: [0.9, 1.35], density: "moderate" },
  cattail:    { shape: "grass",   crownColor: "#6a8a44", trunkColor: "#7a7a42", heightRange: [1, 2],  crownScale: [0.2, 0.4], density: "dense" },

  // Alpine / scrub
  juniper:    { shape: "cone",    crownColor: "#3a5a36", trunkColor: "#6a5a42", heightRange: [2, 5],  crownScale: [0.5, 0.8], density: "sparse" },
  shrub:      { shape: "sphere",  crownColor: "#5a7a3a", trunkColor: "#6a5438", heightRange: [1, 3],  crownScale: [0.4, 0.7], density: "dense" },
};

/**
 * Determine climate zone from latitude.
 */
function climateZone(lat) {
  const absLat = Math.abs(lat);
  if (absLat > 60) return "boreal";
  if (absLat > 50) return "cold-temperate";
  if (absLat > 35) return "temperate";
  if (absLat > 23) return "subtropical";
  return "tropical";
}

/**
 * Determine elevation band from meters above sea level.
 */
function elevationBand(elevation) {
  if (elevation > 2500) return "alpine";
  if (elevation > 1500) return "subalpine";
  if (elevation > 800) return "montane";
  return "lowland";
}

/**
 * Species mix lookup based on climate + elevation + zone type.
 * Returns array of { species, weight } — weights are relative probability.
 */
const BIOME_MIX = {
  "boreal:lowland:forest":    [{ s: "spruce", w: 5 }, { s: "pine", w: 3 }, { s: "birch", w: 2 }],
  "boreal:lowland:park":      [{ s: "birch", w: 4 }, { s: "pine", w: 2 }, { s: "spruce", w: 1 }],
  "boreal:montane:forest":    [{ s: "spruce", w: 6 }, { s: "pine", w: 3 }],
  "boreal:subalpine:forest":  [{ s: "spruce", w: 4 }, { s: "juniper", w: 3 }, { s: "shrub", w: 2 }],

  "cold-temperate:lowland:forest": [{ s: "spruce", w: 3 }, { s: "pine", w: 3 }, { s: "birch", w: 2 }, { s: "oak", w: 1 }],
  "cold-temperate:lowland:park":   [{ s: "maple", w: 3 }, { s: "oak", w: 3 }, { s: "birch", w: 2 }, { s: "pine", w: 2 }, { s: "linden", w: 2 }],
  "cold-temperate:montane:forest": [{ s: "spruce", w: 5 }, { s: "pine", w: 4 }],

  "temperate:lowland:forest": [{ s: "oak", w: 4 }, { s: "maple", w: 3 }, { s: "elm", w: 2 }, { s: "pine", w: 2 }, { s: "linden", w: 1 }, { s: "poplar", w: 1 }],
  "temperate:lowland:park":   [{ s: "oak", w: 3 }, { s: "maple", w: 3 }, { s: "elm", w: 2 }, { s: "pine", w: 2 }, { s: "linden", w: 3 }, { s: "birch", w: 1 }],
  "temperate:montane:forest": [{ s: "pine", w: 4 }, { s: "oak", w: 2 }, { s: "spruce", w: 3 }],
  "temperate:subalpine:forest": [{ s: "pine", w: 4 }, { s: "juniper", w: 3 }, { s: "shrub", w: 2 }],

  "subtropical:lowland:forest": [{ s: "eucalyptus", w: 3 }, { s: "palm", w: 2 }, { s: "cypress", w: 3 }],
  "subtropical:lowland:park":   [{ s: "palm", w: 4 }, { s: "cypress", w: 2 }, { s: "eucalyptus", w: 2 }],
  "subtropical:montane:forest": [{ s: "cypress", w: 4 }, { s: "pine", w: 3 }, { s: "oak", w: 2 }],

  "tropical:lowland:forest":  [{ s: "palm", w: 4 }, { s: "eucalyptus", w: 3 }],
  "tropical:lowland:park":    [{ s: "palm", w: 5 }, { s: "eucalyptus", w: 2 }],

  // Wetland / riparian overrides (ignores climate somewhat)
  "*:*:wetland":   [{ s: "willow", w: 3 }, { s: "alder", w: 3 }, { s: "cattail", w: 4 }],
  "*:*:riparian":  [{ s: "willow", w: 4 }, { s: "alder", w: 3 }, { s: "poplar", w: 2 }],
  "*:*:scrub":     [{ s: "shrub", w: 5 }, { s: "juniper", w: 3 }],
  "*:alpine:*":    [{ s: "juniper", w: 3 }, { s: "shrub", w: 5 }],
};

/**
 * Resolve the species mix for a given location and zone type.
 */
export function resolveVegetationProfile(lat, lon, elevation, zoneType) {
  const climate = climateZone(lat);
  const elev = elevationBand(elevation);

  // Check special overrides first
  if (elev === "alpine") return buildProfile(BIOME_MIX["*:alpine:*"], climate, elev, zoneType);
  if (zoneType === "wetland") return buildProfile(BIOME_MIX["*:*:wetland"], climate, elev, zoneType);
  if (zoneType === "riparian") return buildProfile(BIOME_MIX["*:*:riparian"], climate, elev, zoneType);
  if (zoneType === "scrub") return buildProfile(BIOME_MIX["*:*:scrub"], climate, elev, zoneType);

  // Look up specific biome
  const key = `${climate}:${elev}:${zoneType}`;
  const mix = BIOME_MIX[key];
  if (mix) return buildProfile(mix, climate, elev, zoneType);

  // Fallback: try lowland variant
  const fallbackKey = `${climate}:lowland:${zoneType}`;
  const fallback = BIOME_MIX[fallbackKey];
  if (fallback) return buildProfile(fallback, climate, elev, zoneType);

  // Ultimate fallback: generic temperate forest
  return buildProfile(BIOME_MIX["temperate:lowland:forest"], climate, elev, zoneType);
}

function buildProfile(mix, climate, elevation, zoneType) {
  const totalWeight = mix.reduce((sum, entry) => sum + entry.w, 0);
  const species = mix.map((entry) => ({
    ...SPECIES[entry.s],
    name: entry.s,
    probability: entry.w / totalWeight
  }));

  // Density modifier based on zone
  let densityMod = 1.0;
  if (zoneType === "forest") densityMod = 1.3;
  else if (zoneType === "park") densityMod = 0.5;
  else if (zoneType === "scrub") densityMod = 0.7;
  else if (zoneType === "wetland") densityMod = 0.6;

  return { species, climate, elevation, zoneType, densityMod };
}

/**
 * Pick a species from a profile using a random value [0,1).
 */
export function pickSpecies(profile, rand) {
  let cumulative = 0;
  for (const sp of profile.species) {
    cumulative += sp.probability;
    if (rand < cumulative) return sp;
  }
  return profile.species[profile.species.length - 1];
}
