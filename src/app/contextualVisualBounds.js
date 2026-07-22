function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedBounds(bounds) {
  const minX = finiteNumber(bounds?.minX ?? bounds?.min?.x);
  const maxX = finiteNumber(bounds?.maxX ?? bounds?.max?.x);
  const minZ = finiteNumber(bounds?.minZ ?? bounds?.min?.z);
  const maxZ = finiteNumber(bounds?.maxZ ?? bounds?.max?.z);

  if ([minX, maxX, minZ, maxZ].some((value) => value === null)) return null;
  if (maxX < minX || maxZ < minZ) return null;

  return Object.freeze({ minX, maxX, minZ, maxZ });
}

function expectedRenderBounds(plan) {
  const width = finiteNumber(plan?.visualFeatures?.mapWidthMeters);
  const depth = finiteNumber(plan?.visualFeatures?.mapDepthMeters);
  if (!(width > 0) || !(depth > 0)) return null;

  return Object.freeze({
    minX: -width / 2,
    maxX: width / 2,
    minZ: -depth / 2,
    maxZ: depth / 2,
  });
}

export function inspectContextualVisualBounds(
  plan,
  featureBounds,
  { toleranceMeters = 8, maximumAreaRatio = 0.9 } = {},
) {
  const expected = expectedRenderBounds(plan);
  const actual = normalizedBounds(featureBounds);
  if (!expected || !actual) {
    return Object.freeze({ valid: false, reason: "invalid-bounds" });
  }

  const tolerance = Math.max(0, finiteNumber(toleranceMeters) ?? 0);
  const expectedWidth = expected.maxX - expected.minX;
  const expectedDepth = expected.maxZ - expected.minZ;
  const actualWidth = actual.maxX - actual.minX;
  const actualDepth = actual.maxZ - actual.minZ;
  const expectedArea = expectedWidth * expectedDepth;
  const actualArea = actualWidth * actualDepth;
  const areaRatio = expectedArea > 0 ? actualArea / expectedArea : Infinity;
  const exceedsBounds =
    actual.minX < expected.minX - tolerance ||
    actual.maxX > expected.maxX + tolerance ||
    actual.minZ < expected.minZ - tolerance ||
    actual.maxZ > expected.maxZ + tolerance;
  const suspiciousCoverage =
    actualWidth > 0 &&
    actualDepth > 0 &&
    areaRatio >= Math.max(0, finiteNumber(maximumAreaRatio) ?? 0.9);

  return Object.freeze({
    valid: !exceedsBounds && !suspiciousCoverage,
    reason: exceedsBounds
      ? "outside-render-bounds"
      : suspiciousCoverage
        ? "suspicious-full-map-coverage"
        : "within-render-bounds",
    expected,
    actual,
    actualWidth,
    actualDepth,
    areaRatio,
    exceedsBounds,
    suspiciousCoverage,
  });
}
