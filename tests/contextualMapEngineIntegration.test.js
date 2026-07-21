import { describe, expect, it, vi } from "vitest";
import { installContextualMapEngineGeneration } from "../src/app/contextualMapEngineIntegration.js";

describe("contextual MapEngine integration", () => {
  it("routes normal generateMap calls through the contextual runner", async () => {
    class TestMapEngine {}
    const runner = vi.fn(async (engine, config) => ({ engine, config }));

    expect(installContextualMapEngineGeneration(TestMapEngine, runner)).toBe(
      true,
    );

    const engine = new TestMapEngine();
    const config = { lat: 44.9362, lon: -93.0977, sizeMeters: 350 };

    await expect(engine.generateMap(config)).resolves.toEqual({
      engine,
      config,
    });
    expect(runner).toHaveBeenCalledOnce();
    expect(runner).toHaveBeenCalledWith(engine, config);
  });

  it("is idempotent and does not replace an installed runner", async () => {
    class TestMapEngine {}
    const firstRunner = vi.fn(async () => "first");
    const secondRunner = vi.fn(async () => "second");

    expect(
      installContextualMapEngineGeneration(TestMapEngine, firstRunner),
    ).toBe(true);
    expect(
      installContextualMapEngineGeneration(TestMapEngine, secondRunner),
    ).toBe(false);

    await expect(new TestMapEngine().generateMap({})).resolves.toBe("first");
    expect(firstRunner).toHaveBeenCalledOnce();
    expect(secondRunner).not.toHaveBeenCalled();
  });

  it("rejects invalid integration dependencies", () => {
    expect(() => installContextualMapEngineGeneration(null)).toThrow(
      "A MapEngine class is required.",
    );
    expect(() =>
      installContextualMapEngineGeneration(class TestMapEngine {}, null),
    ).toThrow("A contextual generation runner is required.");
  });
});
