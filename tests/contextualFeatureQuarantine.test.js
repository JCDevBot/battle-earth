import { describe, expect, it, vi } from "vitest";
import { quarantineSuspiciousWaterFeatures } from "../src/app/contextualFeatureQuarantine.js";

function suspicious(index, reason = "suspicious-full-map-coverage") {
  return { collection: "water", index, reason, sourceId: `water-${index}` };
}

describe("contextual water geometry quarantine", () => {
  it("removes invalid water meshes and refreshes terrain modifiers", () => {
    const parent = { remove: vi.fn() };
    const geometry = { dispose: vi.fn() };
    const mesh = { parent, geometry };
    const feature = { id: "water-0", mesh };
    const polygon = { feature };
    const builder = {
      waterPolygons: [polygon],
      waterMeshes: [mesh],
      waterFeatures: [feature],
      applyWaterTerrainInteractions: vi.fn(),
    };

    const result = quarantineSuspiciousWaterFeatures(builder, {
      invalidEntries: [suspicious(0)],
    });

    expect(result).toEqual({ attempted: 1, removed: 1, sourceIds: ["water-0"] });
    expect(parent.remove).toHaveBeenCalledWith(mesh);
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(builder.waterPolygons).toEqual([]);
    expect(builder.waterMeshes).toEqual([]);
    expect(builder.waterFeatures).toEqual([]);
    expect(builder.applyWaterTerrainInteractions).toHaveBeenCalledOnce();
  });

  it("removes multiple entries from highest index first", () => {
    const polygons = [0, 1, 2].map((id) => ({ id }));
    const builder = {
      waterPolygons: polygons,
      waterMeshes: [],
      waterFeatures: [],
      applyWaterTerrainInteractions: vi.fn(),
    };

    const result = quarantineSuspiciousWaterFeatures(builder, {
      invalidEntries: [suspicious(0), suspicious(2, "outside-render-bounds")],
    });

    expect(result.removed).toBe(2);
    expect(builder.waterPolygons).toEqual([{ id: 1 }]);
  });

  it("does not remove unsupported diagnostic reasons", () => {
    const builder = {
      waterPolygons: [{ id: "missing-bounds" }],
      waterMeshes: [],
      waterFeatures: [],
      applyWaterTerrainInteractions: vi.fn(),
    };

    const result = quarantineSuspiciousWaterFeatures(builder, {
      invalidEntries: [suspicious(0, "invalid-bounds")],
    });

    expect(result).toEqual({ attempted: 0, removed: 0, sourceIds: [] });
    expect(builder.waterPolygons).toHaveLength(1);
    expect(builder.applyWaterTerrainInteractions).not.toHaveBeenCalled();
  });
});
