import { describe, expect, it, vi } from "vitest";
import { installContextualMapGeneration } from "../src/app/installContextualMapGeneration.js";

vi.mock("../src/app/runContextualMapGeneration.js", () => ({
  runContextualMapGeneration: vi.fn(async (engine, config) => ({ engine, config })),
}));

import { runContextualMapGeneration } from "../src/app/runContextualMapGeneration.js";

describe("installContextualMapGeneration", () => {
  it("replaces generateMap with the contextual orchestrator", async () => {
    class TestMapEngine {
      generateMap() {
        throw new Error("legacy generation should not run");
      }
    }

    expect(installContextualMapGeneration(TestMapEngine)).toBe(true);

    const engine = new TestMapEngine();
    const config = { lat: 44.9362, lon: -93.0977, sizeMeters: 350 };
    const result = await engine.generateMap(config);

    expect(runContextualMapGeneration).toHaveBeenCalledWith(engine, config);
    expect(result).toEqual({ engine, config });
  });

  it("is idempotent for the same class", () => {
    class TestMapEngine {}

    expect(installContextualMapGeneration(TestMapEngine)).toBe(true);
    expect(installContextualMapGeneration(TestMapEngine)).toBe(false);
  });

  it("rejects a missing MapEngine class", () => {
    expect(() => installContextualMapGeneration(null)).toThrow(TypeError);
  });
});
