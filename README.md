# SEP_Frontend

**AutoScenarioX — Scenario Management and Explainable Failure Analytics**

This repository contains the AutoScenarioX frontend: a role-based single-page application for designing driving scenarios, managing test campaigns, reviewing failures, and configuring the simulation workspace. The interface supports English and Vietnamese; English is the default, and the selected language is remembered in the browser.

The app starts in **mock mode**. Its API boundary is designed so the frontend can later use the .NET REST API without coupling screen components to HTTP or Supabase.

## Features by role

| Role | Screens and workflows |
| --- | --- |
| **Scenario Engineer** | Overview, scenario library and editor, scenario import, side-by-side comparison, scenario clusters, profile |
| **Test Engineer** | Overview, campaign creation and management, prioritization, execution queue and run details, failure insights, campaign reports, profile |
| **Test Reviewer** | Overview, scenario approval queue, failure evidence and root-cause review, run details, campaign reports, profile |
| **Administrator** | Overview, user and role management, simulation nodes, test-oracle rules, analytics settings, audit log, profile |

The sign-in screen also includes registration and forgot-password views. Use the **EN / VI** switch on the sign-in screen or in the top bar to change the interface language. After signing in, use the role selector in the top bar to preview each role's navigation and screens.

## Run locally

### Requirements

- Node.js 20.19 or newer
- npm

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

## Demo sign-in

Choose a role card on the login screen, or use one of these demo accounts:

| Role | Demo email |
| --- | --- |
| Scenario Engineer | `scenario@autoscenariox.dev` |
| Test Engineer | `tester@autoscenariox.dev` |
| Test Reviewer | `reviewer@autoscenariox.dev` |
| Administrator | `admin@autoscenariox.dev` |

For manual sign-in, enter an email and any password with at least six characters. Registration saves a demo profile in this browser. Forgot-password only displays a mock confirmation; no authentication provider is connected yet.

> Role-based navigation is for frontend preview only. Enforce identity, permissions, and role checks in the backend before using real data.

## Mock data and API integration

The app uses mock data by default. To point it at the .NET API, copy `.env.example` to `.env.local` and set the API URL:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://localhost:7001
```

Use the actual URL and port configured for your .NET API, then restart the Vite server. Set `VITE_DATA_MODE=mock` to return to the local demo.

### Frontend service boundary

- `src/data/mockData.ts` provides sample scenarios, campaigns, failures, workers, dashboard metrics, and oracle rules.
- `src/services/mockApi.ts` implements the demo API. Scenario and campaign creation, root-cause confirmation, and oracle edits are saved in browser `localStorage`.
- `src/services/httpApi.ts` implements the .NET REST adapter.
- `src/services/api.ts` selects the mock or HTTP implementation using `VITE_DATA_MODE`.
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

Actual CARLA execution, OpenSCENARIO parsing, backend authentication and authorization, campaign approval, node registration, and report export still need backend support.

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

This project is already a Git repository with an `origin` remote. From the project root, review and commit the README change with:

```powershell
git status
git add README.md
git commit -m "docs: update frontend README"
git push
```

If you changed other files too, stage the files you intend to include (or use `git add .`), check `git status`, then commit. Do not run `git init` inside this existing repository. To verify the configured remote, run `git remote -v`.
