import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const INSTALL_MARKER = Symbol.for(
  "battle-earth.compatible-geometry-merge-installed",
);

function compatibleAttributeNames(geometries) {
  const [first, ...rest] = geometries;
  const compatible = new Set(Object.keys(first.attributes ?? {}));

  for (const name of compatible) {
    const reference = first.getAttribute?.(name);
    const matches =
      reference &&
      rest.every((geometry) => {
        const candidate = geometry.getAttribute?.(name);
        return (
          candidate &&
          candidate.itemSize === reference.itemSize &&
          candidate.normalized === reference.normalized &&
          candidate.array?.constructor === reference.array?.constructor
        );
      });
    if (!matches) compatible.delete(name);
  }

  return compatible;
}

export function mergeCompatibleGeometries(geometries = []) {
  const candidates = geometries.filter(
    (geometry) => geometry?.isBufferGeometry && geometry.getAttribute("position"),
  );
  if (!candidates.length) return null;

  const compatible = compatibleAttributeNames(candidates);
  if (!compatible.has("position")) return null;

  const normalized = candidates.map((geometry) => {
    const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(copy.attributes ?? {})) {
      if (!compatible.has(name)) copy.deleteAttribute(name);
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

function installOnTarget(target) {
  if (!target || target[INSTALL_MARKER]) return false;

  Object.defineProperty(target, INSTALL_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  target.safeMergeGeometries = mergeCompatibleGeometries;
  return true;
}

export function installCompatibleGeometryMerge(builder) {
  if (!builder) return false;

  return [builder, builder.buildingLOD, builder.vegetationLOD].reduce(
    (installed, target) => installOnTarget(target) || installed,
    false,
  );
}
