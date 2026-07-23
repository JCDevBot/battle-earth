import { describe, expect, it, vi } from "vitest";
import { installContextualMapEngineGeneration } from "../src/app/contextualMapEngineIntegration.js";

const result = {
  plan: {
    gameplay: { mapWidthMeters: 350, mapDepthMeters: 350 },
    visualFeatures: { mapWidthMeters: 500, mapDepthMeters: 400 },
    boundsManager: { showOuterSkirt: false },
  },
  contextualDiagnostics: null,
};

describe("contextual feature diagnostics integration", () => {
  it("quarantines suspicious water geometry and exposes the result", async () => {
    class TestMapEngine {
      constructor() {
        this.renderer = { domElement: { dataset: {} } };
        const mesh = {
          parent: { remove: vi.fn() },
          geometry: { dispose: vi.fn() },
        };
        const feature = { id: "bad-water-relation", mesh };
        this.builder = {
          waterPolygons: [
            {
              feature,
              bounds: { minX: -245, maxX: 245, minZ: -195, maxZ: 195 },
            },
          ],
          waterMeshes: [mesh],
          waterFeatures: [feature],
          applyWaterTerrainInteractions: vi.fn(),
        };
        this.log = vi.fn();
      }
    }

    installContextualMapEngineGeneration(TestMapEngine, async () => result);
    const engine = new TestMapEngine();
    await engine.generateMap({});

    expect(engine.lastContextualFeatureDiagnostics).toMatchObject({
      inspected: 1,
      invalid: 1,
      hasSuspiciousGeometry: true,
    });
    expect(engine.lastContextualFeatureQuarantine).toEqual({
      attempted: 1,
      removed: 1,
      sourceIds: ["bad-water-relation"],
    });
    expect(engine.builder.waterPolygons).toEqual([]);
    expect(engine.renderer.domElement.dataset).toMatchObject({
      contextualSuspiciousGeometry: "true",
      contextualWaterFeaturesInspected: "1",
      contextualWaterFeaturesInvalid: "1",
      contextualWaterFeaturesQuarantined: "1",
    });
    expect(engine.log).toHaveBeenCalledWith(
      "Context geometry warning: 1 suspicious water feature. Quarantined 1.",
      "warn",
    );
  });

  it(
    "can preserve suspicious geometry when quarantine is explicitly disabled",
    async () => {
      class TestMapEngine {
        constructor() {
          this.renderer = { domElement: { dataset: {} } };
          this.builder = {
            waterPolygons: [
              {
                feature: { id: "review-only-water" },
                bounds: {
                  minX: -245,
                  maxX: 245,
                  minZ: -195,
                  maxZ: 195,
                },
              },
            ],
          };
          this.log = vi.fn();
        }
      }

      installContextualMapEngineGeneration(TestMapEngine, async () => result);
      const engine = new TestMapEngine();
      await engine.generateMap({ quarantineSuspiciousContextWater: false });

      expect(engine.builder.waterPolygons).toHaveLength(1);
      expect(engine.renderer.domElement.dataset).toMatchObject({
        contextualSuspiciousGeometry: "true",
        contextualWaterFeaturesQuarantined: "0",
      });
    },
  );

  it("reports clean water geometry without a warning", async () => {
    class TestMapEngine {
      constructor() {
        this.renderer = { domElement: { dataset: {} } };
        this.builder = {
          waterPolygons: [
            {
              id: "river-channel",
              bounds: { minX: -90, maxX: 70, minZ: -40, maxZ: 35 },
            },
          ],
        };
        this.log = vi.fn();
      }
    }

    installContextualMapEngineGeneration(TestMapEngine, async () => result);
    const engine = new TestMapEngine();
    await engine.generateMap({});

    expect(engine.renderer.domElement.dataset).toMatchObject({
      contextualSuspiciousGeometry: "false",
      contextualWaterFeaturesInspected: "1",
      contextualWaterFeaturesInvalid: "0",
      contextualWaterFeaturesQuarantined: "0",
    });
    expect(engine.log).not.toHaveBeenCalled();
  });
});
