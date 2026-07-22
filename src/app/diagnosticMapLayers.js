export const DIAGNOSTIC_MAP_LAYER_MODES = Object.freeze({
  ALL: "all",
  TERRAIN_ONLY: "terrain-only",
  WATER_ONLY: "water-only",
  ROADS_ONLY: "roads-only",
  BUILDINGS_ONLY: "buildings-only",
  VEGETATION_ONLY: "vegetation-only",
});

function isWaterFeature(element) {
  const tags = element?.tags ?? {};
  return Boolean(
    tags.natural === "water" ||
      tags.water ||
      tags.waterway ||
      tags.landuse === "reservoir",
  );
}

function isRoadFeature(element) {
  const tags = element?.tags ?? {};
  return Boolean(tags.highway || tags.railway);
}

function isBuildingFeature(element) {
  return Boolean(element?.tags?.building);
}

function isVegetationFeature(element) {
  const tags = element?.tags ?? {};
  return Boolean(
    tags.natural === "tree" ||
      tags.natural === "wood" ||
      tags.natural === "scrub" ||
      tags.natural === "heath" ||
      tags.natural === "wetland" ||
      tags.landuse === "forest" ||
      tags.landuse === "grass" ||
      tags.leisure === "park",
  );
}

function referencedElementIds(elements) {
  const nodeIds = new Set();
  const wayIds = new Set();

  for (const element of elements) {
    for (const nodeId of element?.nodes ?? []) nodeIds.add(nodeId);
    for (const member of element?.members ?? []) {
      if (member?.type === "node") nodeIds.add(member.ref);
      if (member?.type === "way") wayIds.add(member.ref);
    }
  }

  return { nodeIds, wayIds };
}

function retainFeatureFamily(mapData, predicate) {
  const elements = Array.isArray(mapData.elements) ? mapData.elements : [];
  const selectedFeatures = elements.filter(
    (element) =>
      (element?.type === "node" ||
        element?.type === "way" ||
        element?.type === "relation") &&
      predicate(element),
  );
  const references = referencedElementIds(selectedFeatures);
  const referencedWays = elements.filter(
    (element) => element?.type === "way" && references.wayIds.has(element.id),
  );
  const allRetainedFeatures = [...selectedFeatures, ...referencedWays];
  const retainedReferences = referencedElementIds(allRetainedFeatures);
  const retainedIds = new Set(allRetainedFeatures.map((element) => element.id));

  return {
    ...mapData,
    elements: elements.filter(
      (element) =>
        retainedIds.has(element.id) ||
        (element?.type === "node" && retainedReferences.nodeIds.has(element.id)),
    ),
  };
}

/**
 * Restricts fetched map data to a deterministic visual subsystem for manual
 * diagnosis. This is a test-lab aid only; normal gameplay uses the complete
 * source payload.
 */
export function filterMapDataForDiagnosticLayer(
  mapData = {},
  mode = DIAGNOSTIC_MAP_LAYER_MODES.ALL,
) {
  if (mode === DIAGNOSTIC_MAP_LAYER_MODES.ALL) return mapData;

  if (mode === DIAGNOSTIC_MAP_LAYER_MODES.TERRAIN_ONLY) {
    return { ...mapData, elements: [] };
  }

  const predicates = {
    [DIAGNOSTIC_MAP_LAYER_MODES.WATER_ONLY]: isWaterFeature,
    [DIAGNOSTIC_MAP_LAYER_MODES.ROADS_ONLY]: isRoadFeature,
    [DIAGNOSTIC_MAP_LAYER_MODES.BUILDINGS_ONLY]: isBuildingFeature,
    [DIAGNOSTIC_MAP_LAYER_MODES.VEGETATION_ONLY]: isVegetationFeature,
  };
  const predicate = predicates[mode];

  return predicate ? retainFeatureFamily(mapData, predicate) : mapData;
}
