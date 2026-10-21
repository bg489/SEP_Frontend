# SEP_Frontend

**AutoScenarioX — Scenario Management and Explainable Failure Analytics**

This repository contains the AutoScenarioX frontend: a role-based single-page application for designing driving scenarios, managing test campaigns, reviewing failures, and configuring the simulation workspace. The interface supports English and Vietnamese; English is the default, and the selected language is remembered in the browser. Authentication requests are managed with Redux Saga.

The app uses the .NET REST API and PostgreSQL by default for all five workflows. Every workflow request is dispatched through Redux Saga before it reaches the HTTP adapter. Set `VITE_DATA_MODE=mock` only when previewing the UI without backend workflow data. Authentication always uses the .NET API. The browser never connects directly to PostgreSQL or Supabase.

## Features by role

| Role | Screens and workflows |
| --- | --- |
| **Scenario Engineer** | Overview, scenario library and editor, scenario import and automatic configuration validation, side-by-side comparison, scenario clusters, profile |
| **Test Engineer** | Overview, campaign creation and management, prioritization, execution queue and run details, failure insights, campaign reports, profile |
| **Test Reviewer** | Overview, failure evidence and root-cause review, run details, campaign reports, profile |
| **Administrator** | Overview, user and role management, simulation nodes, test-oracle rules, analytics settings, audit log, profile |

The sign-in screen includes registration and forgot-password views. Use the **EN / VI** switch on the sign-in screen or in the top bar to change the interface language. The signed-in role always comes from the backend; mock workflow data does not enable role-preview sign-ins.

## Scenario authoring and campaigns

The create form and Scenario Engineer editor configure the map, weather, ego vehicle, traffic vehicle and count, pedestrian and obstacle blueprints and counts, simulation duration, speed offset, and test intent notes. The vehicle picker includes **41 models in 6 categories** (car, truck, van, bus, motorcycle, and bicycle), with model search and category filters, from the [official CARLA vehicle catalogue](https://carla.readthedocs.io/en/latest/catalogue_vehicles/). Blueprint availability is checked against the installed simulator during execution.

The campaign picker lists scenarios that are **Ready for testing** (`Active` or `Approved`). Search by name, ID, map, description, or tag, and filter by map, scenario type, and severity. Selected scenarios remain selected when filters change; the picker displays the selected and visible counts.

API requests show activity in the top bar. Actions such as saving, validation, import, campaign execution, artifact download, review, and worker configuration show loading states and prevent duplicate submissions while their requests finish.

### Execution modes and current limits

| Mode | Runtime behavior |
| --- | --- |
| **CARLA actor scene** | Creates the configured ego vehicle, traffic vehicles, pedestrians, and props, applies the map, weather, counts, duration, and driving settings, and follows a seeded road path. Route, trigger, and action free-text fields document test intent; they do not define executable trajectories. |
| **OpenSCENARIO source** | Runs the original `.xosc` / `.osc` file saved with that scenario version through ScenarioRunner. The actor form does not rewrite the imported file. Use this mode for exact spawn positions, custom trajectories, triggers, and maneuvers. |

Native actor scenes currently support collision, speed / speeding, and freezing / stagnation checks. Other enabled oracle rules are rejected before a native run is queued; use an imported OpenSCENARIO file with executable safety criteria for those checks. CARLA runs at **Low quality**. A successful native result requires the configured actors to spawn, the simulation to run, and the supported safety checks to pass; launching CARLA alone is insufficient.

## Run locally

### Requirements

- Node.js 20.19 or newer
- npm
- .NET 10 SDK and PostgreSQL 18 to run the backend

### Install and start

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open the local address printed by Vite (usually `http://localhost:5173`).

Useful project scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Serve the production build locally |

## Authentication

Sign-in and registration always use the .NET authentication API. A user must exist in the PostgreSQL `autoscenariox` database (or register through the API) and provide the correct password. There are no demo credentials, local mock accounts, or role-preview sign-ins. If the API is unavailable or rejects the credentials, the frontend stays on the sign-in screen and displays the error.

## Mock data and API integration

The app uses the .NET backend by default. Copy `.env.example` to `.env.local` to set the API URL:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost:5080
```

Start the backend first, then restart Vite after changing `.env.local`. `VITE_DATA_MODE` selects the workflow data source; it never changes authentication. Set it to `mock` to preview seeded records saved in browser storage. API mode reports failed requests instead of silently presenting those records as live data. The backend applies its EF migrations at startup and stores saved workflow data in `app_workflow` tables in PostgreSQL.

### Run backend authentication

The separate backend project is in `../Backend`. It targets PostgreSQL 18 database `autoscenariox` and keeps its Identity tables in schema `app_auth`. Follow [the backend setup guide](../Backend/README.md) to configure .NET User Secrets, run the API, and optionally provision the first administrator. The API runs at `http://localhost:5080`.

Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password`. During registration, users may select Scenario Engineer, Test Engineer, or Test Reviewer; Administrator can only be assigned by an administrator. Administrator-only role management is provided by `GET /api/admin/users` and `PUT /api/admin/users/{id}/role`. Password-reset email delivery still needs a mail provider in production.

### Frontend service boundary

- `src/data/mockData.ts` provides sample scenarios, campaigns, failures, workers, dashboard metrics, and oracle rules.
- `src/services/mockApi.ts` implements the demo adapter. Mock edits are saved in browser `localStorage`.
- `src/services/httpApi.ts` implements the .NET REST adapter for workflow endpoints.
- `src/services/api.ts` is the workflow API facade; UI requests are dispatched through `src/features/workflow/workflowSaga.ts`.
- `src/services/workflowDataApi.ts` selects the mock or HTTP adapter using `VITE_DATA_MODE`.
- `src/services/authApi.ts` sends login, registration, password-reset, and session requests to the .NET authentication API.
- `src/features/auth/authSaga.ts` handles login, registration, session restore, password-reset requests, and logout.
- `src/app/store.ts` creates the Redux store and runs authentication and workflow sagas.
- `src/types.ts` defines the API and screen data contracts.

### .NET API endpoints used by the frontend

| Method | Endpoint | Used for |
| --- | --- | --- |
| `GET` | `/api/dashboard/overview` | Dashboard metrics and activity |
| `GET`, `POST` | `/api/scenarios` | Search/list and create scenarios (`search`, `status`) |
| `POST` | `/api/scenarios/import`, `/api/scenarios/{id}/versions`, `/api/scenarios/{id}/clone` | Import, edit into a new version, or clone |
| `GET`, `PUT`, `PATCH` | `/api/scenarios/{id}/versions`, `/api/scenarios/{id}/status`, `/api/scenarios/{id}/execution-metrics` | Version history, system-validated readiness state, execution metrics |
| `GET`, `POST`, `PATCH` | `/api/campaigns`, `/api/campaigns/{id}` | Campaign list, create, and update |
| `GET`, `PUT` | `/api/campaigns/{id}/ranking` | Persist prioritization order and APFD/APFDc evaluation |
| `GET`, `POST` | `/api/runs`, `/api/campaigns/{id}/runs` | Read and queue backend run records |
| `POST` | `/api/campaigns/{id}/runs/cancel` | Cancel queued and active campaign runs |
| `GET`, `POST` | `/api/analytics/failure-clusters` | Failure groups and oracle evidence |
| `POST` | `/api/analytics/failure-clusters/{id}/confirm` | Confirm or correct a root cause |
| `GET`, `PUT` | `/api/simulation-nodes` | Read or configure simulation node records |
| `GET`, `PUT` | `/api/oracles/rules` | Read and save oracle rules |
| `GET`, `PUT` | `/api/oracles/profile` | Read and save oracle profile version and activation state |
| `GET`, `PUT`, `POST` | `/api/integration/carla`, `/api/integration/carla/test` | Save/check real CARLA and ScenarioRunner readiness; quality is fixed to Low |
| `GET` | `/api/runs/{id}/artifacts/{fileName}` | Download saved run logs, execution options, and simulation results |
| `POST` | `/api/worker-callbacks/runs/{id}` | Receive authenticated external worker callbacks |
| `GET`, `PUT` | `/api/analytics/preferences` | Persist similarity and reporting settings |
| `GET` | `/api/audit-log` | Read administrator audit history |

API responses follow the TypeScript contracts in `src/types.ts`. Configure CORS on the .NET API for the frontend origin. In API mode, scenario definitions and imported OpenSCENARIO XML are stored with their versions. After the Administrator configures and activates the local .NET CARLA worker, campaigns run against CARLA 0.9.16 using the mode above. The worker reports run states and results to PostgreSQL; the UI polls active runs and lets users download saved execution logs and evidence. See `../Backend/README.md` for database tables, installation, and worker callbacks. Report files are generated in the browser from persisted run and ranking data.

### Supabase and secrets

The frontend is intended to call the .NET API. Keep Supabase database access and service-role credentials on the backend; never put a service key in a `VITE_*` variable. If Supabase Auth is later used in the browser, only expose its public anon key and keep authorization checks in .NET as required.

## Project structure

```text
src/
  components/   Authentication and role-specific screens
  data/         Initial mock data and official CARLA vehicle catalogue
  hooks/        Shared API action loading and duplicate-submit protection
  services/     Saga API facade, HTTP adapter, and mock adapter
  features/     Authentication and workflow sagas
  App.tsx       App shell, role navigation, shared flows
  types.ts      Shared data and API contracts
  index.css     Application styling
```

## Git workflow

This frontend folder is a Git repository with an `origin` remote. Create a feature branch for work intended to merge into `main`, then push that branch and open a pull request:

```powershell
git switch -c feature/short-description
git status
git add <files-to-include>
git commit -m "feat: describe the change"
git push -u origin feature/short-description
```

Review `git status` before committing. Do not push directly to `main`. The backend is a sibling repository; commit and push its changes separately. To verify the frontend remote, run `git remote -v`.
