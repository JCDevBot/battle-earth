export const WORLD_SCALE_BANDS = [
  {
    id: "continent",
    label: "Continent",
    minSpanDegrees: 22,
    targetSizeMeters: 7200000,
    osmProfile: "terrainOnly",
    vegetationSource: "osmOnly",
    terrainScale: 2.6,
    featureMode: "strategic-continent",
    visibleLayers: ["terrain", "water", "vegetation", "roads", "strategic-pois", "territory"],
    hiddenLayers: ["buildings", "tactical-buildings", "battlefield-grid", "fog", "classification-debug"],
    renderIntent: "countries, coastlines, mountain systems, major rivers, capital/city markers"
  },
  {
    id: "country",
    label: "Country",
    minSpanDegrees: 7,
    targetSizeMeters: 2200000,
    osmProfile: "terrainOnly",
    vegetationSource: "osmOnly",
    terrainScale: 2.2,
    featureMode: "strategic-country",
    visibleLayers: ["terrain", "water", "vegetation", "roads", "strategic-pois", "territory"],
    hiddenLayers: ["buildings", "tactical-buildings", "battlefield-grid", "fog", "classification-debug"],
    renderIntent: "states/provinces, major terrain regions, highways, rivers, cities"
  },
  {
    id: "region",
    label: "State / Region",
    minSpanDegrees: 1.6,
    targetSizeMeters: 480000,
    osmProfile: "terrainOnly",
    vegetationSource: "osmOnly",
    terrainScale: 1.85,
    featureMode: "strategic-region",
    visibleLayers: ["terrain", "water", "vegetation", "roads", "strategic-pois", "territory"],
    hiddenLayers: ["buildings", "tactical-buildings", "battlefield-grid", "fog", "classification-debug"],
    renderIntent: "regional cities, rivers, lakes, forests, strategic roads"
  },
  {
    id: "city",
    label: "City",
    minSpanDegrees: 0.22,
    targetSizeMeters: 60000,
    osmProfile: "broadBase",
    vegetationSource: "osmOnly",
    terrainScale: 1.45,
    featureMode: "city",
    visibleLayers: ["terrain", "water", "vegetation", "roads", "buildings", "strategic-pois"],
    hiddenLayers: ["tactical-buildings", "battlefield-grid", "fog", "classification-debug"],
    renderIntent: "neighborhoods, arterials, parks, rail, bridges, dense city fabric"
  },
  {
    id: "neighborhood",
    label: "Neighborhood / Tactical",
    minSpanDegrees: 0,
    targetSizeMeters: 1400,
    osmProfile: "broadBase",
    vegetationSource: "planetaryNaip",
    terrainScale: 1.35,
    featureMode: "tactical-neighborhood",
    visibleLayers: ["terrain", "water", "vegetation", "roads", "buildings", "tactical-buildings", "units"],
    hiddenLayers: ["classification-debug"],
    renderIntent: "streets, individual buildings, trees, cover, squads, tactical points"
  }
];

export function getScaleFromSpan(spanDegrees = 0) {
  return WORLD_SCALE_BANDS.find((band) => spanDegrees >= band.minSpanDegrees) ?? WORLD_SCALE_BANDS.at(-1);
}

export function getScaleForEntity(entity = {}, fallbackSizeMeters = 1200) {
  const bbox = entity?.bbox;
  if (bbox) {
    const span = Math.max(Math.abs((bbox.e ?? 0) - (bbox.w ?? 0)), Math.abs((bbox.n ?? 0) - (bbox.s ?? 0)));
    return getScaleFromSpan(span);
  }
  const level = entity?.level ?? entity?.selectionType ?? entity?.scale;
  if (level === "continent") return WORLD_SCALE_BANDS[0];
  if (level === "country") return WORLD_SCALE_BANDS[1];
  if (level === "region" || level === "state" || level === "province") return WORLD_SCALE_BANDS[2];
  if (level === "city") return WORLD_SCALE_BANDS[3];
  if (level === "neighborhood" || level === "district") return WORLD_SCALE_BANDS[4];
  if (fallbackSizeMeters > 1500000) return WORLD_SCALE_BANDS[0];
  if (fallbackSizeMeters > 350000) return WORLD_SCALE_BANDS[1];
  if (fallbackSizeMeters > 45000) return WORLD_SCALE_BANDS[3];
  return WORLD_SCALE_BANDS[4];
}

export function enrichMapConfigForScale(config = {}) {
  const entity = config.battleRequest?.strategicEntity ?? config.battleRequest?.adminContext?.selected ?? config.battleRequest ?? {};
  const scale = getScaleForEntity(entity, config.sizeMeters);
  const mapWidthMeters = Number(config.mapWidthMeters) || Number(config.sizeMeters) || scale.targetSizeMeters;
  const mapDepthMeters = Number(config.mapDepthMeters) || Number(config.sizeMeters) || mapWidthMeters;
  const requestedMax = Math.max(mapWidthMeters, mapDepthMeters);
  const targetSize = Math.max(requestedMax, scale.targetSizeMeters);
  return {
    ...config,
    sizeMeters: targetSize,
    mapWidthMeters: Math.max(mapWidthMeters, targetSize),
    mapDepthMeters: Math.max(mapDepthMeters, targetSize),
    osmProfile: config.osmProfile ?? scale.osmProfile,
    vegetationSource: config.vegetationSource ?? scale.vegetationSource,
    terrainScale: config.terrainScale ?? scale.terrainScale,
    worldScale: scale
  };
}
