# Week 2 frontend verification

Both `bg489/SEP_Frontend` and `bg489/SEP_Backend` use branch
`feature/week2-completion-20261119`. The active backend project is
`Project/Backend/backend/AutoScenarioX.Api`, using the versioned `/api/v1`
contract. Start it from its project directory; the old Identity API under
`legacy/identity-api` does not serve this frontend.

The branch restores feature commits from the existing Review 2 history and adds
current regression coverage. Account registration/recovery/profile/password,
Admin users/Oracle/workers/settings/audit, Oracle history ranking, progress,
linked reruns, similarity and supported OpenSCENARIO import use real API
adapters through Redux Saga. No mock-success fallback replaces failed writes.

```powershell
npm ci
npm run lint
npm run build
npm run verify:api
npm run test:coverage
$env:PLAYWRIGHT_CHANNEL = 'chrome' # or install Playwright Chromium
npm run test:e2e
```

Contract tests exercise 88 Swagger operations with a controlled transport.
Vitest uses React Testing Library/jsdom, and browser tests intercept API requests
with per-test fixtures. They verify frontend behavior; actual database/provider/
CARLA acceptance is recorded separately. CI fails on build/test errors and keeps
JUnit, coverage, browser screenshots and traces.

New component tests cover ranking invalidation when seed/weights/strategy/scope
changes, READY selection across paging/filtering, late video responses and Blob
cleanup, dashboard roles and empty data. Browser lifecycle cases cover JSON/YAML/
OpenSCENARIO import error/retry, version diff, tags, paged history and parameter
batch provenance/download. Variant JSON downloads use the exact backend batch.

The local live review uses frontend `127.0.0.1:4175`, proxy target API
`127.0.0.1:5087` and an isolated PostgreSQL database. To reproduce the read/write
Admin browser check, set `ASX_LIVE_DATABASE_IS_DISPOSABLE=1`,
`ASX_LIVE_FRONTEND`, `ASX_LIVE_OUTPUT` and `PLAYWRIGHT_CHANNEL=chrome`, then run
`node scripts/live-administration.mjs`. It changes and reloads a fixture account,
worker, Oracle version, analytics settings and actual audit log. It restores the
fixture account's original role/status. Use a dedicated test database only.

`scripts/live-campaign.mjs` drives the browser against the real API, launches the
worker and verifies reloaded measured results. Set `ASX_LIVE_API`,
`ASX_BACKEND_REPOSITORY`, `ASX_PYTHON`, `CARLA_ROOT`, `ASX_LIVE_SCENARIO` and the
isolated-database opt-in. CARLA must use Low quality. A measured Oracle FAIL is
a found violation; it is not converted into PASS.

Historical data in `docs/review2-evidence.json` and generated coverage/JUnit files
from November 3 describe older source. Current results belong in
`docs/week2-evidence.json` with exact commits and CI URLs. Generated HTML coverage
and test-result directories are ignored by Git and retained as CI artifacts.

Supabase signup/email recovery and private cloud-storage acceptance require the
backend's Auth/Storage provider settings. A PostgreSQL connection alone does not
configure those services. A shared staging URL was not supplied; local live
review must not be reported as published staging or full release acceptance.
