import { describe, expect, it } from "vitest";
import {
  METERS_PER_DEGREE_LAT,
  boundsFromCenter,
} from "../src/map/utils/geo.js";

describe("boundsFromCenter", () => {
  it("centers a square geographic bounding box on the requested point", () => {
    const bounds = boundsFromCenter(45, -93, 1000);

    expect((bounds.north + bounds.south) / 2).toBeCloseTo(45, 10);
    expect((bounds.east + bounds.west) / 2).toBeCloseTo(-93, 10);
    expect(bounds.north - bounds.south).toBeCloseTo(
      1000 / METERS_PER_DEGREE_LAT,
      10,
    );
  });

  it("supports independent width and depth", () => {
    const square = boundsFromCenter(0, 0, 1000);
    const rectangle = boundsFromCenter(0, 0, 1000, 2000, 500);

    expect(rectangle.east - rectangle.west).toBeCloseTo(
      (square.east - square.west) * 2,
      10,
    );
    expect(rectangle.north - rectangle.south).toBeCloseTo(
      (square.north - square.south) / 2,
      10,
    );
  });
});
