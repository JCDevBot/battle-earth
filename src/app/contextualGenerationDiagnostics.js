function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/**
 * Combines the deterministic contextual generation plan with optional runtime
 * measurements. The result is safe to expose through diagnostics callbacks and
 * keeps measured values distinct from plan-derived estimates.
 */
export function createContextualGenerationDiagnostics(
  generationPlan,
  measurements = {},
) {
  if (!generationPlan?.diagnostics) {
    throw new TypeError("A contextual MapEngine generation plan is required.");
  }

  const diagnostics = generationPlan.diagnostics;
  const generationDurationMs = finiteNonNegative(
    measurements.generationDurationMs,
  );
  const memoryBeforeBytes = finiteNonNegative(measurements.memoryBeforeBytes);
  const memoryAfterBytes = finiteNonNegative(measurements.memoryAfterBytes);
  const memoryDeltaBytes =
    memoryBeforeBytes === null || memoryAfterBytes === null
      ? null
      : memoryAfterBytes - memoryBeforeBytes;

  return Object.freeze({
    enabled: true,
    bufferMetersX: diagnostics.bufferMetersX,
    bufferMetersZ: diagnostics.bufferMetersZ,
    playableWidthMeters: generationPlan.gameplay.mapWidthMeters,
    playableDepthMeters: generationPlan.gameplay.mapDepthMeters,
    renderedWidthMeters: generationPlan.visualFeatures.mapWidthMeters,
    renderedDepthMeters: generationPlan.visualFeatures.mapDepthMeters,
    playableAreaSquareMeters: diagnostics.playableAreaSquareMeters,
    renderedAreaSquareMeters: diagnostics.renderedAreaSquareMeters,
    renderedAreaMultiplier: diagnostics.renderedAreaMultiplier,
    renderedAreaIncreasePercent: diagnostics.renderedAreaIncreasePercent,
    generationDurationMs,
    memoryBeforeBytes,
    memoryAfterBytes,
    memoryDeltaBytes,
    measurementsAvailable:
      generationDurationMs !== null || memoryDeltaBytes !== null,
  });
}
