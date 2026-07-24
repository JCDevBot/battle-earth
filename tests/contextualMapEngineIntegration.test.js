import { describe, expect, it, vi } from "vitest";
import {
  installContextualMapEngineGeneration,
  pickPlayableTerrainPoint,
} from "../src/app/contextualMapEngineIntegration.js";

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
    contextualDiagnostics: {
      renderedAreaMultiplier: 1.96,
      renderedAreaIncreasePercent: 96,
      generationDurationMs: 842,
      memoryDeltaBytes: 4096,
      measurementsAvailable: true,
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
    expect(engine.lastContextualGenerationDiagnostics).toBe(
      result.contextualDiagnostics,
    );
  });

  it("exposes deterministic contextual dimensions and measurements on the renderer canvas", async () => {
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
      renderedAreaMultiplier: "1.96",
      renderedAreaIncreasePercent: "96",
      generationDurationMs: "842",
      memoryDeltaBytes: "4096",
      contextualMeasurementsAvailable: "true",
    });
  });

  it("omits unavailable optional runtime measurements", async () => {
    class TestMapEngine {
      constructor() {
        this.renderer = { domElement: { dataset: {} } };
      }
    }
    const result = contextualResult();
    result.contextualDiagnostics = {
      ...result.contextualDiagnostics,
      generationDurationMs: null,
      memoryDeltaBytes: null,
      measurementsAvailable: false,
    };

    installContextualMapEngineGeneration(TestMapEngine, async () => result);

    const engine = new TestMapEngine();
    await engine.generateMap({});

    expect(
      engine.renderer.domElement.dataset.generationDurationMs,
    ).toBeUndefined();
    expect(engine.renderer.domElement.dataset.memoryDeltaBytes).toBeUndefined();
    expect(
      engine.renderer.domElement.dataset.contextualMeasurementsAvailable,
    ).toBe("false");
  });

  it("uses the authoritative playable terrain hit while deployment mode is armed", () => {
    const terrainHit = { point: { x: 12, y: 3, z: -18 } };
    const engine = {
      deployMode: "friendly",
      terrain: { mesh: { name: "terrain" } },
      bounds: { containsPoint: vi.fn(() => true) },
      raycaster: {
        intersectObject: vi.fn(() => [terrainHit]),
      },
      updatePointerFromEvent: vi.fn(),
    };
    const event = { clientX: 400, clientY: 300 };

    expect(pickPlayableTerrainPoint(engine, event)).toEqual({
      point: terrainHit.point,
      hit: terrainHit,
    });
    expect(engine.updatePointerFromEvent).toHaveBeenCalledWith(event);
    expect(engine.raycaster.intersectObject).toHaveBeenCalledWith(
      engine.terrain.mesh,
      false,
    );
    expect(engine.bounds.containsPoint).toHaveBeenCalledWith(
      terrainHit.point,
      4,
    );
  });

  it("rejects contextual terrain hits outside the playable battlefield", () => {
    const outsideHit = { point: { x: 220, y: 2, z: 0 } };
    const insideHit = { point: { x: 120, y: 2, z: 0 } };
    const engine = {
      deployMode: "friendly",
      terrain: { mesh: {} },
      bounds: {
        containsPoint: vi.fn((point) => point === insideHit.point),
      },
      raycaster: {
        intersectObject: vi.fn(() => [outsideHit, insideHit]),
      },
      updatePointerFromEvent: vi.fn(),
    };

    expect(pickPlayableTerrainPoint(engine, {})).toEqual({
      point: insideHit.point,
      hit: insideHit,
    });
    expect(engine.bounds.containsPoint).toHaveBeenNthCalledWith(
      1,
      outsideHit.point,
      4,
    );
    expect(engine.bounds.containsPoint).toHaveBeenNthCalledWith(
      2,
      insideHit.point,
      4,
    );

    engine.bounds.containsPoint.mockReturnValue(false);
    expect(pickPlayableTerrainPoint(engine, {})).toBeNull();
  });

  it("wraps world picking so contextual deployment prefers terrain over visual features", () => {
    const terrainHit = { point: { x: 0, y: 1, z: 0 } };
    const originalResult = { point: { x: 999, y: 0, z: 999 }, hit: null };

    class TestMapEngine {
      constructor() {
        this.deployMode = "friendly";
        this.terrain = { mesh: {} };
        this.bounds = { containsPoint: vi.fn(() => true) };
        this.raycaster = { intersectObject: vi.fn(() => [terrainHit]) };
        this.updatePointerFromEvent = vi.fn();
      }

      pickWorldPoint() {
        return originalResult;
      }
    }

    installContextualMapEngineGeneration(TestMapEngine, async () =>
      contextualResult(),
    );

    const engine = new TestMapEngine();
    expect(engine.pickWorldPoint({ clientX: 10, clientY: 20 })).toEqual({
      point: terrainHit.point,
      hit: terrainHit,
    });

    engine.deployMode = null;
    expect(engine.pickWorldPoint({ clientX: 10, clientY: 20 })).toBe(
      originalResult,
    );
  });

  it("returns an out-of-bounds terrain pick without falling back to contextual visual features", () => {
    const outsideTerrainHit = { point: { x: 220, y: 1, z: 0 } };
    const originalPick = vi.fn(() => ({
      point: { x: 220, y: 3, z: 0 },
      hit: { object: { name: "context-building" } },
    }));

    class TestMapEngine {
      constructor() {
        this.deployMode = "friendly";
        this.terrain = { mesh: {} };
        this.bounds = { containsPoint: vi.fn(() => false) };
        this.raycaster = {
          intersectObject: vi.fn(() => [outsideTerrainHit]),
        };
        this.updatePointerFromEvent = vi.fn();
      }
    }
    TestMapEngine.prototype.pickWorldPoint = originalPick;

    installContextualMapEngineGeneration(TestMapEngine, async () =>
      contextualResult(),
    );

    const engine = new TestMapEngine();
    expect(engine.pickWorldPoint({ clientX: 12, clientY: 24 })).toEqual({
      point: outsideTerrainHit.point,
      hit: outsideTerrainHit,
    });
    expect(originalPick).not.toHaveBeenCalled();

    engine.deployMode = null;
    expect(engine.pickWorldPoint({ clientX: 12, clientY: 24 })).toEqual({
      point: { x: 220, y: 3, z: 0 },
      hit: { object: { name: "context-building" } },
    });
    expect(originalPick).toHaveBeenCalledOnce();
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
