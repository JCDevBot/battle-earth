function removableWaterEntries(diagnostics) {
  return (diagnostics?.invalidEntries ?? [])
    .filter((entry) => entry.collection === "water")
    .filter((entry) =>
      ["outside-render-bounds", "suspicious-full-map-coverage"].includes(
        entry.reason,
      ),
    )
    .sort((a, b) => b.index - a.index);
}

function removeMesh(mesh) {
  if (!mesh) return;
  mesh.parent?.remove?.(mesh);
  mesh.geometry?.dispose?.();
}

/**
 * Removes water polygons that fail contextual render-bound validation.
 *
 * This is deliberately a narrow safety valve for malformed filled water
 * geometry. It does not alter valid rivers, ponds, waterways, or source data.
 * The source feature remains visible in diagnostics so the upstream relation
 * assembly can still be corrected rather than silently forgotten.
 */
export function quarantineSuspiciousWaterFeatures(builder, diagnostics) {
  const waterPolygons = builder?.waterPolygons;
  if (!Array.isArray(waterPolygons)) {
    return Object.freeze({ attempted: 0, removed: 0, sourceIds: Object.freeze([]) });
  }

  const entries = removableWaterEntries(diagnostics);
  const sourceIds = [];
  let removed = 0;

  for (const entry of entries) {
    const polygon = waterPolygons[entry.index];
    if (!polygon) continue;

    const feature = polygon.feature ?? null;
    const mesh = feature?.mesh ?? polygon.mesh ?? null;
    removeMesh(mesh);

    if (Array.isArray(builder.waterMeshes)) {
      builder.waterMeshes = builder.waterMeshes.filter((candidate) => candidate !== mesh);
    }
    if (Array.isArray(builder.waterFeatures)) {
      builder.waterFeatures = builder.waterFeatures.filter(
        (candidate) => candidate !== feature,
      );
    }

    waterPolygons.splice(entry.index, 1);
    sourceIds.push(entry.sourceId ?? feature?.id ?? polygon.id ?? null);
    removed += 1;
  }

  if (removed > 0) builder.applyWaterTerrainInteractions?.();

  return Object.freeze({
    attempted: entries.length,
    removed,
    sourceIds: Object.freeze(sourceIds),
  });
}
