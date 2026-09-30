import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4180/";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  geolocation: { latitude: 16.04331234, longitude: 120.33361234 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const nav = (name) =>
  page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name, exact: true });
mkdirSync("test-results", { recursive: true });
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Around Dagupan", exact: true })
    .waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator(".map-marker").count(), 6);
  let issues = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  assert.deepEqual(
    issues.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
    "Dashboard accessibility",
  );
  await page.screenshot({
    path: "test-results/react-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search roads or barangays" })
    .fill("Perez");
  assert.equal(await page.locator(".map-marker").count(), 1);
  await page
    .getByRole("textbox", { name: "Search roads or barangays" })
    .fill("");
  await page
    .getByRole("button", { name: "Higher levels", exact: true })
    .click();
  assert.equal(await page.locator(".map-marker").count(), 4);
  await page
    .getByRole("button", { name: "All observations", exact: true })
    .click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  assert.equal(await page.locator(".map-list .report-row").count(), 6);
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: "Report a flood", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Road or landmark", exact: true })
    .selectOption("perez");
  await page
    .getByLabel("What should neighbours know?")
    .fill("React browser test observation");
  await page
    .getByRole("button", { name: "Use my location", exact: true })
    .click();
  await page
    .getByLabel("Include my approximate GPS tag", { exact: false })
    .check();
  const photo = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 150;
    const x = c.getContext("2d");
    x.fillStyle = "white";
    x.fillRect(0, 0, 200, 150);
    x.fillStyle = "red";
    x.fillRect(30, 20, 150, 100);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Upload optional photo").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(photo, "base64"),
  });
  await page
    .getByRole("button", { name: "Cover entire photo", exact: true })
    .click();
  await page
    .getByLabel("I reviewed and covered all identifying details.")
    .check();
  await page
    .getByLabel("I’m in a safe place and this is my own observation.")
    .check();
  issues = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  assert.deepEqual(
    issues.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
    "Report form accessibility",
  );
  await page
    .getByRole("button", { name: "Save test report", exact: true })
    .click();
  await page
    .getByText("Report saved on this device. Thank you for testing.", {
      exact: true,
    })
    .waitFor();
  await nav("My reports").click();
  await page
    .getByRole("button", {
      name: "Read report for Perez Boulevard",
      exact: true,
    })
    .click();
  const image = page.getByAltText(
    "Contributor supplied flood observation with privacy edits",
  );
  await image.waitFor();
  const pixel = await image.evaluate(async (img) => {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    return [...x.getImageData(100, 75, 1, 1).data];
  });
  assert.ok(
    pixel[0] < 5 && pixel[1] < 8 && pixel[2] < 115,
    "Redaction is baked into stored JPEG",
  );
  await page
    .getByText("Approximate GPS: 16.043, 120.334 · unverified")
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Your corner of the community.",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Report a flood", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Road or landmark", exact: true })
    .selectOption("arellano");
  await page
    .getByLabel("What should neighbours know?")
    .fill("Offline React observation");
  await page
    .getByLabel("I’m in a safe place and this is my own observation.")
    .check();
  await page
    .getByRole("button", { name: "Save test report", exact: true })
    .click();
  await page
    .getByText("Report saved on this device. Thank you for testing.", {
      exact: true,
    })
    .waitFor();
  await page.reload();
  await page.getByText("Offline React observation", { exact: true }).waitFor();
  await context.setOffline(false);
  await page
    .getByRole("button", {
      name: "Read report for Perez Boulevard",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Remove my report" }).click();
  await page
    .getByRole("button", { name: "Remove record", exact: true })
    .click();
  await page.getByText("Record removed.", { exact: true }).waitFor();
  await nav("Route check").click();
  await page
    .getByRole("button", { name: "Check observations", exact: true })
    .click();
  await page
    .getByText(
      "Route safety is unverified. No validated routing engine is connected.",
      { exact: true },
    )
    .waitFor();
  await nav("Safety hub").click();
  await page
    .getByRole("button", { name: "Record a test help request", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Nearest road or landmark", exact: true })
    .selectOption("arellano");
  await page
    .getByLabel(
      "I understand this is a local test record, not a rescue request to responders.",
    )
    .check();
  await page
    .getByRole("button", { name: "Save test help record", exact: true })
    .click();
  await page
    .getByText("Test help record saved. No responders were notified.", {
      exact: true,
    })
    .waitFor();
  await nav("My reports").click();
  await page.getByText(/Saved on this device · not dispatched/).waitFor();
  await page
    .getByRole("button", { name: "Remove help record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove record", exact: true })
    .click();
  await nav("Flood map").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: "test-results/react-mobile.png" });
  const mobileNav = page.getByRole("navigation", {
    name: "Mobile navigation",
    exact: true,
  });
  for (const name of [
    "Flood map",
    "Reports",
    "Route check",
    "Safety hub",
    "My reports",
  ]) {
    await mobileNav.getByRole("button", { name, exact: true }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${name} has no mobile overflow`,
    );
  }
  await page
    .getByRole("button", { name: "Report a flood", exact: true })
    .click();
  await page.screenshot({ path: "test-results/react-mobile-report.png" });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "320px layout",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React rendering, filtering, map/list switch, GPS, photo redaction, CRUD, offline reload and reporting, help records, route checks, desktop/mobile layouts, and WCAG scans.",
  );
} finally {
  await browser.close();
}
