import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src/map/utils/SeededRandom.js";

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);

    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it("keeps ranged values within the requested interval", () => {
    const random = new SeededRandom(7);
    const values = Array.from({ length: 20 }, () => random.range(-5, 10));

    expect(values.every((value) => value >= -5 && value < 10)).toBe(true);
  });
});
