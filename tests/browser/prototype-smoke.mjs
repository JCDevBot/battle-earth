import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl =
  process.env.BATTLE_EARTH_BASE_URL ?? "http://127.0.0.1:4173";
const artifactDir =
  process.env.BROWSER_ARTIFACT_DIR ?? "browser-artifacts";
const events = [];

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (message) => {
  events.push({
    type: "console",
    level: message.type(),
    text: message.text(),
  });
});
page.on("pageerror", (error) => {
  events.push({
    type: "pageerror",
    message: error.message,
    stack: error.stack,
  });
});
page.on("requestfailed", (request) => {
  events.push({
    type: "requestfailed",
    url: request.url(),
    failure: request.failure()?.errorText ?? "unknown",
  });
});

async function waitForButton(pattern) {
  const button = page.getByRole("button", { name: pattern }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  return button;
}

async function deployFriendlySquad(canvas) {
  const deployFriendly = await waitForButton(/^Deploy Friendly$/i);
  await deployFriendly.click();

  const squadButton = page.locator('button[aria-label^="Select "]').first();
  const candidatePositions = [
    { x: 720, y: 470 },
    { x: 620, y: 520 },
    { x: 820, y: 420 },
    { x: 520, y: 470 },
  ];

  for (const position of candidatePositions) {
    await canvas.click({ position });

    try {
      await squadButton.waitFor({ state: "visible", timeout: 3_000 });
      return squadButton;
    } catch {
      await deployFriendly.click();
    }
  }

  throw new Error("Friendly squad did not deploy at any smoke-test position.");
}

try {
  await page.goto(`${baseUrl}/?scenario=prototype-smoke`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.getByText("Sandbox Mode", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });
  await page.getByText("Saint Paul smoke test", { exact: true }).waitFor({
    state: "visible",
    timeout: 45_000,
  });

  const loadingOverlay = page.getByText("Generating map...", { exact: true });
  await loadingOverlay.waitFor({ state: "hidden", timeout: 90_000 });

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 45_000 });

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
    throw new Error(`Browser emitted ${pageErrors.length} page error event(s).`);
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
