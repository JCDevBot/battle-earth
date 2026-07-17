import { describe, expect, it } from "vitest";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
  hasValidLocationCoordinates,
} from "../src/app/stageRouting.js";

describe("stage routing", () => {
  it("accepts valid geographic coordinates including zero values", () => {
    expect(hasValidLocationCoordinates({ lat: 0, lon: 0 })).toBe(true);
    expect(hasValidLocationCoordinates({ lat: "44.95", lon: "-93.09" })).toBe(
      true,
    );
  });

  it("rejects missing, non-finite, and out-of-range coordinates", () => {
    expect(hasValidLocationCoordinates(null)).toBe(false);
    expect(hasValidLocationCoordinates({ lat: 91, lon: 0 })).toBe(false);
    expect(hasValidLocationCoordinates({ lat: 0, lon: -181 })).toBe(false);
    expect(hasValidLocationCoordinates({ lat: "not-a-number", lon: 0 })).toBe(
      false,
    );
  });

  it("routes a selected location directly into the tactical stage by default", () => {
    const location = { lat: 44.95, lon: -93.09, sizeMeters: 350 };

    expect(getStageForLocation(location)).toBe(APP_STAGES.TACTICAL);
    expect(canRenderStage(APP_STAGES.TACTICAL, location)).toBe(true);
  });

  it("routes campaign requests into campaign while requiring request context", () => {
    const location = {
      lat: 44.95,
      lon: -93.09,
      battleRequest: { launchType: APP_STAGES.CAMPAIGN },
    };

    expect(getStageForLocation(location)).toBe(APP_STAGES.CAMPAIGN);
    expect(canRenderStage(APP_STAGES.CAMPAIGN, location)).toBe(true);
    expect(
      canRenderStage(APP_STAGES.CAMPAIGN, { lat: 44.95, lon: -93.09 }),
    ).toBe(false);
  });

  it("falls back to the globe when a selection cannot safely launch", () => {
    const invalidLocation = { lat: undefined, lon: -93.09 };

    expect(getStageForLocation(invalidLocation)).toBe(APP_STAGES.GLOBE);
    expect(canRenderStage(APP_STAGES.TACTICAL, invalidLocation)).toBe(false);
    expect(canRenderStage(APP_STAGES.GLOBE, invalidLocation)).toBe(true);
  });
});
