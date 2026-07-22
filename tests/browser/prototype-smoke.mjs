import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BATTLE_EARTH_BASE_URL ?? "http://127.0.0.1:4173";
const artifactDir = process.env.BROWSER_ARTIFACT_DIR ?? "browser-artifacts";
const events = [];

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});

async function createInstrumentedPage() {
  const nextPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  nextPage.on("console", (message) => {
    events.push({
      type: "console",
      level: message.type(),
      text: message.text(),
    });
  });
  nextPage.on("pageerror", (error) => {
    events.push({
      type: "pageerror",
      message: error.message,
      stack: error.stack,
    });
  });
  nextPage.on("requestfailed", (request) => {
    events.push({
      type: "requestfailed",
      url: request.url(),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });

  await nextPage.route("**/*", async (route) => {
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

  return nextPage;
}

let page = await createInstrumentedPage();

async function waitForButton(pattern) {
  const button = page.getByRole("button", { name: pattern }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  return button;
}

async function waitForGeneratedCanvas() {
  const loadingOverlay = page.getByText("Generating map...", { exact: true });
  await loadingOverlay.waitFor({ state: "hidden", timeout: 90_000 });

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 45_000 });
  return canvas;
}

async function assertContextualGeneration(canvas) {
  const contextual = await canvas.evaluate((element) => ({
    status: element.dataset.contextualGeneration,
    playableWidth: Number(element.dataset.playableWidthMeters),
    playableDepth: Number(element.dataset.playableDepthMeters),
    renderWidth: Number(element.dataset.renderWidthMeters),
    renderDepth: Number(element.dataset.renderDepthMeters),
    outerSkirtVisible: element.dataset.outerSkirtVisible,
    renderedAreaMultiplier: Number(element.dataset.renderedAreaMultiplier),
    renderedAreaIncreasePercent: Number(
      element.dataset.renderedAreaIncreasePercent,
    ),
    generationDurationMs: Number(element.dataset.generationDurationMs),
    measurementsAvailable:
      element.dataset.contextualMeasurementsAvailable === "true",
  }));

  if (contextual.status !== "ready") {
    throw new Error("Contextual generation diagnostics were not exposed.");
  }
  if (
    !(contextual.renderWidth > contextual.playableWidth) ||
    !(contextual.renderDepth > contextual.playableDepth)
  ) {
    throw new Error(
      `Rendered context did not exceed playable bounds: ${JSON.stringify(contextual)}`,
    );
  }
  if (contextual.outerSkirtVisible !== "false") {
    throw new Error("The legacy flat outer skirt remained enabled.");
  }
  if (
    !(contextual.renderedAreaMultiplier > 1) ||
    !(contextual.renderedAreaIncreasePercent > 0)
  ) {
    throw new Error(
      `Contextual area impact was not reported: ${JSON.stringify(contextual)}`,
    );
  }
  if (
    !contextual.measurementsAvailable ||
    !(contextual.generationDurationMs >= 0)
  ) {
    throw new Error(
      `Contextual runtime measurement was unavailable: ${JSON.stringify(contextual)}`,
    );
  }
}

async function verifyTestLabLaunchers() {
  await page.goto(`${baseUrl}/?dev=1`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page
    .getByRole("heading", { name: "Replica Neighborhood Test Lab" })
    .waitFor({ state: "visible", timeout: 30_000 });

  const directBattle = await waitForButton(/^Jump to replica battle/i);
  await directBattle.click();
  await page.getByText("Sandbox Mode", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });
  await assertContextualGeneration(await waitForGeneratedCanvas());

  const returnButton = await waitForButton(/^← Globe$/i);
  await returnButton.click();
  await page
    .getByRole("heading", { name: "Replica Neighborhood Test Lab" })
    .waitFor({ state: "visible", timeout: 30_000 });

  const fullSlice = await waitForButton(/^Play full vertical slice/i);
  await fullSlice.click();
  await page.getByText("Campaign Lobby", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });
}

async function enterTacticalFromGlobe() {
  await page.goto(`${baseUrl}/?scenario=prototype-globe-smoke`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.getByText("Campaign Lobby", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });

  const settings = await waitForButton(/^Settings$/i);
  await settings.click();

  const knownLocation = page
    .getByRole("button", { name: /^St\. Paul \/ Harriet Island/i })
    .first();
  await knownLocation.waitFor({ state: "visible", timeout: 30_000 });
  await knownLocation.click();

  await page.getByRole("heading", { name: "St. Paul", exact: true }).waitFor({
    state: "visible",
    timeout: 30_000,
  });

  const generateBattle = await waitForButton(/^Generate City Battle/i);
  await generateBattle.click();

  const deployAnyway = await waitForButton(/^Deploy anyway$/i);
  await deployAnyway.click();
}

function deploymentCandidatesForCanvas(box) {
  const xFractions = [0.18, 0.28, 0.38, 0.48, 0.58];
  const yFractions = [0.32, 0.44, 0.56, 0.68, 0.78];

  return yFractions.flatMap((yFraction) =>
    xFractions.map((xFraction) => ({
      x: Math.round(box.width * xFraction),
      y: Math.round(box.height * yFraction),
    })),
  );
}

async function deployFriendlySquad(canvas) {
  const deployFriendly = await waitForButton(/^Deploy Friendly$/i);
  const squadButton = page.locator('button[aria-label^="Select "]').first();
  const canvasBox = await canvas.boundingBox();

  if (!canvasBox) {
    throw new Error("Smoke-test canvas had no measurable bounds.");
  }

  const candidatePositions = deploymentCandidatesForCanvas(canvasBox);

  for (const position of candidatePositions) {
    await deployFriendly.click();
    await canvas.click({ position });

    try {
      await squadButton.waitFor({ state: "visible", timeout: 1_500 });
      return squadButton;
    } catch {
      // Try the next deterministic position. Deployment can be rejected on roads,
      // buildings, water, or outside the friendly side of the playable bounds.
    }
  }

  throw new Error(
    `Friendly squad did not deploy at any of ${candidatePositions.length} smoke-test positions.`,
  );
}

try {
  await verifyTestLabLaunchers();
  await page.close();
  page = await createInstrumentedPage();

  await enterTacticalFromGlobe();

  await page.getByText("Sandbox Mode", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });
  await page.getByText("St. Paul", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 45_000,
  });

  const canvas = await waitForGeneratedCanvas();
  const friendlyUnit = await deployFriendlySquad(canvas);
  await friendlyUnit.click();

  const moveButton = await waitForButton(/^Move$/i);
  await moveButton.click();
  await canvas.click({ position: { x: 760, y: 430 } });

  await friendlyUnit.click();
  const holdButton = await waitForButton(/^Hold$/i);
  await holdButton.click();

  await page.waitForTimeout(2_000);

  const stageFailureVisible = await page
    .getByText("Stage failed to load", { exact: true })
    .isVisible()
    .catch(() => false);
  if (stageFailureVisible) {
    throw new Error("The tactical stage entered its error boundary.");
  }

  const pageErrors = events.filter((event) => event.type === "pageerror");
  if (pageErrors.length > 0) {
    throw new Error(
      `Browser emitted ${pageErrors.length} page error event(s).`,
    );
  }

  await page.screenshot({
    path: `${artifactDir}/prototype-smoke-success.png`,
    fullPage: true,
  });
} catch (error) {
  events.push({
    type: "test-failure",
    message: error.message,
    stack: error.stack,
  });
  await page
    .screenshot({
      path: `${artifactDir}/prototype-smoke-failure.png`,
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${artifactDir}/browser-events.json`,
    `${JSON.stringify(events, null, 2)}\n`,
  );
  await browser.close();
}
