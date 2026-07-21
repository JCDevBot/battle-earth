import { createContextualMapPlan } from "./contextualMapPlan.js";

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

  const plan = createContextualMapPlan({
    lat: config.lat,
    lon: config.lon,
    mapWidthMeters,
    mapDepthMeters,
    bufferRatio: config.contextBufferRatio,
    minBufferMeters: config.contextMinBufferMeters,
    maxBufferMeters: config.contextMaxBufferMeters,
  });

  return Object.freeze({
    plan,
    render: Object.freeze({
      sizeMeters: plan.renderedSizeMeters,
      mapWidthMeters: plan.renderedWidthMeters,
      mapDepthMeters: plan.renderedDepthMeters,
      sourceQueryBounds: plan.sourceQueryBounds,
      canopySizeMeters: plan.renderedSizeMeters,
      showOuterSkirt: false,
    }),
    gameplay: Object.freeze({
      sizeMeters: plan.playableSizeMeters,
      mapWidthMeters: plan.playableWidthMeters,
      mapDepthMeters: plan.playableDepthMeters,
      bounds: plan.playableBounds,
    }),
    diagnostics: Object.freeze({
      contextEnabled: true,
      bufferXMeters: plan.bufferXMeters,
      bufferZMeters: plan.bufferZMeters,
      renderedAreaRatio:
        (plan.renderedWidthMeters * plan.renderedDepthMeters) /
        (plan.playableWidthMeters * plan.playableDepthMeters),
    }),
  });
}
