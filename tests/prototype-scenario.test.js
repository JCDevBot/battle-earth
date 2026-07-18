import { describe, expect, it } from "vitest";
import {
  PROTOTYPE_SMOKE_SCENARIO,
  createPrototypeSmokeLocation,
} from "../src/app/prototypeScenario.js";
import {
  APP_STAGES,
  canRenderStage,
  getStageForLocation,
} from "../src/app/stageRouting.js";

describe("prototype smoke scenario", () => {
  it("provides a deterministic tactical location without live terrain dependencies", () => {
    const location = createPrototypeSmokeLocation();

    expect(location).not.toBeNull();
    expect(getStageForLocation(location)).toBe(APP_STAGES.TACTICAL);
    expect(canRenderStage(APP_STAGES.TACTICAL, location)).toBe(true);
    expect(location.battleRequest.seed).toBe(1);
    expect(location.battleRequest.useRealTerrain).toBe(false);
    expect(location.battleRequest.sandbox).toEqual({
      enabled: true,
      allowBothSides: true,
      allowManualDeployment: true,
    });
  });

  it("returns an isolated copy for each browser or integration run", () => {
    const first = createPrototypeSmokeLocation();
    const second = createPrototypeSmokeLocation();

    first.battleRequest.sandbox.enabled = false;

    expect(second.battleRequest.sandbox.enabled).toBe(true);
    expect(
      PROTOTYPE_SMOKE_SCENARIO.location.battleRequest.sandbox.enabled,
    ).toBe(true);
  });
});
