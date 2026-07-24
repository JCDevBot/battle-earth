function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function readNow(clock) {
  if (typeof clock === "function") {
    return finiteNonNegative(clock());
  }

  if (typeof globalThis.performance?.now === "function") {
    return finiteNonNegative(globalThis.performance.now());
  }

  return finiteNonNegative(Date.now());
}

function readHeapBytes(memoryReader) {
  if (typeof memoryReader === "function") {
    return finiteNonNegative(memoryReader());
  }

  return finiteNonNegative(globalThis.performance?.memory?.usedJSHeapSize);
}

/**
 * Captures optional browser runtime measurements without coupling the pure
 * contextual diagnostics contract to browser-only APIs. Unsupported memory
 * measurements remain null rather than being estimated.
 */
export function beginContextualRuntimeMeasurement(options = {}) {
  const startedAtMs = readNow(options.clock);
  const memoryBeforeBytes = readHeapBytes(options.memoryReader);

  return Object.freeze({
    finish() {
      const finishedAtMs = readNow(options.clock);
      const generationDurationMs =
        startedAtMs === null || finishedAtMs === null
          ? null
          : Math.max(0, finishedAtMs - startedAtMs);

      return Object.freeze({
        generationDurationMs,
        memoryBeforeBytes,
        memoryAfterBytes: readHeapBytes(options.memoryReader),
      });
    },
  });
}
