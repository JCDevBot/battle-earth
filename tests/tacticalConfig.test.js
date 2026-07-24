import { describe, expect, it } from "vitest";
import { createInitialTacticalConfig } from "../src/app/tacticalConfig.js";
import { createPrototypeSmokeLocation } from "../src/app/prototypeScenario.js";

describe("createInitialTacticalConfig", () => {
  it("preserves deterministic smoke-scenario settings", () => {
    const location = createPrototypeSmokeLocation();
    const config = createInitialTacticalConfig(location);

    expect(config.lat).toBe(location.lat);
    expect(config.lon).toBe(location.lon);
    expect(config.seed).toBe(1);
    expect(config.useRealTerrain).toBe(false);
    expect(config.battleRequest).toBe(location.battleRequest);
  });

  it("retains existing tactical defaults when no battle request is supplied", () => {
    const config = createInitialTacticalConfig({
      lat: 44.9537,
      lon: -93.09,
      sizeMeters: 350,
    });

    expect(config.sizeMeters).toBe(350);
    expect(config.useRealTerrain).toBe(true);
    expect(config.seed).toBe(1);
    expect(config.battleRequest.sandbox.enabled).toBe(true);
  });
});
