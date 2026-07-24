export const DEFAULT_CONTEXT_BUFFER_RATIO = 0.18;
export const DEFAULT_CONTEXT_BUFFER_MIN_METERS = 80;
export const DEFAULT_CONTEXT_BUFFER_MAX_METERS = 240;

function positiveNumber(value, fallback, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${label} must be a finite number greater than zero.`);
  }
  return number;
}

function nonNegativeNumber(value, fallback, label) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${label} must be a finite number greater than or equal to zero.`);
  }
  return number;
}

export function createContextBoundsPlan({
  playableWidthMeters,
  playableDepthMeters,
  bufferRatio = DEFAULT_CONTEXT_BUFFER_RATIO,
  minBufferMeters = DEFAULT_CONTEXT_BUFFER_MIN_METERS,
  maxBufferMeters = DEFAULT_CONTEXT_BUFFER_MAX_METERS,
} = {}) {
  const playableWidth = positiveNumber(
    playableWidthMeters,
    undefined,
    "playableWidthMeters",
  );
  const playableDepth = positiveNumber(
    playableDepthMeters,
    undefined,
    "playableDepthMeters",
  );
  const ratio = nonNegativeNumber(
    bufferRatio,
    DEFAULT_CONTEXT_BUFFER_RATIO,
    "bufferRatio",
  );
  const minimum = nonNegativeNumber(
    minBufferMeters,
    DEFAULT_CONTEXT_BUFFER_MIN_METERS,
    "minBufferMeters",
  );
  const maximum = nonNegativeNumber(
    maxBufferMeters,
    DEFAULT_CONTEXT_BUFFER_MAX_METERS,
    "maxBufferMeters",
  );
  if (maximum < minimum) {
    throw new RangeError("maxBufferMeters must be greater than or equal to minBufferMeters.");
  }

  const widthBuffer = Math.min(
    maximum,
    Math.max(minimum, playableWidth * ratio),
  );
  const depthBuffer = Math.min(
    maximum,
    Math.max(minimum, playableDepth * ratio),
  );

  return {
    playable: {
      widthMeters: playableWidth,
      depthMeters: playableDepth,
      sizeMeters: Math.max(playableWidth, playableDepth),
    },
    rendered: {
      widthMeters: playableWidth + widthBuffer * 2,
      depthMeters: playableDepth + depthBuffer * 2,
      sizeMeters: Math.max(
        playableWidth + widthBuffer * 2,
        playableDepth + depthBuffer * 2,
      ),
    },
    buffer: {
      ratio,
      westMeters: widthBuffer,
      eastMeters: widthBuffer,
      northMeters: depthBuffer,
      southMeters: depthBuffer,
    },
  };
}
