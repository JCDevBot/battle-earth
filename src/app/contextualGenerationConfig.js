import { createContextualMapPlan } from "./contextualMapPlan.js";
import { boundsFromCenter } from "../map/utils/geo.js";

function createUnbufferedMapPlan({ lat, lon, mapWidthMeters, mapDepthMeters }) {
  const playableSizeMeters = Math.max(mapWidthMeters, mapDepthMeters);
  const playableBounds = Object.freeze({
    minX: -mapWidthMeters / 2,
    maxX: mapWidthMeters / 2,
    minZ: -mapDepthMeters / 2,
    maxZ: mapDepthMeters / 2,
  });

  return Object.freeze({
    center: Object.freeze({ lat: Number(lat), lon: Number(lon) }),
    playableWidthMeters: mapWidthMeters,
    playableDepthMeters: mapDepthMeters,
    renderedWidthMeters: mapWidthMeters,
    renderedDepthMeters: mapDepthMeters,
    bufferXMeters: 0,
    bufferZMeters: 0,
    playableBounds,
    renderedContextBounds: playableBounds,
    playableSizeMeters,
    renderedSizeMeters: playableSizeMeters,
    sourceQueryBounds: Object.freeze(
      boundsFromCenter(
        Number(lat),
        Number(lon),
        playableSizeMeters,
        mapWidthMeters,
        mapDepthMeters,
      ),
    ),
  });
}

/**
 * Converts the tactical map request into two explicit configuration domains:
 *
 * - render: source queries and visual feature generation
 * - gameplay: navigation, fog, objectives, territory, deployment, and bounds
 *
 * Keeping this transformation pure makes the playable/context separation
 * deterministic and testable before the renderer consumes it.
 */
export function createContextualGenerationConfig(config = {}) {
  const mapWidthMeters =
    Number(config.mapWidthMeters) || Number(config.sizeMeters) || 1000;
  const mapDepthMeters =
    Number(config.mapDepthMeters) || Number(config.sizeMeters) || mapWidthMeters;
  const contextEnabled = config.contextEnabled !== false;

  const plan = contextEnabled
    ? createContextualMapPlan({
        lat: config.lat,
        lon: config.lon,
        mapWidthMeters,
        mapDepthMeters,
        bufferRatio: config.contextBufferRatio,
        minBufferMeters: config.contextMinBufferMeters,
        maxBufferMeters: config.contextMaxBufferMeters,
      })
    : createUnbufferedMapPlan({
        lat: config.lat,
        lon: config.lon,
        mapWidthMeters,
        mapDepthMeters,
      });

  return Object.freeze({
    plan,
    render: Object.freeze({
      sizeMeters: plan.renderedSizeMeters,
      mapWidthMeters: plan.renderedWidthMeters,
      mapDepthMeters: plan.renderedDepthMeters,
      sourceQueryBounds: plan.sourceQueryBounds,
      canopySizeMeters: plan.renderedSizeMeters,
      showOuterSkirt: !contextEnabled,
    }),
    gameplay: Object.freeze({
      sizeMeters: plan.playableSizeMeters,
      mapWidthMeters: plan.playableWidthMeters,
      mapDepthMeters: plan.playableDepthMeters,
      bounds: plan.playableBounds,
    }),
    diagnostics: Object.freeze({
      contextEnabled,
      bufferXMeters: plan.bufferXMeters,
      bufferZMeters: plan.bufferZMeters,
      renderedAreaRatio:
        (plan.renderedWidthMeters * plan.renderedDepthMeters) /
        (plan.playableWidthMeters * plan.playableDepthMeters),
    }),
  });
}
