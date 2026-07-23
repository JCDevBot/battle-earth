import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const INSTALL_MARKER = Symbol.for(
  "battle-earth.compatible-geometry-merge-installed",
);

function sharedAttributeNames(geometries) {
  const [first, ...rest] = geometries;
  const shared = new Set(Object.keys(first.attributes ?? {}));

  for (const geometry of rest) {
    for (const name of shared) {
      if (!geometry.getAttribute?.(name)) shared.delete(name);
    }
  }

  return shared;
}

export function mergeCompatibleGeometries(geometries = []) {
  const candidates = geometries.filter(
    (geometry) => geometry?.isBufferGeometry && geometry.getAttribute("position"),
  );
  if (!candidates.length) return null;

  const shared = sharedAttributeNames(candidates);
  if (!shared.has("position")) return null;

  const normalized = candidates.map((geometry) => {
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(copy.attributes ?? {})) {
      if (!shared.has(name)) copy.deleteAttribute(name);
    }
    copy.morphAttributes = {};
    copy.morphTargetsRelative = false;
    return copy;
  });

  try {
    return mergeGeometries(normalized, false);
  } finally {
    normalized.forEach((geometry) => geometry.dispose());
  }
}

export function installCompatibleGeometryMerge(builder) {
  if (!builder || builder[INSTALL_MARKER]) return false;

  Object.defineProperty(builder, INSTALL_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  builder.safeMergeGeometries = mergeCompatibleGeometries;
  return true;
}
