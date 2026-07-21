import { createContextualBoundsPlan } from "./contextualBounds.js";
import { boundsFromCenter } from "../map/utils/geo.js";

function finiteCoordinate(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new TypeError(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

/**
 * Creates one immutable plan for generating a larger visual context while
 * preserving the original tactical play area.
 *
 * Map rendering and source queries use rendered dimensions. Gameplay systems
 * continue to use playable dimensions and bounds.
 */
export function createContextualMapPlan({
  lat,
  lon,
  mapWidthMeters,
  mapDepthMeters,
  bufferRatio,
  minBufferMeters,
  maxBufferMeters,
} = {}) {
  const centerLat = finiteCoordinate(lat, -90, 90, "lat");
  const centerLon = finiteCoordinate(lon, -180, 180, "lon");
  const dimensions = createContextualBoundsPlan({
    playableWidthMeters: mapWidthMeters,
    playableDepthMeters: mapDepthMeters,
    bufferRatio,
    minBufferMeters,
    maxBufferMeters,
  });
  const renderedSizeMeters = Math.max(
    dimensions.renderedWidthMeters,
    dimensions.renderedDepthMeters,
  );

  return Object.freeze({
    center: Object.freeze({ lat: centerLat, lon: centerLon }),
    ...dimensions,
    playableSizeMeters: Math.max(
      dimensions.playableWidthMeters,
      dimensions.playableDepthMeters,
    ),
    renderedSizeMeters,
    sourceQueryBounds: Object.freeze(
      boundsFromCenter(
        centerLat,
        centerLon,
        renderedSizeMeters,
        dimensions.renderedWidthMeters,
        dimensions.renderedDepthMeters,
      ),
    ),
  });
}
