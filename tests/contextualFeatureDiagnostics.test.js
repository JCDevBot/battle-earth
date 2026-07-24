import { describe, expect, it } from "vitest";
import { summarizeContextualFeatureBounds } from "../src/app/contextualFeatureDiagnostics.js";

const plan = Object.freeze({
  visualFeatures: Object.freeze({
    mapWidthMeters: 500,
    mapDepthMeters: 400,
  }),
});

describe("contextual feature diagnostics", () => {
  it("summarizes valid and suspicious water polygons", () => {
    const result = summarizeContextualFeatureBounds(plan, {
      water: [
        {
          id: "river-channel",
          bounds: { minX: -90, maxX: 70, minZ: -40, maxZ: 35 },
        },
        {
          feature: { id: "malformed-relation" },
          bounds: { minX: -245, maxX: 245, minZ: -195, maxZ: 195 },
        },
      ],
    });

    expect(result).toMatchObject({
      inspected: 2,
      valid: 1,
      invalid: 1,
      hasSuspiciousGeometry: true,
      byReason: { "suspicious-full-map-coverage": 1 },
    });
    expect(result.invalidEntries[0]).toMatchObject({
      collection: "water",
      index: 1,
      sourceId: "malformed-relation",
      reason: "suspicious-full-map-coverage",
    });
  });

  it("records malformed bounds without throwing", () => {
    const result = summarizeContextualFeatureBounds(plan, {
      water: [{ id: "missing-bounds" }],
    });

    expect(result).toMatchObject({
      inspected: 1,
      invalid: 1,
      byReason: { "invalid-bounds": 1 },
    });
  });

  it("ignores non-array collections and freezes the result", () => {
    const result = summarizeContextualFeatureBounds(plan, {
      water: null,
      vegetation: [],
    });

    expect(result).toMatchObject({
      inspected: 0,
      valid: 0,
      invalid: 0,
      hasSuspiciousGeometry: false,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(Object.isFrozen(result.byReason)).toBe(true);
  });
});
