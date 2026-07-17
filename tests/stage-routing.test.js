import { describe, expect, it } from "vitest";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
} from "../src/app/stageRouting.js";

describe("app stage routing", () => {
  it("returns to the globe when no location is selected", () => {
    expect(getStageForLocation(null)).toBe(APP_STAGES.GLOBE);
    expect(canRenderStage(APP_STAGES.GLOBE, null)).toBe(true);
  });

  it("routes campaign requests to the campaign stage", () => {
    const location = {
      lat: 44.98,
      lon: -93.26,
      battleRequest: { launchType: "campaign" },
    };

    expect(getStageForLocation(location)).toBe(APP_STAGES.CAMPAIGN);
    expect(canRenderStage(APP_STAGES.CAMPAIGN, location)).toBe(true);
  });

  it("routes direct battle requests to the tactical stage", () => {
    const location = {
      lat: 44.98,
      lon: -93.26,
      battleRequest: { launchType: "tactical" },
    };

    expect(getStageForLocation(location)).toBe(APP_STAGES.TACTICAL);
    expect(canRenderStage(APP_STAGES.TACTICAL, location)).toBe(true);
  });

  it("prevents campaign rendering without a battle request", () => {
    expect(
      canRenderStage(APP_STAGES.CAMPAIGN, { lat: 44.98, lon: -93.26 }),
    ).toBe(false);
  });
});
