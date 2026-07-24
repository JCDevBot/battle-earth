import { describe, expect, it } from "vitest";
import { validateContextualVisualSuite } from "../src/app/contextualVisualSuiteContract.js";

const scenarios = [
  "replica-battle-terrain-only",
  "replica-battle-water-only",
  "replica-battle-roads-only",
  "replica-battle-buildings-only",
  "replica-battle-vegetation-only",
  "replica-battle",
  "replica-battle-no-context",
];

function entry(scenario, overrides = {}) {
  const contextual = scenario !== "replica-battle-no-context";
  return {
    scenario,
    status: "captured",
    events: [],
    diagnostics: {
      playableWidthMeters: "400",
      playableDepthMeters: "300",
      renderWidthMeters: contextual ? "520" : "400",
      renderDepthMeters: contextual ? "420" : "300",
      ...overrides,
    },
  };
}

function validReport() {
  return scenarios.map((scenario) => entry(scenario));
}

describe("contextual visual suite contract", () => {
  it("accepts a complete consistent suite", () => {
    expect(validateContextualVisualSuite(validReport())).toEqual([]);
  });

  it("rejects a non-array report", () => {
    expect(validateContextualVisualSuite({})).toEqual([
      "visual capture report was not an array",
    ]);
  });

  it("rejects a missing route", () => {
    const report = validReport().filter(
      (item) => item.scenario !== "replica-battle-water-only",
    );
    expect(validateContextualVisualSuite(report)).toContain(
      "missing visual capture for replica-battle-water-only",
    );
  });

  it("rejects duplicate route captures instead of silently overwriting them", () => {
    const report = validReport();
    report.push(entry("replica-battle-water-only"));
    expect(validateContextualVisualSuite(report)).toContain(
      "duplicate visual capture for replica-battle-water-only",
    );
  });

  it("rejects unexpected routes in the visual report", () => {
    const report = validReport();
    report.push(entry("prototype-smoke"));
    expect(validateContextualVisualSuite(report)).toContain(
      "unexpected visual capture for prototype-smoke",
    );
  });

  it("rejects browser errors even when route capture completed", () => {
    const report = validReport();
    report[0].events.push({ type: "pageerror", message: "boom" });
    expect(validateContextualVisualSuite(report)).toContain(
      "browser events were recorded for replica-battle-terrain-only",
    );
  });

  it("rejects layer routes that use different map dimensions", () => {
    const report = validReport();
    report.find(
      (item) => item.scenario === "replica-battle-buildings-only",
    ).diagnostics.renderWidthMeters = "500";
    expect(validateContextualVisualSuite(report)).toContain(
      "contextual dimensions diverged for replica-battle-buildings-only",
    );
  });

  it("rejects a no-context control with different playable dimensions", () => {
    const report = validReport();
    report.find(
      (item) => item.scenario === "replica-battle-no-context",
    ).diagnostics.playableWidthMeters = "410";
    expect(validateContextualVisualSuite(report)).toContain(
      "no-context control changed playable dimensions",
    );
  });
});
