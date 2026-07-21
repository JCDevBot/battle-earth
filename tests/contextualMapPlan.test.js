import { describe, expect, it } from "vitest";
import { createContextualMapPlan } from "../src/app/contextualMapPlan.js";

describe("contextual map generation plan", () => {
  it("expands render and source-query dimensions without changing playable bounds", () => {
    const plan = createContextualMapPlan({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      bufferRatio: 0.18,
      minBufferMeters: 60,
      maxBufferMeters: 250,
    });

    expect(plan.playableWidthMeters).toBe(800);
    expect(plan.playableDepthMeters).toBe(1200);
    expect(plan.playableBounds).toEqual({
      minX: -400,
      maxX: 400,
      minZ: -600,
      maxZ: 600,
    });
    expect(plan.renderedWidthMeters).toBe(1088);
    expect(plan.renderedDepthMeters).toBe(1632);
    expect(plan.renderedSizeMeters).toBe(1632);
    expect(plan.sourceQueryBounds.north).toBeGreaterThan(44.9362);
    expect(plan.sourceQueryBounds.south).toBeLessThan(44.9362);
    expect(plan.sourceQueryBounds.east).toBeGreaterThan(-93.0977);
    expect(plan.sourceQueryBounds.west).toBeLessThan(-93.0977);
  });

  it("is deterministic for the same explicit inputs", () => {
    const input = {
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 350,
      mapDepthMeters: 350,
    };

    expect(createContextualMapPlan(input)).toEqual(
      createContextualMapPlan(input),
    );
  });

  it("rejects invalid geographic centers", () => {
    expect(() =>
      createContextualMapPlan({
        lat: 91,
        lon: -93.0977,
        mapWidthMeters: 350,
        mapDepthMeters: 350,
      }),
    ).toThrow("lat must be between -90 and 90");
  });
});
