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
  REPLICA_BATTLE_NO_CONTEXT: "replica-battle-no-context",
  REPLICA_BATTLE_TERRAIN_ONLY: "replica-battle-terrain-only",
  REPLICA_BATTLE_WATER_ONLY: "replica-battle-water-only",
  REPLICA_BATTLE_ROADS_ONLY: "replica-battle-roads-only",
  REPLICA_BATTLE_BUILDINGS_ONLY: "replica-battle-buildings-only",
  REPLICA_BATTLE_VEGETATION_ONLY: "replica-battle-vegetation-only",
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
    id: SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT,
    label: "Replica battle · overscan off",
    description:
      "Open the same benchmark with legacy playable-only rendering for A/B diagnosis.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE_TERRAIN_ONLY,
    label: "Replica diagnostic · terrain only",
    description:
      "Render contextual terrain without OSM feature meshes to isolate ground coverage and material failures.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE_WATER_ONLY,
    label: "Replica diagnostic · water only",
    description:
      "Render contextual terrain plus sourced water geometry to isolate malformed water extents.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE_ROADS_ONLY,
    label: "Replica diagnostic · roads only",
    description:
      "Render contextual terrain plus sourced road and rail geometry to isolate projection and clipping failures.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE_BUILDINGS_ONLY,
    label: "Replica diagnostic · buildings only",
    description:
      "Render contextual terrain plus sourced buildings to isolate footprint, height, and placement failures.",
    startType: SCENARIO_START_TYPES.DIRECT_LOCATION,
    testLab: true,
  }),
  Object.freeze({
    id: SCENARIO_IDS.REPLICA_BATTLE_VEGETATION_ONLY,
    label: "Replica diagnostic · vegetation only",
    description:
      "Render contextual terrain plus sourced vegetation to isolate canopy and tree-placement failures.",
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
    description:
      "Begin at Earth view and normalize the selected location for smoke testing.",
    startType: SCENARIO_START_TYPES.GLOBE,
    testLab: false,
  }),
]);

const SCENARIO_BY_ID = new Map(
  SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

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

function createReplicaBattleLocation({
  contextEnabled,
  diagnosticLayerMode = "all",
}) {
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
      contextEnabled,
      diagnosticLayerMode,
      battleSession: serializeBattleSession(session),
    },
  };
}

const DIAGNOSTIC_SCENARIO_MODES = Object.freeze({
  [SCENARIO_IDS.REPLICA_BATTLE_TERRAIN_ONLY]: "terrain-only",
  [SCENARIO_IDS.REPLICA_BATTLE_WATER_ONLY]: "water-only",
  [SCENARIO_IDS.REPLICA_BATTLE_ROADS_ONLY]: "roads-only",
  [SCENARIO_IDS.REPLICA_BATTLE_BUILDINGS_ONLY]: "buildings-only",
  [SCENARIO_IDS.REPLICA_BATTLE_VEGETATION_ONLY]: "vegetation-only",
});

export function createScenarioLocation(id) {
  if (id === SCENARIO_IDS.PROTOTYPE_SMOKE) {
    return createPrototypeSmokeLocation();
  }

  if (id === SCENARIO_IDS.REPLICA_BATTLE) {
    return createReplicaBattleLocation({ contextEnabled: true });
  }

  if (id === SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT) {
    return createReplicaBattleLocation({ contextEnabled: false });
  }

  const diagnosticLayerMode = DIAGNOSTIC_SCENARIO_MODES[id];
  if (diagnosticLayerMode) {
    return createReplicaBattleLocation({
      contextEnabled: true,
      diagnosticLayerMode,
    });
  }

  return null;
}
