function readString(dataset, key, fallbackKey = null) {
  const value = dataset?.[key] ?? (fallbackKey ? dataset?.[fallbackKey] : undefined);
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Normalizes the canvas dataset exposed by contextual map generation into the
 * stable field names consumed by the visual-contract validator and browser
 * artifact reporting.
 *
 * The renderer intentionally prefixes feature-specific diagnostics with
 * `contextual*` to avoid collisions on the canvas element. The validator uses
 * shorter domain names. Keeping that translation in one pure helper prevents
 * browser checks from silently reading the wrong dataset keys.
 */
export function collectContextualVisualDiagnostics(dataset = {}) {
  return Object.freeze({
    contextualGeneration: readString(dataset, "contextualGeneration"),
    playableWidthMeters: readString(dataset, "playableWidthMeters"),
    playableDepthMeters: readString(dataset, "playableDepthMeters"),
    renderWidthMeters: readString(dataset, "renderWidthMeters"),
    renderDepthMeters: readString(dataset, "renderDepthMeters"),
    outerSkirtVisible: readString(dataset, "outerSkirtVisible"),
    suspiciousGeometry: readString(
      dataset,
      "contextualSuspiciousGeometry",
      "suspiciousGeometry",
    ),
    waterFeaturesInspected: readString(
      dataset,
      "contextualWaterFeaturesInspected",
      "waterFeaturesInspected",
    ),
    waterFeaturesInvalid: readString(
      dataset,
      "contextualWaterFeaturesInvalid",
      "waterFeaturesInvalid",
    ),
    waterFeaturesQuarantined: readString(
      dataset,
      "contextualWaterFeaturesQuarantined",
      "waterFeaturesQuarantined",
    ),
  });
}
