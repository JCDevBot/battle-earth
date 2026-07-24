import { describe, expect, it } from "vitest";
import { inspectContextualVisualBounds } from "../src/app/contextualVisualBounds.js";

const plan = Object.freeze({
  visualFeatures: Object.freeze({
    mapWidthMeters: 500,
    mapDepthMeters: 400,
  }),
});

describe("contextual visual bounds diagnostics", () => {
  it("accepts a normal feature inside the rendered context", () => {
    expect(
      inspectContextualVisualBounds(plan, {
        min: { x: -70, z: -30 },
        max: { x: 90, z: 50 },
      }),
    ).toMatchObject({
      valid: true,
      reason: "within-render-bounds",
      exceedsBounds: false,
      suspiciousCoverage: false,
    });
  });

  it("rejects geometry extending beyond the contextual render bounds", () => {
    expect(
      inspectContextualVisualBounds(plan, {
        minX: -280,
        maxX: 210,
        minZ: -120,
        maxZ: 110,
      }),
    ).toMatchObject({
      valid: false,
      reason: "outside-render-bounds",
      exceedsBounds: true,
    });
  });

  it("flags a single filled polygon covering nearly the entire map", () => {
    const result = inspectContextualVisualBounds(plan, {
      minX: -245,
      maxX: 245,
      minZ: -195,
      maxZ: 195,
    });

    expect(result).toMatchObject({
      valid: false,
      reason: "suspicious-full-map-coverage",
      suspiciousCoverage: true,
    });
    expect(result.areaRatio).toBeCloseTo(0.9555, 4);
  });

  it("allows long linear features with effectively zero filled area", () => {
    expect(
      inspectContextualVisualBounds(plan, {
        minX: -240,
        maxX: 240,
        minZ: 18,
        maxZ: 18,
      }),
    ).toMatchObject({
      valid: true,
      suspiciousCoverage: false,
    });
  });

  it("rejects missing or blank coordinates instead of coercing them to zero", () => {
    for (const missingValue of [null, undefined, ""]) {
      expect(
        inspectContextualVisualBounds(plan, {
          minX: missingValue,
          maxX: 40,
          minZ: -20,
          maxZ: 20,
        }),
      ).toEqual({
        valid: false,
        reason: "invalid-bounds",
      });
    }
  });

  it("rejects missing contextual render dimensions", () => {
    expect(
      inspectContextualVisualBounds(
        {
          visualFeatures: {
            mapWidthMeters: null,
            mapDepthMeters: 400,
          },
        },
        {
          minX: -20,
          maxX: 20,
          minZ: -20,
          maxZ: 20,
        },
      ),
    ).toEqual({
      valid: false,
      reason: "invalid-bounds",
    });
  });

  it("returns a stable invalid result for malformed inputs", () => {
    expect(inspectContextualVisualBounds(plan, { minX: 4 })).toEqual({
      valid: false,
      reason: "invalid-bounds",
    });
    expect(
      Object.isFrozen(inspectContextualVisualBounds(plan, { minX: 4 })),
    ).toBe(true);
  });
});
