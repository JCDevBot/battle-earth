import { describe, expect, it, vi } from "vitest";
import { installContextualMapEngineGeneration } from "../src/app/contextualMapEngineIntegration.js";

function contextualResult() {
  return {
    plan: {
      gameplay: {
        mapWidthMeters: 350,
        mapDepthMeters: 350,
      },
      visualFeatures: {
        mapWidthMeters: 490,
        mapDepthMeters: 490,
      },
      boundsManager: {
        showOuterSkirt: false,
      },
    },
  };
}

describe("contextual MapEngine integration", () => {
  it("routes normal generateMap calls through the contextual runner", async () => {
    class TestMapEngine {}
    const result = contextualResult();
    const runner = vi.fn(async () => result);

    expect(installContextualMapEngineGeneration(TestMapEngine, runner)).toBe(
      true,
    );

    const engine = new TestMapEngine();
    const config = { lat: 44.9362, lon: -93.0977, sizeMeters: 350 };

    await expect(engine.generateMap(config)).resolves.toBe(result);
    expect(runner).toHaveBeenCalledOnce();
    expect(runner).toHaveBeenCalledWith(engine, config);
    expect(engine.lastContextualGenerationPlan).toBe(result.plan);
  });

  it("exposes deterministic contextual dimensions on the renderer canvas", async () => {
    class TestMapEngine {
      constructor() {
        this.renderer = { domElement: { dataset: {} } };
      }
    }
    const result = contextualResult();

    installContextualMapEngineGeneration(TestMapEngine, async () => result);

    const engine = new TestMapEngine();
    await engine.generateMap({});

    expect(engine.renderer.domElement.dataset).toEqual({
      contextualGeneration: "ready",
      playableWidthMeters: "350",
      playableDepthMeters: "350",
      renderWidthMeters: "490",
      renderDepthMeters: "490",
      outerSkirtVisible: "false",
    });
  });

  it("is idempotent and does not replace an installed runner", async () => {
    class TestMapEngine {}
    const firstRunner = vi.fn(async () => "first");
    const secondRunner = vi.fn(async () => "second");

    expect(
      installContextualMapEngineGeneration(TestMapEngine, firstRunner),
    ).toBe(true);
    expect(
      installContextualMapEngineGeneration(TestMapEngine, secondRunner),
    ).toBe(false);

    await expect(new TestMapEngine().generateMap({})).resolves.toBe("first");
    expect(firstRunner).toHaveBeenCalledOnce();
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("rejects invalid integration dependencies", () => {
    expect(() => installContextualMapEngineGeneration(null)).toThrow(
      "A MapEngine class is required.",
    );
    expect(() =>
      installContextualMapEngineGeneration(class TestMapEngine {}, null),
    ).toThrow("A contextual generation runner is required.");
  });
});
