import { describe, expect, it, vi } from "vitest";
import {
  installContextualMapEngineGeneration,
  pickPlayableTerrainPoint,
} from "../src/app/contextualMapEngineIntegration.js";

function contextualResult() {
  return {
    plan: {
      gameplay: { mapWidthMeters: 350, mapDepthMeters: 350 },
      visualFeatures: { mapWidthMeters: 490, mapDepthMeters: 490 },
      boundsManager: { showOuterSkirt: false },
    },
    contextualDiagnostics: null,
  };
}

describe("contextual deployment fallback", () => {
  it("uses a bounded ground-plane point when the terrain mesh misses", () => {
    const fallbackPoint = { x: 18, y: 0, z: -24 };
    const ray = {
      intersectPlane: vi.fn((_plane, target) => {
        target.set(fallbackPoint.x, fallbackPoint.y, fallbackPoint.z);
        return target;
      }),
    };
    const engine = {
      deployMode: "friendly",
      terrain: {
        mesh: {},
        getWorldHeight: vi.fn(() => 6),
      },
      controls: { target: { y: 2 } },
      bounds: { containsPoint: vi.fn(() => true) },
      raycaster: {
        ray,
        intersectObject: vi.fn(() => []),
      },
      updatePointerFromEvent: vi.fn(),
    };

    const result = pickPlayableTerrainPoint(engine, {
      clientX: 720,
      clientY: 450,
    });

    expect(result?.hit).toBeNull();
    expect(result?.point).toMatchObject({ x: 18, y: 6, z: -24 });
    expect(engine.bounds.containsPoint).toHaveBeenCalledWith(
      expect.objectContaining({ x: 18, z: -24 }),
      4,
    );
  });

  it("rejects a ground-plane fallback outside playable bounds", () => {
    const engine = {
      deployMode: "friendly",
      terrain: { mesh: {} },
      controls: { target: { y: 0 } },
      bounds: { containsPoint: vi.fn(() => false) },
      raycaster: {
        ray: {
          intersectPlane: vi.fn((_plane, target) => {
            target.set(240, 0, 0);
            return target;
          }),
        },
        intersectObject: vi.fn(() => []),
      },
      updatePointerFromEvent: vi.fn(),
    };

    expect(pickPlayableTerrainPoint(engine, {})).toBeNull();
  });

  it("recovers an in-bounds authoritative terrain pick after both contextual fallbacks miss", () => {
    const terrainMesh = { name: "terrain" };
    const legacyPick = {
      point: { x: 24, y: 9, z: -31 },
      hit: { object: terrainMesh },
    };

    class TestMapEngine {
      constructor() {
        this.deployMode = "friendly";
        this.terrain = {
          mesh: terrainMesh,
          getWorldHeight: vi.fn(() => 2.5),
        };
        this.bounds = { containsPoint: vi.fn(() => true) };
        this.raycaster = { intersectObject: vi.fn(() => []) };
        this.updatePointerFromEvent = vi.fn();
      }

      pickWorldPoint() {
        return legacyPick;
      }
    }

    installContextualMapEngineGeneration(TestMapEngine, async () =>
      contextualResult(),
    );

    const engine = new TestMapEngine();
    const result = engine.pickWorldPoint({ clientX: 400, clientY: 300 });

    expect(result.hit).toBe(legacyPick.hit);
    expect(result.point.toArray()).toEqual([24, 2.5, -31]);
    expect(engine.terrain.getWorldHeight).toHaveBeenCalledWith(24, -31);
    expect(engine.bounds.containsPoint).toHaveBeenCalledWith(
      legacyPick.point,
      4,
    );
  });
});
