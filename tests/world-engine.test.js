import { describe, expect, it } from "vitest";
import {
  buildWorldEnginePlan,
  estimateNaturalRegionCount,
  lodForEntityLevel,
  regionDensityConfig,
} from "../src/world/WorldEngine.js";
import {
  getScaleForEntity,
  getScaleFromSpan,
} from "../src/world/WorldScaleConfig.js";

describe("world-scale planning", () => {
  it("maps entity levels to the expected level of detail", () => {
    expect(lodForEntityLevel("continent").id).toBe("theater");
    expect(lodForEntityLevel("city").id).toBe("city");
    expect(lodForEntityLevel("unknown").id).toBe("planet");
  });

  it("uses curated natural counts for major entities", () => {
    expect(
      estimateNaturalRegionCount({ level: "continent", name: "North America" }),
    ).toBe(3);
    expect(
      estimateNaturalRegionCount({ level: "country", name: "United States" }),
    ).toBe(50);
  });

  it("scales recommended density without losing bounds", () => {
    const sparse = regionDensityConfig(
      { level: "country", name: "United States" },
      0,
      "sparse",
    );
    const dense = regionDensityConfig(
      { level: "country", name: "United States" },
      0,
      "dense",
    );

    expect(sparse.target).toBeLessThan(dense.target);
    expect(sparse.min).toBeLessThanOrEqual(sparse.target);
    expect(dense.target).toBeLessThanOrEqual(dense.max);
  });

  it("builds an explicit plan for the current and next scale", () => {
    const plan = buildWorldEnginePlan({
      entity: { id: "mn", name: "Minnesota", level: "region" },
      gameMode: "risk",
      playableChildLevel: "city",
      childCount: 12,
    });

    expect(plan.currentLod.id).toBe("state");
    expect(plan.detailLod.id).toBe("city");
    expect(plan.playableChildLevel).toBe("city");
  });

  it("selects scale bands from either geometry or entity level", () => {
    expect(getScaleFromSpan(30).id).toBe("continent");
    expect(getScaleForEntity({ level: "city" }).id).toBe("city");
    expect(
      getScaleForEntity({ bbox: { w: -94, e: -93.9, s: 44.9, n: 45 } }).id,
    ).toBe("neighborhood");
  });
});
