import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
if (process.env.ASX_LIVE_DATABASE_IS_DISPOSABLE !== "1") throw new Error("Use only the prepared disposable database.");
const output = path.resolve(process.env.ASX_LIVE_OUTPUT ?? "test-results/live-administration"); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const evidence = { startedAt: new Date().toISOString(), environment: "Isolated local PostgreSQL/API; no Supabase Auth account created" };
const open = name => page.locator("aside").getByRole("button", { name, exact: true }).click();
try {
  await page.addInitScript(() => localStorage.setItem("asx-locale", "en")); await page.goto(process.env.ASX_LIVE_FRONTEND ?? "http://127.0.0.1:4175");
  await page.getByLabel("Dev role", { exact: true }).selectOption("ADMIN"); await page.getByRole("button", { name: "Open development workspace", exact: true }).click();
  await open("User management"); await page.getByLabel("Search users").fill("tester@example.invalid");
  const role = page.getByRole("combobox", { name: "Role for tester@example.invalid" }); await role.selectOption("TEST_REVIEWER");
  await expect(page.getByRole("status").filter({ hasText: "Role saved." })).toBeVisible(); await page.getByRole("button", { name: "Block account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unblock account", exact: true })).toBeEnabled(); await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(role).toHaveValue("TEST_REVIEWER"); await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, "account-persisted.png"), fullPage: true });
  await page.getByRole("button", { name: "Unblock account", exact: true }).click(); await expect(page.getByRole("button", { name: "Block account", exact: true })).toBeEnabled();
  await role.selectOption("TEST_ENGINEER"); await expect(page.getByRole("status").filter({ hasText: "Role saved." })).toBeVisible(); evidence.accountPersistence = true;
  await open("Simulation nodes"); const workerName = "Review2 browser " + Date.now(); await page.getByLabel("Worker name", { exact: true }).fill(workerName);
  await page.getByRole("button", { name: "Register worker", exact: true }).click(); await expect(page.getByText(workerName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh", exact: true }).click(); await expect(page.getByText(workerName, { exact: true })).toBeVisible(); evidence.workerName = workerName;
  await open("Test oracles"); const oracleName = "Review2 browser Oracle " + Date.now(); await page.getByLabel("Configuration name", { exact: true }).fill(oracleName);
  await page.getByRole("button", { name: "Create version", exact: true }).click(); const oracleRow = page.getByRole("row").filter({ hasText: oracleName });
  await oracleRow.getByRole("button", { name: "Activate", exact: true }).click(); await expect(oracleRow.getByRole("button", { name: "Active", exact: true })).toBeDisabled();
  evidence.oracleName = oracleName; await page.screenshot({ path: path.join(output, "oracle-version.png"), fullPage: true });
  await open("Analytics settings"); await page.getByLabel("Retention days", { exact: true }).fill("45"); await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "System settings saved." })).toBeVisible(); await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByLabel("Retention days", { exact: true })).toHaveValue("45"); evidence.retentionDays = 45;
  await open("Audit log"); await expect(page.getByRole("cell").filter({ hasText: "ADMIN_UPDATE_USER" }).first()).toBeVisible(); await page.screenshot({ path: path.join(output, "audit.png"), fullPage: true });
  evidence.accepted = true; evidence.finishedAt = new Date().toISOString(); console.log(JSON.stringify(evidence));
} catch (error) { evidence.accepted = false; evidence.error = String(error); await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }); throw error; }
finally { await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2)); await browser.close(); }
