import { describe, expect, it } from "vitest";
import { createContextualGenerationConfig } from "../src/app/contextualGenerationConfig.js";

describe("contextual generation configuration", () => {
  it("separates rendered context from unchanged gameplay dimensions", () => {
    const config = createContextualGenerationConfig({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      contextBufferRatio: 0.18,
      contextMinBufferMeters: 60,
      contextMaxBufferMeters: 250,
    });

    expect(config.gameplay).toEqual({
      sizeMeters: 1200,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      bounds: {
        minX: -400,
        maxX: 400,
        minZ: -600,
        maxZ: 600,
      },
    });
    expect(config.render.mapWidthMeters).toBe(1088);
    expect(config.render.mapDepthMeters).toBe(1632);
    expect(config.render.sizeMeters).toBe(1632);
    expect(config.render.canopySizeMeters).toBe(1632);
    expect(config.render.showOuterSkirt).toBe(false);
    expect(config.diagnostics.contextEnabled).toBe(true);
    expect(config.diagnostics.bufferXMeters).toBe(144);
    expect(config.diagnostics.bufferZMeters).toBe(216);
    expect(config.diagnostics.renderedAreaRatio).toBeGreaterThan(1);
  });

  it("supports a deterministic overscan-off comparison without expanding gameplay", () => {
    const config = createContextualGenerationConfig({
      lat: 44.9537,
      lon: -93.09,
      mapWidthMeters: 350,
      mapDepthMeters: 350,
      contextEnabled: false,
    });

    expect(config.render).toEqual({
      sizeMeters: 350,
      mapWidthMeters: 350,
      mapDepthMeters: 350,
      sourceQueryBounds: config.plan.sourceQueryBounds,
      canopySizeMeters: 350,
      showOuterSkirt: true,
    });
    expect(config.gameplay.mapWidthMeters).toBe(350);
    expect(config.gameplay.mapDepthMeters).toBe(350);
    expect(config.diagnostics).toEqual({
      contextEnabled: false,
      bufferXMeters: 0,
      bufferZMeters: 0,
      renderedAreaRatio: 1,
    });
  });

  it("uses tactical size as the fallback for both playable dimensions", () => {
    const config = createContextualGenerationConfig({
      lat: 44.9537,
      lon: -93.09,
      sizeMeters: 350,
    });

    expect(config.gameplay.mapWidthMeters).toBe(350);
    expect(config.gameplay.mapDepthMeters).toBe(350);
    expect(config.render.mapWidthMeters).toBeGreaterThan(350);
    expect(config.render.mapDepthMeters).toBeGreaterThan(350);
  });

  it("is deterministic and returns frozen top-level domains", () => {
    const input = {
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 350,
      mapDepthMeters: 350,
    };
    const first = createContextualGenerationConfig(input);
    const second = createContextualGenerationConfig(input);

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.render)).toBe(true);
    expect(Object.isFrozen(first.gameplay)).toBe(true);
    expect(Object.isFrozen(first.diagnostics)).toBe(true);
  });
});
