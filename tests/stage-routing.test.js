import { describe, expect, it } from "vitest";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
  hasValidLocationCoordinates,
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

  it("accepts numeric coordinate strings from form-driven location selection", () => {
    const location = { lat: "44.98", lon: "-93.26" };

    expect(hasValidLocationCoordinates(location)).toBe(true);
    expect(getStageForLocation(location)).toBe(APP_STAGES.TACTICAL);
  });

  it.each([
    { lat: undefined, lon: -93.26 },
    { lat: 44.98, lon: undefined },
    { lat: "not-a-number", lon: -93.26 },
    { lat: 91, lon: -93.26 },
    { lat: 44.98, lon: -181 },
  ])("keeps invalid locations out of renderable stages: %o", (location) => {
    expect(hasValidLocationCoordinates(location)).toBe(false);
    expect(getStageForLocation(location)).toBe(APP_STAGES.GLOBE);
    expect(canRenderStage(APP_STAGES.TACTICAL, location)).toBe(false);
    expect(
      canRenderStage(APP_STAGES.CAMPAIGN, {
        ...location,
        battleRequest: { launchType: "campaign" },
      }),
    ).toBe(false);
  });
});
