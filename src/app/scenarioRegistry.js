import {
  createDevelopmentBattleSession,
  serializeBattleSession,
} from "../domain/BattleSession.js";
import { createPrototypeSmokeLocation } from "./prototypeScenario.js";

export const SCENARIO_IDS = Object.freeze({
  PROTOTYPE_SMOKE: "prototype-smoke",
  PROTOTYPE_GLOBE_SMOKE: "prototype-globe-smoke",
  VERTICAL_SLICE_FULL: "vertical-slice-full",
  REPLICA_BATTLE: "replica-battle",
});

export const SCENARIO_START_TYPES = Object.freeze({
  GLOBE: "globe",
  DIRECT_LOCATION: "direct-location",
});

const SCENARIOS = Object.freeze([
  Object.freeze({
    id: SCENARIO_IDS.VERTICAL_SLICE_FULL,
    label: "Play full vertical slice",
    description: "Start at Earth view and follow the intended player journey.",
    startType: SCENARIO_START_TYPES.GLOBE,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE,
    label: "Jump to replica battle",
    description: "Open the deterministic Replica Neighborhood benchmark battle.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.PROTOTYPE_SMOKE,
    label: "Prototype tactical smoke",
    description: "Direct deterministic tactical entry used by browser validation.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: false,
  }),
  Object.freeze({
    id: SCENARIO_IDS.PROTOTYPE_GLOBE_SMOKE,
    label: "Prototype globe smoke",
    description: "Begin at Earth view and normalize the selected location for smoke testing.",
    startType: SCENARIO_START_TYPES.GLOBE,
    testLab: false,
  }),
]);

const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function listScenarios({ testLabOnly = false } = {}) {
  return SCENARIOS.filter((scenario) => !testLabOnly || scenario.testLab);
}

export function getScenario(id) {
  return SCENARIO_BY_ID.get(id) ?? null;
}

export function readScenarioId(search = "") {
  return new URLSearchParams(search).get("scenario");
}

export function isTestLabEnabled(search = "", isDevelopment = false) {
  const params = new URLSearchParams(search);
  return isDevelopment || params.get("dev") === "1";
}

export function createScenarioLocation(id) {
  if (id === SCENARIO_IDS.PROTOTYPE_SMOKE) {
    return createPrototypeSmokeLocation();
  }

  if (id === SCENARIO_IDS.REPLICA_BATTLE) {
    const session = createDevelopmentBattleSession();
    const location = createPrototypeSmokeLocation();
    return {
      ...location,
      lat: session.geographicContext.location.lat,
      lon: session.geographicContext.location.lon,
      battleRequest: {
        ...location.battleRequest,
        selectedName: session.geographicContext.name,
        region: session.geographicContext.hierarchy.join(" / "),
        seed: session.seed,
        battleSession: serializeBattleSession(session),
      },
    };
  }

  return null;
}
