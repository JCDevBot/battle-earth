import { describe, expect, it } from "vitest";
import { beginContextualRuntimeMeasurement } from "../src/app/contextualRuntimeMeasurement.js";

describe("contextual generation runtime measurement", () => {
  it("captures deterministic duration and heap measurements", () => {
    const times = [100, 425];
    const memory = [1000, 1600];
    const measurement = beginContextualRuntimeMeasurement({
      clock: () => times.shift(),
      memoryReader: () => memory.shift(),
    });

    expect(measurement.finish()).toEqual({
      generationDurationMs: 325,
      memoryBeforeBytes: 1000,
      memoryAfterBytes: 1600,
    });
  });

  it("keeps unavailable heap measurements null", () => {
    const times = [25, 75];
    const measurement = beginContextualRuntimeMeasurement({
      clock: () => times.shift(),
      memoryReader: () => undefined,
    });

    expect(measurement.finish()).toEqual({
      generationDurationMs: 50,
      memoryBeforeBytes: null,
      memoryAfterBytes: null,
    });
  });

  it("clamps a backwards clock to zero duration", () => {
    const times = [200, 150];
    const measurement = beginContextualRuntimeMeasurement({
      clock: () => times.shift(),
      memoryReader: () => null,
    });

    expect(measurement.finish().generationDurationMs).toBe(0);
  });

  it("returns frozen measurement objects", () => {
    const measurement = beginContextualRuntimeMeasurement({
      clock: () => 10,
      memoryReader: () => 20,
    });
    const result = measurement.finish();

    expect(Object.isFrozen(measurement)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
