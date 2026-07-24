import { readFile } from "node:fs/promises";
import { validateContextualVisualContract } from "../../src/app/contextualVisualContract.js";
import { validateContextualVisualReportCoverage } from "../../src/app/contextualVisualReport.js";

const artifactDir = process.env.BROWSER_ARTIFACT_DIR ?? "browser-artifacts";
const reportPath = `${artifactDir}/contextual-visual-report.json`;
const report = JSON.parse(await readFile(reportPath, "utf-8"));

const coverageErrors = validateContextualVisualReportCoverage(report);
if (coverageErrors.length > 0) {
  throw new Error(
    `Contextual visual report coverage failed:\n${coverageErrors
      .map((error) => `- ${error}`)
      .join("\n")}`,
  );
}

const failures = [];
for (const entry of report) {
  if (entry?.status !== "captured") {
    failures.push({
      scenario: entry?.scenario ?? "unknown",
      errors: [`capture status was ${entry?.status ?? "missing"}`],
    });
    continue;
  }

  const errors = validateContextualVisualContract(
    entry.scenario,
    entry.diagnostics,
  );
  if (errors.length > 0) {
    failures.push({ scenario: entry.scenario, errors });
  }
}

if (failures.length > 0) {
  throw new Error(
    `Contextual visual contract failed:\n${failures
      .map(({ scenario, errors }) => `- ${scenario}: ${errors.join("; ")}`)
      .join("\n")}`,
  );
}
