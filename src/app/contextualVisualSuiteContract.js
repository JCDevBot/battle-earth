import { SCENARIO_IDS } from "./scenarioRegistry.js";

const CONTEXTUAL_SCENARIOS = [
  SCENARIO_IDS.REPLICA_BATTLE_TERRAIN_ONLY,
  SCENARIO_IDS.REPLICA_BATTLE_WATER_ONLY,
  SCENARIO_IDS.REPLICA_BATTLE_ROADS_ONLY,
  SCENARIO_IDS.REPLICA_BATTLE_BUILDINGS_ONLY,
  SCENARIO_IDS.REPLICA_BATTLE_VEGETATION_ONLY,
  SCENARIO_IDS.REPLICA_BATTLE,
];
const REQUIRED_SCENARIOS = [
  ...CONTEXTUAL_SCENARIOS,
  SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT,
];
const REQUIRED_SCENARIO_SET = new Set(REQUIRED_SCENARIOS);

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dimensions(entry) {
  const diagnostics = entry?.diagnostics ?? {};
  return {
    playableWidth: finiteNumber(diagnostics.playableWidthMeters),
    playableDepth: finiteNumber(diagnostics.playableDepthMeters),
    renderWidth: finiteNumber(diagnostics.renderWidthMeters),
    renderDepth: finiteNumber(diagnostics.renderDepthMeters),
  };
}

function sameDimensions(left, right) {
  return (
    left.playableWidth === right.playableWidth &&
    left.playableDepth === right.playableDepth &&
    left.renderWidth === right.renderWidth &&
    left.renderDepth === right.renderDepth
  );
}

/**
 * Validates invariants that only become visible when the complete contextual
 * visual-capture suite is considered together. Individual route validation
 * remains the responsibility of contextualVisualContract.
 */
export function validateContextualVisualSuite(report = []) {
  const errors = [];
  if (!Array.isArray(report)) {
    return ["visual capture report was not an array"];
  }

  const entriesByScenario = new Map();
  for (const entry of report) {
    const scenario = entry?.scenario;
    if (!REQUIRED_SCENARIO_SET.has(scenario)) {
      errors.push(`unexpected visual capture for ${scenario ?? "unknown scenario"}`);
      continue;
    }
    if (entriesByScenario.has(scenario)) {
      errors.push(`duplicate visual capture for ${scenario}`);
      continue;
    }
    entriesByScenario.set(scenario, entry);
  }

  for (const scenario of REQUIRED_SCENARIOS) {
    const entry = entriesByScenario.get(scenario);
    if (!entry) {
      errors.push(`missing visual capture for ${scenario}`);
      continue;
    }
    if (entry.status !== "captured") {
      errors.push(`visual capture was not valid for ${scenario}`);
    }
    if ((entry.events ?? []).length > 0) {
      errors.push(`browser events were recorded for ${scenario}`);
    }
  }

  const baseline = entriesByScenario.get(SCENARIO_IDS.REPLICA_BATTLE);
  if (!baseline?.diagnostics) return errors;
  const baselineDimensions = dimensions(baseline);

  for (const scenario of CONTEXTUAL_SCENARIOS) {
    const entry = entriesByScenario.get(scenario);
    if (!entry?.diagnostics) continue;
    if (!sameDimensions(dimensions(entry), baselineDimensions)) {
      errors.push(`contextual dimensions diverged for ${scenario}`);
    }
  }

  const control = entriesByScenario.get(SCENARIO_IDS.REPLICA_BATTLE_NO_CONTEXT);
  if (control?.diagnostics) {
    const controlDimensions = dimensions(control);
    if (
      controlDimensions.playableWidth !== baselineDimensions.playableWidth ||
      controlDimensions.playableDepth !== baselineDimensions.playableDepth
    ) {
      errors.push("no-context control changed playable dimensions");
    }
  }

  return errors;
}
