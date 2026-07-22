import { describe, expect, it } from "vitest";
import { OSMService } from "../src/map/services/OSMService.js";

function createService() {
  return new OSMService({
    cache: {
      get: async () => null,
      put: async () => {},
      clear: async () => {},
    },
    logger: {},
  });
}

describe("OSMService.resolveRelations", () => {
  it("joins split outer members into one closed synthetic way", () => {
    const resolved = createService().resolveRelations({
      elements: [
        { type: "node", id: 1 },
        { type: "node", id: 2 },
        { type: "node", id: 3 },
        { type: "node", id: 4 },
        { type: "way", id: 10, nodes: [1, 2, 3] },
        { type: "way", id: 11, nodes: [3, 4, 1] },
        {
          type: "relation",
          id: 90,
          tags: { type: "multipolygon", natural: "water" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
          ],
        },
      ],
    });

    const synthetic = resolved.elements.filter(
      (element) => element.type === "way" && element.id < 0,
    );

    expect(synthetic).toHaveLength(1);
    expect(synthetic[0].nodes).toEqual([1, 2, 3, 4, 1]);
    expect(synthetic[0].tags.natural).toBe("water");
  });

  it("reverses member direction when necessary", () => {
    const resolved = createService().resolveRelations({
      elements: [
        { type: "way", id: 10, nodes: [1, 2, 3] },
        { type: "way", id: 11, nodes: [1, 4, 3] },
        {
          type: "relation",
          id: 91,
          tags: { type: "multipolygon", landuse: "forest" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
          ],
        },
      ],
    });

    const synthetic = resolved.elements.find(
      (element) => element.type === "way" && element.id < 0,
    );

    expect(synthetic.nodes).toEqual([1, 2, 3, 4, 1]);
  });

  it("does not turn an incomplete outer boundary into a filled polygon", () => {
    const resolved = createService().resolveRelations({
      elements: [
        { type: "way", id: 10, nodes: [1, 2, 3] },
        { type: "way", id: 11, nodes: [7, 8, 9] },
        {
          type: "relation",
          id: 92,
          tags: { type: "multipolygon", natural: "water" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
          ],
        },
      ],
    });

    expect(
      resolved.elements.filter(
        (element) => element.type === "way" && element.id < 0,
      ),
    ).toEqual([]);
  });

  it("assembles inner members as closed holes", () => {
    const resolved = createService().resolveRelations({
      elements: [
        { type: "way", id: 10, nodes: [1, 2, 3] },
        { type: "way", id: 11, nodes: [3, 4, 1] },
        { type: "way", id: 20, nodes: [5, 6, 7] },
        { type: "way", id: 21, nodes: [7, 8, 5] },
        {
          type: "relation",
          id: 93,
          tags: { type: "multipolygon", natural: "water" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
            { type: "way", ref: 20, role: "inner" },
            { type: "way", ref: 21, role: "inner" },
          ],
        },
      ],
    });

    const synthetic = resolved.elements.find(
      (element) => element.type === "way" && element.id < 0,
    );

    expect(synthetic.innerRings).toEqual([[5, 6, 7, 8, 5]]);
  });
});
