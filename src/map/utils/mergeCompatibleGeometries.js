import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function normalizeGeometry(geometry) {
  const normalized = geometry.index
    ? geometry.toNonIndexed()
    : geometry.clone();

  if (!normalized.getAttribute("normal")) {
    normalized.computeVertexNormals();
  }

  normalized.morphAttributes = {};
  return normalized;
}

function compatibleAttributeNames(geometries) {
  const [first, ...rest] = geometries;
  const names = Object.keys(first.attributes);

  return names.filter((name) => {
    const reference = first.getAttribute(name);
    return rest.every((geometry) => {
      const candidate = geometry.getAttribute(name);
      return (
        candidate &&
        candidate.itemSize === reference.itemSize &&
        candidate.normalized === reference.normalized &&
        candidate.array.constructor === reference.array.constructor
      );
    });
  });
}

/**
 * Merges generated visual geometry without allowing optional attributes such as
 * UVs or colors on only some inputs to invalidate the entire batch.
 *
 * Inputs are cloned before normalization, so source geometry remains unchanged.
 */
export function mergeCompatibleGeometries(geometries) {
  const normalized = geometries.filter(Boolean).map(normalizeGeometry);
  if (!normalized.length) return null;

  const retainedAttributes = new Set(compatibleAttributeNames(normalized));
  if (!retainedAttributes.has("position")) return null;

  for (const geometry of normalized) {
    for (const attributeName of Object.keys(geometry.attributes)) {
      if (!retainedAttributes.has(attributeName)) {
        geometry.deleteAttribute(attributeName);
      }
    }
  }

  return mergeGeometries(normalized, false);
}
