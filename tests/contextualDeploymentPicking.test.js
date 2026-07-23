import { describe, expect, it, vi } from "vitest";
import { pickPlayableTerrainPoint } from "../src/app/contextualMapEngineIntegration.js";

describe("contextual deployment picking", () => {
  it("falls back to the playable ground plane when terrain LOD omits terrain.mesh", () => {
    const intersectPlane = vi.fn((_plane, point) => {
      point.set(18, 0, -12);
      return point;
    });
    const engine = {
      deployMode: "friendly",
      terrain: {
        mesh: null,
        getWorldHeight: vi.fn(() => 4),
      },
      controls: { target: { y: 0 } },
      bounds: { containsPoint: vi.fn(() => true) },
      raycaster: {
        ray: { intersectPlane },
        intersectObject: vi.fn(),
      },
      updatePointerFromEvent: vi.fn(),
    };
    const event = { clientX: 720, clientY: 450 };

    const result = pickPlayableTerrainPoint(engine, event);

    expect(result?.hit).toBeNull();
    expect(result?.point).toMatchObject({ x: 18, y: 4, z: -12 });
    expect(engine.updatePointerFromEvent).toHaveBeenCalledWith(event);
    expect(engine.raycaster.intersectObject).not.toHaveBeenCalled();
    expect(engine.bounds.containsPoint).toHaveBeenCalledWith(
      expect.objectContaining({ x: 18, z: -12 }),
      4,
    );
  });

  it("rejects the ground-plane fallback outside playable bounds", () => {
    const engine = {
      deployMode: "friendly",
      terrain: { mesh: null },
      controls: { target: { y: 0 } },
      bounds: { containsPoint: vi.fn(() => false) },
      raycaster: {
        ray: {
          intersectPlane: vi.fn((_plane, point) => {
            point.set(220, 0, 0);
            return point;
          }),
        },
        intersectObject: vi.fn(),
      },
      updatePointerFromEvent: vi.fn(),
    };

    expect(
      pickPlayableTerrainPoint(engine, { clientX: 720, clientY: 450 }),
    ).toBeNull();
    expect(engine.raycaster.intersectObject).not.toHaveBeenCalled();
  });
});
