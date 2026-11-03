// Explicit opt-in acceptance against an isolated environment. This script writes a campaign.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

if (process.env.ASX_LIVE_DATABASE_IS_DISPOSABLE !== "1") throw new Error("Set ASX_LIVE_DATABASE_IS_DISPOSABLE=1 only for your prepared isolated API/database.");
const frontend = process.env.ASX_LIVE_FRONTEND ?? "http://127.0.0.1:4175";
const backend = process.env.ASX_LIVE_API ?? "http://localhost:5080";
const repository = process.env.ASX_BACKEND_REPOSITORY;
const python = process.env.ASX_PYTHON;
const scenarioName = process.env.ASX_LIVE_SCENARIO;
const output = path.resolve(process.env.ASX_LIVE_OUTPUT ?? "test-results/live-campaign");
if (!repository || !python || !scenarioName) throw new Error("Set ASX_BACKEND_REPOSITORY, ASX_PYTHON and ASX_LIVE_SCENARIO to an existing real READY scenario.");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage(); const responses = []; const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if (new URL(response.url()).pathname.startsWith("/api/")) responses.push({ method: response.request().method(), url: response.url(), status: response.status() }); });
const headers = { "X-Asx-Dev-Role": "TEST_ENGINEER" };
const name = "Review2 web " + new Date().toISOString(); let evidence = {};
try {
  await page.addInitScript(() => localStorage.setItem("asx-locale", "en")); await page.goto(frontend);
  await page.getByLabel("Dev role", { exact: true }).selectOption("TEST_ENGINEER");
  await page.getByRole("button", { name: "Open development workspace", exact: true }).click();
  await page.locator("aside").getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("button", { name: "Build campaign", exact: true }).click();
  const form = page.getByRole("form", { name: "Campaign builder" });
  await form.getByLabel("Campaign name", { exact: true }).fill(name);
  await form.getByLabel("Search", { exact: true }).fill(scenarioName);
  await form.locator(".ops-ready-card").filter({ hasText: scenarioName }).first().getByRole("checkbox").check();
  const created = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/campaigns");
  await form.getByRole("button", { name: "Save campaign", exact: true }).click();
  const response = await created; expect(response.status()).toBe(201); const campaign = await response.json();
  const row = page.getByRole("row").filter({ has: page.getByRole("button", { name, exact: true }) });
  const started = page.waitForResponse(response => response.url().endsWith(`/campaigns/${campaign.id}/start`));
  await row.getByRole("button", { name: "Start", exact: true }).click(); expect((await started).ok()).toBe(true);
  evidence = { environment: "isolated local API + PostgreSQL 18 (not shared staging)", startedAt: new Date().toISOString(), campaignId: campaign.id, scenarioName };
  await page.screenshot({ path: path.join(output, "queued.png"), fullPage: true });
  let log = "";
  const child = spawn(python, ["-X", "utf8", "tools/campaign_worker.py", "--api", backend, "--campaign-id", campaign.id, "--once", "--cooldown", "0", "--worker-name", `review2-web-${Date.now()}`, "--out", output],
    { cwd: repository, windowsHide: true, env: { ...process.env, ASX_DEV_ROLE: "TEST_ENGINEER", PYTHONIOENCODING: "utf-8" } });
  child.stdout.on("data", data => { log += data; }); child.stderr.on("data", data => { log += data; });
  const exit = new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", code => resolve(code)); });
  const timer = setTimeout(() => child.kill(), 240_000);
  try {
    await page.locator("aside").getByRole("button", { name: "Execution queue", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
    expect(await exit).toBe(0);
  } finally { await exit; clearTimeout(timer); await fs.writeFile(path.join(output, "worker.log"), log); }
  const runsResponse = await context.request.get(`${backend}/api/v1/campaigns/${campaign.id}/runs`, { headers }); expect(runsResponse.ok()).toBe(true);
  const runs = await runsResponse.json(); expect(runs).toHaveLength(1); evidence.runId = runs[0].id;
  const resultResponse = await context.request.get(`${backend}/api/v1/runs/${evidence.runId}/result`, { headers }); const result = await resultResponse.json();
  expect(result.outcome).toBe("COMPLETED"); expect(result.hasVideo).toBe(true); expect(["PASS", "FAIL"]).toContain(result.verdict);
  evidence.result = result;
  await page.reload(); await page.getByLabel("Dev role", { exact: true }).selectOption("TEST_ENGINEER"); await page.getByRole("button", { name: "Open development workspace", exact: true }).click();
  await page.locator("aside").getByRole("button", { name: "Execution queue", exact: true }).click(); await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".ops-verdict").filter({ hasText: result.verdict }).first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(output, "result-reloaded.png"), fullPage: true });
  expect(errors).toEqual([]); expect(responses.filter(item => item.status >= 500)).toEqual([]);
  evidence.accepted = true; evidence.finishedAt = new Date().toISOString(); console.log(JSON.stringify({ campaignId: campaign.id, runId: evidence.runId, accepted: true }));
} catch (error) { evidence.accepted = false; evidence.error = String(error); await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }); throw error; }
finally { evidence.responses = responses; await fs.writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2)); await context.tracing.stop({ path: path.join(output, "trace.zip") }); await browser.close(); }
