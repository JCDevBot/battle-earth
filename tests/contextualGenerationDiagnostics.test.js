import { describe, expect, it } from "vitest";
import { createContextualGenerationDiagnostics } from "../src/app/contextualGenerationDiagnostics.js";
import { createMapEngineGenerationPlan } from "../src/app/mapEngineGenerationPlan.js";

describe("contextual generation runtime diagnostics", () => {
  it("combines plan-derived area impact with measured runtime values", () => {
    const plan = createMapEngineGenerationPlan({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      contextBufferRatio: 0.18,
      contextMinBufferMeters: 60,
      contextMaxBufferMeters: 250,
    });

    const diagnostics = createContextualGenerationDiagnostics(plan, {
      generationDurationMs: 4250,
      memoryBeforeBytes: 1000,
      memoryAfterBytes: 1450,
    });

    expect(diagnostics).toMatchObject({
      enabled: true,
      playableWidthMeters: 800,
      playableDepthMeters: 1200,
      renderedWidthMeters: 1088,
      renderedDepthMeters: 1632,
      generationDurationMs: 4250,
      memoryBeforeBytes: 1000,
      memoryAfterBytes: 1450,
      memoryDeltaBytes: 450,
      measurementsAvailable: true,
    });
    expect(diagnostics.renderedAreaMultiplier).toBeCloseTo(1.8496, 4);
    expect(diagnostics.renderedAreaIncreasePercent).toBeCloseTo(84.96, 2);
    expect(Object.isFrozen(diagnostics)).toBe(true);
  });

  it("reports unavailable measurements without inventing values", () => {
    const plan = createMapEngineGenerationPlan({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 350,
      mapDepthMeters: 350,
    });

    expect(createContextualGenerationDiagnostics(plan)).toMatchObject({
      generationDurationMs: null,
      memoryBeforeBytes: null,
      memoryAfterBytes: null,
      memoryDeltaBytes: null,
      measurementsAvailable: false,
    });
  });

  it("rejects calls without a generation plan", () => {
    expect(() => createContextualGenerationDiagnostics(null)).toThrow(
      "A contextual MapEngine generation plan is required.",
    );
  });
});
