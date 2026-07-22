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
  it("exposes suspicious water geometry for browser and manual review", async () => {
    class TestMapEngine {
      constructor() {
        this.renderer = { domElement: { dataset: {} } };
        this.builder = {
          waterPolygons: [
            {
              feature: { id: "bad-water-relation" },
              bounds: { minX: -245, maxX: 245, minZ: -195, maxZ: 195 },
            },
          ],
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
    expect(engine.renderer.domElement.dataset).toMatchObject({
      contextualSuspiciousGeometry: "true",
      contextualWaterFeaturesInspected: "1",
      contextualWaterFeaturesInvalid: "1",
    });
    expect(engine.log).toHaveBeenCalledWith(
      "Context geometry warning: 1 suspicious water feature.",
      "warn",
    );
  });

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
    });
    expect(engine.log).not.toHaveBeenCalled();
  });
});
