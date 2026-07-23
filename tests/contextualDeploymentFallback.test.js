import { describe, expect, it, vi } from "vitest";
import { pickPlayableTerrainPoint } from "../src/app/contextualMapEngineIntegration.js";

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
});
