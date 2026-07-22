import { APP_STAGES, normalizeSelectedLocation } from "./stageRouting.js";

export const PROTOTYPE_SMOKE_SCENARIO = Object.freeze({
  name: "Deterministic tactical smoke scenario",
  location: Object.freeze({
    lat: 44.9537,
    lon: -93.09,
    sizeMeters: 350,
    battleRequest: Object.freeze({
      launchType: APP_STAGES.TACTICAL,
      playerMode: "sandbox",
      gameMode: "freeplay",
      scale: "testSlice",
      selectedName: "Saint Paul smoke test",
      mapAspect: "square",
      mapWidthMeters: 350,
      mapDepthMeters: 350,
      sizeMeters: 350,
      seed: 1,
      useRealTerrain: false,
      contextEnabled: false,
      sandbox: Object.freeze({
        enabled: true,
        allowBothSides: true,
        allowManualDeployment: true,
      }),
    }),
  }),
});

export function createPrototypeSmokeLocation() {
  const location = PROTOTYPE_SMOKE_SCENARIO.location;

  return normalizeSelectedLocation({
    ...location,
    battleRequest: {
      ...location.battleRequest,
      sandbox: { ...location.battleRequest.sandbox },
    },
  });
}
