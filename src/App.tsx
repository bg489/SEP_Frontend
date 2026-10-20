import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { Icon, type IconName } from "./components/Icon";
import { AuthScreen } from "./components/AuthScreen";
import { RolePages, RoleWelcome } from "./components/RolePages";
import { LanguageProvider, LanguageSwitcher } from "./i18n";
import { api, isMockMode } from "./services/api";
import { isAuthApiEnabled } from "./services/authConfig";
import type { AppDispatch, RootState } from "./app/store";
import {
  bootstrapAuthRequested,
  loginRequested,
  logoutRequested,
  passwordResetRequested,
  registerRequested,
} from "./features/auth/authSlice";
import {
  mockCampaigns,
  mockFailures,
  mockOracleRules,
  mockOverview,
  mockScenarios,
  mockWorkers,
} from "./data/mockData";
import type {
  Campaign,
  AppPage,
  CreateCampaignInput,
  CreateScenarioInput,
  DemoUser,
  FailureCluster,
  OracleRule,
  OverviewData,
  Scenario,
  UserRole,
  WorkerNode,
} from "./types";

type Page = AppPage;
const rolePages: Record<UserRole, Page[]> = {
  "Scenario Engineer": [
    "overview",
    "scenarios",
    "scenario-editor",
    "import",
    "compare",
    "clusters",
    "profile",
  ],
  "Test Engineer": [
    "overview",
    "campaigns",
    "priority",
    "execution",
    "run-detail",
    "failures",
    "report",
    "profile",
  ],
  "Test Reviewer": [
    "overview",
    "review",
    "failures",
    "report",
    "run-detail",
    "profile",
  ],
  Administrator: [
    "overview",
    "users",
    "nodes",
    "oracles",
    "analytics",
    "audit",
    "profile",
  ],
};
const navByRole: Record<
  UserRole,
  { id: Page; label: string; icon: IconName; group: string }[]
> = {
  "Scenario Engineer": [
    { id: "overview", label: "Overview", icon: "overview", group: "WORKSPACE" },
    {
      id: "scenarios",
      label: "Scenario library",
      icon: "scenarios",
      group: "DESIGN",
    },
    {
      id: "import",
      label: "Import scenarios",
      icon: "upload",
      group: "DESIGN",
    },
    {
      id: "compare",
      label: "Compare scenarios",
      icon: "priority",
      group: "DESIGN",
    },
    {
      id: "clusters",
      label: "Scenario clusters",
      icon: "map",
      group: "EXPLORE",
    },
    { id: "profile", label: "My profile", icon: "users", group: "ACCOUNT" },
  ],
  "Test Engineer": [
    { id: "overview", label: "Overview", icon: "overview", group: "WORKSPACE" },
    {
      id: "campaigns",
      label: "Campaigns",
      icon: "campaigns",
      group: "TESTING",
    },
    {
      id: "priority",
      label: "Prioritization",
      icon: "priority",
      group: "TESTING",
    },
    {
      id: "execution",
      label: "Execution queue",
      icon: "play",
      group: "TESTING",
    },
    {
      id: "failures",
      label: "Failure insights",
      icon: "failures",
      group: "ANALYZE",
    },
    {
      id: "report",
      label: "Campaign reports",
      icon: "activity",
      group: "ANALYZE",
    },
    { id: "profile", label: "My profile", icon: "users", group: "ACCOUNT" },
  ],
  "Test Reviewer": [
    { id: "overview", label: "Overview", icon: "overview", group: "WORKSPACE" },
    { id: "review", label: "Review queue", icon: "shield", group: "REVIEW" },
    {
      id: "failures",
      label: "Failure evidence",
      icon: "failures",
      group: "REVIEW",
    },
    {
      id: "report",
      label: "Campaign reports",
      icon: "activity",
      group: "ANALYZE",
    },
    { id: "profile", label: "My profile", icon: "users", group: "ACCOUNT" },
  ],
  Administrator: [
    { id: "overview", label: "Overview", icon: "overview", group: "WORKSPACE" },
    { id: "users", label: "User management", icon: "users", group: "ACCESS" },
    { id: "nodes", label: "Simulation nodes", icon: "nodes", group: "SYSTEM" },
    { id: "oracles", label: "Test oracles", icon: "oracles", group: "SYSTEM" },
    {
      id: "analytics",
      label: "Analytics settings",
      icon: "priority",
      group: "SYSTEM",
    },
    { id: "audit", label: "Audit log", icon: "clock", group: "SYSTEM" },
    { id: "profile", label: "My profile", icon: "users", group: "ACCOUNT" },
  ],
};
const titles: Record<Page, string> = {
  overview: "Overview",
  scenarios: "Scenario library",
  campaigns: "Test campaigns",
  priority: "Scenario prioritization",
  failures: "Failure insights",
  nodes: "Simulation nodes",
  oracles: "Test oracle configuration",
  "scenario-editor": "Scenario editor",
  import: "Import scenarios",
  compare: "Compare scenarios",
  clusters: "Scenario clusters",
  execution: "Execution queue",
  "run-detail": "Run details",
  review: "Review queue",
  report: "Campaign report",
  users: "User management",
  analytics: "Analytics settings",
  audit: "Audit log",
  profile: "My profile",
};
const dashboardLinks: Record<
  UserRole,
  {
    primary: Page;
    primaryLabel: string;
    secondary: Page;
    secondaryLabel: string;
  }
> = {
  "Scenario Engineer": {
    primary: "scenarios",
    primaryLabel: "Open scenario library",
    secondary: "clusters",
    secondaryLabel: "Explore scenario clusters",
  },
  "Test Engineer": {
    primary: "campaigns",
    primaryLabel: "View campaigns",
    secondary: "failures",
    secondaryLabel: "Explore failure insights",
  },
  "Test Reviewer": {
    primary: "review",
    primaryLabel: "Open review queue",
    secondary: "failures",
    secondaryLabel: "Explore failure evidence",
  },
  Administrator: {
    primary: "nodes",
    primaryLabel: "Manage simulation nodes",
    secondary: "audit",
    secondaryLabel: "Review audit activity",
  },
};

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);
  const user = auth.user;
  const [page, setPage] = useState<Page>("overview");
  const [overview, setOverview] = useState<OverviewData>(mockOverview);
  const [scenarios, setScenarios] = useState<Scenario[]>(mockScenarios);
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);
  const [failures, setFailures] = useState<FailureCluster[]>(mockFailures);
  const [workers, setWorkers] = useState<WorkerNode[]>(mockWorkers);
  const [rules, setRules] = useState<OracleRule[]>(mockOracleRules);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"scenario" | "campaign" | null>(null);
  const [toast, setToast] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null,
  );
  const [editorScenarioId, setEditorScenarioId] = useState<
    string | undefined
  >();
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    string | undefined
  >();
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [ready, setReady] = useState(false);
  const role = user?.role ?? "Test Engineer";
  useEffect(() => {
    dispatch(bootstrapAuthRequested());
  }, [dispatch]);

  const navigate = (target: Page) => {
    if (!rolePages[role].includes(target)) {
      notify("This screen is not included in the current role preview.");
      return;
    }
    setPage(target);
    setSelectedScenario(null);
  };
  const updateUser = (next: DemoUser) => {
    if (isAuthApiEnabled) return;
    localStorage.setItem("asx-session", JSON.stringify(next));
  };
  const signOut = () => {
    dispatch(logoutRequested());
    setPage("overview");
  };

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.getOverview(),
      api.listScenarios(),
      api.listCampaigns(),
      api.listFailures(),
      api.listWorkers(),
      api.listOracleRules(),
    ])
      .then(([o, s, c, f, w, r]) => {
        if (!mounted) return;
        if (o.status === "fulfilled") setOverview(o.value);
        if (s.status === "fulfilled") setScenarios(s.value);
        if (c.status === "fulfilled") setCampaigns(c.value);
        if (f.status === "fulfilled") setFailures(f.value);
        if (w.status === "fulfilled") setWorkers(w.value);
        if (r.status === "fulfilled") setRules(r.value);
        if (
          !isMockMode &&
          [o, s, c, f, w, r].some((result) => result.status === "rejected")
        )
          setToast(
            "Some API endpoints are unavailable. Demo data is shown for those sections.",
          );
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!ready || page !== "scenarios") return;
    let active = true;
    const timer = window.setTimeout(() => {
      api
        .listScenarios({ query: search, status: statusFilter })
        .then((items) => {
          if (active) setScenarios(items);
        })
        .catch((error: unknown) => {
          if (active && !isMockMode)
            setToast(
              error instanceof Error
                ? error.message
                : "Could not load scenarios.",
            );
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, ready, search, statusFilter]);

  const filteredScenarios = useMemo(
    () =>
      scenarios.filter((s) => {
        const q = search.trim().toLowerCase();
        return (
          (!q ||
            [s.id, s.name, s.map, s.category, ...s.tags]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (statusFilter === "All statuses" || s.status === statusFilter)
        );
      }),
    [scenarios, search, statusFilter],
  );

  const notify = (message: string) => setToast(message);
  const createScenario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: CreateScenarioInput = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      map: String(form.get("map") ?? "Town05"),
      category: String(form.get("category") ?? "Urban"),
      severity: String(
        form.get("severity") ?? "High",
      ) as CreateScenarioInput["severity"],
      weather: String(form.get("weather") ?? "Clear noon"),
    };
    try {
      const item = await api.createScenario(input);
      setScenarios((items) => [item, ...items]);
      setOverview((value) => ({
        ...value,
        totalScenarios: value.totalScenarios + 1,
      }));
      setDialog(null);
      setPage("scenarios");
      setSearch("");
      notify("Scenario " + item.id + " saved as draft.");
    } catch {
      notify("Could not save scenario. Check the API connection.");
    }
  };
  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ids = form.getAll("scenarioIds").map(String);
    if (!ids.length) {
      notify("Select at least one scenario.");
      return;
    }
    const input: CreateCampaignInput = {
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      scenarioIds: ids,
      strategy: String(form.get("strategy") ?? "Proposed (APFD)"),
    };
    try {
      const item = await api.createCampaign(input);
      setCampaigns((items) => [item, ...items]);
      setDialog(null);
      setPage("campaigns");
      notify("Campaign " + item.name + " has been created.");
    } catch {
      notify("Could not create campaign. Check the API connection.");
    }
  };
  const saveRules = async (next: OracleRule[]) => {
    try {
      setRules(await api.saveOracleRules(next));
      notify("Oracle configuration saved.");
    } catch {
      notify("Could not save oracle rules. Check the API connection.");
    }
  };
  const confirmFailure = async (failure: FailureCluster) => {
    try {
      const updated = await api.confirmFailureCluster(failure.id);
      setFailures((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify("Root cause marked as confirmed.");
    } catch {
      notify("Could not confirm the root cause. Check the API connection.");
    }
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rolePages[role].includes("scenarios")) {
      notify(
        "Scenario search is available in the Scenario Engineer role preview.",
      );
      return;
    }
    setPage("scenarios");
    setStatusFilter("All statuses");
  };
  const action =
    page === "scenarios" ? (
      <div className="actions">
        <button className="btn btn-light" onClick={() => navigate("import")}>
          <Icon name="upload" size={16} /> Import
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setDialog("scenario")}
        >
          <Icon name="plus" size={16} /> New scenario
        </button>
      </div>
    ) : (page === "campaigns" || page === "overview") &&
      role === "Test Engineer" ? (
      <button className="btn btn-primary" onClick={() => setDialog("campaign")}>
        <Icon name="plus" size={16} /> New campaign
      </button>
    ) : page === "priority" && role === "Test Engineer" ? (
      <button
        className="btn btn-light"
        onClick={() =>
          notify("Evaluation report will download when the API is connected.")
        }
      >
        <Icon name="download" size={15} /> Export report
      </button>
    ) : page === "oracles" && role === "Administrator" ? (
      <button className="btn btn-light" onClick={() => saveRules(rules)}>
        <Icon name="check" size={15} /> Save changes
      </button>
    ) : page === "failures" || page === "nodes" ? (
      <button
        className="btn btn-light"
        onClick={() => notify("Data refreshed from the mock workspace.")}
      >
        <Icon name="refresh" size={15} /> Refresh
      </button>
    ) : null;

  if (auth.status === "checking") {
    return <div className="auth-loading">Checking your session…</div>;
  }

  if (!user) {
    return (
      <AuthScreen
        busy={auth.busy}
        error={auth.error}
        notice={auth.message}
        onLogin={(input) => dispatch(loginRequested(input))}
        onRegister={(input) => dispatch(registerRequested(input))}
        onRequestPasswordReset={(email) => dispatch(passwordResetRequested(email))}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>
              AutoScenario<span>X</span>
            </strong>
            <small>SIMULATION INTELLIGENCE</small>
          </div>
        </div>
        <button
          className="project-switch"
          onClick={() =>
            notify(
              "Urban Mobility Lab is the only project configured in this demo.",
            )
          }
        >
          <span className="project-icon">
            <Icon name="car" size={16} />
          </span>
          <span>
            <small>PROJECT</small>
            <b>Urban Mobility Lab</b>
          </span>
          <Icon name="chevron" size={14} />
        </button>
        {[...new Set(navByRole[role].map((item) => item.group))].map(
          (group) => (
            <div className="nav-group" key={group}>
              <label>{group}</label>
              {navByRole[role]
                .filter((n) => n.group === group)
                .map((n) => (
                  <button
                    className={"nav-item " + (page === n.id ? "active" : "")}
                    key={n.id}
                    onClick={() => {
                      navigate(n.id);
                    }}
                  >
                    <Icon name={n.icon} size={17} />
                    <span>{n.label}</span>
                    {n.id === "failures" && <em>12</em>}
                  </button>
                ))}
            </div>
          ),
        )}
        <div className="sidebar-spacer" />
        {(role === "Administrator" || role === "Test Engineer") && (
          <div className="worker-mini">
            <span className="worker-mini-icon">
              <Icon name="activity" size={15} />
            </span>
            <span>
              <b>Simulation cluster</b>
              <small>
                <i /> {workers.filter((w) => w.status !== "Offline").length} of{" "}
                {workers.length} workers online
              </small>
            </span>
            <button
              onClick={() =>
                role === "Administrator"
                  ? navigate("nodes")
                  : notify(
                      "Simulation node administration is available to Administrators.",
                    )
              }
            >
              <Icon name="arrow-right" size={14} />
            </button>
          </div>
        )}
        <div className="sidebar-profile">
          <Avatar
            initials={user.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          />
          <span>
            <b>{user.name}</b>
            <small>{user.role}</small>
          </span>
          <button onClick={() => navigate("profile")}>
            <Icon name="more" size={16} />
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="crumb">
            <span>
              {page === "priority" || page === "failures" || page === "report"
                ? "Analyze"
                : page === "nodes" ||
                    page === "oracles" ||
                    page === "analytics" ||
                    page === "audit" ||
                    page === "users"
                  ? "Administration"
                  : page === "review"
                    ? "Review"
                    : page === "profile"
                      ? "Account"
                      : "Workspace"}
            </span>
            <i>/</i>
            <b>{titles[page]}</b>
          </div>
          {role === "Scenario Engineer" && (
            <form className="top-search" onSubmit={submitSearch}>
              <Icon name="search" size={16} />
              <input
                placeholder="Search scenarios, campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </form>
          )}
          <div className="topbar-right">
            <span className="project-pill">
              <i>U</i> Urban Mobility Lab <Icon name="chevron" size={13} />
            </span>
            <button
              className="icon-button bell"
              aria-label="Notifications"
              onClick={() => notify("You are all caught up.")}
            >
              <Icon name="bell" size={18} />
              <i />
            </button>
            <span className="top-divider" />
            <button className="top-user" onClick={() => navigate("profile")}>
              <Avatar
                initials={user.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              />
              <span>
                <b>{user.name}</b>
                <small>{user.role}</small>
              </span>
              <Icon name="chevron" size={13} />
            </button>
            <LanguageSwitcher />
            <button className="sign-out-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <i /> AUTOSCENARIOX <span>·</span>{" "}
                {page === "overview" ||
                page === "scenarios" ||
                page === "campaigns" ||
                page === "import" ||
                page === "compare" ||
                page === "clusters" ||
                page === "scenario-editor"
                  ? "WORKSPACE"
                  : page === "priority" ||
                      page === "failures" ||
                      page === "report" ||
                      page === "execution" ||
                      page === "run-detail"
                    ? "TEST OPERATIONS"
                    : page === "review"
                      ? "REVIEW"
                      : page === "profile"
                        ? "ACCOUNT"
                        : "ADMINISTRATION"}
              </div>
              <h1>{titles[page]}</h1>
              <p>{pageDescription(page)}</p>
            </div>
            <div className="page-actions">{action}</div>
          </div>
          {isMockMode && (
            <div className="demo-banner">
              <i />
              <b>Demo workspace</b>
              <span>
                Sample data is stored in this browser. Your .NET API can replace
                it when ready.
              </span>
              <button
                onClick={() =>
                  notify(
                    "Set VITE_DATA_MODE=api and VITE_API_BASE_URL to connect the .NET API.",
                  )
                }
              >
                How it works <Icon name="arrow-right" size={13} />
              </button>
            </div>
          )}
          {!ready && (
            <div className="loading-line">
              <i /> Loading workspace data
            </div>
          )}
          {page === "overview" && (
            <RoleWelcome role={role} onNavigate={navigate} />
          )}
          {page === "overview" && (
            <Overview
              role={role}
              overview={overview}
              scenarios={scenarios}
              campaigns={campaigns}
              failures={failures}
              workers={workers}
              primaryLabel={dashboardLinks[role].primaryLabel}
              secondaryLabel={dashboardLinks[role].secondaryLabel}
              openPrimary={() => navigate(dashboardLinks[role].primary)}
              openSecondary={() => navigate(dashboardLinks[role].secondary)}
              onScenario={setSelectedScenario}
            />
          )}
          {page === "scenarios" && (
            <ScenarioLibrary
              scenarios={filteredScenarios}
              total={overview.totalScenarios}
              search={search}
              setSearch={setSearch}
              status={statusFilter}
              setStatus={setStatusFilter}
              openScenario={setSelectedScenario}
              onImport={() => navigate("import")}
            />
          )}
          {page === "campaigns" && (
            <Campaigns
              campaigns={campaigns}
              scenarios={scenarios}
              onNavigate={navigate}
              onOpenCampaign={(id) => {
                setSelectedCampaignId(id);
                navigate("run-detail");
              }}
            />
          )}
          {page === "priority" && (
            <Prioritization
              scenarios={scenarios}
              campaigns={campaigns}
              notify={notify}
            />
          )}
          {page === "failures" && (
            <Failures
              failures={failures}
              notify={notify}
              onConfirm={confirmFailure}
            />
          )}
          {page === "nodes" && (
            <Nodes
              workers={workers}
              notify={notify}
              onAddWorker={(worker) =>
                setWorkers((items) => [worker, ...items])
              }
            />
          )}
          {page === "oracles" && <Oracles rules={rules} onSave={saveRules} />}
          {![
            "overview",
            "scenarios",
            "campaigns",
            "priority",
            "failures",
            "nodes",
            "oracles",
          ].includes(page) && (
            <RolePages
              page={page}
              user={user}
              scenarios={scenarios}
              campaigns={campaigns}
              failures={failures}
              workers={workers}
              onNavigate={navigate}
              onNotify={notify}
              onScenarioStatus={(id, status) =>
                setScenarios((items) =>
                  items.map((item) =>
                    item.id === id ? { ...item, status } : item,
                  ),
                )
              }
              onScenarioUpdate={(id, changes) =>
                setScenarios((items) =>
                  items.map((item) =>
                    item.id === id ? { ...item, ...changes } : item,
                  ),
                )
              }
              onImport={(scenario) => {
                setScenarios((items) => [scenario, ...items]);
                setOverview((value) => ({
                  ...value,
                  totalScenarios: value.totalScenarios + 1,
                }));
              }}
              onFailureConfirm={confirmFailure}
              onCampaignStatus={(id, status) =>
                setCampaigns((items) =>
                  items.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          status,
                          progress:
                            status === "Completed"
                              ? 100
                              : status === "Running"
                                ? Math.max(item.progress, 8)
                                : item.progress,
                        }
                      : item,
                  ),
                )
              }
              onUserUpdate={updateUser}
              onLogout={signOut}
              initialScenarioId={editorScenarioId}
              selectedCampaignId={selectedCampaignId}
              onOpenCampaign={(id) => {
                setSelectedCampaignId(id);
                navigate("run-detail");
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              AutoScenarioX <i>·</i> Scenario testing workspace
            </span>
            <span>
              CARLA integration{" "}
              <b>
                <i />{" "}
                {workers.some((w) => w.status !== "Offline")
                  ? "Operational"
                  : "Needs attention"}
              </b>
            </span>
          </footer>
        </main>
      </div>

      {dialog === "scenario" && (
        <Modal
          title="Create a scenario"
          subtitle="Add a reusable case to the scenario library."
          onClose={() => setDialog(null)}
          onSubmit={createScenario}
        >
          <label>
            Scenario name <em>*</em>
            <input
              name="name"
              required
              maxLength={255}
              placeholder="e.g. Unprotected left turn in rain"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              placeholder="Describe the road situation and test goal."
            />
          </label>
          <div className="form-row">
            <label>
              CARLA map
              <select name="map">
                {[
                  "Town01",
                  "Town02",
                  "Town03",
                  "Town04",
                  "Town05",
                  "Town06",
                  "Town07",
                  "Town10HD",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Scenario type
              <select name="category">
                {["Urban", "Highway", "Intersection", "Rural", "Parking"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Risk severity
              <select name="severity">
                {["Critical", "High", "Medium", "Low"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Weather
              <select name="weather">
                {[
                  "Clear noon",
                  "Clear morning",
                  "Sunset",
                  "Overcast",
                  "Light rain",
                  "Heavy rain",
                  "Fog",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-note">
            <Icon name="shield" size={15} /> New scenarios are saved as Draft
            and reviewed before use.
          </div>
        </Modal>
      )}
      {dialog === "campaign" && (
        <Modal
          title="Create a test campaign"
          subtitle="Select scenarios and a prioritization strategy."
          onClose={() => setDialog(null)}
          onSubmit={createCampaign}
        >
          <label>
            Campaign name <em>*</em>
            <input
              name="name"
              required
              maxLength={255}
              placeholder="e.g. Release 2.5 safety regression"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows={2}
              placeholder="What does this campaign validate?"
            />
          </label>
          <label>
            Execution strategy
            <select name="strategy">
              {[
                "Proposed (APFD)",
                "History-based",
                "Risk-first",
                "Severity-first",
                "Random baseline",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <div className="picker-label">
            Approved scenarios <span>Select at least one</span>
          </div>
          <div className="scenario-picker">
            {scenarios
              .filter((s) => s.status === "Approved")
              .slice(0, 7)
              .map((s) => (
                <label className="pick-item" key={s.id}>
                  <input type="checkbox" name="scenarioIds" value={s.id} />
                  <span>
                    <b>{s.name}</b>
                    <small>
                      {s.id} · {s.map} · {s.category}
                    </small>
                  </span>
                  <Badge value={s.severity} />
                </label>
              ))}
          </div>
        </Modal>
      )}
      {selectedScenario && (
        <div className="overlay" onClick={() => setSelectedScenario(null)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <small>SCENARIO DETAILS · {selectedScenario.id}</small>
                <button onClick={() => setSelectedScenario(null)}>
                  <Icon name="close" size={18} />
                </button>
              </div>
              <h2>{selectedScenario.name}</h2>
              <p>{selectedScenario.description}</p>
              <div className="inline-badges">
                <Badge value={selectedScenario.status} />
                <Badge value={selectedScenario.severity} />
                <span>{selectedScenario.version}</span>
              </div>
            </div>
            <div className="drawer-stats">
              <div>
                <small>PASS RATE</small>
                <b>{selectedScenario.passRate.toFixed(1)}%</b>
              </div>
              <div>
                <small>EXECUTIONS</small>
                <b>{selectedScenario.runCount}</b>
              </div>
              <div>
                <small>PRIORITY</small>
                <b>{selectedScenario.priorityScore}/100</b>
              </div>
            </div>
            <div className="drawer-section">
              <h3>Scenario definition</h3>
              <div>
                <span>
                  <Icon name="map" size={15} /> Map
                </span>
                <b>{selectedScenario.map}</b>
              </div>
              <div>
                <span>
                  <Icon name="cloud" size={15} /> Weather
                </span>
                <b>{selectedScenario.weather}</b>
              </div>
              <div>
                <span>
                  <Icon name="users" size={15} /> Entities
                </span>
                <b>{selectedScenario.actors} actors including ego</b>
              </div>
              <div>
                <span>
                  <Icon name="calendar" size={15} /> Last execution
                </span>
                <b>{selectedScenario.lastRun}</b>
              </div>
            </div>
            <div className="drawer-section">
              <h3>Version history</h3>
              <div className="version-entry">
                <i />
                <span>
                  <b>{selectedScenario.version} · Current</b>
                  <small>Preserved with each campaign run.</small>
                </span>
              </div>
            </div>
            <div className="drawer-actions">
              <button
                className="btn btn-light"
                onClick={() => downloadScenarioFile(selectedScenario)}
              >
                <Icon name="download" size={15} /> Download mock .xosc
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (role === "Scenario Engineer")
                    setEditorScenarioId(selectedScenario.id);
                  const target: Page =
                    role === "Scenario Engineer"
                      ? "scenario-editor"
                      : role === "Test Engineer"
                        ? "run-detail"
                        : role === "Test Reviewer"
                          ? "review"
                          : "audit";
                  navigate(target);
                }}
              >
                {role === "Scenario Engineer"
                  ? "Edit scenario"
                  : role === "Test Engineer"
                    ? "Open related run"
                    : role === "Test Reviewer"
                      ? "Open review queue"
                      : "Open audit log"}{" "}
                <Icon name="arrow-right" size={14} />
              </button>
            </div>
          </aside>
        </div>
      )}
      {toast && (
        <div className="toast">
          <Icon name="circle-check" size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function pageDescription(page: Page) {
  const descriptions: Record<Page, string> = {
    overview: "A clear view of your simulation testing activity.",
    scenarios: "Create, organize and prepare scenarios for repeatable testing.",
    campaigns: "Coordinate scenario execution and review campaign outcomes.",
    priority:
      "Order scenarios to reveal faults earlier and compare APFD effectiveness.",
    failures:
      "Review oracle evidence, recurring patterns and root-cause explanations.",
    nodes: "Monitor CARLA workers and available simulation capacity.",
    oracles: "Manage the safety rules used to evaluate each simulation run.",
    "scenario-editor":
      "Edit a scenario definition before submitting it for review.",
    import: "Validate and bring OpenSCENARIO files into your reusable library.",
    compare: "Compare scenario context, risk, coverage and execution results.",
    clusters: "Explore scenarios grouped by road context and shared tags.",
    execution: "Monitor campaigns waiting for simulation capacity.",
    "run-detail": "Inspect scenario-level outcomes and execution evidence.",
    review: "Approve scenario definitions and confirm explainable root causes.",
    report: "Review campaign quality trends and scenario coverage.",
    users: "Manage workspace members and role assignments.",
    analytics: "Configure default report scope and insight delivery.",
    audit: "Trace important changes across the simulation workspace.",
    profile: "Manage your workspace identity and notification preferences.",
  };
  return descriptions[page];
}

function Overview({
  role,
  overview,
  scenarios,
  campaigns,
  failures,
  workers,
  primaryLabel,
  secondaryLabel,
  openPrimary,
  openSecondary,
  onScenario,
}: {
  role: UserRole;
  overview: OverviewData;
  scenarios: Scenario[];
  campaigns: Campaign[];
  failures: FailureCluster[];
  workers: WorkerNode[];
  primaryLabel: string;
  secondaryLabel: string;
  openPrimary: () => void;
  openSecondary: () => void;
  onScenario: (scenario: Scenario) => void;
}) {
  const running = campaigns.filter((c) => c.status === "Running").length;
  const [period, setPeriod] = useState("Last 7 days");
  return (
    <div className="content-stack">
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <i /> LIVE TEST ENVIRONMENT
          </div>
          <h2>
            Make every simulation
            <br />
            <em>count.</em>
          </h2>
          <p>
            Bring scenarios, campaigns and failure evidence together in one
            place.
          </p>
          <button className="btn btn-white" onClick={openPrimary}>
            {primaryLabel} <Icon name="arrow-right" size={15} />
          </button>
          <small>
            <Icon name="clock" size={13} /> Updated just now
          </small>
        </div>
        <div className="hero-map">
          <span className="map-caption">
            <i>
              <Icon name="route" size={13} />
            </i>
            <b>Town05</b>
            <small>ROUTE 12 · NORTHBOUND</small>
          </span>
          <RouteArt />
          <div className="hero-stat">
            <Icon name="car" size={15} />
            <span>
              <small>SCENARIOS RUN</small>
              <b>
                2,416 <em>+12.8%</em>
              </b>
            </span>
            <span className="bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="hero-node">
            <i />
            <span>
              <b>CARLA worker</b>
              <small>Connected · 24ms</small>
            </span>
            <Icon name="circle-check" size={16} />
          </div>
        </div>
        <span className="hero-index">01 / SIMULATION OVERVIEW</span>
      </section>
      <div className="stat-grid">
        <Stat
          icon="scenarios"
          label="Scenario library"
          value={overview.totalScenarios.toLocaleString()}
          delta="+8.4%"
          note="vs. last month"
          color="purple"
        />
        <Stat
          icon="campaigns"
          label="Active campaigns"
          value={String(Math.max(overview.activeCampaigns, running)).padStart(
            2,
            "0",
          )}
          delta="2 running"
          note="1 queued to execute"
          color="blue"
        />
        <Stat
          icon="circle-check"
          label="Overall pass rate"
          value={overview.passRate.toFixed(1) + "%"}
          delta="+2.3%"
          note="vs. previous period"
          color="green"
        />
        <Stat
          icon="failures"
          label="Failure clusters"
          value={String(overview.failureClusters).padStart(2, "0")}
          delta={
            failures.filter((f) => f.reviewStatus === "Needs review").length +
            " need review"
          }
          note="across recent executions"
          color="orange"
        />
      </div>
      <div className="dashboard-grid">
        <section className="card chart-card">
          <SectionHead
            kicker="EXECUTION ACTIVITY"
            title="Test runs over time"
            note="Daily completed scenarios across all campaigns."
            action={period}
            onAction={() =>
              setPeriod(
                period === "Last 7 days" ? "Last 30 days" : "Last 7 days",
              )
            }
          />
          <div className="chart-total">
            <b>482</b>
            <span>runs completed</span>
            <strong>↗ 18.6%</strong>
            <small>vs. previous week</small>
          </div>
          <ActivityChart data={overview.weeklyRuns} />
          <div className="chart-labels">
            {overview.weeklyLabels.map((x, i) => (
              <span key={x}>{i % 2 === 0 ? x : ""}</span>
            ))}
          </div>
        </section>
        <section className="card live-card">
          <SectionHead
            kicker="IN PROGRESS"
            title="Live campaigns"
            note="Simulation work happening now."
          />
          <div className="live-list">
            {campaigns
              .filter((c) => c.status === "Running" || c.status === "Queued")
              .slice(0, 3)
              .map((c, i) => (
                <div className="live-item" key={c.id}>
                  <span className={"live-icon tint-" + i}>
                    <Icon
                      name={c.status === "Running" ? "activity" : "clock"}
                      size={16}
                    />
                  </span>
                  <div>
                    <div className="live-title">
                      <b>{c.name}</b>
                      <Badge value={c.status} />
                    </div>
                    <small>
                      {c.scenarioIds.length} scenarios ·{" "}
                      {c.status === "Running"
                        ? c.progress + "% complete"
                        : "In execution queue"}
                    </small>
                    <Progress value={c.progress} />
                  </div>
                </div>
              ))}
          </div>
          <button className="link-button" onClick={openPrimary}>
            {role === "Test Engineer" ? "All campaigns" : primaryLabel}{" "}
            <Icon name="arrow-right" size={14} />
          </button>
        </section>
      </div>
      <div className="dashboard-grid dashboard-grid-lower">
        <section className="card recent-card">
          <SectionHead
            kicker="RECENTLY TESTED"
            title="Scenario activity"
            note="Latest executions from your library."
          />
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>SCENARIO</th>
                  <th>MAP</th>
                  <th>LAST RESULT</th>
                  <th>PASS RATE</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.slice(0, 4).map((s) => (
                  <tr key={s.id} onClick={() => onScenario(s)}>
                    <td>
                      <ScenarioName scenario={s} />
                    </td>
                    <td>
                      <span className="map-tag">
                        <Icon name="map" size={13} />
                        {s.map}
                      </span>
                    </td>
                    <td>
                      <Verdict pass={s.passRate > 90} />
                    </td>
                    <td>
                      <b
                        className={
                          s.passRate > 90 ? "green-text" : "orange-text"
                        }
                      >
                        {s.passRate.toFixed(1)}%
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card pattern-card">
          <SectionHead
            kicker={
              role === "Scenario Engineer"
                ? "SCENARIO GROUPS"
                : role === "Administrator"
                  ? "SYSTEM ACTIVITY"
                  : "SIGNALS TO REVIEW"
            }
            title={
              role === "Scenario Engineer"
                ? "Scenario clusters"
                : role === "Administrator"
                  ? "Workspace audit"
                  : "Failure patterns"
            }
            note={
              role === "Scenario Engineer"
                ? "Related road situations in your library."
                : role === "Administrator"
                  ? "Changes and decisions worth tracking."
                  : "Recurring issues worth investigating."
            }
          />
          <div className="pattern-summary">
            <div className="ring">
              <b>{overview.failureClusters}</b>
              <small>clusters</small>
            </div>
            <div className="pattern-legend">
              <span>
                <i className="orange-dot" />
                Needs review{" "}
                <b>
                  {
                    failures.filter((f) => f.reviewStatus === "Needs review")
                      .length
                  }
                </b>
              </span>
              <span>
                <i className="green-dot" />
                Confirmed{" "}
                <b>
                  {
                    failures.filter((f) => f.reviewStatus === "Confirmed")
                      .length
                  }
                </b>
              </span>
              <span>
                <i className="blue-dot" />
                New this week <b>3</b>
              </span>
            </div>
          </div>
          <button className="link-button" onClick={openSecondary}>
            {secondaryLabel} <Icon name="arrow-right" size={14} />
          </button>
        </section>
      </div>
      <div className="worker-strip">
        <span className="worker-strip-icon">
          <Icon name="nodes" size={17} />
        </span>
        <span className="worker-strip-copy">
          <b>Simulation workers</b>
          <small>CARLA nodes available for execution</small>
        </span>
        <div className="worker-stack">
          {workers
            .filter((w) => w.status !== "Offline")
            .map((w, i) => (
              <span className={"worker-dot worker-" + i} key={w.id}>
                <Icon name="car" size={12} />
              </span>
            ))}
        </div>
        <b className="worker-total">
          {workers.filter((w) => w.status !== "Offline").length}
          <small> / {workers.length} ONLINE</small>
        </b>
        <button className="link-button" onClick={openPrimary}>
          {role === "Administrator" ? "Manage nodes" : primaryLabel}{" "}
          <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}

function ScenarioLibrary({
  scenarios,
  total,
  search,
  setSearch,
  status,
  setStatus,
  openScenario,
  onImport,
}: {
  scenarios: Scenario[];
  total: number;
  search: string;
  setSearch: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  openScenario: (s: Scenario) => void;
  onImport: () => void;
}) {
  return (
    <div className="content-stack">
      <div className="library-toolbar">
        <div className="local-search">
          <Icon name="search" size={16} />
          <input
            placeholder="Search by name, map or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘ F</kbd>
        </div>
        <label className="filter-box">
          <Icon name="filter" size={15} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All statuses", "Approved", "In review", "Draft", "Archived"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <Icon name="chevron" size={13} />
        </label>
      </div>
      <div className="list-meta">
        <span>
          <b>{scenarios.length}</b> scenarios shown <i>·</i>{" "}
          <b>{total.toLocaleString()}</b> in library
        </span>
        <span>
          <i className="green-dot" />
          Approved <i className="orange-dot" />
          In review{" "}
          <span className="updated">
            <Icon name="clock" size={13} />
            Updated moments ago
          </span>
        </span>
      </div>
      <section className="card table-card">
        <div className="table-scroll">
          <table className="table full-table">
            <thead>
              <tr>
                <th>SCENARIO</th>
                <th>TYPE / MAP</th>
                <th>SEVERITY</th>
                <th>LAST RUN</th>
                <th>PASS RATE</th>
                <th>STATUS</th>
                <th>PRIORITY</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} onClick={() => openScenario(s)}>
                  <td>
                    <ScenarioName scenario={s} />
                  </td>
                  <td>
                    {s.category}
                    <small className="subline">
                      {s.map} · {s.weather}
                    </small>
                  </td>
                  <td>
                    <Badge value={s.severity} />
                  </td>
                  <td>
                    {s.lastRun}
                    <small className="subline">{s.runCount} executions</small>
                  </td>
                  <td>
                    <div className="rate">
                      <b>{s.passRate.toFixed(1)}%</b>
                      <Progress value={s.passRate} />
                    </div>
                  </td>
                  <td>
                    <Badge value={s.status} />
                  </td>
                  <td>
                    <Priority score={s.priorityScore} />
                  </td>
                  <td>
                    <Icon name="arrow-right" size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scenarios.length === 0 && (
            <Empty
              title="No scenarios found"
              detail="Try another search or clear the status filter."
              onClick={() => {
                setSearch("");
                setStatus("All statuses");
              }}
            />
          )}
        </div>
        <div className="table-footer">
          Showing{" "}
          <b>
            {scenarios.length ? 1 : 0}–{scenarios.length}
          </b>{" "}
          of <b>{total.toLocaleString()}</b> scenarios{" "}
          <span>
            20 / page　‹　 <strong>1</strong>　2　3　…　25　›
          </span>
        </div>
      </section>
      <div className="info-callout">
        <Icon name="spark" size={17} />
        <div>
          <b>Reusable scenarios, reliable results</b>
          <small>
            Approved scenarios are versioned and traceable to each campaign,
            oracle configuration and execution artifact.
          </small>
        </div>
        <button onClick={onImport}>
          OpenSCENARIO import <Icon name="arrow-right" size={13} />
        </button>
      </div>
    </div>
  );
}

function Campaigns({
  campaigns,
  scenarios,
  onNavigate,
  onOpenCampaign,
}: {
  campaigns: Campaign[];
  scenarios: Scenario[];
  onNavigate: (page: Page) => void;
  onOpenCampaign: (id: string) => void;
}) {
  const [filter, setFilter] = useState("All campaigns");
  const tabs = [
    "All campaigns",
    "Running",
    "Queued",
    "Completed",
    "Needs review",
  ];
  const rows =
    filter === "All campaigns"
      ? campaigns
      : campaigns.filter((c) => c.status === filter);
  return (
    <div className="content-stack">
      <div className="campaign-tabs">
        {tabs.map((x) => (
          <button
            className={filter === x ? "selected" : ""}
            key={x}
            onClick={() => setFilter(x)}
          >
            {x}
            {x === "Running" && (
              <i>{campaigns.filter((c) => c.status === "Running").length}</i>
            )}
          </button>
        ))}
      </div>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">EXECUTION MANAGEMENT</small>
            <h3>Campaign overview</h3>
            <p>
              Runs preserve the scenario version, SUT and oracle configuration
              used at launch.
            </p>
          </div>
          <span className="legend">
            <i />
            Running　
            <i className="queued" />
            Queued
          </span>
        </div>
        <div className="table-scroll">
          <table className="table full-table campaign-table">
            <thead>
              <tr>
                <th>CAMPAIGN</th>
                <th>STATUS</th>
                <th>SCENARIOS</th>
                <th>STRATEGY</th>
                <th>PROGRESS</th>
                <th>PASS RATE</th>
                <th>OWNER</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => onOpenCampaign(c.id)}>
                  <td>
                    <div className="campaign-cell">
                      <span className="campaign-symbol">
                        <Icon
                          name={
                            c.status === "Running" ? "activity" : "campaigns"
                          }
                          size={16}
                        />
                      </span>
                      <span>
                        <b>{c.name}</b>
                        <small>{c.id}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td>
                    <b>{c.scenarioIds.length}</b> scenarios
                  </td>
                  <td>
                    <span className="strategy-tag">
                      <Icon
                        name={
                          c.strategy.includes("Proposed") ? "spark" : "priority"
                        }
                        size={13}
                      />
                      {c.strategy}
                    </span>
                  </td>
                  <td>
                    <div className="rate">
                      <b>{c.progress}%</b>
                      <Progress value={c.progress} />
                    </div>
                  </td>
                  <td
                    className={c.passRate >= 90 ? "green-text" : "orange-text"}
                  >
                    {c.passRate ? c.passRate.toFixed(1) + "%" : "—"}
                  </td>
                  <td>
                    <span className="owner">
                      <Avatar
                        initials={c.owner
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      />
                      {c.owner}
                    </span>
                  </td>
                  <td>{c.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <Empty
              title="No campaigns in this view"
              detail="Create a campaign to group scenarios into a repeatable run."
            />
          )}
        </div>
        <div className="table-footer">
          Showing <b>{rows.length}</b> of <b>{campaigns.length}</b> campaigns
          <span>Durations estimated from recent runs</span>
        </div>
      </section>
      <div className="callout-grid">
        <div className="info-callout">
          <Icon name="shield" size={18} />
          <div>
            <b>Approval keeps runs reproducible</b>
            <small>
              Submit for Test Reviewer approval before execution. Running
              campaigns cannot be modified.
            </small>
          </div>
          <button onClick={() => onNavigate("execution")}>
            Open execution queue <Icon name="arrow-right" size={13} />
          </button>
        </div>
        <div className="card coverage-card">
          <small>SCENARIO COVERAGE</small>
          <b>
            {Math.round(
              (new Set(campaigns.flatMap((c) => c.scenarioIds)).size /
                Math.max(1, scenarios.length)) *
                100,
            )}
            <i>%</i>
          </b>
          <span>of active library appears in recent campaigns</span>
          <Progress
            value={Math.min(
              100,
              (new Set(campaigns.flatMap((c) => c.scenarioIds)).size /
                Math.max(1, scenarios.length)) *
                100,
            )}
          />
        </div>
      </div>
    </div>
  );
}

function Prioritization({
  scenarios,
  campaigns,
  notify,
}: {
  scenarios: Scenario[];
  campaigns: Campaign[];
  notify: (s: string) => void;
}) {
  const [strategy, setStrategy] = useState("Proposed · failure history");
  const [ranked, setRanked] = useState(false);
  const [order, setOrder] = useState(
    [...scenarios].sort((a, b) => b.priorityScore - a.priorityScore),
  );
  const campaign =
    campaigns.find((c) => c.status === "Running") ?? campaigns[0];
  const run = () => {
    setOrder(
      [...scenarios].sort((a, b) =>
        strategy === "Severity-first"
          ? severity(b.severity) - severity(a.severity) ||
            b.priorityScore - a.priorityScore
          : strategy === "Random baseline"
            ? a.id.localeCompare(b.id)
            : b.priorityScore - a.priorityScore,
      ),
    );
    setRanked(true);
    notify("Scenario ranking generated with " + strategy.toLowerCase() + ".");
  };
  return (
    <div className="content-stack">
      <div className="priority-banner">
        <div>
          <small className="section-kicker">CAMPAIGN TO OPTIMIZE</small>
          <div className="active-campaign">
            <Icon name="campaigns" size={18} />
            <span>
              <b>{campaign?.name ?? "No campaign available"}</b>
              <small>
                {campaign?.id ?? "Create a campaign"} ·{" "}
                {campaign?.scenarioIds.length ?? 0} scenarios ·{" "}
                {campaign?.strategy ?? "—"}
              </small>
            </span>
          </div>
        </div>
        <div>
          <Badge value="Ready" />
          <button className="btn btn-primary" onClick={run}>
            <Icon name="spark" size={15} />
            {ranked ? "Re-run" : "Run prioritization"}
          </button>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="APFD score"
          value={ranked && strategy.startsWith("Proposed") ? "0.86" : "0.82"}
          delta="+0.11"
          text="vs. random baseline"
          icon="activity"
          color="purple"
        />
        <Metric
          label="APFDc score"
          value="0.76"
          delta="+0.08"
          text="cost-aware effectiveness"
          icon="clock"
          color="blue"
        />
        <Metric
          label="Faults found early"
          value="4 / 5"
          delta="80%"
          text="within first 40% of runs"
          icon="failures"
          color="orange"
        />
        <Metric
          label="Estimated suite time"
          value="2h 18m"
          delta="−24m"
          text="vs. default ordering"
          icon="route"
          color="green"
        />
      </div>
      <div className="priority-grid">
        <section className="card strategy-card">
          <SectionHead
            kicker="ORDERING METHOD"
            title="Choose a strategy"
            note="Compare a proposed approach against baselines."
          />
          <div className="strategy-options">
            {[
              [
                "Proposed · failure history",
                "Combines failure history, risk and execution cost.",
                "spark",
              ],
              [
                "Severity-first",
                "Runs critical and high-risk cases before others.",
                "shield",
              ],
              [
                "Random baseline",
                "Shuffles scenarios to establish a baseline.",
                "refresh",
              ],
            ].map(([name, description, icon]) => (
              <button
                className={strategy === name ? "picked" : ""}
                key={name}
                onClick={() => setStrategy(name)}
              >
                <Icon name={icon as IconName} size={17} />
                <span>
                  <b>{name}</b>
                  <small>{description}</small>
                </span>
                <i>{strategy === name ? "●" : "○"}</i>
              </button>
            ))}
          </div>
          <div className="note">
            <Icon name="shield" size={14} />
            APFD measures how early an order finds known faults.
          </div>
        </section>
        <section className="card detection-card">
          <SectionHead
            kicker="FAILURE DETECTION CURVE"
            title="Faults found earlier"
            note="Detection rate as the suite executes."
          />
          <DetectionChart />
        </section>
      </div>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">
              RECOMMENDED EXECUTION ORDER
            </small>
            <h3>
              Prioritized scenarios{" "}
              <span className="count-chip">{order.length}</span>
            </h3>
            <p>
              {ranked
                ? "Updated just now using " + strategy + "."
                : "Run prioritization to apply the selected strategy."}
            </p>
          </div>
          <button
            className="btn btn-light"
            onClick={() =>
              notify(
                "Scenario ranking export will be available when the API is connected.",
              )
            }
          >
            <Icon name="download" size={14} />
            Export order
          </button>
        </div>
        <div className="table-scroll">
          <table className="table full-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>SCENARIO</th>
                <th>RISK</th>
                <th>FAILURE HISTORY</th>
                <th>EST. COST</th>
                <th>SCORE</th>
                <th>RATIONALE</th>
              </tr>
            </thead>
            <tbody>
              {order.slice(0, 7).map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <b className={"rank " + (i < 3 ? "top" : "")}>
                      {String(i + 1).padStart(2, "0")}
                    </b>
                  </td>
                  <td>
                    <ScenarioName scenario={s} />
                  </td>
                  <td>
                    <Badge value={s.severity} />
                  </td>
                  <td>
                    <span className="signal-count">
                      {Math.max(1, Math.round((100 - s.passRate) / 4))} signals
                    </span>
                  </td>
                  <td>~{(4 + s.actors * 0.48).toFixed(1)} min</td>
                  <td>
                    <Priority score={s.priorityScore} />
                  </td>
                  <td>
                    {s.priorityScore > 90
                      ? "High fault yield · recent regression"
                      : s.severity === "Critical"
                        ? "Critical safety exposure"
                        : "Complements suite coverage"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            <Icon name="spark" size={13} /> Score combines fault history,
            severity and expected run cost.
          </span>
          <button
            className="text-button"
            onClick={() =>
              notify(
                "Evaluation compares the selected campaign with its baseline run.",
              )
            }
          >
            Evaluation details <Icon name="arrow-right" size={13} />
          </button>
        </div>
      </section>
    </div>
  );
}

function Failures({
  failures,
  notify,
  onConfirm,
}: {
  failures: FailureCluster[];
  notify: (s: string) => void;
  onConfirm: (failure: FailureCluster) => void;
}) {
  const [open, setOpen] = useState<FailureCluster | null>(null);
  const [reviewFilter, setReviewFilter] = useState("All statuses");
  const [timeRange, setTimeRange] = useState("This week");
  const visibleFailures = failures.filter(
    (failure) =>
      reviewFilter === "All statuses" || failure.reviewStatus === reviewFilter,
  );
  const types = [
    ["Collision", 9, "red"],
    ["Time-to-collision", 7, "orange"],
    ["Lane invasion", 5, "purple"],
    ["Route incompletion", 3, "blue"],
    ["Traffic-light violation", 2, "green"],
  ];
  return (
    <div className="content-stack">
      <div className="metric-grid">
        <Metric
          label="Open clusters"
          value={String(
            failures.filter((f) => f.reviewStatus === "Needs review").length,
          ).padStart(2, "0")}
          delta="need review"
          text="root causes to confirm"
          icon="failures"
          color="orange"
        />
        <Metric
          label="Affected executions"
          value={String(failures.reduce((s, f) => s + f.affectedRuns, 0))}
          delta="−18%"
          text="compared to last week"
          icon="activity"
          color="purple"
        />
        <Metric
          label="Mean confidence"
          value={
            Math.round(
              failures.reduce((s, f) => s + f.confidence, 0) /
                Math.max(1, failures.length),
            ) + "%"
          }
          delta="+4.2%"
          text="explanation confidence"
          icon="spark"
          color="blue"
        />
        <Metric
          label="Reviewed this week"
          value={String(
            failures.filter((f) => f.reviewStatus === "Confirmed").length,
          )}
          delta="On track"
          text="review queue progress"
          icon="circle-check"
          color="green"
        />
      </div>
      <div className="priority-grid">
        <section className="card oracle-chart-card">
          <SectionHead
            kicker="ORACLE SIGNALS"
            title="Detected failure types"
            note={`Violations surfaced across ${timeRange.toLowerCase()}.`}
            action={timeRange}
            onAction={() => {
              const next =
                timeRange === "This week" ? "Last 30 days" : "This week";
              setTimeRange(next);
              notify(
                `Failure analytics period changed to ${next}; mock chart values are illustrative.`,
              );
            }}
          />
          <div className="failure-types">
            {types.map(([label, count, color]) => (
              <div key={label as string}>
                <span className={"failure-type " + color}>
                  <Icon
                    name={
                      label === "Collision"
                        ? "car"
                        : label === "Lane invasion"
                          ? "route"
                          : "warning"
                    }
                    size={14}
                  />
                </span>
                <b>{label}</b>
                <span className="bar-bg">
                  <i
                    className={"bar-" + color}
                    style={{ width: Number(count) * 9 + "%" }}
                  />
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="chart-foot">
            Safety-critical <b>16</b>
            <span>
              Behavioral <b>10</b>
            </span>
            <button onClick={() => failures[0] && setOpen(failures[0])}>
              View oracle evidence <Icon name="arrow-right" size={12} />
            </button>
          </div>
        </section>
        <section className="card insight-card">
          <small className="section-kicker">EXPLAINABLE ANALYTICS</small>
          <h3>
            <Icon name="spark" size={16} />
            What changed?
          </h3>
          <blockquote>
            <b>
              Rainy merge scenarios account for 31% of this week's new failures.
            </b>{" "}
            Low TTC and contact events co-occur in Town05 across 4 runs.
          </blockquote>
          <div className="insight-tags">
            <span>
              <Icon name="map" size={13} /> Town05
            </span>
            <span>
              <Icon name="cloud" size={13} /> Heavy rain
            </span>
            <span>
              <Icon name="users" size={13} /> 4 related runs
            </span>
          </div>
          <button
            className="link-button"
            onClick={() => failures[0] && setOpen(failures[0])}
          >
            Review evidence <Icon name="arrow-right" size={14} />
          </button>
        </section>
      </div>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">ROOT-CAUSE REVIEW</small>
            <h3>
              Failure clusters{" "}
              <span className="count-chip">{visibleFailures.length} shown</span>
            </h3>
            <p>Similar failed runs grouped with traceable oracle evidence.</p>
          </div>
          <label className="filter-box">
            <Icon name="filter" size={14} />
            <select
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value)}
            >
              {["All statuses", "Needs review", "Confirmed"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <Icon name="chevron" size={12} />
          </label>
        </div>
        <div className="table-scroll">
          <table className="table full-table">
            <thead>
              <tr>
                <th>CLUSTER</th>
                <th>ROOT CAUSE</th>
                <th>SCENARIO / MAP</th>
                <th>RELATED RUNS</th>
                <th>SIMILARITY</th>
                <th>LAST DETECTED</th>
                <th>REVIEW</th>
              </tr>
            </thead>
            <tbody>
              {visibleFailures.map((f) => (
                <tr key={f.id} onClick={() => setOpen(f)}>
                  <td>
                    <div className="cluster-name">
                      <Icon name="failures" size={15} />
                      <span>
                        <b>{f.label}</b>
                        <small>{f.id}</small>
                      </span>
                    </div>
                  </td>
                  <td className="root-cause">{f.rootCause}</td>
                  <td>
                    {f.scenarioName}
                    <small className="subline">{f.map}</small>
                  </td>
                  <td>
                    <span className="signal-count">{f.affectedRuns} runs</span>
                  </td>
                  <td>
                    <Similarity value={f.similarity} />
                  </td>
                  <td>{f.lastDetected}</td>
                  <td>
                    <Badge value={f.reviewStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleFailures.length === 0 && (
            <Empty
              title="No failure clusters in this view"
              detail="Choose another review status to see matching evidence."
            />
          )}
        </div>
      </section>
      {open && (
        <Modal
          title={open.label}
          subtitle={open.id + " · " + open.affectedRuns + " related executions"}
          onClose={() => setOpen(null)}
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(open);
            setOpen(null);
          }}
          submitLabel="Confirm root cause"
        >
          <div className="evidence-modal">
            <Badge value={open.reviewStatus} />
            <h3>Root-cause explanation</h3>
            <p>{open.rootCause}</p>
            <h3>Oracle evidence</h3>
            {open.evidence.map((e, i) => (
              <div className="evidence-row" key={i}>
                <b>{e.rule}</b>
                <small>
                  {e.timestamp} · {e.measured} · threshold {e.threshold}
                </small>
                <p>{e.note}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Nodes({
  workers,
  notify,
  onAddWorker,
}: {
  workers: WorkerNode[];
  notify: (s: string) => void;
  onAddWorker: (worker: WorkerNode) => void;
}) {
  const [registering, setRegistering] = useState(false);
  const test = (w: WorkerNode) =>
    notify(
      w.status === "Offline"
        ? "Node " +
            w.name +
            " could not be reached at " +
            w.host +
            ":" +
            w.port +
            "."
        : "Connection to " +
            w.name +
            " succeeded · CARLA " +
            w.carlaVersion +
            ".",
    );
  return (
    <div className="content-stack">
      <div className="metric-grid">
        <Metric
          label="Registered workers"
          value={String(workers.length)}
          delta="All configured"
          text="simulation nodes"
          icon="nodes"
          color="purple"
        />
        <Metric
          label="Available capacity"
          value={String(
            workers
              .filter((w) => w.status !== "Offline")
              .reduce((s, w) => s + w.capacity - w.activeRuns, 0),
          )}
          delta="Parallel slots"
          text="for queued runs"
          icon="activity"
          color="blue"
        />
        <Metric
          label="Active executions"
          value={String(workers.reduce((s, w) => s + w.activeRuns, 0))}
          delta="Across all nodes"
          text="live scenario runs"
          icon="car"
          color="green"
        />
        <Metric
          label="Connection health"
          value={
            workers.filter((w) => w.status !== "Offline").length +
            " / " +
            workers.length
          }
          delta="1 node offline"
          text="heartbeat monitored"
          icon="circle-check"
          color="orange"
        />
      </div>
      <section className="card nodes-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">
              CARLA EXECUTION INFRASTRUCTURE
            </small>
            <h3>Simulation workers</h3>
            <p>Registered CARLA and ScenarioRunner installations.</p>
          </div>
          <button
            className="btn btn-light"
            onClick={() => setRegistering(true)}
          >
            <Icon name="plus" size={14} /> Register node
          </button>
        </div>
        <div className="node-grid">
          {workers.map((w, i) => (
            <article
              className={"node-card " + w.status.toLowerCase()}
              key={w.id}
            >
              <div>
                <Badge value={w.status} />
                <span className={"node-dot " + w.status.toLowerCase()} />
              </div>
              <span className={"node-art node-art-" + i}>
                <Icon name="nodes" size={25} />
              </span>
              <h3>{w.name}</h3>
              <small className="node-address">
                {w.host}:{w.port}
              </small>
              <div className="node-details">
                <span>
                  CARLA <b>v{w.carlaVersion}</b>
                </span>
                <span>
                  ScenarioRunner <b>v{w.scenarioRunnerVersion}</b>
                </span>
                <span>
                  Active runs{" "}
                  <b>
                    {w.activeRuns} / {w.capacity}
                  </b>
                </span>
                <span>
                  Last heartbeat <b>{w.lastHeartbeat}</b>
                </span>
              </div>
              <div className="node-bottom">
                <span className="slot-bar">
                  {Array.from({ length: w.capacity }, (_, n) => (
                    <i className={n < w.activeRuns ? "busy" : ""} key={n} />
                  ))}
                </span>
                <button className="text-button" onClick={() => test(w)}>
                  Test connection <Icon name="arrow-right" size={12} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="info-callout">
        <Icon name="shield" size={17} />
        <div>
          <b>Keep execution environments reproducible</b>
          <small>
            Campaign runs retain node, CARLA version, SUT configuration and
            random seed.
          </small>
        </div>
      </div>
      {registering && (
        <Modal
          title="Register a simulation node"
          subtitle="Add a CARLA worker to the local demo cluster."
          submitLabel="Register node"
          onClose={() => setRegistering(false)}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const port = Number(form.get("port"));
            const host = String(form.get("host"));
            if (
              workers.some((item) => item.port === port && item.host === host)
            ) {
              notify(
                `${host}:${port} is already used by a registered mock worker.`,
              );
              return;
            }
            const worker: WorkerNode = {
              id: `worker-${host.replace(/[^\w]/g, "-")}-${port}`,
              name: String(form.get("name")),
              host,
              port,
              carlaVersion: String(form.get("carlaVersion")),
              scenarioRunnerVersion: String(form.get("runnerVersion")),
              status: "Online",
              capacity: Number(form.get("capacity")),
              activeRuns: 0,
              lastHeartbeat: "Just now",
            };
            onAddWorker(worker);
            setRegistering(false);
            notify(`${worker.name} added to the mock simulation cluster.`);
          }}
        >
          <label>
            Node name
            <input name="name" required placeholder="carla-worker-04" />
          </label>
          <div className="form-row">
            <label>
              Host / IP
              <input name="host" required placeholder="192.168.1.24" />
            </label>
            <label>
              Port
              <input
                name="port"
                type="number"
                min="1"
                max="65535"
                required
                defaultValue="2000"
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              CARLA version
              <input name="carlaVersion" required defaultValue="0.9.15" />
            </label>
            <label>
              ScenarioRunner version
              <input name="runnerVersion" required defaultValue="0.9.15" />
            </label>
          </div>
          <label>
            Parallel capacity
            <input
              name="capacity"
              type="number"
              min="1"
              max="64"
              required
              defaultValue="4"
            />
          </label>
        </Modal>
      )}
    </div>
  );
}

function Oracles({
  rules,
  onSave,
}: {
  rules: OracleRule[];
  onSave: (r: OracleRule[]) => void;
}) {
  const [draft, setDraft] = useState(rules);
  useEffect(() => setDraft(rules), [rules]);
  const update = (id: string, patch: Partial<OracleRule>) =>
    setDraft((items) =>
      items.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  return (
    <div className="content-stack">
      <div className="oracle-intro">
        <span>
          <Icon name="shield" size={22} />
        </span>
        <div>
          <small className="section-kicker">AUTOMATED TEST ORACLE</small>
          <h3>Safety criteria for every run</h3>
          <p>
            Rules evaluate CARLA telemetry and events. Each violation retains a
            timestamp, measured value and supporting evidence.
          </p>
        </div>
        <Badge value="Configuration v1.8" />
      </div>
      <div className="oracle-layout">
        <section className="card oracle-list">
          <div className="section-head">
            <div>
              <small className="section-kicker">RULE CATALOG</small>
              <h3>Active test rules</h3>
              <p>
                {draft.filter((r) => r.enabled).length} of {draft.length} rules
                enabled.
              </p>
            </div>
            <button
              className="text-button"
              onClick={() =>
                setDraft((items) => items.map((r) => ({ ...r, enabled: true })))
              }
            >
              Enable all
            </button>
          </div>
          {draft.map((r, i) => (
            <div className="oracle-row" key={r.id}>
              <span className={"oracle-rule-icon oracle-" + i}>
                <Icon name={ruleIcon(r.id)} size={17} />
              </span>
              <span className="oracle-copy">
                <b>
                  {r.name}
                  <Badge value={r.enabled ? "Enabled" : "Disabled"} />
                </b>
                <small>{r.description}</small>
              </span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(r.id, { enabled: e.target.checked })}
                />
                <i />
              </label>
              <label className="threshold">
                <small>THRESHOLD</small>
                <span>
                  <input
                    type="number"
                    min="0"
                    step={r.unit.includes("s") ? "0.1" : "1"}
                    value={r.threshold}
                    disabled={!r.enabled}
                    onChange={(e) =>
                      update(r.id, { threshold: Number(e.target.value) })
                    }
                  />
                  {r.unit}
                </span>
              </label>
            </div>
          ))}
          <div className="oracle-save">
            <span>
              <Icon name="clock" size={14} />
              Applies to new campaign runs.
            </span>
            <button className="btn btn-primary" onClick={() => onSave(draft)}>
              <Icon name="check" size={15} />
              Save configuration
            </button>
          </div>
        </section>
        <aside className="oracle-aside">
          <section className="card profile-card">
            <small className="section-kicker">CONFIGURATION PROFILE</small>
            <h3>
              <Icon name="shield" size={17} />
              Default safety profile
            </h3>
            <p>Version 1.8 · Active</p>
            <div>
              <span>
                ENABLED RULES{" "}
                <b>
                  {draft.filter((r) => r.enabled).length}/{draft.length}
                </b>
              </span>
              <span>
                LAST UPDATED <b>14/10/2026 08:30</b>
              </span>
            </div>
            <button className="link-button" onClick={() => onSave(draft)}>
              View version history <Icon name="arrow-right" size={13} />
            </button>
          </section>
          <div className="oracle-note">
            <Icon name="spark" size={16} />
            <span>
              <b>Explainable by design</b>
              <small>
                Failed runs link each verdict to its oracle rule and evidence.
                Reviewers can confirm root-cause labels.
              </small>
            </span>
          </div>
          <section className="card coverage-card">
            <small>RULE COVERAGE · 7 CATEGORIES</small>
            <div className="rule-dots">
              {draft.map((r) => (
                <span
                  className={r.enabled ? "on" : ""}
                  key={r.id}
                  title={r.name}
                >
                  <Icon name={ruleIcon(r.id)} size={13} />
                </span>
              ))}
            </div>
            <p>Collision · lane · TTC · speed · signal · route · freezing</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  onSubmit,
  children,
  submitLabel,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        <div className="modal-actions">
          <button className="btn btn-light" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" size={15} />
            {submitLabel ??
              (title.startsWith("Create a scenario")
                ? "Save scenario"
                : "Create campaign")}
          </button>
        </div>
      </form>
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  delta,
  note,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  delta: string;
  note: string;
  color: string;
}) {
  return (
    <div className="card stat">
      <span className={"stat-icon " + color}>
        <Icon name={icon} size={18} />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>
        <b>{delta}</b> {note}
      </span>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  delta,
  text,
  color,
}: {
  icon: IconName;
  label: string;
  value: string;
  delta: string;
  text: string;
  color: string;
}) {
  return (
    <div className="card metric">
      <span className={"metric-icon " + color}>
        <Icon name={icon} size={16} />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>
        <b>{delta}</b> {text}
      </span>
    </div>
  );
}
function SectionHead({
  kicker,
  title,
  note,
  action,
  onAction,
  link,
  onLink,
}: {
  kicker: string;
  title: string;
  note: string;
  action?: string;
  onAction?: () => void;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <small className="section-kicker">{kicker}</small>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      {action ? (
        <button className="select-like" onClick={onAction}>
          {action}
          <Icon name="chevron" size={13} />
        </button>
      ) : link ? (
        <button className="link-button" onClick={onLink}>
          {link}
          <Icon name="arrow-right" size={13} />
        </button>
      ) : null}
    </div>
  );
}
function ScenarioName({ scenario }: { scenario: Scenario }) {
  return (
    <div className="scenario-name">
      <span>
        <Icon
          name={
            scenario.category === "Highway"
              ? "route"
              : scenario.category === "Intersection"
                ? "map"
                : "car"
          }
          size={15}
        />
      </span>
      <span>
        <b>{scenario.name}</b>
        <small>
          {scenario.id} · {scenario.version}
        </small>
      </span>
    </div>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <span className="progress">
      <i style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </span>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value.toLowerCase().replaceAll(" ", "-")}>
      {value}
    </span>
  );
}
function Verdict({ pass }: { pass: boolean }) {
  return (
    <span className={"verdict " + (pass ? "pass" : "fail")}>
      <i>{pass ? "✓" : "×"}</i>
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}
function Priority({ score }: { score: number }) {
  return (
    <span className="priority-score">
      <b>{score}</b>
      <i>
        <em style={{ width: score + "%" }} />
      </i>
    </span>
  );
}
function Similarity({ value }: { value: number }) {
  return (
    <span className="similarity">
      <i>
        <b style={{ width: value * 100 + "%" }} />
      </i>
      <strong>{Math.round(value * 100)}%</strong>
    </span>
  );
}
function Avatar({ initials }: { initials: string }) {
  return <i className="avatar">{initials}</i>;
}
function Empty({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <Icon name="search" size={20} />
      <b>{title}</b>
      <small>{detail}</small>
      {onClick && (
        <button className="text-button" onClick={onClick}>
          Clear filters
        </button>
      )}
    </div>
  );
}
function ActivityChart({ data }: { data: number[] }) {
  const max = Math.max(100, ...data) * 1.1;
  const pts = data.map(
    (v, i) =>
      [
        (i / Math.max(1, data.length - 1)) * 600,
        180 - (v / max) * 175,
      ] as const,
  );
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  return (
    <svg
      className="activity-chart"
      viewBox="0 0 600 190"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FF6363" stopOpacity=".2" />
          <stop offset="1" stopColor="#FF6363" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((n) => (
        <line
          key={n}
          x1="0"
          x2="600"
          y1={n * 60}
          y2={n * 60}
          className="grid-line"
        />
      ))}
      <path d={line + " L 600 190 L 0 190 Z"} fill="url(#fill)" />
      <path
        d={line}
        fill="none"
        stroke="#FF6363"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="3"
          fill="#fff"
          stroke="#FF6363"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
function DetectionChart() {
  return (
    <svg
      className="detection-chart"
      viewBox="0 0 540 190"
      preserveAspectRatio="none"
    >
      {[0, 1, 2, 3].map((n) => (
        <line
          key={n}
          x1="22"
          x2="536"
          y1={10 + n * 48}
          y2={10 + n * 48}
          className="grid-line"
        />
      ))}
      <path
        d="M24 173 C76 163 90 145 136 140 S204 110 245 104 S312 76 350 68 S418 44 457 39 S508 25 535 19"
        fill="none"
        stroke="#FF6363"
        strokeWidth="3"
      />
      <path
        d="M24 173 C72 162 91 154 136 149 S202 134 245 127 S307 108 350 103 S414 83 457 76 S507 59 535 53"
        fill="none"
        stroke="#bbc2cd"
        strokeWidth="2"
        strokeDasharray="5 6"
      />
      <text x="22" y="188">
        0%
      </text>
      <text x="150" y="188">
        25%
      </text>
      <text x="278" y="188">
        50%
      </text>
      <text x="405" y="188">
        75%
      </text>
      <text x="514" y="188">
        100%
      </text>
    </svg>
  );
}
function RouteArt() {
  return (
    <svg viewBox="0 0 440 220">
      <path
        d="M38 196C89 163 128 181 151 143S101 101 126 72C150 43 196 64 223 78S232 142 276 143 306 85 351 69 388 79 409 35"
        fill="none"
        stroke="rgba(255,255,255,.16)"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d="M38 196C89 163 128 181 151 143S101 101 126 72C150 43 196 64 223 78S232 142 276 143 306 85 351 69 388 79 409 35"
        fill="none"
        stroke="#FCFFA7"
        strokeWidth="3"
        strokeDasharray="4 8"
        strokeLinecap="round"
      />
      <circle cx="38" cy="196" r="5" fill="#FCFFA7" />
      <circle cx="409" cy="35" r="7" fill="#FCFFA7" />
    </svg>
  );
}
function severity(v: Scenario["severity"]) {
  return v === "Critical" ? 4 : v === "High" ? 3 : v === "Medium" ? 2 : 1;
}
function ruleIcon(id: string): IconName {
  return id === "collision"
    ? "car"
    : id === "lane-invasion"
      ? "route"
      : id === "ttc"
        ? "clock"
        : id === "speed"
          ? "activity"
          : id === "traffic-light"
            ? "warning"
            : id === "route"
              ? "map"
              : "clock";
}

function downloadScenarioFile(scenario: Scenario) {
  const xml = `<?xml version="1.0"?>\n<OpenSCENARIO>\n  <FileHeader revMajor="1" revMinor="1" description="${xmlEscape(scenario.description)}" author="AutoScenarioX" />\n  <ParameterDeclarations />\n  <CatalogLocations />\n  <RoadNetwork>\n    <LogicFile filepath="${xmlEscape(scenario.map)}" />\n  </RoadNetwork>\n  <Storyboard name="${xmlEscape(scenario.name)}">\n    <Environment name="${xmlEscape(scenario.weather)}" />\n    <Entities count="${scenario.actors}" />\n    <ScenarioTags>${scenario.tags.map(xmlEscape).join(", ")}</ScenarioTags>\n  </Storyboard>\n</OpenSCENARIO>\n`;
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${scenario.id.toLowerCase()}.xosc`;
  link.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string) {
  const entities: Record<string, string> = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  };
  return value.replace(
    /[<>&"']/g,
    (character) => entities[character] ?? character,
  );
}
