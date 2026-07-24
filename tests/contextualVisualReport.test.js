import { describe, expect, it } from "vitest";
import {
  CONTEXTUAL_VISUAL_SCENARIOS,
  validateContextualVisualReportCoverage,
} from "../src/app/contextualVisualReport.js";

describe("contextual visual report coverage", () => {
  const completeReport = CONTEXTUAL_VISUAL_SCENARIOS.map((scenario) => ({
    scenario,
    status: "captured",
  }));

  it("accepts exactly one entry for every diagnostic scenario", () => {
    expect(validateContextualVisualReportCoverage(completeReport)).toEqual([]);
  });

  it("reports missing, duplicate, unexpected, and unnamed entries", () => {
    const report = [
      ...completeReport.filter(
        ({ scenario }) => scenario !== "replica-battle-water-only",
      ),
      { scenario: "replica-battle", status: "captured" },
      { scenario: "unregistered-scenario", status: "captured" },
      { status: "captured" },
    ];

    expect(validateContextualVisualReportCoverage(report)).toEqual([
      "report contained an entry without a scenario",
      "missing scenario replica-battle-water-only",
      "duplicate scenario replica-battle",
      "unexpected scenario unregistered-scenario",
    ]);
  });

  it("rejects non-array reports", () => {
    expect(validateContextualVisualReportCoverage(null)).toEqual([
      "contextual visual report must be an array",
    ]);
  });
});
