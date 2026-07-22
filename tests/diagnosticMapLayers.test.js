import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_MAP_LAYER_MODES,
  filterMapDataForDiagnosticLayer,
} from "../src/app/diagnosticMapLayers.js";

const MAP_DATA = {
  version: 0.6,
  elements: [
    { type: "node", id: 1, lat: 1, lon: 1 },
    { type: "node", id: 2, lat: 1, lon: 2 },
    { type: "node", id: 3, lat: 2, lon: 2 },
    { type: "node", id: 4, lat: 3, lon: 3 },
    { type: "node", id: 5, lat: 4, lon: 4, tags: { natural: "tree" } },
    {
      type: "way",
      id: 10,
      nodes: [1, 2, 3],
      tags: { natural: "water" },
    },
    {
      type: "way",
      id: 11,
      nodes: [3, 4],
      tags: { highway: "residential" },
    },
    { type: "way", id: 12, nodes: [1, 4], tags: { building: "yes" } },
    {
      type: "way",
      id: 13,
      nodes: [2, 4],
      tags: { landuse: "forest" },
    },
  ],
};

describe("diagnostic map layer filtering", () => {
  it("returns the original payload for normal rendering", () => {
    expect(
      filterMapDataForDiagnosticLayer(MAP_DATA, DIAGNOSTIC_MAP_LAYER_MODES.ALL),
    ).toBe(MAP_DATA);
  });

  it("removes all sourced visual features for terrain-only diagnosis", () => {
    expect(
      filterMapDataForDiagnosticLayer(
        MAP_DATA,
        DIAGNOSTIC_MAP_LAYER_MODES.TERRAIN_ONLY,
      ),
    ).toEqual({ version: 0.6, elements: [] });
  });

  it("retains only water features and the nodes they reference", () => {
    const result = filterMapDataForDiagnosticLayer(
      MAP_DATA,
      DIAGNOSTIC_MAP_LAYER_MODES.WATER_ONLY,
    );

    expect(result.elements.map((element) => element.id)).toEqual([1, 2, 3, 10]);
  });

  it("retains only roads and the nodes they reference", () => {
    const result = filterMapDataForDiagnosticLayer(
      MAP_DATA,
      DIAGNOSTIC_MAP_LAYER_MODES.ROADS_ONLY,
    );

    expect(result.elements.map((element) => element.id)).toEqual([3, 4, 11]);
  });

  it("retains only buildings and the nodes they reference", () => {
    const result = filterMapDataForDiagnosticLayer(
      MAP_DATA,
      DIAGNOSTIC_MAP_LAYER_MODES.BUILDINGS_ONLY,
    );

    expect(result.elements.map((element) => element.id)).toEqual([1, 4, 12]);
  });

  it("retains vegetation areas, explicit trees, and referenced nodes", () => {
    const result = filterMapDataForDiagnosticLayer(
      MAP_DATA,
      DIAGNOSTIC_MAP_LAYER_MODES.VEGETATION_ONLY,
    );

    expect(result.elements.map((element) => element.id)).toEqual([2, 4, 5, 13]);
  });

  it("falls back to the unmodified payload for unknown modes", () => {
    expect(filterMapDataForDiagnosticLayer(MAP_DATA, "unknown")).toBe(MAP_DATA);
  });
});
