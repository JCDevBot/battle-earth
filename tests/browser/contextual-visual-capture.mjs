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
      await page.goto(`${baseUrl}/?scenario=${scenario}`, {
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
      }));

      const screenshot = `${artifactDir}/contextual-${scenario}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      report.push({
        scenario,
        status: "captured",
        screenshot,
        diagnostics,
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

const failures = report.filter((entry) => entry.status === "failed");
if (failures.length > 0) {
  throw new Error(
    `Failed to capture ${failures.length} contextual diagnostic scenario(s): ${failures
      .map((entry) => entry.scenario)
      .join(", ")}`,
  );
}
