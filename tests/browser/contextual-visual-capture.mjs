import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BATTLE_EARTH_BASE_URL ?? "http://127.0.0.1:4173";
const artifactDir = process.env.BROWSER_ARTIFACT_DIR ?? "browser-artifacts";
const routes = [
  "replica-battle-terrain-only",
  "replica-battle-water-only",
  "replica-battle-roads-only",
  "replica-battle-buildings-only",
  "replica-battle-vegetation-only",
  "replica-battle",
  "replica-battle-no-context",
];

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateContextContract(scenario, diagnostics) {
  const errors = [];
  const playableWidth = numberOrNull(diagnostics.playableWidthMeters);
  const playableDepth = numberOrNull(diagnostics.playableDepthMeters);
  const renderWidth = numberOrNull(diagnostics.renderWidthMeters);
  const renderDepth = numberOrNull(diagnostics.renderDepthMeters);

  if (diagnostics.contextualGeneration !== "ready") {
    errors.push("contextual generation did not report ready");
  }
  if ([playableWidth, playableDepth, renderWidth, renderDepth].includes(null)) {
    errors.push("one or more map dimensions were unavailable");
    return errors;
  }

  if (scenario === "replica-battle-no-context") {
    if (renderWidth !== playableWidth || renderDepth !== playableDepth) {
      errors.push("no-context control unexpectedly expanded render dimensions");
    }
    if (diagnostics.outerSkirtVisible !== "true") {
      errors.push("no-context control did not retain the legacy outer skirt");
    }
    return errors;
  }

  if (renderWidth <= playableWidth || renderDepth <= playableDepth) {
    errors.push("contextual route did not expand both render dimensions");
  }
  if (diagnostics.outerSkirtVisible !== "false") {
    errors.push("contextual route still reports the legacy outer skirt");
  }
  return errors;
}

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const report = [];

try {
  for (const scenario of routes) {
    const events = [];
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });

    page.on("pageerror", (error) => {
      events.push({ type: "pageerror", message: error.message });
    });
    page.on("requestfailed", (request) => {
      events.push({
        type: "requestfailed",
        url: request.url(),
        failure: request.failure()?.errorText ?? "unknown",
      });
    });

    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (
        url.includes("overpass-api.de") ||
        url.includes("overpass.kumi.systems") ||
        url.includes("overpass.openstreetmap.ru")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ elements: [] }),
        });
        return;
      }
      await route.continue();
    });

    try {
      const scenarioUrl = `${baseUrl}/?scenario=${scenario}`;
      await page.goto(scenarioUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const loadingOverlay = page.getByText("Generating map...", {
        exact: true,
      });
      await loadingOverlay.waitFor({ state: "hidden", timeout: 90_000 });

      const canvas = page.locator("canvas").first();
      await canvas.waitFor({ state: "visible", timeout: 45_000 });
      await page.waitForTimeout(1_000);

      const diagnostics = await canvas.evaluate((element) => ({
        contextualGeneration: element.dataset.contextualGeneration ?? null,
        playableWidthMeters: element.dataset.playableWidthMeters ?? null,
        playableDepthMeters: element.dataset.playableDepthMeters ?? null,
        renderWidthMeters: element.dataset.renderWidthMeters ?? null,
        renderDepthMeters: element.dataset.renderDepthMeters ?? null,
        outerSkirtVisible: element.dataset.outerSkirtVisible ?? null,
        suspiciousGeometry: element.dataset.contextualSuspiciousGeometry ?? null,
        waterFeaturesInspected:
          element.dataset.contextualWaterFeaturesInspected ?? null,
        waterFeaturesInvalid:
          element.dataset.contextualWaterFeaturesInvalid ?? null,
        waterFeaturesQuarantined:
          element.dataset.contextualWaterFeaturesQuarantined ?? null,
      }));
      const canvasBounds = await canvas.boundingBox();
      const contractErrors = validateContextContract(scenario, diagnostics);

      const screenshot = `${artifactDir}/contextual-${scenario}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      report.push({
        scenario,
        scenarioUrl,
        status: contractErrors.length === 0 ? "captured" : "invalid",
        screenshot,
        canvasBounds,
        diagnostics,
        contractErrors,
        events,
      });
    } catch (error) {
      const screenshot = `${artifactDir}/contextual-${scenario}-failure.png`;
      await page
        .screenshot({ path: screenshot, fullPage: true })
        .catch(() => {});
      report.push({
        scenario,
        status: "failed",
        screenshot,
        error: error.message,
        events,
      });
    } finally {
      await page.close();
    }
  }
} finally {
  await writeFile(
    `${artifactDir}/contextual-visual-report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await browser.close();
}

const failures = report.filter((entry) => entry.status !== "captured");
if (failures.length > 0) {
  throw new Error(
    `Invalid contextual capture for ${failures.length} scenario(s): ${failures
      .map((entry) => entry.scenario)
      .join(", ")}`,
  );
}
