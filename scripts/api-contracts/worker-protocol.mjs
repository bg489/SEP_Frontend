// Mock-only verification. No real API, browser, CARLA, database, or external file is contacted.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const source = await readFile(resolve(root, "src/services/workerProtocol.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { workerProtocol, validateTelemetryText, isRunGuid, isWorkerUploadSizeValid, hasMp4Header, canRequeueInfrastructure,
  TELEMETRY_MAX_BYTES, VIDEO_MAX_BYTES } = mod;
const runId = "39f7ea13-835f-42fc-a0e7-359ed350d4bc";
const campaignId = "8aa605f6-142e-40a7-8973-9dc413a3d24b";
const versionId = "8a4c1de8-7826-4376-bfca-41e8ad0db125";
const otherId = "bf88484f-0d0e-4fe9-9310-d02aff944434";
const hash = "sha256:original-recording-version-hash";
const target = { runId, scenarioVersionId: versionId, contentHash: hash };
const calls = [];
const coverage = new Set();
let nextResponse;
const client = {
  async request(path, init) { coverage.add(`${init?.method ?? "GET"} ${path}`); calls.push({ type: "request", path, init }); return nextResponse; },
  async download(path, name) { coverage.add(`GET ${path}`); calls.push({ type: "download", path, name }); },
};
const api = workerProtocol(client);
const cases = [];
const check = (name, fn) => cases.push({ name, fn });
const recordedHeader = { kind: "header", format: "asx.telemetry/1", run_id: runId, scenario_version_id: versionId,
  content_hash: hash, carla_version: "0.9.16", ego_extent: { x: 2.4, y: 1 }, goal: { x: 30, y: 20 }, warmup_s: 1, route_speed_limit_kmh: 50 };
const recordedTick = { kind: "tick", t: 0, post_stop: false, ego: { x: 0, y: 1, vx: 2, vy: 0, speed_limit_kmh: 50 },
  actors: [{ id: 1, x: 10, y: 1, vx: 2, vy: 0, extent: { x: 2, y: 1 } }] };
const recordedEnd = { kind: "end", t: 1, outcome: "COMPLETED" };
const ndjson = (...records) => records.map(value => typeof value === "string" ? value : JSON.stringify(value)).join("\n");
const inspect = (...records) => validateTelemetryText(ndjson(...records), target);
const block = (label, records, pattern) => check(label, () => {
  const result = inspect(...records);
  assert.equal(result.valid, false);
  if (pattern) assert.match(result.errors.join("\n"), pattern);
});
const baseResult = { runId, campaignId, scenarioVersionId: versionId, scenarioId: otherId, campaignCode: "CMP-MOCK", campaignName: "mock harness",
  scenarioCode: "SCN-MOCK", scenarioName: "mock harness", versionNumber: 1, status: "Error", seed: 1, startedAt: null, finishedAt: null,
  outcome: "INFRA_FAILED", durationS: 0, telemetryReceivedAt: "2026-10-27T00:00:00Z", verdict: "ERROR", hasVideo: true, infraRetryCount: 0,
  evaluations: [{ evaluatedAt: "2026-10-27T00:00:00Z", verdict: "ERROR", errorReason: "CARLA connection failed", violations: [] }] };

check("GET campaigns", async () => { nextResponse = [{ id: campaignId }]; assert.deepEqual(await api.campaigns(), nextResponse); assert.equal(calls.at(-1).path, "/api/v1/campaigns"); assert.equal(calls.at(-1).init, undefined); });
check("GET actual campaign runs", async () => { await api.runs(campaignId); assert.equal(calls.at(-1).path, `/api/v1/campaigns/${campaignId}/runs`); assert.equal(calls.at(-1).init, undefined); });
check("POST campaign-scoped claim", async () => { nextResponse = { runId, campaignId }; assert.equal(await api.claim(campaignId), nextResponse); assert.equal(calls.at(-1).path, `/api/v1/runs/claim?campaignId=${campaignId}`); assert.deepEqual(calls.at(-1).init, { method: "POST" }); });
check("POST explicitly global claim", async () => { await api.claim(); assert.equal(calls.at(-1).path, "/api/v1/runs/claim"); });
check("204 claim remains undefined and does not synthesize a job", async () => { nextResponse = undefined; assert.equal(await api.claim(campaignId), undefined); });
check("POST mark running", async () => { await api.running(runId); assert.equal(calls.at(-1).path, `/api/v1/runs/${runId}/running`); assert.deepEqual(calls.at(-1).init, { method: "POST" }); });
check("POST requeue infrastructure", async () => { await api.requeue(runId); assert.equal(calls.at(-1).path, `/api/v1/runs/${runId}/requeue-infra`); assert.deepEqual(calls.at(-1).init, { method: "POST" }); });
check("PUT telemetry passes original File body unchanged and correct content type", async () => { const file = new File([ndjson(recordedHeader, recordedTick, recordedEnd)], "recorded.jsonl"); await api.telemetry(runId, file); const call = calls.at(-1); assert.equal(call.path, `/api/v1/runs/${runId}/telemetry`); assert.equal(call.init.method, "PUT"); assert.equal(call.init.headers["Content-Type"], "application/x-ndjson"); assert.equal(call.init.body, file); });
check("PUT video passes original File body unchanged and correct content type", async () => { const file = new File([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109])], "recorded.mp4"); await api.video(runId, file); const call = calls.at(-1); assert.equal(call.path, `/api/v1/runs/${runId}/video`); assert.equal(call.init.method, "PUT"); assert.equal(call.init.headers["Content-Type"], "video/mp4"); assert.equal(call.init.body, file); });
check("GET run result", async () => { nextResponse = baseResult; assert.equal(await api.result(runId), baseResult); assert.equal(calls.at(-1).path, `/api/v1/runs/${runId}/result`); assert.equal(calls.at(-1).init, undefined); });
check("GET execution package", async () => { await api.executionPackage(versionId); assert.equal(calls.at(-1).path, `/api/v1/scenario-versions/${versionId}/execution-package`); });
check("GET result download is delegated to the authenticated download client", async () => { await api.downloadResult(runId); assert.deepEqual(calls.at(-1), { type: "download", path: `/api/v1/runs/${runId}/result`, name: `${runId}-result.json` }); });
check("GET video download is delegated to the authenticated download client", async () => { await api.downloadVideo(runId); assert.deepEqual(calls.at(-1), { type: "download", path: `/api/v1/runs/${runId}/video`, name: `${runId}.mp4` }); });

check("GUID helper accepts canonical GUIDs and rejects malformed/injected input", () => { assert.equal(isRunGuid(runId), true); assert.equal(isRunGuid(runId.toUpperCase()), true); for (const invalid of ["", " ", "abc", runId + "/running", "../runs", "00000000-0000-0000-0000-00000000000Z"]) assert.equal(isRunGuid(invalid), false); });
for (const [name, operation] of Object.entries({ campaignRuns: () => api.runs("bad"), result: () => api.result("bad"), scopedClaim: () => api.claim(""), running: () => api.running("bad"), requeue: () => api.requeue("bad"), telemetry: () => api.telemetry("bad", { size: 1 }), video: () => api.video("bad", { size: 1 }), package: () => api.executionPackage("bad"), resultDownload: () => api.downloadResult("bad"), videoDownload: () => api.downloadVideo("bad") }))
  check(`invalid GUID blocked before client: ${name}`, () => { const before = calls.length; assert.throws(operation, /valid target GUID/); assert.equal(calls.length, before); });
check("upload defaults are exactly 100/200 MiB", () => { assert.equal(TELEMETRY_MAX_BYTES, 100 * 1024 * 1024); assert.equal(VIDEO_MAX_BYTES, 200 * 1024 * 1024); });
for (const kind of ["telemetry", "video"]) {
  const max = kind === "telemetry" ? TELEMETRY_MAX_BYTES : VIDEO_MAX_BYTES;
  check(`${kind} exact limit allowed; empty, oversize, non-finite and fractional sizes blocked`, () => { assert.equal(isWorkerUploadSizeValid(max, kind), true); assert.equal(isWorkerUploadSizeValid(1, kind), true); for (const value of [0, -1, max + 1, Infinity, NaN, 1.5]) assert.equal(isWorkerUploadSizeValid(value, kind), false); });
  check(`${kind} invalid size never reaches mock client`, () => { for (const value of [0, max + 1]) { const before = calls.length; assert.throws(() => api[kind](runId, { size: value }), /non-empty/); assert.equal(calls.length, before); } });
}
check("MP4 signature recognizes ftyp and rejects empty/incorrect headers", () => { assert.equal(hasMp4Header(new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109])), true); assert.equal(hasMp4Header(new Uint8Array()), false); assert.equal(hasMp4Header(new Uint8Array(32)), false); });

check("well-formed existing telemetry metadata is inspected without predicting verdict", () => { const value = inspect(recordedHeader, recordedTick, recordedEnd); assert.equal(value.valid, true); assert.equal(value.runId, runId); assert.equal(value.scenarioVersionId, versionId); assert.equal(value.contentHash, hash); assert.equal(value.ticks, 1); assert.equal(value.evaluatedTicks, 1); assert.equal(value.outcome, "COMPLETED"); assert.equal("verdict" in value, false); });
check("original zero-tick INFRA_FAILED remains accepted", () => { const value = inspect({ kind: "header", format: "asx.telemetry/1", run_id: runId }, { kind: "end", t: 0, outcome: "INFRA_FAILED", reason: "CARLA connection refused" }); assert.equal(value.valid, true); assert.equal(value.ticks, 0); assert.equal(value.outcome, "INFRA_FAILED"); assert.ok(value.warnings.length > 0); });
check("late asynchronous sensor events preserve a valid recording", () => { const value = inspect(recordedHeader, { ...recordedTick, t: 1 }, { kind: "event", t: 0.5, post_stop: false, type: "collision" }, { ...recordedTick, t: 2 }, { ...recordedEnd, t: 3 }); assert.equal(value.valid, true); assert.equal(value.events, 1); });
check("actor id is optional as in TelemetryReader", () => { const { id: ignored, ...actor } = recordedTick.actors[0]; assert.ok(ignored); assert.equal(inspect(recordedHeader, { ...recordedTick, actors: [actor] }, recordedEnd).valid, true); });
check("tick time reversal is rejected", () => { assert.equal(inspect(recordedHeader, { ...recordedTick, t: 2 }, { ...recordedTick, t: 1 }, { ...recordedEnd, t: 3 }).valid, false); });
check("truncated recordings with actual ticks carry an explicit partial-evidence warning", () => { const value = inspect(recordedHeader, recordedTick, { ...recordedEnd, outcome: "TRUNCATED" }); assert.equal(value.valid, true); assert.match(value.warnings.join(" "), /partial recording/); });
block("completed zero-tick snapshot is blocked", [recordedHeader, recordedEnd], /recorded ticks/);
block("truncated zero-tick snapshot is blocked", [recordedHeader, { ...recordedEnd, outcome: "TRUNCATED" }], /recorded ticks/);
block("post_stop-only snapshot is blocked", [recordedHeader, { ...recordedTick, post_stop: true }, recordedEnd], /recorded ticks/);
for (const marker of ["simulated", "synthetic", "mock", "fixture"]) block(`${marker} marker blocks even typed ticks`, [{ ...recordedHeader, [marker]: true }, recordedTick, recordedEnd], /not accepted/);
block("source provenance explicitly marked fixture is blocked", [{ ...recordedHeader, source: "fixture" }, recordedTick, recordedEnd], /not accepted/);
block("run mismatch is blocked", [{ ...recordedHeader, run_id: otherId }, recordedTick, recordedEnd], /run_id/);
block("uppercase header run_id is blocked to match backend exact comparison", [{ ...recordedHeader, run_id: runId.toUpperCase() }, recordedTick, recordedEnd], /lowercase/);
block("version mismatch is blocked", [{ ...recordedHeader, scenario_version_id: otherId }, recordedTick, recordedEnd], /scenario_version_id/);
block("hash mismatch is blocked", [{ ...recordedHeader, content_hash: "sha256:other" }, recordedTick, recordedEnd], /content_hash/);
block("missing header is blocked", [recordedTick, recordedEnd], /header/);
block("missing end is blocked", [recordedHeader, recordedTick], /end record/);
block("broken final JSON is blocked", [recordedHeader, recordedTick, '{"kind":"end"'], /invalid JSON/);
block("non-object JSON line is blocked", [recordedHeader, [], recordedEnd], /JSON object/);
block("duplicate header is blocked", [recordedHeader, recordedHeader, recordedTick, recordedEnd], /one header/);
block("records after end are blocked", [recordedHeader, recordedTick, recordedEnd, recordedTick], /follow the end/);
block("unknown format is blocked", [{ ...recordedHeader, format: "asx.telemetry/2" }, recordedTick, recordedEnd], /format/);
block("unsupported outcome is blocked", [recordedHeader, recordedTick, { ...recordedEnd, outcome: "PASS" }], /Unsupported/);
block("infra failure missing original reason is blocked", [recordedHeader, { ...recordedEnd, outcome: "INFRA_FAILED" }], /reason/);
block("tick post_stop wrong type is blocked", [recordedHeader, { ...recordedTick, post_stop: "false" }, recordedEnd], /post_stop/);
block("tick numeric ego field wrong type is blocked", [recordedHeader, { ...recordedTick, ego: { ...recordedTick.ego, vx: "2" } }, recordedEnd], /ego.vx/);
block("optional header numeric field wrong type is blocked", [{ ...recordedHeader, warmup_s: "one" }, recordedTick, recordedEnd], /warmup_s/);
block("actor extent missing is blocked", [recordedHeader, { ...recordedTick, actors: [{ id: 1, x: 1, y: 2, vx: 1, vy: 1 }] }, recordedEnd], /extent/);
block("lane event markings wrong type is blocked", [recordedHeader, recordedTick, { kind: "event", t: 0.5, post_stop: false, type: "lane_invasion", markings: [1] }, recordedEnd], /markings/);
block("end time missing is blocked", [recordedHeader, recordedTick, { kind: "end", outcome: "COMPLETED" }], /must be a finite number/);
check("invalid target GUID cannot produce a valid preview", () => { assert.equal(validateTelemetryText(ndjson({ ...recordedHeader, run_id: "bad" }, recordedTick, recordedEnd), { runId: "bad" }).valid, false); });
check("infra ERROR eligibility follows server status/verdict/outcome", () => { assert.equal(canRequeueInfrastructure(baseResult), true); assert.equal(canRequeueInfrastructure({ ...baseResult, outcome: null }), true); assert.equal(canRequeueInfrastructure(null), false); for (const verdict of ["PASS", "FAIL"]) assert.equal(canRequeueInfrastructure({ ...baseResult, verdict }), false); assert.equal(canRequeueInfrastructure({ ...baseResult, status: "Completed" }), false); assert.equal(canRequeueInfrastructure({ ...baseResult, outcome: null, evaluations: [] }), false); });

// Render the real component as an inert JSX tree with seeded hooks. Effects are never executed.
// This checks read controls/gates without requiring a browser, network, or a testing dependency.
const panelSource = await readFile(resolve(root, "src/components/WorkerProtocolPanel.tsx"), "utf8");
function inertPanel(role, options = {}) {
  let cursor = 0;
  const seeds = { 0: [{ id: campaignId, code: "CMP-MOCK", name: "mock harness" }], 1: campaignId,
    2: { campaignId, items: [{ id: runId, campaignId, scenarioVersionId: versionId, scenarioCode: "SCN-MOCK", versionNumber: 1, status: "Error" }] },
    3: runId, 6: baseResult, 8: false, ...options.seedOverrides };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const exports = {};
  const require = name => name === "react" ? { useState: initial => { const slot = cursor++; return [Object.hasOwn(seeds, slot) ? seeds[slot] : typeof initial === "function" ? initial() : initial, value => options.writes?.push({ slot, value })]; }, useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect: effect => options.effects?.push(effect) }
    : name === "react/jsx-runtime" ? { jsx, jsxs: jsx, Fragment: "fragment" }
    : name.includes("localeContext") ? { useLocale: () => ({ locale: "en" }) }
    : name.includes("useAsyncAction") ? { useAsyncAction: () => ({ pending: false, isPending: () => false, run: async (_key, task) => task() }) }
    : name.includes("services/workerProtocol") ? mod : name.endsWith(".css") ? {} : (() => { throw new Error(`Unexpected import ${name}`); })();
  const body = ts.transpileModule(panelSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "exports", body)(require, exports);
  return exports.WorkerProtocolPanel({ client: options.client ?? client, role });
}
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const content = value => value == null || typeof value === "boolean" ? "" : typeof value !== "object" ? String(value) : Array.isArray(value) ? value.map(content).join("") : content(value.props?.children);
check("read-only role sees result/package/download controls without acknowledgement", () => { const tree = inertPanel("Test Reviewer"); const all = nodes(tree); for (const label of ["Download result JSON", "Inspect execution package", "Download recorded MP4"]) { const button = all.find(node => node.type === "button" && content(node) === label); assert.ok(button, label); assert.equal(button.props.disabled, false); } const advanced = all.find(node => node.type === "details" && node.props.className?.includes("worker-protocol-advanced")); assert.equal(advanced.props.open, false); assert.ok(nodes(advanced).filter(node => node.type === "fieldset").every(node => node.props.disabled)); });
check("even managing role has all mutation groups disabled before acknowledgement", () => { const tree = inertPanel("Test Engineer"); const advanced = nodes(tree).find(node => node.type === "details" && node.props.className?.includes("worker-protocol-advanced")); assert.ok(nodes(advanced).filter(node => node.type === "fieldset").every(node => node.props.disabled)); });
check("read-only role handlers reject mutation even with forged local confirmations", async () => {
  const tree = inertPanel("Test Reviewer", { seedOverrides: { 13: true, 14: true, 16: true, 17: true, 18: true } });
  const before = calls.length;
  const claimButton = nodes(tree).find(node => node.type === "button" && content(node) === "Claim one job");
  const requeueButton = nodes(tree).find(node => node.type === "button" && content(node) === "Remove infra evidence and requeue");
  claimButton.props.onClick(); requeueButton.props.onClick(); await Promise.resolve();
  assert.equal(calls.length, before);
});
check("different read actions clicked before a render cannot run concurrently", async () => {
  let release;
  const seen = [];
  const deferred = new Promise(resolve => { release = resolve; });
  const lockedClient = { async request(path) { seen.push(path); return { scenarioVersionId: versionId }; }, async download(path) { seen.push(path); await deferred; } };
  const tree = inertPanel("Test Engineer", { client: lockedClient });
  const download = nodes(tree).find(node => node.type === "button" && content(node) === "Download result JSON");
  const inspectPackage = nodes(tree).find(node => node.type === "button" && content(node) === "Inspect execution package");
  download.props.onClick(); inspectPackage.props.onClick();
  assert.deepEqual(seen, [`/api/v1/runs/${runId}/result`]);
  release(); await new Promise(resolve => setImmediate(resolve));
  inspectPackage.props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, [`/api/v1/runs/${runId}/result`, `/api/v1/scenario-versions/${versionId}/execution-package`]);
});
check("campaign run effect discards an older response after scope cleanup", async () => {
  let releaseA, releaseB;
  const older = new Promise(resolve => { releaseA = resolve; });
  const newer = new Promise(resolve => { releaseB = resolve; });
  const scopedClient = { request(path) { return path.includes(campaignId) ? older : newer; }, async download() {} };
  const effectsA = [], writesA = [], effectsB = [], writesB = [];
  inertPanel("Test Engineer", { client: scopedClient, effects: effectsA, writes: writesA });
  const cleanupA = effectsA[1]();
  cleanupA();
  inertPanel("Test Engineer", { client: scopedClient, effects: effectsB, writes: writesB, seedOverrides: { 1: otherId, 2: { campaignId: otherId, items: [] } } });
  const cleanupB = effectsB[1]();
  releaseB([{ id: otherId }]); await new Promise(resolve => setImmediate(resolve));
  releaseA([{ id: runId }]); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writesA.filter(item => item.slot === 2).length, 1, "cleaned-up request only wrote its initial empty state");
  assert.deepEqual(writesB.filter(item => item.slot === 2).at(-1).value, { campaignId: otherId, items: [{ id: otherId }] });
  cleanupB();
});
check("in-flight package response does not write state after panel unmount", async () => {
  let release;
  const response = new Promise(resolve => { release = resolve; });
  const effects = [], writes = [];
  const tree = inertPanel("Test Engineer", { client: { request: () => response, async download() {} }, effects, writes });
  const unmount = effects[4]();
  nodes(tree).find(node => node.type === "button" && content(node) === "Inspect execution package").props.onClick();
  unmount();
  const count = writes.length;
  release({ scenarioVersionId: versionId }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, count);
});

const results = [];
for (const { name, fn } of cases) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack ?? String(error) }); }
}
const failed = results.filter(value => !value.passed);
const report = { scope: "mock-only frontend worker protocol", networkRequests: 0, total: results.length, passed: results.length - failed.length, failed: failed.length, results };
await writeFile(resolve(root, "node_modules/.cache/worker-protocol-contract-results.json"), JSON.stringify(report, null, 2));
for (const result of failed) process.stderr.write(`FAIL ${result.name}\n${result.error}\n`);
process.stdout.write(`Worker protocol mock contracts: ${report.passed}/${report.total} passed; network requests: 0\n`);
process.stdout.write('ASX_COVERAGE:' + JSON.stringify([...coverage]) + '\n');
if (failed.length) process.exitCode = 1;
