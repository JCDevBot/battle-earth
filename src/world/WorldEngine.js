export const WORLD_ENGINE_TAGLINE = "One continuous, scale-aware digital Earth for strategy gameplay from planetary level down to individual streets.";

export const WORLD_LOD_LEVELS = [
  {
    id: "planet",
    label: "Planet",
    entityLevels: ["world"],
    playableForRisk: "countries",
    renderAssets: ["continents", "countries", "oceans", "major rivers", "capitals", "global shipping lanes"],
    commandScale: "global command"
  },
  {
    id: "theater",
    label: "Theater",
    entityLevels: ["continent"],
    playableForRisk: "countries",
    renderAssets: ["countries", "capitals", "major cities", "ports", "mountain systems", "major rivers", "strategic corridors"],
    commandScale: "field armies"
  },
  {
    id: "country",
    label: "Country",
    entityLevels: ["country"],
    playableForRisk: "states / provinces / strategic regions",
    renderAssets: ["admin regions", "cities", "highways", "rail", "forests", "rivers", "airfields", "ports", "industry"],
    commandScale: "corps"
  },
  {
    id: "state",
    label: "State / Region",
    entityLevels: ["region"],
    playableForRisk: "strategic control regions / cities",
    renderAssets: ["strategic control regions", "cities", "interstates", "rail", "airports", "lakes", "forests", "power and industry"],
    commandScale: "brigades"
  },
  {
    id: "city",
    label: "City",
    entityLevels: ["city"],
    playableForRisk: "districts / neighborhoods",
    renderAssets: ["districts", "neighborhoods", "arterials", "parks", "bridges", "airports", "industrial zones", "hospitals"],
    commandScale: "battalions"
  },
  {
    id: "tactical",
    label: "Neighborhood / Tactical",
    entityLevels: ["neighborhood", "district"],
    playableForRisk: "streets / buildings / POIs",
    renderAssets: ["OSM buildings", "streets", "trees", "cover", "garrison points", "destructible assets", "tactical POIs"],
    commandScale: "squads"
  }
];

export const REGION_DENSITY_MODES = [
  { id: "sparse", label: "Sparse", multiplier: 0.65, description: "Fewer, larger regions for faster campaigns." },
  { id: "recommended", label: "Recommended", multiplier: 1, description: "Generator-chosen region count for the selected theater." },
  { id: "dense", label: "Dense", multiplier: 1.55, description: "More regions and more granular control." },
  { id: "custom", label: "Custom", multiplier: 1, description: "Use the custom min/max values once enabled." }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lodForEntityLevel(level = "world") {
  return WORLD_LOD_LEVELS.find((lod) => lod.entityLevels.includes(level)) ?? WORLD_LOD_LEVELS[0];
}

export function nextLodForEntityLevel(level = "world") {
  const current = lodForEntityLevel(level);
  const index = WORLD_LOD_LEVELS.findIndex((lod) => lod.id === current.id);
  return WORLD_LOD_LEVELS[Math.min(WORLD_LOD_LEVELS.length - 1, index + 1)] ?? current;
}

export function estimateNaturalRegionCount(entity = {}, childCount = 0) {
  const level = entity.level ?? "world";
  const name = `${entity.name ?? ""}`.toLowerCase();
  const bbox = entity.bbox;
  const lonSpan = bbox ? Math.abs((bbox.e ?? 0) - (bbox.w ?? 0)) : 0;
  const latSpan = bbox ? Math.abs((bbox.n ?? 0) - (bbox.s ?? 0)) : 0;
  const areaScore = Math.max(1, Math.sqrt(Math.max(1, lonSpan * latSpan)));

  if (level === "world") return Math.max(120, childCount || 195);
  if (level === "continent") return childCount || (name.includes("north america") ? 3 : clamp(Math.round(areaScore * 2.6), 8, 80));
  if (level === "country") {
    if (name.includes("united states")) return childCount || 50;
    if (name.includes("canada")) return childCount || 18;
    if (name.includes("russia")) return childCount || 80;
    return childCount || clamp(Math.round(areaScore * 1.4), 8, 70);
  }
  if (level === "region") return childCount || clamp(Math.round(areaScore * 2.1), 6, 42);
  if (level === "city") return childCount || clamp(Math.round(areaScore * 3.4), 8, 64);
  return childCount || 12;
}

export function regionDensityConfig(entity = {}, childCount = 0, densityId = "recommended") {
  const mode = REGION_DENSITY_MODES.find((item) => item.id === densityId) ?? REGION_DENSITY_MODES[1];
  const recommended = estimateNaturalRegionCount(entity, childCount);
  const target = Math.max(1, Math.round(recommended * mode.multiplier));
  return {
    mode: mode.id,
    label: mode.label,
    description: mode.description,
    suggested: recommended,
    target,
    min: Math.max(2, Math.floor(recommended * 0.45)),
    max: Math.max(4, Math.ceil(recommended * 2.2))
  };
}

export function buildWorldEnginePlan({ entity = {}, gameMode = "risk", playableChildLevel = null, childCount = 0, density = "recommended" } = {}) {
  const rootLevel = entity.level ?? "world";
  const currentLod = lodForEntityLevel(rootLevel);
  const detailLod = nextLodForEntityLevel(rootLevel);
  const regionDensity = regionDensityConfig(entity, childCount, density);
  return {
    version: "World Engine v1",
    tagline: WORLD_ENGINE_TAGLINE,
    rootEntity: { id: entity.id, name: entity.name ?? "World", level: rootLevel },
    gameMode,
    currentLod,
    detailLod,
    playableChildLevel,
    regionDensity,
    streamingModel: "camera-driven LOD refinement",
    rendererModel: "shared terrain / water / vegetation / border / influence pipeline",
    tacticalModel: "tactical battle is the highest-detail LOD, not a separate map type",
    scaleAssets: currentLod.renderAssets,
    nextScaleAssets: detailLod.renderAssets
  };
}
