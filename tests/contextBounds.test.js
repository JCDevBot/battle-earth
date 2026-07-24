import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_BUFFER_MAX_METERS,
  DEFAULT_CONTEXT_BUFFER_MIN_METERS,
  createContextBoundsPlan,
} from "../src/map/utils/contextBounds.js";

describe("context bounds planning", () => {
  it("adds a bounded context ring without changing playable dimensions", () => {
    const plan = createContextBoundsPlan({
      playableWidthMeters: 800,
      playableDepthMeters: 1200,
    });

    expect(plan.playable).toEqual({
      widthMeters: 800,
      depthMeters: 1200,
      sizeMeters: 1200,
    });
    expect(plan.rendered.widthMeters).toBeGreaterThan(800);
    expect(plan.rendered.depthMeters).toBeGreaterThan(1200);
    expect(plan.buffer.westMeters).toBe(plan.buffer.eastMeters);
    expect(plan.buffer.northMeters).toBe(plan.buffer.southMeters);
  });

  it("uses the minimum buffer for a small tactical slice", () => {
    const plan = createContextBoundsPlan({
      playableWidthMeters: 350,
      playableDepthMeters: 350,
    });

    expect(plan.buffer.westMeters).toBe(DEFAULT_CONTEXT_BUFFER_MIN_METERS);
    expect(plan.rendered.widthMeters).toBe(510);
    expect(plan.rendered.depthMeters).toBe(510);
  });

  it("caps the buffer for large battlefields", () => {
    const plan = createContextBoundsPlan({
      playableWidthMeters: 5000,
      playableDepthMeters: 7000,
    });

    expect(plan.buffer.westMeters).toBe(DEFAULT_CONTEXT_BUFFER_MAX_METERS);
    expect(plan.buffer.northMeters).toBe(DEFAULT_CONTEXT_BUFFER_MAX_METERS);
  });

  it("supports explicit deterministic tuning", () => {
    const plan = createContextBoundsPlan({
      playableWidthMeters: 500,
      playableDepthMeters: 900,
      bufferRatio: 0.1,
      minBufferMeters: 25,
      maxBufferMeters: 100,
    });

    expect(plan.buffer).toEqual({
      ratio: 0.1,
      westMeters: 50,
      eastMeters: 50,
      northMeters: 90,
      southMeters: 90,
    });
    expect(plan.rendered).toEqual({
      widthMeters: 600,
      depthMeters: 1080,
      sizeMeters: 1080,
    });
  });

  it("rejects invalid dimensions and buffer limits", () => {
    expect(() =>
      createContextBoundsPlan({
        playableWidthMeters: 0,
        playableDepthMeters: 350,
      }),
    ).toThrow(/playableWidthMeters/);

    expect(() =>
      createContextBoundsPlan({
        playableWidthMeters: 350,
        playableDepthMeters: 350,
        minBufferMeters: 100,
        maxBufferMeters: 50,
      }),
    ).toThrow(/maxBufferMeters/);
  });
});
