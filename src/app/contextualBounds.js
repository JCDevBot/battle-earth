export const DEFAULT_CONTEXT_BUFFER_RATIO = 0.18;
export const DEFAULT_CONTEXT_BUFFER_MIN_METERS = 60;
export const DEFAULT_CONTEXT_BUFFER_MAX_METERS = 250;

function finitePositive(value, fallback, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
  return number;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Produces distinct gameplay and render dimensions for a tactical battlefield.
 * The context ring expands every side while leaving the playable rectangle unchanged.
 */
export function createContextualBoundsPlan({
  playableWidthMeters,
  playableDepthMeters,
  bufferRatio = DEFAULT_CONTEXT_BUFFER_RATIO,
  minBufferMeters = DEFAULT_CONTEXT_BUFFER_MIN_METERS,
  maxBufferMeters = DEFAULT_CONTEXT_BUFFER_MAX_METERS,
} = {}) {
  const playableWidth = finitePositive(
    playableWidthMeters,
    undefined,
    "playableWidthMeters",
  );
  const playableDepth = finitePositive(
    playableDepthMeters,
    undefined,
    "playableDepthMeters",
  );
  const ratio = finitePositive(
    bufferRatio,
    DEFAULT_CONTEXT_BUFFER_RATIO,
    "bufferRatio",
  );
  const minimum = finitePositive(
    minBufferMeters,
    DEFAULT_CONTEXT_BUFFER_MIN_METERS,
    "minBufferMeters",
  );
  const maximum = finitePositive(
    maxBufferMeters,
    DEFAULT_CONTEXT_BUFFER_MAX_METERS,
    "maxBufferMeters",
  );

  if (maximum < minimum) {
    throw new TypeError("maxBufferMeters must be greater than or equal to minBufferMeters");
  }

  const bufferXMeters = clamp(playableWidth * ratio, minimum, maximum);
  const bufferZMeters = clamp(playableDepth * ratio, minimum, maximum);
  const renderedWidthMeters = playableWidth + bufferXMeters * 2;
  const renderedDepthMeters = playableDepth + bufferZMeters * 2;

  return {
    playableWidthMeters: playableWidth,
    playableDepthMeters: playableDepth,
    renderedWidthMeters,
    renderedDepthMeters,
    bufferXMeters,
    bufferZMeters,
    playableBounds: {
      minX: -playableWidth / 2,
      maxX: playableWidth / 2,
      minZ: -playableDepth / 2,
      maxZ: playableDepth / 2,
    },
    renderedContextBounds: {
      minX: -renderedWidthMeters / 2,
      maxX: renderedWidthMeters / 2,
      minZ: -renderedDepthMeters / 2,
      maxZ: renderedDepthMeters / 2,
    },
  };
}
