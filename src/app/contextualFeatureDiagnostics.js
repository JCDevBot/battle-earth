import { inspectContextualVisualBounds } from "./contextualVisualBounds.js";

function featureBounds(feature) {
  return feature?.bounds ?? feature?.feature?.bounds ?? feature?.userData?.bounds ?? null;
}

function frozenEntries(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

/**
 * Inspects source-backed filled features before they are accepted as visually
 * coherent contextual geometry. The first use is water polygons because a
 * malformed open relation can otherwise close across most of the map and look
 * like an artificial rectangular slab.
 */
export function summarizeContextualFeatureBounds(
  plan,
  collections = {},
  options = {},
) {
  const entries = [];

  for (const [collectionName, features] of Object.entries(collections)) {
    if (!Array.isArray(features)) continue;

    features.forEach((feature, index) => {
      const inspection = inspectContextualVisualBounds(
        plan,
        featureBounds(feature),
        options,
      );
      entries.push({
        collection: collectionName,
        index,
        sourceId: feature?.feature?.id ?? feature?.id ?? null,
        source: feature?.source ?? feature?.feature?.source ?? null,
        ...inspection,
      });
    });
  }

  const invalid = entries.filter((entry) => !entry.valid);
  const byReason = {};
  for (const entry of invalid) {
    byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
  }

  return Object.freeze({
    inspected: entries.length,
    valid: entries.length - invalid.length,
    invalid: invalid.length,
    hasSuspiciousGeometry: invalid.length > 0,
    byReason: Object.freeze(byReason),
    entries: frozenEntries(entries),
    invalidEntries: frozenEntries(invalid),
  });
}
