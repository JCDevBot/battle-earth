import { createContextualGenerationConfig } from "./contextualGenerationConfig.js";

/**
 * Produces the exact argument domains consumed by MapEngine.generateMap.
 *
 * Visual/source systems receive the buffered render dimensions. Tactical
 * systems receive the unchanged playable dimensions. Keeping this mapping
 * pure prevents a later renderer integration from accidentally expanding
 * deployment, navigation, fog, territory, objectives, or camera constraints.
 */
export function createMapEngineGenerationPlan(config = {}) {
  const contextual = createContextualGenerationConfig(config);
  const { render, gameplay, diagnostics } = contextual;

  const renderDimensions = Object.freeze({
    sizeMeters: render.sizeMeters,
    mapWidthMeters: render.mapWidthMeters,
    mapDepthMeters: render.mapDepthMeters,
  });
  const gameplayDimensions = Object.freeze({
    sizeMeters: gameplay.sizeMeters,
    mapWidthMeters: gameplay.mapWidthMeters,
    mapDepthMeters: gameplay.mapDepthMeters,
  });
  const playableAreaSquareMeters =
    gameplay.mapWidthMeters * gameplay.mapDepthMeters;
  const renderedAreaSquareMeters =
    render.mapWidthMeters * render.mapDepthMeters;
  const renderedAreaMultiplier =
    renderedAreaSquareMeters / playableAreaSquareMeters;

  return Object.freeze({
    contextual,
    sourceQuery: Object.freeze({
      bounds: render.sourceQueryBounds,
      profileName: config.osmProfile,
    }),
    terrain: renderDimensions,
    terrainLod: renderDimensions,
    proceduralFallback: Object.freeze({
      lat: config.lat,
      lon: config.lon,
      sizeMeters: render.sizeMeters,
      seed: config.seed,
    }),
    canopy: Object.freeze({
      lat: config.lat,
      lon: config.lon,
      sizeMeters: render.canopySizeMeters,
    }),
    visualFeatures: Object.freeze({
      ...renderDimensions,
      canopySizeMeters: render.canopySizeMeters,
    }),
    strategicPois: gameplayDimensions,
    gameplay: Object.freeze({
      ...gameplayDimensions,
      bounds: gameplay.bounds,
    }),
    boundsManager: Object.freeze({
      sizeMeters: gameplay.sizeMeters,
      showOuterSkirt: render.showOuterSkirt,
    }),
    camera: gameplayDimensions,
    diagnostics: Object.freeze({
      ...diagnostics,
      bufferMetersX: diagnostics.bufferXMeters,
      bufferMetersZ: diagnostics.bufferZMeters,
      playableAreaSquareMeters,
      renderedAreaSquareMeters,
      renderedAreaMultiplier,
      renderedAreaIncreasePercent: (renderedAreaMultiplier - 1) * 100,
    }),
  });
}
