export const CONTEXTUAL_VISUAL_SCENARIOS = Object.freeze([
  "replica-battle-terrain-only",
  "replica-battle-water-only",
  "replica-battle-roads-only",
  "replica-battle-buildings-only",
  "replica-battle-vegetation-only",
  "replica-battle",
  "replica-battle-no-context",
]);

export function validateContextualVisualReportCoverage(
  report,
  expectedScenarios = CONTEXTUAL_VISUAL_SCENARIOS,
) {
  const errors = [];
  if (!Array.isArray(report)) {
    return ["contextual visual report must be an array"];
  }

  const counts = new Map();
  for (const entry of report) {
    const scenario = entry?.scenario;
    if (typeof scenario !== "string" || scenario.length === 0) {
      errors.push("report contained an entry without a scenario");
      continue;
    }
    counts.set(scenario, (counts.get(scenario) ?? 0) + 1);
  }

  for (const scenario of expectedScenarios) {
    const count = counts.get(scenario) ?? 0;
    if (count === 0) errors.push(`missing scenario ${scenario}`);
    if (count > 1) errors.push(`duplicate scenario ${scenario}`);
  }

  const expected = new Set(expectedScenarios);
  for (const scenario of counts.keys()) {
    if (!expected.has(scenario)) errors.push(`unexpected scenario ${scenario}`);
  }

  return errors;
}
