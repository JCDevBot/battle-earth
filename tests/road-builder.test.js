import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  ROAD_STYLE_BY_TYPE,
  RoadBuilder,
  convexHull,
} from "../src/map/builders/RoadBuilder.js";

function createHost(points) {
  return {
    getWayPoints: vi.fn(() => points),
    renderPath: vi.fn(() => ({ visible: true })),
    materials: {
      sidewalk: { id: "sidewalk" },
      roadShoulder: { id: "shoulder" },
      road: { id: "road" },
      roadEdgeLine: { id: "edge" },
      roadCenterline: { id: "center" },
    },
    terrain: { getHeight: vi.fn(() => 12) },
    destruction: { register: vi.fn() },
    roadSegments: [],
    roadJunctions: new Map(),
    centerLat: 45,
    centerLon: -93,
    scaleFactor: 111_320,
    group: { add: vi.fn() },
  };
}

describe("RoadBuilder", () => {
  it("builds residential road surfaces and records collision segments", () => {
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(30, 0)];
    const host = createHost(points);
    const builder = new RoadBuilder(host);

    builder.createRoad(
      { id: 42, tags: { highway: "residential", name: "Test Street" } },
      {},
    );

    expect(host.renderPath).toHaveBeenCalledTimes(3);
    expect(host.roadSegments).toEqual([
      expect.objectContaining({
        a: points[0],
        b: points[1],
        highway: "residential",
        width:
          ROAD_STYLE_BY_TYPE.residential.halfWidth +
          ROAD_STYLE_BY_TYPE.residential.shoulder +
          1.35,
      }),
    ]);
    expect(host.roadJunctions.size).toBe(2);
    expect(host.destruction.register).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "road:42",
        category: "road",
        position: expect.objectContaining({ x: 15, y: 12.5, z: 0 }),
      }),
    );
  });

  it("does not register bridge endpoints as ordinary junctions", () => {
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(30, 0)];
    const host = createHost(points);
    const builder = new RoadBuilder(host);

    builder.createRoad(
      { id: 7, tags: { highway: "primary", bridge: "yes" } },
      {},
    );

    expect(host.roadJunctions.size).toBe(0);
    expect(host.destruction.register).toHaveBeenCalledWith(
      expect.objectContaining({ category: "bridge", maxHealth: 180 }),
    );
  });

  it("returns a stable convex hull without duplicate interior points", () => {
    const hull = convexHull([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(10, 0),
      new THREE.Vector2(10, 10),
      new THREE.Vector2(0, 10),
      new THREE.Vector2(5, 5),
      new THREE.Vector2(0, 0),
    ]);

    expect(hull).toHaveLength(4);
    expect(hull.map((point) => `${point.x}:${point.y}`).sort()).toEqual([
      "0:0",
      "0:10",
      "10:0",
      "10:10",
    ]);
  });

  it("quantizes nearby road endpoints to the same junction key", () => {
    const builder = new RoadBuilder(createHost([]));

    expect(builder.roadJunctionKey(new THREE.Vector2(4.1, 7.2))).toBe("3:6");
    expect(builder.roadJunctionKey(new THREE.Vector2(4.4, 7.4))).toBe("3:6");
  });
});
