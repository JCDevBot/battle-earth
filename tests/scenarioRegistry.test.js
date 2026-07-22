import { describe, expect, it } from "vitest";
import {
  SCENARIO_IDS,
  SCENARIO_START_TYPES,
  createScenarioLocation,
  getScenario,
  isTestLabEnabled,
  listScenarios,
  readScenarioId,
} from "../src/app/scenarioRegistry.js";
import { restoreBattleSession } from "../src/domain/BattleSession.js";

describe("scenario registry", () => {
  it("lists only explicit Test Lab entries when requested", () => {
    const scenarios = listScenarios({ testLabOnly: true });

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      SCENARIO_IDS.VERTICAL_SLICE_FULL,
      SCENARIO_IDS.REPLICA_BATTLE,
      SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT,
      SCENARIO_IDS.REPLICA_BATTLE_TERRAIN_ONLY,
      SCENARIO_IDS.REPLICA_BATTLE_WATER_ONLY,
    ]);
    expect(
      scenarios.every((scenario) =>
        Object.values(SCENARIO_START_TYPES).includes(scenario.startType),
      ),
    ).toBe(true);
  });

  it("reads stable scenario IDs from a URL query", () => {
    expect(readScenarioId("?scenario=replica-battle&dev=1")).toBe(
      SCENARIO_IDS.REPLICA_BATTLE,
    );
    expect(readScenarioId("")).toBeNull();
  });

  it("enables the Test Lab only in development or by explicit query", () => {
    expect(isTestLabEnabled("", false)).toBe(false);
    expect(isTestLabEnabled("?dev=1", false)).toBe(true);
    expect(isTestLabEnabled("", true)).toBe(true);
  });

  it("creates the replica benchmark through the normal tactical location contract", () => {
    const location = createScenarioLocation(SCENARIO_IDS.REPLICA_BATTLE);
    const session = restoreBattleSession(location.battleRequest.battleSession);

    expect(location.lat).toBe(session.geographicContext.location.lat);
    expect(location.lon).toBe(session.geographicContext.location.lon);
    expect(location.battleRequest.selectedName).toBe(
      "St. Paul / Harriet Island",
    );
    expect(location.battleRequest.seed).toBe(session.seed);
    expect(location.battleRequest.contextEnabled).toBe(true);
    expect(location.battleRequest.diagnosticLayerMode).toBe("all");
  });

  it("creates a matched overscan-off benchmark for visual A/B diagnosis", () => {
    const withContext = createScenarioLocation(SCENARIO_IDS.REPLICA_BATTLE);
    const withoutContext = createScenarioLocation(
      SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT,
    );

    expect(withoutContext).toMatchObject({
      lat: withContext.lat,
      lon: withContext.lon,
      sizeMeters: withContext.sizeMeters,
    });
    expect(withoutContext.battleRequest).toMatchObject({
      selectedName: withContext.battleRequest.selectedName,
      seed: withContext.battleRequest.seed,
      contextEnabled: false,
      diagnosticLayerMode: "all",
    });
  });

  it("creates matched terrain-only and water-only diagnostics", () => {
    const terrainOnly = createScenarioLocation(
      SCENARIO_IDS.REPLICA_BATTLE_TERRAIN_ONLY,
    );
    const waterOnly = createScenarioLocation(
      SCENARIO_IDS.REPLICA_BATTLE_WATER_ONLY,
    );

    expect(terrainOnly.battleRequest).toMatchObject({
      contextEnabled: true,
      diagnosticLayerMode: "terrain-only",
    });
    expect(waterOnly).toMatchObject({
      lat: terrainOnly.lat,
      lon: terrainOnly.lon,
      sizeMeters: terrainOnly.sizeMeters,
    });
    expect(waterOnly.battleRequest).toMatchObject({
      selectedName: terrainOnly.battleRequest.selectedName,
      seed: terrainOnly.battleRequest.seed,
      contextEnabled: true,
      diagnosticLayerMode: "water-only",
    });
  });

  it("keeps full-flow scenarios at Earth view", () => {
    expect(getScenario(SCENARIO_IDS.VERTICAL_SLICE_FULL)).toMatchObject({
      startType: SCENARIO_START_TYPES.GLOBE,
      testLab: true,
    });
    expect(createScenarioLocation(SCENARIO_IDS.VERTICAL_SLICE_FULL)).toBeNull();
  });
});
