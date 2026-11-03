import assert from "node:assert/strict";
import { createServer } from "vite";

const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.window = { sessionStorage: storage, localStorage: storage };
globalThis.localStorage = storage; globalThis.sessionStorage = storage;
const calls = []; const coverage = new Set();
const user = { id: "00000000-0000-4000-8000-000000000001", displayName: "Review 2", email: "review2@example.invalid", role: "TEST_REVIEWER", isActive: true };
const workerId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
let failNext = false;
globalThis.fetch = async (path, init = {}) => {
  const method = init.method ?? "GET"; coverage.add(`${method} ${path}`); calls.push({ path, method, body: init.body ? JSON.parse(init.body) : null });
  assert.equal(new Headers(init.headers).has("X-Asx-Dev-Role"), false);
  if (failNext) { failNext = false; return new Response(JSON.stringify({ title: "Fixture Admin protection" }), { status: 409 }); }
  const result = path.includes("/auth/register") ? { user, session: null, requiresEmailConfirmation: true, message: "Confirm email" }
    : path.endsWith("/auth/profile") || /\/admin\/users\/[^/?]+$/.test(path) ? user
    : path.includes("/admin/users?") ? { items: [user], page: 1, pageSize: 25, totalPages: 1, totalCount: 1 }
    : path.includes("/auth/") ? { message: "Request accepted" }
    : path.includes("/workers") ? { id: workerId, quality: "Low", capacity: 1, activeRuns: 0, availableCapacity: 0 }
    : path.includes("/compare") ? { id: workerId, method: "gower", clusters: [], pairs: [], featureNames: [], note: "Fixture" }
    : path.endsWith("/progress") ? { runId, status: "Running", updatedAt: null, progress: null } : [];
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
};
const server = await createServer({ configFile: false, envFile: false, logLevel: "error", server: { middlewareMode: true }, define: {
  "import.meta.env.VITE_AUTH_MODE": '"Supabase"', "import.meta.env.VITE_API_BASE_URL": '""', "import.meta.env.VITE_DATA_MODE": '"api"',
} });
try {
  const { authApi } = await server.ssrLoadModule("/src/services/authApi.ts");
  const { teamClient } = await server.ssrLoadModule("/src/services/teamClient.ts");
  const { administrationApi } = await server.ssrLoadModule("/src/services/teamAdministration.ts");
  const { similarityApi } = await server.ssrLoadModule("/src/services/teamSimilarity.ts");
  const { operationsApi } = await server.ssrLoadModule("/src/services/teamOperations.ts");
  const registration = await authApi.register({ name: "Reviewer", email: " REVIEW2@example.invalid ", password: "fixture-password", role: "Test Reviewer" });
  assert.equal(registration.session, null); assert.equal(registration.requiresEmailConfirmation, true);
  assert.equal(calls.at(-1).body.role, "TEST_REVIEWER"); assert.equal(calls.at(-1).body.email, "review2@example.invalid");
  const before = calls.length;
  await assert.rejects(authApi.register({ name: "Admin", email: user.email, password: "fixture-password", role: "Administrator" }), /Administrator/);
  assert.equal(calls.length, before);
  await authApi.requestPasswordReset(user.email); await authApi.resetPassword({ accessToken: "fixture-recovery", newPassword: "fixture-password" });
  await authApi.updateProfile("New display name"); await authApi.changePassword({ currentPassword: "old-fixture", newPassword: "new-fixture" });
  const admin = administrationApi(teamClient);
  assert.equal((await admin.users("Review & 2")).items[0].id, user.id); assert.match(calls.at(-1).path, /Review%20%26%202/);
  await admin.updateUser(user.id, { role: "TEST_REVIEWER", isActive: true });
  failNext = true; await assert.rejects(admin.updateUser(user.id, { isActive: false }), /Fixture Admin protection/);
  await admin.workers(); await admin.registerWorker({ name: "fixture", host: "127.0.0.1", rpcPort: 2000, capacity: 1, carlaVersion: "0.9.16", maps: ["Town01"] });
  await admin.updateWorker({ id: workerId, capacity: 1 }, false); await admin.recoverLost();
  await teamClient.request(`/api/v1/workers/${workerId}/heartbeat`, { method: "POST", body: JSON.stringify({ maps: ["Town01"], error: null }) });
  await admin.oracles(); await admin.createOracle({ name: "Fixture", speedingToleranceKmh: 5, speedingMinDurationS: 2, freezingMaxStillS: 20, ttcThresholdS: 1.5, routeGoalToleranceM: 5 });
  await admin.activateOracle(workerId); await admin.settings(); await admin.saveSettings({ similarityWarningPercent: 85, similarityBlockPercent: 98, retentionDays: 30, retentionEnabled: false }); await admin.audit();
  const similarity = similarityApi(teamClient); await similarity.compare([workerId, runId], "gower", 0.2); await similarity.get(workerId);
  await operationsApi(teamClient).getRunProgress(runId);
  await teamClient.request(`/api/v1/runs/${runId}/progress`, { method: "PUT", body: JSON.stringify({ frame: 1, simulationTimeS: 0.05, egoX: 1, egoY: 2, egoZ: 0.3, speedKmh: 10 }) });
  console.log("Review 2 account, persistent administration, similarity and progress adapters: passed.");
  console.log("ASX_COVERAGE:" + JSON.stringify([...coverage]));
} finally { await server.close(); }
