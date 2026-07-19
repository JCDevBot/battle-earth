import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.BATTLE_EARTH_BASE_URL ?? "http://127.0.0.1:4173";
const artifactDir = process.env.BROWSER_ARTIFACT_DIR ?? "browser-artifacts";
const events = [];

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (message) => {
  const entry = { type: "console", level: message.type(), text: message.text() };
  events.push(entry);
});
page.on("pageerror", (error) => {
  events.push({ type: "pageerror", message: error.message, stack: error.stack });
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

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 45_000 });

  const deployFriendly = await waitForButton(/friendly/i);
  await deployFriendly.click();
  await canvas.click({ position: { x: 520, y: 470 } });

  const friendlyUnit = page.getByRole("button", { name: /select .*friendly|select .*squad/i }).first();
  await friendlyUnit.waitFor({ state: "visible", timeout: 30_000 });
  await friendlyUnit.click();

  const holdButton = await waitForButton(/^hold$/i);
  await holdButton.click();

  await page.waitForTimeout(2_000);

  const blockingErrors = events.filter(
    (event) =>
      event.type === "pageerror" ||
      (event.type === "console" && event.level === "error"),
  );

  if (blockingErrors.length > 0) {
    throw new Error(`Browser emitted ${blockingErrors.length} blocking error event(s).`);
  }

  await page.screenshot({
    path: `${artifactDir}/prototype-smoke-success.png`,
    fullPage: true,
  });
} catch (error) {
  events.push({ type: "test-failure", message: error.message, stack: error.stack });
  await page.screenshot({
    path: `${artifactDir}/prototype-smoke-failure.png`,
    fullPage: true,
  }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${artifactDir}/browser-events.json`,
    `${JSON.stringify(events, null, 2)}\n`,
  );
  await browser.close();
}
