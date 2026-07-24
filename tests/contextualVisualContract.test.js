import { describe, expect, it } from "vitest";
import { validateContextualVisualContract } from "../src/app/contextualVisualContract.js";

const contextualDiagnostics = {
  contextualGeneration: "ready",
  playableWidthMeters: "400",
  playableDepthMeters: "300",
  renderWidthMeters: "520",
  renderDepthMeters: "420",
  renderedAreaMultiplier: "1.82",
  renderedAreaIncreasePercent: "82",
  outerSkirtVisible: "false",
  suspiciousGeometry: "false",
  waterFeaturesInspected: "3",
  waterFeaturesInvalid: "0",
  waterFeaturesQuarantined: "0",
};

const noContextDiagnostics = {
  ...contextualDiagnostics,
  renderWidthMeters: "400",
  renderDepthMeters: "300",
  renderedAreaMultiplier: "1",
  renderedAreaIncreasePercent: "0",
  outerSkirtVisible: "true",
};

const contextualScenarioIds = [
  "replica-battle",
  "replica-battle-terrain-only",
  "replica-battle-water-only",
  "replica-battle-roads-only",
  "replica-battle-buildings-only",
  "replica-battle-vegetation-only",
];

describe("contextual visual contract", () => {
  it("accepts every registered contextual replica route", () => {
    for (const scenario of contextualScenarioIds) {
      expect(
        validateContextualVisualContract(scenario, contextualDiagnostics),
      ).toEqual([]);
    }
  });

  it("rejects scenarios outside the contextual visual gate", () => {
    expect(
      validateContextualVisualContract("prototype-smoke", contextualDiagnostics),
    ).toEqual(["scenario is not part of the contextual visual gate"]);
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

  it("rejects invalid water left in the rendered scene", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        suspiciousGeometry: "true",
        waterFeaturesInvalid: "2",
        waterFeaturesQuarantined: "1",
      }),
    ).toContain("invalid water geometry remained unquarantined");
  });

  it("rejects inconsistent geometry diagnostics", () => {
    const errors = validateContextualVisualContract("replica-battle", {
      ...contextualDiagnostics,
      suspiciousGeometry: "false",
      waterFeaturesInspected: "1",
      waterFeaturesInvalid: "2",
      waterFeaturesQuarantined: "3",
    });

    expect(errors).toContain(
      "invalid water feature count exceeded inspected count",
    );
    expect(errors).toContain(
      "quarantined water feature count exceeded invalid count",
    );
    expect(errors).toContain(
      "invalid water geometry was reported without a suspicious flag",
    );
  });

  it("rejects fractional or negative water geometry counts", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        waterFeaturesInspected: "2.5",
        waterFeaturesInvalid: "-1",
      }),
    ).toContain("water geometry counts must be non-negative integers");
  });

  it("requires the suspicious flag to agree with invalid geometry", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        suspiciousGeometry: "true",
      }),
    ).toContain("suspicious water flag was set without invalid geometry");

    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        suspiciousGeometry: "",
      }),
    ).toContain("suspicious water geometry flag was unavailable");
  });

  it("rejects zero or negative contextual map dimensions", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        playableWidthMeters: "0",
      }),
    ).toContain("map dimensions must be positive finite values");

    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        renderDepthMeters: "-420",
      }),
    ).toContain("map dimensions must be positive finite values");
  });

  it("requires area diagnostics to agree with the exposed dimensions", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        renderedAreaMultiplier: "1.4",
      }),
    ).toContain("rendered area multiplier did not match map dimensions");

    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        renderedAreaIncreasePercent: "40",
      }),
    ).toContain("rendered area increase did not match map dimensions");
  });

  it("requires available, non-negative area diagnostics", () => {
    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        renderedAreaMultiplier: "",
      }),
    ).toContain("contextual area diagnostics were unavailable");

    expect(
      validateContextualVisualContract("replica-battle", {
        ...contextualDiagnostics,
        renderedAreaIncreasePercent: "-1",
      }),
    ).toContain(
      "contextual area diagnostics must be non-negative finite values",
    );
  });

  it("preserves the explicit no-context control contract", () => {
    expect(
      validateContextualVisualContract(
        "replica-battle-no-context",
        noContextDiagnostics,
      ),
    ).toEqual([]);
  });

  it("validates water geometry in the no-context control", () => {
    expect(
      validateContextualVisualContract("replica-battle-no-context", {
        ...noContextDiagnostics,
        suspiciousGeometry: "true",
        waterFeaturesInvalid: "2",
        waterFeaturesQuarantined: "1",
      }),
    ).toContain("invalid water geometry remained unquarantined");
  });
});
