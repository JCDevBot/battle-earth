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

describe("OSMService", () => {
  it("uses a new cache namespace for corrected relation assembly", () => {
    expect(createService().getCacheKey(44, -94, 45, -93, "expanded")).toContain(
      "expanded_v5_",
    );
  });
});

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

  it("removes assembled area-member fragments from resolved output", () => {
    const resolved = createService().resolveRelations({
      elements: [
        {
          type: "way",
          id: 10,
          nodes: [1, 2, 3],
          tags: { natural: "water" },
        },
        {
          type: "way",
          id: 11,
          nodes: [3, 4, 1],
          tags: { natural: "water" },
        },
        {
          type: "relation",
          id: 94,
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
        (element) => element.type === "way" && element.id > 0,
      ),
    ).toEqual([]);
    expect(
      resolved.elements.filter(
        (element) => element.type === "way" && element.id < 0,
      ),
    ).toHaveLength(1);
  });

  it("preserves independent line semantics on a consumed member way", () => {
    const resolved = createService().resolveRelations({
      elements: [
        {
          type: "way",
          id: 10,
          nodes: [1, 2, 3],
          tags: { barrier: "fence" },
        },
        { type: "way", id: 11, nodes: [3, 4, 1] },
        {
          type: "relation",
          id: 95,
          tags: { type: "multipolygon", landuse: "military" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
          ],
        },
      ],
    });

    expect(resolved.elements).toContainEqual(
      expect.objectContaining({ id: 10, tags: { barrier: "fence" } }),
    );
    expect(resolved.elements.some((element) => element.id === 11)).toBe(false);
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
    expect(resolved.elements.some((element) => element.id === 10)).toBe(true);
    expect(resolved.elements.some((element) => element.id === 11)).toBe(true);
  });

  it("preserves incomplete fragments when another outer ring succeeds", () => {
    const resolved = createService().resolveRelations({
      elements: [
        { type: "way", id: 10, nodes: [1, 2, 3] },
        { type: "way", id: 11, nodes: [3, 4, 1] },
        {
          type: "way",
          id: 12,
          nodes: [20, 21, 22],
          tags: { natural: "water" },
        },
        {
          type: "relation",
          id: 96,
          tags: { type: "multipolygon", natural: "water" },
          members: [
            { type: "way", ref: 10, role: "outer" },
            { type: "way", ref: 11, role: "outer" },
            { type: "way", ref: 12, role: "outer" },
          ],
        },
      ],
    });

    expect(
      resolved.elements.filter(
        (element) => element.type === "way" && element.id < 0,
      ),
    ).toHaveLength(1);
    expect(resolved.elements.some((element) => element.id === 10)).toBe(false);
    expect(resolved.elements.some((element) => element.id === 11)).toBe(false);
    expect(resolved.elements.some((element) => element.id === 12)).toBe(true);
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
