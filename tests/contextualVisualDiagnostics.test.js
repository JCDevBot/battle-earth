import { describe, expect, it } from "vitest";
import { collectContextualVisualDiagnostics } from "../src/app/contextualVisualDiagnostics.js";

describe("contextual visual diagnostics", () => {
  it("maps renderer-prefixed canvas dataset fields to the validator contract", () => {
    expect(
      collectContextualVisualDiagnostics({
        contextualGeneration: "ready",
        playableWidthMeters: "400",
        playableDepthMeters: "300",
        renderWidthMeters: "520",
        renderDepthMeters: "420",
        outerSkirtVisible: "false",
        contextualSuspiciousGeometry: "true",
        contextualWaterFeaturesInspected: "4",
        contextualWaterFeaturesInvalid: "2",
        contextualWaterFeaturesQuarantined: "2",
      }),
    ).toEqual({
      contextualGeneration: "ready",
      playableWidthMeters: "400",
      playableDepthMeters: "300",
      renderWidthMeters: "520",
      renderDepthMeters: "420",
      outerSkirtVisible: "false",
      suspiciousGeometry: "true",
      waterFeaturesInspected: "4",
      waterFeaturesInvalid: "2",
      waterFeaturesQuarantined: "2",
    });
  });

  it("retains compatibility with already-normalized artifact fields", () => {
    const diagnostics = collectContextualVisualDiagnostics({
      suspiciousGeometry: false,
      waterFeaturesInspected: 3,
      waterFeaturesInvalid: 0,
      waterFeaturesQuarantined: 0,
    });

    expect(diagnostics.suspiciousGeometry).toBe("false");
    expect(diagnostics.waterFeaturesInspected).toBe("3");
    expect(diagnostics.waterFeaturesInvalid).toBe("0");
    expect(diagnostics.waterFeaturesQuarantined).toBe("0");
  });

  it("returns explicit empty strings for unavailable fields", () => {
    expect(collectContextualVisualDiagnostics()).toEqual({
      contextualGeneration: "",
      playableWidthMeters: "",
      playableDepthMeters: "",
      renderWidthMeters: "",
      renderDepthMeters: "",
      outerSkirtVisible: "",
      suspiciousGeometry: "",
      waterFeaturesInspected: "",
      waterFeaturesInvalid: "",
      waterFeaturesQuarantined: "",
    });
  });

  it("freezes the normalized result", () => {
    expect(Object.isFrozen(collectContextualVisualDiagnostics())).toBe(true);
  });
});
