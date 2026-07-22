export const DIAGNOSTIC_MAP_LAYER_MODES = Object.freeze({
  ALL: "all",
  TERRAIN_ONLY: "terrain-only",
  WATER_ONLY: "water-only",
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

/**
 * Restricts fetched map data to a deterministic visual subsystem for manual
 * diagnosis. This is a test-lab aid only; normal gameplay uses the complete
 * source payload.
 */
export function filterMapDataForDiagnosticLayer(
  mapData = {},
  mode = DIAGNOSTIC_MAP_LAYER_MODES.ALL,
) {
  const elements = Array.isArray(mapData.elements) ? mapData.elements : [];

  if (mode === DIAGNOSTIC_MAP_LAYER_MODES.ALL) return mapData;

  if (mode === DIAGNOSTIC_MAP_LAYER_MODES.TERRAIN_ONLY) {
    return { ...mapData, elements: [] };
  }

  if (mode !== DIAGNOSTIC_MAP_LAYER_MODES.WATER_ONLY) return mapData;

  const waterFeatures = elements.filter(
    (element) =>
      (element?.type === "way" || element?.type === "relation") &&
      isWaterFeature(element),
  );
  const references = referencedElementIds(waterFeatures);
  const referencedWays = elements.filter(
    (element) => element?.type === "way" && references.wayIds.has(element.id),
  );
  const allRetainedFeatures = [...waterFeatures, ...referencedWays];
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
