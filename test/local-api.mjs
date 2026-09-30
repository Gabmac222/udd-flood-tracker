import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("heading", { name: "Around Dagupan" }).waitFor();
  await page
    .getByRole("button", { name: "Report a flood", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Road or landmark", exact: true })
    .selectOption("arellano");
  await page
    .getByRole("textbox", { name: "What should neighbours know?" })
    .fill("Synthetic React API integration check");
  await page
    .getByLabel("I’m in a safe place and this is my own observation.")
    .check();
  await page
    .getByRole("button", { name: "Save test report", exact: true })
    .click();
  await page
    .getByText("Report saved to your local test server.", { exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "My reports", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Read report for Arellano Street",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Remove my report", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove record", exact: true })
    .click();
  await page.getByText("Record removed.", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React local API mode creates and removes a SQLite report through the Vite proxy.",
  );
} finally {
  await browser.close();
}
