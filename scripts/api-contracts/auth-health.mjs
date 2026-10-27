import assert from "node:assert/strict";
import { createServer } from "vite";

const memory = new Map();
const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key) };
const events = new EventTarget();
globalThis.sessionStorage = storage;
globalThis.localStorage = storage;
globalThis.window = { sessionStorage: storage, localStorage: storage,
  addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) };
const originalFetch = globalThis.fetch;
const coverage = new Set();
const server = await createServer({ configFile: false, envFile: false, logLevel: "error", server: { middlewareMode: true }, define: {
  "import.meta.env.VITE_AUTH_MODE": JSON.stringify("Supabase"), "import.meta.env.VITE_API_BASE_URL": JSON.stringify(""), "import.meta.env.VITE_DATA_MODE": JSON.stringify("api"),
} });
let refreshed = 0;
let failRefresh = false;
let unauthorizedOnce = false;
let healthUnavailable = false;
const user = { id: "qa-user", displayName: "QA User", email: "qa@example.invalid", role: "TEST_ENGINEER", isActive: true };
const respond = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (path, init = {}) => {
  const method = init.method ?? "GET";
  coverage.add(`${method} ${path}`);
  const headers = new Headers(init.headers);
  assert.equal(headers.has("X-Asx-Dev-Role"), false, "Supabase never transmits a Dev role header");
  if (path === "/api/v1/auth/login") {
    assert.equal(method, "POST");
    assert.deepEqual(JSON.parse(init.body), { email: "qa@example.invalid", password: "fixture-password" });
    return respond({ accessToken: "qa-access-0", refreshToken: "qa-refresh-0", expiresIn: 3600, user });
  }
  if (path === "/api/v1/auth/refresh") {
    assert.equal(method, "POST");
    assert.equal(typeof JSON.parse(init.body).refreshToken, "string");
    refreshed++;
    await new Promise(resolve => setTimeout(resolve, 5));
    if (failRefresh) return respond({ title: "Fixture session expired" }, 401);
    return respond({ accessToken: `qa-access-${refreshed}`, refreshToken: `qa-refresh-${refreshed}`, expiresIn: 3600, user });
  }
  if (unauthorizedOnce) { unauthorizedOnce = false; return respond({ title: "Fixture token expired" }, 401); }
  assert.equal(headers.get("Authorization"), `Bearer qa-access-${refreshed}`);
  if (path === "/api/v1/auth/me") return respond(user);
  if (path === "/api/health/db") return healthUnavailable
    ? respond({ title: "Database unavailable", detail: "Fixture connection could not be checked", traceId: "qa-trace" }, 503)
    : respond({ status: "SCHEMA_INCOMPLETE", missingTables: ["scenario_tags"], postgres: "PostgreSQL fixture" });
  if (path.endsWith("/video")) return new Response(new Uint8Array([0,0,0,20,102,116,121,112,109,112,52,50]), { headers: { "Content-Type": "video/mp4" } });
  return respond([]);
};

try {
  const { store } = await server.ssrLoadModule("/src/app/store.ts");
  const actions = await server.ssrLoadModule("/src/features/auth/authSlice.ts");
  const tokens = await server.ssrLoadModule("/src/services/authToken.ts");
  const { authApi } = await server.ssrLoadModule("/src/services/authApi.ts");
  const { api } = await server.ssrLoadModule("/src/services/api.ts");
  const authenticated = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("Auth Saga did not complete")); }, 2500);
    const unsubscribe = store.subscribe(() => { if (store.getState().auth.status === "authenticated") { clearTimeout(timer); unsubscribe(); resolve(); } });
  });
  store.dispatch(actions.loginRequested({ email: " qa@example.invalid ", password: "fixture-password" }));
  await authenticated;
  assert.equal(store.getState().auth.user.role, "Test Engineer");
  assert.equal(tokens.getTokenSession().refreshToken, "qa-refresh-0");
  assert.equal((await authApi.currentUser()).email, user.email);

  tokens.storeTokenSession({ ...tokens.getTokenSession(), expiresAt: Date.now() - 1000 });
  await Promise.all([api.backendRequest("/api/v1/reference/maps"), api.backendRequest("/api/v1/reference/catalog")]);
  assert.equal(refreshed, 1, "concurrent requests share one expired-token refresh");
  await api.backendRefreshSession();
  assert.equal(refreshed, 2, "manual session refresh traverses Redux Saga");
  unauthorizedOnce = true;
  await api.backendRequest("/api/v1/oracle-configs");
  assert.equal(refreshed, 3, "401 triggers one refresh and retries the API request");

  const health = await api.backendRequest("/api/health/db");
  assert.deepEqual(health, { status: "SCHEMA_INCOMPLETE", missingTables: ["scenario_tags"], postgres: "PostgreSQL fixture" });
  healthUnavailable = true;
  await assert.rejects(api.backendRequest("/api/health/db"), error => error.status === 503
    && error.traceId === "qa-trace" && error.message.includes("Fixture connection could not be checked"));
  const video = await api.backendMedia("/api/v1/runs/39f7ea13-835f-42fc-a0e7-359ed350d4bc/video");
  assert.equal(video.type, "video/mp4"); assert.equal(video.size, 12);

  const before = coverage.size;
  store.dispatch(actions.switchDevRoleRequested("ADMIN"));
  assert.equal(store.getState().auth.user.role, "Test Engineer"); assert.equal(coverage.size, before);
  failRefresh = true;
  await assert.rejects(api.backendRefreshSession(), /Fixture session expired/);
  assert.equal(tokens.getTokenSession(), null);
  assert.equal(store.getState().auth.status, "anonymous");
  console.log("Auth/health contracts: login/me/refresh/health, Saga dispatch, expiry concurrency, 401 retry, manual refresh, Blob media, Dev isolation and expired-session logout passed. Network requests: 0.");
  console.log("ASX_COVERAGE:" + JSON.stringify([...coverage]));
} finally { globalThis.fetch = originalFetch; await server.close(); }
