import { describe, expect, it } from "vitest";
import { validateContextualVisualContract } from "../src/app/contextualVisualContract.js";

const contextualDiagnostics = {
  contextualGeneration: "ready",
  playableWidthMeters: "400",
  playableDepthMeters: "300",
  renderWidthMeters: "520",
  renderDepthMeters: "420",
  outerSkirtVisible: "false",
  suspiciousGeometry: "false",
  waterFeaturesInspected: "3",
  waterFeaturesInvalid: "0",
  waterFeaturesQuarantined: "0",
};

describe("contextual visual contract", () => {
  it("accepts a coherent contextual render", () => {
    expect(
      validateContextualVisualContract(
        "replica-battle-water-only",
        contextualDiagnostics,
      ),
    ).toEqual([]);
  });

  it("accepts suspicious water only when every invalid feature was quarantined", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        suspiciousGeometry: "true",
        waterFeaturesInspected: "4",
        waterFeaturesInvalid: "2",
        waterFeaturesQuarantined: "2",
      }),
    ).toEqual([]);
  });

  it("rejects suspicious water left in the rendered scene", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        suspiciousGeometry: "true",
        waterFeaturesInvalid: "2",
        waterFeaturesQuarantined: "1",
      }),
    ).toContain("suspicious water geometry remained unquarantined");
  });

  it("rejects inconsistent geometry diagnostics", () => {
    const errors = validateContextualVisualContract("replica-battle", {
      ...contextualDiagnostics,
      suspiciousGeometry: "false",
      waterFeaturesInspected: "1",
      waterFeaturesInvalid: "2",
      waterFeaturesQuarantined: "3",
    });

    expect(errors).toContain("invalid water feature count exceeded inspected count");
    expect(errors).toContain("quarantined water feature count exceeded invalid count");
    expect(errors).toContain(
      "invalid water geometry was reported without a suspicious flag",
    );
  });

  it("preserves the explicit no-context control contract", () => {
    expect(
      validateContextualVisualContract("replica-battle-no-context", {
        contextualGeneration: "ready",
        playableWidthMeters: "400",
        playableDepthMeters: "300",
        renderWidthMeters: "400",
        renderDepthMeters: "300",
        outerSkirtVisible: "true",
      }),
    ).toEqual([]);
  });
});
