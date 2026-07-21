import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_BUFFER_MAX_METERS,
  DEFAULT_CONTEXT_BUFFER_MIN_METERS,
  createContextualBoundsPlan,
} from "../src/app/contextualBounds.js";

describe("contextual bounds planning", () => {
  it("keeps playable dimensions unchanged while expanding rendered context", () => {
    const plan = createContextualBoundsPlan({
      playableWidthMeters: 800,
      playableDepthMeters: 1200,
    });

    expect(plan.playableWidthMeters).toBe(800);
    expect(plan.playableDepthMeters).toBe(1200);
    expect(plan.bufferXMeters).toBe(144);
    expect(plan.bufferZMeters).toBe(216);
    expect(plan.renderedWidthMeters).toBe(1088);
    expect(plan.renderedDepthMeters).toBe(1632);
    expect(plan.playableBounds).toEqual({
      minX: -400,
      maxX: 400,
      minZ: -600,
      maxZ: 600,
    });
    expect(plan.renderedContextBounds).toEqual({
      minX: -544,
      maxX: 544,
      minZ: -816,
      maxZ: 816,
    });
  });

  it("uses the minimum context buffer for a small test slice", () => {
    const plan = createContextualBoundsPlan({
      playableWidthMeters: 350,
      playableDepthMeters: 350,
    });

    expect(plan.bufferXMeters).toBe(DEFAULT_CONTEXT_BUFFER_MIN_METERS);
    expect(plan.bufferZMeters).toBe(DEFAULT_CONTEXT_BUFFER_MIN_METERS);
    expect(plan.renderedWidthMeters).toBe(470);
    expect(plan.renderedDepthMeters).toBe(470);
  });

  it("caps context growth on large tactical maps", () => {
    const plan = createContextualBoundsPlan({
      playableWidthMeters: 5000,
      playableDepthMeters: 4000,
    });

    expect(plan.bufferXMeters).toBe(DEFAULT_CONTEXT_BUFFER_MAX_METERS);
    expect(plan.bufferZMeters).toBe(DEFAULT_CONTEXT_BUFFER_MAX_METERS);
  });

  it("accepts a deterministic custom buffer policy", () => {
    const plan = createContextualBoundsPlan({
      playableWidthMeters: 600,
      playableDepthMeters: 900,
      bufferRatio: 0.25,
      minBufferMeters: 40,
      maxBufferMeters: 180,
    });

    expect(plan.bufferXMeters).toBe(150);
    expect(plan.bufferZMeters).toBe(180);
  });

  it("rejects invalid dimensions and buffer policies", () => {
    expect(() =>
      createContextualBoundsPlan({
        playableWidthMeters: 0,
        playableDepthMeters: 350,
      }),
    ).toThrow("playableWidthMeters");

    expect(() =>
      createContextualBoundsPlan({
        playableWidthMeters: 350,
        playableDepthMeters: 350,
        minBufferMeters: 100,
        maxBufferMeters: 50,
      }),
    ).toThrow("maxBufferMeters");
  });
});
