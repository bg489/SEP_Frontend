import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// All children execute real frontend adapters against in-memory transports.
// They never contact the user's API, database, CARLA, or external services.
await mkdir(resolve("node_modules/.tmp"), { recursive: true });
await mkdir(resolve("node_modules/.cache"), { recursive: true });
const snapshot = JSON.parse((await readFile(resolve("docs/backend-endpoints.json"), "utf8")).replace(/^\uFEFF/, ""));
const observed = new Set();
for (const file of ["scenarios", "operations", "worker-protocol", "auth-health", "reference-coverage", "failure-analysis"]) {
  const child = spawnSync(process.execPath, [resolve(`scripts/api-contracts/${file}.mjs`)], { encoding: "utf8", env: process.env, maxBuffer: 8 * 1024 * 1024 });
  if (child.error) throw child.error;
  for (const line of (child.stdout ?? "").split(/\r?\n/)) {
    if (line.startsWith("ASX_COVERAGE:")) JSON.parse(line.slice("ASX_COVERAGE:".length)).forEach(value => observed.add(value));
    else if (line.trim()) console.log(line);
  }
  if (child.stderr) process.stderr.write(child.stderr);
  assert.equal(child.status, 0, `${file} API contract harness failed`);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = path => new RegExp("^" + path.split("/").map(part => /^\{[^}]+\}$/.test(part) ? "[^/]+" : escape(part)).join("/") + "$", "i");
const missing = snapshot.endpoints.filter(endpoint => ![...observed].some(call => {
  const split = call.indexOf(" ");
  return call.slice(0, split) === endpoint.method && pattern(endpoint.path).test(new URL(call.slice(split + 1), "https://fixture.invalid").pathname);
}));
assert.equal(snapshot.endpoints.length, snapshot.endpointCount, "The endpoint snapshot count is inconsistent");
assert.deepEqual(missing, [], "Some documented backend endpoints have no exercised frontend contract");
console.log(`Backend API contract coverage: ${snapshot.endpointCount}/${snapshot.endpointCount} Swagger operations exercised. No live database writes or CARLA processes.`);
