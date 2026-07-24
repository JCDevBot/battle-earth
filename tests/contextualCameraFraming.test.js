import { describe, expect, it, vi } from "vitest";
import {
  applyContextualCameraFrame,
  createContextualCameraFrame,
} from "../src/app/contextualCameraFraming.js";

describe("contextual camera framing", () => {
  it("creates a steeper frame for a compact tactical slice", () => {
    expect(
      createContextualCameraFrame({
        camera: {
          sizeMeters: 350,
          mapWidthMeters: 350,
          mapDepthMeters: 350,
        },
      }),
    ).toEqual({
      x: 0,
      y: 280,
      z: 220,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    });
  });

  it("preserves the existing framing for larger maps", () => {
    expect(
      createContextualCameraFrame({
        camera: {
          sizeMeters: 1200,
          mapWidthMeters: 800,
          mapDepthMeters: 1200,
        },
      }),
    ).toBeNull();
  });

  it("anchors the compact frame to the terrain height at map center", () => {
    const engine = {
      camera: {
        position: { set: vi.fn() },
        lookAt: vi.fn(),
      },
      controls: {
        target: { set: vi.fn() },
        update: vi.fn(),
      },
      terrain: {
        getWorldHeight: vi.fn(() => 42),
      },
    };
    const plan = {
      camera: {
        sizeMeters: 350,
        mapWidthMeters: 350,
        mapDepthMeters: 350,
      },
    };

    expect(applyContextualCameraFrame(engine, plan)).toBe(true);
    expect(engine.terrain.getWorldHeight).toHaveBeenCalledWith(0, 0);
    expect(engine.camera.position.set).toHaveBeenCalledWith(0, 322, 220);
    expect(engine.camera.lookAt).toHaveBeenCalledWith(0, 42, 0);
    expect(engine.controls.target.set).toHaveBeenCalledWith(0, 42, 0);
    expect(engine.controls.update).toHaveBeenCalledOnce();
  });
});
