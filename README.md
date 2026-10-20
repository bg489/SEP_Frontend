# SEP_Frontend

**AutoScenarioX — Scenario Management and Explainable Failure Analytics**

This repository contains the AutoScenarioX frontend: a role-based single-page application for designing driving scenarios, managing test campaigns, reviewing failures, and configuring the simulation workspace. The interface supports English and Vietnamese; English is the default, and the selected language is remembered in the browser. Authentication requests are managed with Redux Saga.

The app starts in **mock mode**. Its API boundary is designed so the frontend can later use the .NET REST API without coupling screen components to HTTP or Supabase.

## Features by role

| Role | Screens and workflows |
| --- | --- |
| **Scenario Engineer** | Overview, scenario library and editor, scenario import, side-by-side comparison, scenario clusters, profile |
| **Test Engineer** | Overview, campaign creation and management, prioritization, execution queue and run details, failure insights, campaign reports, profile |
| **Test Reviewer** | Overview, scenario approval queue, failure evidence and root-cause review, run details, campaign reports, profile |
| **Administrator** | Overview, user and role management, simulation nodes, test-oracle rules, analytics settings, audit log, profile |

The sign-in screen includes registration and forgot-password views. Use the **EN / VI** switch on the sign-in screen or in the top bar to change the interface language. In mock mode, the role selector previews each role's navigation. In API mode, the role comes from the backend and the preview selector is hidden.

## Run locally

### Requirements

- Node.js 20.19 or newer
- npm
- .NET 10 SDK and PostgreSQL 18 to run backend authentication

### Install and start

```powershell
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

The app uses mock scenario-management data by default, while authentication always uses the .NET backend. Copy `.env.example` to `.env.local` to set the API URL:

```dotenv
VITE_DATA_MODE=mock
VITE_API_BASE_URL=http://localhost:5080
```

Start the backend first, then restart Vite after changing `.env.local`. `VITE_DATA_MODE` only switches scenario-management data; it never changes authentication. Set `VITE_DATA_MODE=api` only when the scenario-management endpoints listed below are available.

### Run backend authentication

The separate backend project is in `../Backend`. It targets PostgreSQL 18 database `autoscenariox` and keeps its Identity tables in schema `app_auth`. Follow [the backend setup guide](../Backend/README.md) to configure .NET User Secrets, run the API, and optionally provision the first administrator. The API runs at `http://localhost:5080`.

Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, and `POST /api/auth/reset-password`. During registration, users may select Scenario Engineer, Test Engineer, or Test Reviewer; Administrator can only be assigned by an administrator. Administrator-only role management is provided by `GET /api/admin/users` and `PUT /api/admin/users/{id}/role`. Password-reset email delivery still needs a mail provider in production.

### Frontend service boundary

- `src/data/mockData.ts` provides sample scenarios, campaigns, failures, workers, dashboard metrics, and oracle rules.
- `src/services/mockApi.ts` implements the demo API. Scenario and campaign creation, root-cause confirmation, and oracle edits are saved in browser `localStorage`.
- `src/services/httpApi.ts` implements the .NET REST adapter.
- `src/services/api.ts` selects the mock or HTTP implementation using `VITE_DATA_MODE`.
- `src/services/authApi.ts` sends login, registration, password-reset, and session requests to the .NET authentication API.
- `src/features/auth/authSaga.ts` handles login, registration, session restore, password-reset requests, and logout.
- `src/app/store.ts` creates the Redux store and runs the authentication saga.
- `src/types.ts` defines the API and screen data contracts.

### Expected .NET API endpoints

| Method | Endpoint | Used for |
| --- | --- | --- |
| `GET` | `/api/dashboard/overview` | Dashboard metrics and activity |
| `GET`, `POST` | `/api/scenarios` | Search/list scenarios and create a scenario (`search` and `status` query parameters are supported) |
| `GET`, `POST` | `/api/campaigns` | List and create campaigns |
| `GET` | `/api/analytics/failure-clusters` | Failure clusters and evidence |
| `POST` | `/api/analytics/failure-clusters/{id}/confirm` | Confirm a reviewed root cause |
| `GET` | `/api/simulation-nodes` | Simulation worker status |
| `GET`, `PUT` | `/api/oracles/rules` | Read and save oracle rules |

API responses should match the TypeScript contracts in `src/types.ts`. Configure CORS on the .NET API for the frontend origin. If an API request fails, the interface keeps its available demo data and displays a notification.

Actual CARLA execution, OpenSCENARIO parsing, campaign approval, node registration, and report export still need backend support.

### Supabase and secrets

The frontend is intended to call the .NET API. Keep Supabase database access and service-role credentials on the backend; never put a service key in a `VITE_*` variable. If Supabase Auth is later used in the browser, only expose its public anon key and keep authorization checks in .NET as required.

## Project structure

```text
src/
  components/   Authentication and role-specific screens
  data/         Initial mock data
  services/     Mock API, HTTP API, and API selector
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

Review `git status` before committing. Do not push directly to `main`. The backend is a sibling folder and is not inside this frontend Git repository; version-control it in its own repository when your team creates one. To verify the frontend remote, run `git remote -v`.
