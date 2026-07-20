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
  });

  it("keeps full-flow scenarios at Earth view", () => {
    expect(getScenario(SCENARIO_IDS.VERTICAL_SLICE_FULL)).toMatchObject({
      startType: SCENARIO_START_TYPES.GLOBE,
      testLab: true,
    });
    expect(createScenarioLocation(SCENARIO_IDS.VERTICAL_SLICE_FULL)).toBeNull();
  });
});
