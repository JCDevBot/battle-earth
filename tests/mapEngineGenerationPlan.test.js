import { describe, expect, it } from "vitest";
import { createMapEngineGenerationPlan } from "../src/app/mapEngineGenerationPlan.js";

describe("MapEngine contextual generation plan", () => {
  it("routes buffered dimensions only to source and visual systems", () => {
    const plan = createMapEngineGenerationPlan({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
      osmProfile: "broadBase",
      contextBufferRatio: 0.18,
      contextMinBufferMeters: 60,
      contextMaxBufferMeters: 250,
    });

    expect(plan.sourceQuery.profileName).toBe("broadBase");
    expect(plan.sourceQuery.bounds).toEqual(
      plan.contextual.render.sourceQueryBounds,
    );
    expect(plan.terrain).toEqual({
      sizeMeters: 1632,
      mapWidthMeters: 1088,
      mapDepthMeters: 1632,
    });
    expect(plan.visualFeatures).toEqual({
      sizeMeters: 1632,
      mapWidthMeters: 1088,
      mapDepthMeters: 1632,
      canopySizeMeters: 1632,
    });
  });

  it("keeps every tactical and camera domain on playable dimensions", () => {
    const plan = createMapEngineGenerationPlan({
      lat: 44.9362,
      lon: -93.0977,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
    });

    expect(plan.gameplay).toEqual({
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
    expect(plan.camera).toEqual({
      sizeMeters: 1200,
      mapWidthMeters: 800,
      mapDepthMeters: 1200,
    });
    expect(plan.boundsManager).toEqual({
      sizeMeters: 1200,
      showOuterSkirt: false,
    });
  });

  it("reports the deterministic area cost of contextual rendering", () => {
    const plan = createMapEngineGenerationPlan({
      lat: 44.9537,
      lon: -93.09,
      sizeMeters: 350,
    });

    expect(plan.diagnostics.playableAreaSquareMeters).toBe(122500);
    expect(plan.diagnostics.renderedAreaSquareMeters).toBeGreaterThan(122500);
    expect(plan.diagnostics.renderedAreaRatio).toBeCloseTo(
      plan.diagnostics.renderedAreaSquareMeters /
        plan.diagnostics.playableAreaSquareMeters,
    );
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.gameplay)).toBe(true);
    expect(Object.isFrozen(plan.visualFeatures)).toBe(true);
  });
});
