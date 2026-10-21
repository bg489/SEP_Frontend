import {
  useEffect,
  useMemo,
  useRef,
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
import {
  appendAuditEvent,
  getCarlaConfig as readCarlaConfig,
  getOracleProfileState,
  getRanking,
  listRuns as loadRuns,
  saveRuns as persistRuns,
} from "./services/workflowStore";
import { downloadCsv } from "./utils/download";
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
  CarlaIntegrationConfig,
  CreateCampaignInput,
  CreateScenarioInput,
  DemoUser,
  FailureCluster,
  OracleRule,
  OverviewData,
  Scenario,
  ScenarioRun,
  ScenarioVersionRecord,
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
  const [overview, setOverview] = useState<OverviewData>(isMockMode ? mockOverview : { totalScenarios: 0, activeCampaigns: 0, passRate: 0, failureClusters: 0, weeklyRuns: [], weeklyLabels: [], recentActivity: [] });
  const [scenarios, setScenarios] = useState<Scenario[]>(isMockMode ? mockScenarios : []);
  const [campaigns, setCampaigns] = useState<Campaign[]>(isMockMode ? mockCampaigns : []);
  const [failures, setFailures] = useState<FailureCluster[]>(isMockMode ? mockFailures : []);
  const [runs, setRuns] = useState<ScenarioRun[]>(() => isMockMode ? loadRuns() : []);
  const [workers, setWorkers] = useState<WorkerNode[]>(isMockMode ? mockWorkers : []);
  const [carlaConfig, setCarlaConfig] = useState<CarlaIntegrationConfig>(() => isMockMode ? readCarlaConfig() : {
    host: "127.0.0.1", rpcPort: 2000, streamingPort: 2001, carlaVersion: "0.9.16",
    scenarioRunnerPath: "", qualityLevel: "Low", validated: false, active: false,
    connectionStatus: "Not tested", updatedAt: "Not configured",
  });
  const [oracleProfile, setOracleProfile] = useState(() => isMockMode ? getOracleProfileState() : { version: 1, active: false, validated: false, updatedAt: "Not configured" });
  const [rules, setRules] = useState<OracleRule[]>(isMockMode ? mockOracleRules : []);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"scenario" | "campaign" | null>(null);
  const [toast, setToast] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null,
  );
  const [scenarioVersions, setScenarioVersions] = useState<ScenarioVersionRecord[]>([]);
  const [editorScenarioId, setEditorScenarioId] = useState<
    string | undefined
  >();
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    string | undefined
  >();
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [ready, setReady] = useState(false);
  const cancelledRunIds = useRef(new Set<string>());
  const role = user?.role ?? "Test Engineer";
  useEffect(() => {
    dispatch(bootstrapAuthRequested());
  }, [dispatch]);

  useEffect(() => {
    if (isMockMode) return;
    let active = true;
    void api.getOracleProfileState().then((profile) => {
      if (active) setOracleProfile(profile);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

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
      api.listRuns(),
      api.getCarlaIntegration(),
    ])
      .then(([o, s, c, f, w, r, runResult, carlaResult]) => {
        if (!mounted) return;
        if (o.status === "fulfilled") setOverview(o.value);
        else if (!isMockMode) setOverview({ totalScenarios: 0, activeCampaigns: 0, passRate: 0, failureClusters: 0, weeklyRuns: [], weeklyLabels: [], recentActivity: [] });
        if (s.status === "fulfilled") setScenarios(s.value);
        else if (!isMockMode) setScenarios([]);
        if (c.status === "fulfilled") setCampaigns(c.value);
        else if (!isMockMode) setCampaigns([]);
        if (f.status === "fulfilled") setFailures(f.value);
        else if (!isMockMode) setFailures([]);
        if (w.status === "fulfilled") setWorkers(w.value);
        else if (!isMockMode) setWorkers([]);
        if (r.status === "fulfilled") setRules(r.value);
        else if (!isMockMode) setRules([]);
        if (runResult.status === "fulfilled") setRuns(runResult.value);
        else if (!isMockMode) setRuns([]);
        if (carlaResult.status === "fulfilled") setCarlaConfig(carlaResult.value);
        if (
          !isMockMode &&
          [o, s, c, f, w, r, runResult, carlaResult].some((result) => result.status === "rejected")
        )
          setToast(
            "Some backend data could not be loaded. Check the API connection and permissions.",
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
    if (!runs.length) return;
    const terminalStates = new Set(["Passed", "Failed", "Cancelled", "Timed Out"]);
    const updates: Campaign[] = [];
    const nextCampaigns = campaigns.map((campaign) => {
      const campaignRuns = runs.filter((run) => run.campaignId === campaign.id);
      if (!campaignRuns.length) return campaign;
      const completed = campaignRuns.filter((run) => terminalStates.has(run.state));
      const progress = Math.round(campaignRuns.reduce((sum, run) => sum + run.progress, 0) / campaignRuns.length);
      let status: Campaign["status"] = campaignRuns.every((run) => run.state === "Queued")
        ? "Queued"
        : "Running";
      if (completed.length === campaignRuns.length) {
        status = completed.every((run) => run.state === "Cancelled")
          ? "Cancelled"
          : completed.some((run) => run.state === "Failed" || run.state === "Timed Out")
            ? "Failed"
            : "Completed";
      }
      const verdictRuns = campaignRuns.filter((run) => run.verdict === "PASS" || run.verdict === "FAIL" || run.verdict === "TIMEOUT");
      const updated = {
        ...campaign,
        status,
        progress,
        passRate: verdictRuns.length ? (verdictRuns.filter((run) => run.verdict === "PASS").length / verdictRuns.length) * 100 : 0,
        failedRuns: verdictRuns.filter((run) => run.verdict === "FAIL" || run.verdict === "TIMEOUT").length,
      };
      if (updated.status !== campaign.status || updated.progress !== campaign.progress || updated.passRate !== campaign.passRate || updated.failedRuns !== campaign.failedRuns) updates.push(updated);
      return updated;
    });
    if (!updates.length) return;
    setCampaigns(nextCampaigns);
    updates.forEach((campaign) => {
      void api.updateCampaign(campaign.id, campaign).catch((error: unknown) => {
        if (!isMockMode) notify(error instanceof Error ? error.message : "Could not persist campaign progress.");
      });
    });
    setOverview((current) => ({
      ...current,
      activeCampaigns: nextCampaigns.filter((campaign) => campaign.status === "Running" || campaign.status === "Queued").length,
      passRate: Math.round(nextCampaigns.reduce((sum, campaign) => sum + campaign.passRate, 0) / Math.max(1, nextCampaigns.length) * 10) / 10,
    }));
  }, [runs]);

  useEffect(() => {
    if (!ready || isMockMode) return;
    let mounted = true;
    let inFlight = false;
    const refreshExecution = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [runResult, campaignResult, overviewResult] = await Promise.allSettled([
          api.listRuns(),
          api.listCampaigns(),
          api.getOverview(),
        ]);
        if (!mounted) return;
        if (runResult.status === "fulfilled") setRuns(runResult.value);
        if (campaignResult.status === "fulfilled") setCampaigns(campaignResult.value);
        if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => void refreshExecution(), 4000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [ready]);

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
  const recordAuditEvent = (event: Parameters<typeof appendAuditEvent>[0]) => {
    if (isMockMode) appendAuditEvent(event);
  };
  const refreshWorkspace = async () => {
    const results = await Promise.allSettled([
      api.getOverview(),
      api.listScenarios(),
      api.listCampaigns(),
      api.listFailures(),
      api.listWorkers(),
      api.listOracleRules(),
      api.listRuns(),
      api.getCarlaIntegration(),
    ]);
    const [overviewResult, scenariosResult, campaignsResult, failuresResult, workersResult, rulesResult, runsResult, carlaResult] = results;
    if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
    if (scenariosResult.status === "fulfilled") setScenarios(scenariosResult.value);
    if (campaignsResult.status === "fulfilled") setCampaigns(campaignsResult.value);
    if (failuresResult.status === "fulfilled") setFailures(failuresResult.value);
    if (workersResult.status === "fulfilled") setWorkers(workersResult.value);
    if (rulesResult.status === "fulfilled") setRules(rulesResult.value);
    if (runsResult.status === "fulfilled") setRuns(runsResult.value);
    if (carlaResult.status === "fulfilled") setCarlaConfig(carlaResult.value);
    if (isMockMode) setOracleProfile(getOracleProfileState());
    else void api.getOracleProfileState().then(setOracleProfile).catch(() => undefined);
    notify(results.some((result) => result.status === "rejected")
      ? "Some workspace sources could not be refreshed."
      : "Workspace data refreshed from its current data source.");
  };
  const openScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setScenarioVersions([]);
    void api.listScenarioVersions(scenario.id).then(setScenarioVersions).catch(() => setScenarioVersions([]));
  };
  const cloneSelectedScenario = async (scenario: Scenario) => {
    try {
      const cloned = await api.cloneScenario(scenario.id);
      setScenarios((items) => [cloned, ...items]);
      setOverview((value) => ({ ...value, totalScenarios: value.totalScenarios + 1 }));
      openScenario(cloned);
      notify(`${scenario.id} cloned to ${cloned.id}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not clone scenario.");
    }
  };
  const updateRunRecords = (update: (current: ScenarioRun[]) => ScenarioRun[]) => {
    setRuns((current) => {
      const next = update(current);
      if (isMockMode) persistRuns(next);
      return next;
    });
  };
  const startCampaign = (campaignId: string, requestedScenarioIds?: string[], retryOf?: string, overrideCampaign?: Campaign) => {
    const campaign = overrideCampaign ?? campaigns.find((item) => item.id === campaignId);
    if (!campaign) return notify("Campaign not found.");
    const targetScenarioIds = requestedScenarioIds ?? campaign.scenarioIds;
    const campaignScenarios = targetScenarioIds
      .map((id) => scenarios.find((scenario) => scenario.id === id))
      .filter((scenario): scenario is Scenario => Boolean(scenario));
    const inactive = campaignScenarios.filter((scenario) => scenario.status !== "Active" && scenario.status !== "Approved");
    if (!campaignScenarios.length || inactive.length) {
      return notify(inactive.length
        ? `Execution blocked: ${inactive.map((scenario) => scenario.id).join(", ")} must be Active first.`
        : "Execution blocked: campaign has no scenarios.");
    }
    const availableWorkers = workers.filter((worker) => worker.status !== "Offline" && worker.activeRuns < worker.capacity);
    if (!availableWorkers.length) return notify("Execution blocked: no healthy worker has available capacity.");
    const workerSlots = availableWorkers.flatMap((worker) =>
      Array.from({ length: worker.capacity - worker.activeRuns }, () => worker.id),
    );
    const ranking = isMockMode ? getRanking<{ order: string[] }>(campaignId) : undefined;
    const rankedIds = ranking?.order ?? [];
    const orderedScenarios = [...campaignScenarios].sort((a, b) => {
      const ai = rankedIds.indexOf(a.id);
      const bi = rankedIds.indexOf(b.id);
      if (ai < 0 && bi < 0) return campaign.scenarioIds.indexOf(a.id) - campaign.scenarioIds.indexOf(b.id);
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    });
    if (!isMockMode) {
      void api.getCampaignRanking(campaignId).catch(() => null).then((savedRanking) => {
        const savedOrder = Array.isArray(savedRanking?.order) ? savedRanking.order as string[] : [];
        const effectiveOrder = savedOrder.length
          ? [...orderedScenarios].sort((left, right) => {
              const leftRank = savedOrder.indexOf(left.id);
              const rightRank = savedOrder.indexOf(right.id);
              return (leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank) - (rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank);
            })
          : orderedScenarios;
        return api.queueCampaignRuns(campaignId, effectiveOrder.map((scenario) => scenario.id), retryOf);
      }).then((queuedRuns) => {
        setRuns((current) => [...current.filter((item) => !queuedRuns.some((queued) => queued.id === item.id)), ...queuedRuns]);
        setCampaigns((current) => current.map((item) => item.id === campaignId ? { ...item, status: "Queued", progress: 0 } : item));
        setSelectedCampaignId(campaignId);
        recordAuditEvent({ actor: user?.name ?? "Current user", action: "Queue campaign execution", target: campaignId, result: "Success" });
        notify(`${campaign.name} queued ${queuedRuns.length} run(s) in PostgreSQL. The active .NET worker will execute them with CARLA at Low quality.`);
      }).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not queue campaign runs."));
      return;
    }
    const startedAt = new Date().toLocaleString();
    const createdAt = Date.now();
    const executionItems = orderedScenarios.flatMap((scenario) =>
      Array.from({ length: Math.min(100, Math.max(1, campaign.repetitions ?? 1)) }, (_, repetition) => ({ scenario, repetition: repetition + 1 })),
    );
    const newRuns: ScenarioRun[] = executionItems.map(({ scenario, repetition }, index) => ({
      id: `RUN-${createdAt}-${String(index + 1).padStart(2, "0")}`,
      campaignId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      repetition,
      state: "Queued",
      progress: 0,
      startedAt,
      workerId: workerSlots[index % workerSlots.length],
      retryOf,
      sutVersion: campaign.sutVersion ?? "1.0.0",
      agent: campaign.agent ?? "Behavior Agent",
      randomSeed: (campaign.randomSeed ?? 42) + repetition - 1,
      oracleProfile: campaign.oracleProfile ?? "Default safety profile",
      artifacts: ["telemetry.json", "events.json", "scenario-run.log"],
      evidence: [],
    }));
    persistRuns([...runs, ...newRuns]);
    setRuns((current) => [...current, ...newRuns]);
    setCampaigns((current) => current.map((item) => item.id === campaignId
      ? { ...item, status: "Running", progress: 0, failedRuns: 0, passRate: 0 }
      : item));
    void api.updateCampaign(campaignId, { status: "Running", progress: 0, failedRuns: 0, passRate: 0 }).catch((error: unknown) => {
      if (!isMockMode) notify(error instanceof Error ? error.message : "Could not start the campaign.");
    });
    recordAuditEvent({ actor: user?.name ?? "Current user", action: isMockMode ? "Start campaign execution (mock)" : "Queue campaign execution", target: campaignId, result: "Success" });
    notify(`${campaign.name} queued ${newRuns.length} scenario runs in the local mock simulator. No CARLA process was started.`);

    newRuns.forEach((run, index) => {
      const wave = Math.floor(index / workerSlots.length);
      const waveRuns = newRuns.slice(wave * workerSlots.length, (wave + 1) * workerSlots.length);
      const waveOffset = wave * 2200;
      if (index % workerSlots.length === 0) {
        window.setTimeout(() => {
          const scheduledRuns = waveRuns.filter((item) => !cancelledRunIds.current.has(item.id));
          if (!scheduledRuns.length) return;
          const waveCounts = new Map<string, number>();
          scheduledRuns.forEach((item) => {
            if (item.workerId) waveCounts.set(item.workerId, (waveCounts.get(item.workerId) ?? 0) + 1);
          });
          setWorkers((current) => current.map((worker) => {
            const activeRuns = Math.min(worker.capacity, worker.activeRuns + (waveCounts.get(worker.id) ?? 0));
            return { ...worker, activeRuns, status: activeRuns ? "Busy" : worker.status };
          }));
          updateRunRecords((items) => items.map((item) => scheduledRuns.some((scheduled) => scheduled.id === item.id)
            ? { ...item, state: "Assigned", progress: 15 }
            : item));
        }, waveOffset + 100);
      }
      window.setTimeout(() => {
        if (!cancelledRunIds.current.has(run.id)) updateRunRecords((items) => items.map((item) => item.id === run.id ? { ...item, state: "Running", progress: 55 } : item));
      }, waveOffset + 850);
      window.setTimeout(() => {
        if (cancelledRunIds.current.has(run.id)) return;
        const scenario = executionItems[index].scenario;
        const sourceFailure = failures.find((failure) => failure.scenarioName === scenario.name);
        const evidence = evaluateOracleEvidence(sourceFailure?.evidence ?? [], rules);
        const passed = evidence.length === 0;
        const finished: ScenarioRun = {
          ...run,
          state: passed ? "Passed" : "Failed",
          verdict: passed ? "PASS" : "FAIL",
          progress: 100,
          durationSeconds: 12 + scenario.actors * 3,
          evidence,
          artifacts: ["telemetry.json", "events.json", "scenario-run.log", ...(passed ? [] : ["oracle-evidence.json"])],
        };
        updateRunRecords((items) => items.map((item) => item.id === run.id ? finished : item));
        const lastRun = new Date().toLocaleString();
        void api.listScenarios().then((storedScenarios) => {
          const latest = storedScenarios.find((item) => item.id === scenario.id) ?? scenario;
          const totalRuns = latest.runCount + 1;
          const passRate = ((latest.passRate * latest.runCount / 100 + (passed ? 1 : 0)) / totalRuns) * 100;
          setScenarios((current) => current.map((item) => item.id === scenario.id ? { ...item, runCount: totalRuns, passRate, lastRun } : item));
          return api.updateScenarioMetrics(scenario.id, { runCount: totalRuns, passRate, lastRun });
        }).catch(() => undefined);
        const workerId = run.workerId;
        if (workerId) setWorkers((current) => current.map((worker) => worker.id === workerId
          ? { ...worker, activeRuns: Math.max(0, worker.activeRuns - 1), status: worker.activeRuns <= 1 ? "Online" : "Busy", lastHeartbeat: "Just now" }
          : worker));
        if (!passed) {
          const failure: FailureCluster = {
            id: sourceFailure?.id ?? `FCL-${run.id}`,
            label: sourceFailure?.label ?? evidence[0]?.rule ?? "Oracle violation",
            rootCause: sourceFailure?.rootCause ?? `The ${evidence[0]?.rule ?? "oracle"} rule was violated during this execution.`,
            reviewStatus: "Needs review",
            similarity: sourceFailure?.similarity ?? 1,
            affectedRuns: 1,
            lastDetected: lastRun,
            map: scenario.map,
            scenarioName: scenario.name,
            confidence: sourceFailure?.confidence ?? 85,
            evidence,
            sourceRunId: run.id,
          };
          void api.addFailureCluster(failure).then((saved) => {
            return api.listFailures().then((latestFailures) => {
              setFailures(latestFailures);
              setOverview((current) => ({ ...current, failureClusters: latestFailures.length }));
              return saved;
            });
          }).catch((error: unknown) => {
            if (!isMockMode) notify(error instanceof Error ? error.message : "Could not save failure analysis.");
          });
        }
        recordAuditEvent({ actor: "AutoScenarioX System", action: `Oracle verdict ${finished.verdict}`, target: run.id, result: passed ? "Success" : "Rejected" });
      }, waveOffset + 1600);
    });
  };
  const cancelCampaign = (campaignId: string) => {
    if (!isMockMode) {
      void api.cancelCampaignRuns(campaignId).then((cancelledRuns) => {
        const cancelledIds = new Set(cancelledRuns.map((run) => run.id));
        setRuns((current) => current.map((run) => cancelledIds.has(run.id) ? { ...run, state: "Cancelled", progress: 0 } : run));
        if (cancelledRuns.length) {
          setCampaigns((current) => current.map((campaign) => campaign.id === campaignId ? { ...campaign, status: "Cancelled", progress: 0 } : campaign));
          recordAuditEvent({ actor: user?.name ?? "Current user", action: "Cancel campaign execution", target: campaignId, result: "Info" });
        }
        notify(cancelledRuns.length ? `Cancelled ${cancelledRuns.length} queued run(s).` : "There are no active runs to cancel.");
      }).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not cancel campaign runs."));
      return;
    }
    const activeRuns = runs.filter((run) => run.campaignId === campaignId && (run.state === "Queued" || run.state === "Assigned" || run.state === "Running"));
    if (!activeRuns.length) return notify("There are no active runs to cancel.");
    activeRuns.forEach((run) => cancelledRunIds.current.add(run.id));
    updateRunRecords((items) => items.map((run) => activeRuns.some((active) => active.id === run.id) ? { ...run, state: "Cancelled", progress: 0 } : run));
    const cancelledByWorker = new Map<string, number>();
    activeRuns.filter((run) => run.state === "Assigned" || run.state === "Running").forEach((run) => {
      if (run.workerId) cancelledByWorker.set(run.workerId, (cancelledByWorker.get(run.workerId) ?? 0) + 1);
    });
    setWorkers((current) => current.map((worker) => {
      const activeRuns = Math.max(0, worker.activeRuns - (cancelledByWorker.get(worker.id) ?? 0));
      return { ...worker, activeRuns, status: activeRuns ? "Busy" : "Online" };
    }));
    recordAuditEvent({ actor: user?.name ?? "Current user", action: "Cancel campaign execution", target: campaignId, result: "Info" });
    notify("Campaign cancellation requested; queued mock runs were stopped.");
  };
  const reexecuteFailure = async (failure: FailureCluster) => {
    const scenario = scenarios.find((item) => item.name === failure.scenarioName);
    if (!scenario) return notify("The source scenario for this failure is no longer available.");
    if (scenario.status !== "Active" && scenario.status !== "Approved") return notify(`${scenario.id} must be Active before re-execution.`);
    try {
      const campaign = await api.createCampaign({
        name: `Re-execution · ${scenario.name}`,
        description: `Reviewer-requested verification of ${failure.id}.`,
        scenarioIds: [scenario.id],
        strategy: "Failure re-execution",
        sutName: "AutoScenarioX SUT",
        sutVersion: "1.0.0",
        agent: "Behavior Agent",
        randomSeed: 42,
        repetitions: 1,
        timeoutSeconds: 300,
        oracleProfile: "Default safety profile",
      });
      setCampaigns((items) => [campaign, ...items]);
      setSelectedCampaignId(campaign.id);
      setPage("run-detail");
      startCampaign(campaign.id, [scenario.id], failure.sourceRunId, campaign);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not create a verification run.");
    }
  };
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
      sutName: String(form.get("sutName") ?? "AutoScenarioX SUT").trim(),
      sutVersion: String(form.get("sutVersion") ?? "1.0.0").trim(),
      agent: String(form.get("agent") ?? "Behavior Agent") as CreateCampaignInput["agent"],
      randomSeed: Number(form.get("randomSeed") ?? 42),
      repetitions: Number(form.get("repetitions") ?? 1),
      timeoutSeconds: Number(form.get("timeoutSeconds") ?? 300),
      oracleProfile: "Default safety profile",
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
    if (!next.some((rule) => rule.enabled)) {
      notify("Enable at least one oracle rule before activating the profile.");
      return;
    }
    if (next.some((rule) => !Number.isFinite(rule.threshold) || rule.threshold < 0)) {
      notify("Oracle thresholds must be finite, non-negative numbers.");
      return;
    }
    try {
      const saved = await api.saveOracleRules(next);
      const profile = {
        version: oracleProfile.version + 1,
        active: true,
        validated: true,
        updatedAt: new Date().toLocaleString(),
      };
      const savedProfile = await api.saveOracleProfileState(profile);
      setRules(saved);
      setOracleProfile(savedProfile);
      recordAuditEvent({ actor: user?.name ?? "Current user", action: `Validated and activated oracle profile v${profile.version}`, target: "Default safety profile", result: "Success" });
      notify(`Oracle profile v${profile.version} validated and activated.`);
    } catch {
      notify("Could not save oracle rules. Check the API connection.");
    }
  };
  const saveCarlaIntegration = async (next: CarlaIntegrationConfig): Promise<boolean> => {
    if (!next.host.trim() || !next.scenarioRunnerPath.trim()) {
      notify("Enter a CARLA host and installation path before saving.");
      return false;
    }
    if ([next.rpcPort, next.streamingPort].some((port) => !Number.isInteger(port) || port < 1 || port > 65535) || next.rpcPort === next.streamingPort) {
      notify("Use two different valid ports between 1 and 65535.");
      return false;
    }
    const candidate = { ...next, qualityLevel: "Low" as const, validated: true, active: false, connectionStatus: "Not tested" as const, updatedAt: new Date().toLocaleString() };
    let saved: CarlaIntegrationConfig;
    try {
      saved = await api.saveCarlaIntegration(candidate);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save CARLA settings.");
      return false;
    }
    setCarlaConfig(saved);
    recordAuditEvent({ actor: user?.name ?? "Current user", action: "Saved CARLA integration settings (Low quality)", target: `${saved.host}:${saved.rpcPort}`, result: "Success" });
    notify("CARLA settings saved. The connection has not been tested yet.");
    return true;
  };
  const testCarlaIntegration = async () => {
    if (!carlaConfig.validated) return notify("Save valid CARLA settings before testing the installation.");
    let updated: CarlaIntegrationConfig;
    try {
      updated = await api.testCarlaIntegration();
      setCarlaConfig(updated);
    } catch (error) {
      notify(error instanceof Error ? error.message : "CARLA/ScenarioRunner readiness check failed.");
      return;
    }
    recordAuditEvent({ actor: user?.name ?? "Current user", action: "Tested CARLA/ScenarioRunner readiness", target: `${updated.host}:${updated.rpcPort}`, result: updated.connectionStatus === "Failed" ? "Rejected" : "Success" });
    notify(updated.connectionStatus === "Failed" ? "CARLA/ScenarioRunner readiness check failed." : updated.connectionStatus === "Connected" ? "CARLA is responding on its RPC port." : "CARLA and ScenarioRunner are ready. CARLA will start at Low quality when a run is claimed.");
  };
  const activateCarlaIntegration = async () => {
    if (!carlaConfig.validated || !["Ready", "Connected"].includes(carlaConfig.connectionStatus)) {
      notify("Save the settings and pass the CARLA/ScenarioRunner readiness check before activation.");
      return;
    }
    const updated = { ...carlaConfig, active: true, qualityLevel: "Low" as const, updatedAt: new Date().toLocaleString() };
    try {
      const saved = await api.saveCarlaIntegration(updated);
      setCarlaConfig(saved);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not activate CARLA settings.");
      return;
    }
    recordAuditEvent({ actor: user?.name ?? "Current user", action: "Activated CARLA worker (Low quality)", target: `${updated.host}:${updated.rpcPort}`, result: "Success" });
    notify("CARLA worker is active. New campaign runs will execute with CARLA at Low quality.");
  };
  const testWorkerConnection = async (worker: WorkerNode) => {
    const reachable = worker.status !== "Offline";
    const updated = workers.map((item) => item.id === worker.id
      ? { ...item, status: reachable ? (item.activeRuns ? "Busy" as const : "Online" as const) : "Offline" as const, lastHeartbeat: reachable ? "Just now" : item.lastHeartbeat }
      : item);
    try {
      setWorkers(await api.saveWorkers(updated));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update the simulation node.");
      return;
    }
    recordAuditEvent({ actor: user?.name ?? "Current user", action: `Tested worker connection (mock): ${worker.name}`, target: `${worker.host}:${worker.port}`, result: reachable ? "Success" : "Rejected" });
    notify(reachable
      ? `Mock connection to ${worker.name} succeeded. No CARLA process was started.`
      : `Mock connection to ${worker.name} failed; the worker is offline.`);
  };
  const setWorkerAvailability = async (worker: WorkerNode, online: boolean) => {
    if (worker.activeRuns > 0) {
      notify("A worker with active runs cannot be taken offline.");
      return;
    }
    const updated = workers.map((item) => item.id === worker.id
      ? { ...item, status: online ? "Online" as const : "Offline" as const }
      : item);
    try {
      setWorkers(await api.saveWorkers(updated));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update the simulation node.");
      return;
    }
    recordAuditEvent({ actor: user?.name ?? "Current user", action: online ? "Brought simulation worker online" : "Took simulation worker offline", target: worker.id, result: "Success" });
    notify(`${worker.name} is now ${online ? "online" : "offline"} in the mock cluster.`);
  };
  const confirmFailure = async (failure: FailureCluster, changes: Partial<FailureCluster> = {}) => {
    try {
      const updated = await api.confirmFailureCluster(failure.id, changes);
      setFailures((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify(changes.label && changes.label !== failure.label ? "Failure classification corrected and confirmed." : "Root cause marked as confirmed.");
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
    ) : page === "oracles" && role === "Administrator" ? (
      <button className="btn btn-light" onClick={() => saveRules(rules)}>
        <Icon name="check" size={15} /> Save changes
      </button>
    ) : page === "failures" || page === "nodes" ? (
      <button
        className="btn btn-light"
        onClick={() => void refreshWorkspace()}
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
              onScenario={openScenario}
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
              openScenario={openScenario}
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
              failures={failures}
              notify={notify}
            />
          )}
          {page === "failures" && (
            <Failures
              failures={failures}
              runs={runs}
              notify={notify}
              onConfirm={confirmFailure}
              onReexecute={reexecuteFailure}
            />
          )}
          {page === "nodes" && (
            <Nodes
              workers={workers}
              config={carlaConfig}
              notify={notify}
              onSaveConfig={saveCarlaIntegration}
              onTestConfig={testCarlaIntegration}
              onActivateConfig={activateCarlaIntegration}
              onTestWorker={testWorkerConnection}
              onWorkerAvailability={setWorkerAvailability}
              onAddWorker={async (worker) => {
                const next = [worker, ...workers];
                try {
                  setWorkers(await api.saveWorkers(next));
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Could not register the simulation node.");
                  return;
                }
                recordAuditEvent({ actor: user?.name ?? "Current user", action: "Registered simulation worker", target: worker.id, result: "Success" });
                notify(`${worker.name} registered.`);
              }}
            />
          )}
          {page === "oracles" && <Oracles rules={rules} profile={oracleProfile} onSave={saveRules} />}
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
              runs={runs}
              workers={workers}
              onNavigate={navigate}
              onNotify={notify}
              onScenarioStatus={async (id, status, note) => {
                try {
                  const updated = await api.updateScenarioStatus(id, status, note);
                  setScenarios((items) => items.map((item) => item.id === id ? updated : item));
                  notify(status === "Active" ? `Scenario ${id} passed system validation and is ready for testing.` : `${id} status changed to ${status}.`);
                  return true;
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Could not update scenario status.");
                  return false;
                }
              }}
              onScenarioUpdate={async (id, changes) => {
                try {
                  const updated = await api.updateScenario(id, changes);
                  setScenarios((items) => items.map((item) => item.id === id ? updated : item));
                  setSelectedScenario((item) => item?.id === id ? updated : item);
                  void api.listScenarioVersions(id).then(setScenarioVersions);
                  notify(`${id} saved as immutable version ${updated.version}.`);
                  return true;
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Could not save scenario version.");
                  return false;
                }
              }}
              onImport={async (scenario, sourceContent) => {
                const saved = await api.persistImportedScenario(scenario, sourceContent);
                setScenarios((items) => [saved, ...items]);
                setOverview((value) => ({ ...value, totalScenarios: value.totalScenarios + 1 }));
                return saved;
              }}
              onFailureConfirm={confirmFailure}
              onScenarioReexecute={reexecuteFailure}
              onCampaignStart={startCampaign}
              onCampaignCancel={cancelCampaign}
              onDownloadArtifact={(runId, fileName) => {
                void api.downloadRunArtifact(runId, fileName).catch((error: unknown) =>
                  notify(error instanceof Error ? error.message : "Could not download the run artifact."),
                );
              }}
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
                {isMockMode
                  ? workers.some((w) => w.status !== "Offline") ? "Mock ready" : "Needs attention"
                  : carlaConfig.active ? "Worker active" : "Needs attention"}
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
            and become ready for testing after system validation.
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
          <div className="form-row">
            <label>
              SUT name
              <input name="sutName" required defaultValue="AutoScenarioX SUT" maxLength={120} />
            </label>
            <label>
              SUT version
              <input name="sutVersion" required defaultValue="1.0.0" maxLength={80} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Driving agent
              <select name="agent" defaultValue="Behavior Agent">
                <option>Behavior Agent</option>
                <option>Autopilot</option>
              </select>
            </label>
            <label>
              Oracle profile
              <input value="Default safety profile" readOnly />
            </label>
          </div>
          <div className="form-row">
            <label>
              Random seed
              <input name="randomSeed" type="number" min="0" max="2147483647" defaultValue="42" required />
            </label>
            <label>
              Repetitions
              <input name="repetitions" type="number" min="1" max="100" defaultValue="1" required />
            </label>
            <label>
              Timeout (seconds)
              <input name="timeoutSeconds" type="number" min="1" max="86400" defaultValue="300" required />
            </label>
          </div>
          <div className="picker-label">
            Ready for testing <span>Select at least one</span>
          </div>
          <div className="scenario-picker">
            {scenarios
              .filter((s) => s.status === "Active" || s.status === "Approved")
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
              {(scenarioVersions.length ? scenarioVersions : [{
                version: selectedScenario.version,
                savedAt: "Current version",
                note: "Scenario definition",
                hash: "",
                status: selectedScenario.status,
              }]).map((version, index) => (
                <div className="version-entry" key={version.version}>
                  <i />
                  <span>
                    <b>{version.version} {index === 0 ? "· Current" : ""}</b>
                    <small>{version.note} · {version.savedAt} · {version.hash ? `SHA ${version.hash}` : version.status}</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="drawer-actions">
              {role === "Scenario Engineer" && (
                <button className="btn btn-light" onClick={() => void cloneSelectedScenario(selectedScenario)}>
                  <Icon name="plus" size={15} /> Clone scenario
                </button>
              )}
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
      "Configure a scenario and validate it automatically before testing.",
    import: "Validate and bring OpenSCENARIO files into your reusable library.",
    compare: "Compare scenario context, risk, coverage and execution results.",
    clusters: "Explore scenarios grouped by road context and shared tags.",
    execution: "Monitor campaigns waiting for simulation capacity.",
    "run-detail": "Inspect scenario-level outcomes and execution evidence.",
    review: "Review failure evidence and confirm explainable root causes.",
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
            {["All statuses", "Active", "Draft", "Archived"].map(
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
          Ready for testing <i className="orange-dot" />
          Draft{" "}
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
            Validated scenarios are versioned and traceable to each campaign,
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
            <b>System validation keeps runs reproducible</b>
            <small>
              The system validates scenario configuration before it is ready
              for execution. Running campaigns cannot be modified.
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
  failures,
  notify,
}: {
  scenarios: Scenario[];
  campaigns: Campaign[];
  failures: FailureCluster[];
  notify: (s: string) => void;
}) {
  const [strategy, setStrategy] = useState("Proposed · failure history");
  const [ranked, setRanked] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [order, setOrder] = useState<Scenario[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState({ risk: 50, history: 35, cost: 15 });
  const [metrics, setMetrics] = useState({ apfd: "—", apfdc: "—", early: "—", duration: "—", baselineApfd: "Unavailable", baselineApfdc: "Unavailable" });
  const [detectionPositions, setDetectionPositions] = useState<number[]>([]);
  const [baselineDetectionPositions, setBaselineDetectionPositions] = useState<number[]>([]);
  const [faultCount, setFaultCount] = useState(0);
  const campaign = campaigns.find((item) => item.id === campaignId)
    ?? campaigns.find((item) => item.status === "Running")
    ?? campaigns[0];
  const candidateScenarios = campaign?.scenarioIds.length
    ? campaign.scenarioIds.map((id) => scenarios.find((scenario) => scenario.id === id)).filter((item): item is Scenario => Boolean(item))
    : scenarios.filter((scenario) => scenario.status === "Active" || scenario.status === "Approved");
  const cost = (scenario: Scenario) => 4 + scenario.actors * 0.48;
  const stableHash = (value: string) => Array.from(value).reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
  const run = () => {
    if (candidateScenarios.length === 0) {
      notify("Select a campaign with scenarios before requesting prioritization.");
      return;
    }
    const faultSignal = (scenario: Scenario) => Math.min(1, ((100 - scenario.passRate) / 100) * Math.log2(scenario.runCount + 1) / 5);
    const maxCost = Math.max(...candidateScenarios.map(cost), 1);
    const totalWeight = Math.max(1, weights.risk + weights.history + weights.cost);
    const score = (scenario: Scenario) => Math.round(100 * (
      (scenario.priorityScore / 100) * weights.risk / totalWeight +
      faultSignal(scenario) * weights.history / totalWeight +
      (1 - cost(scenario) / maxCost) * weights.cost / totalWeight
    ));
    const nextOrder = [...candidateScenarios].sort((a, b) => {
      if (strategy === "Severity-first") return severity(b.severity) - severity(a.severity) || score(b) - score(a) || a.id.localeCompare(b.id);
      if (strategy === "Risk-first") return b.priorityScore - a.priorityScore || a.id.localeCompare(b.id);
      if (strategy === "History-based") return faultSignal(b) - faultSignal(a) || score(b) - score(a) || a.id.localeCompare(b.id);
      if (strategy === "Shortest-first") return cost(a) - cost(b) || a.id.localeCompare(b.id);
      if (strategy === "Random baseline") return stableHash(`${campaign?.id ?? "baseline"}:${a.id}`) - stableHash(`${campaign?.id ?? "baseline"}:${b.id}`);
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const knownFaults = failures.filter((failure) => nextOrder.some((scenario) => scenario.name === failure.scenarioName));
    const positions = knownFaults.map((failure) => nextOrder.findIndex((scenario) => scenario.name === failure.scenarioName) + 1).filter((position) => position > 0);
    setDetectionPositions(positions);
    setFaultCount(knownFaults.length);
    const totalCost = nextOrder.reduce((sum, scenario) => sum + cost(scenario), 0);
    const prefixCosts = nextOrder.map((scenario, index) => nextOrder.slice(0, index).reduce((sum, item) => sum + cost(item), 0) + cost(scenario) / 2);
    const detectedAt = knownFaults.map((failure) => {
      const index = nextOrder.findIndex((scenario) => scenario.name === failure.scenarioName);
      return index < 0 ? undefined : prefixCosts[index] / totalCost;
    }).filter((value): value is number => value !== undefined);
    const apfd = positions.length && nextOrder.length
      ? 1 - positions.reduce((sum, position) => sum + position, 0) / (nextOrder.length * positions.length) + 1 / (2 * nextOrder.length)
      : undefined;
    const baselineOrder = [...candidateScenarios].sort((a, b) => stableHash(`${campaign?.id ?? "baseline"}:${a.id}`) - stableHash(`${campaign?.id ?? "baseline"}:${b.id}`));
    const baselinePositions = knownFaults.map((failure) => baselineOrder.findIndex((scenario) => scenario.name === failure.scenarioName) + 1).filter((position) => position > 0);
    setBaselineDetectionPositions(baselinePositions);
    const baselineApfd = baselinePositions.length && baselineOrder.length
      ? 1 - baselinePositions.reduce((sum, position) => sum + position, 0) / (baselineOrder.length * baselinePositions.length) + 1 / (2 * baselineOrder.length)
      : undefined;
    const baselineTotalCost = baselineOrder.reduce((sum, scenario) => sum + cost(scenario), 0);
    const baselinePrefixCosts = baselineOrder.map((scenario, index) => baselineOrder.slice(0, index).reduce((sum, item) => sum + cost(item), 0) + cost(scenario) / 2);
    const baselineDetectedAt = knownFaults.map((failure) => {
      const index = baselineOrder.findIndex((scenario) => scenario.name === failure.scenarioName);
      return index < 0 ? undefined : baselinePrefixCosts[index] / baselineTotalCost;
    }).filter((value): value is number => value !== undefined);
    const baselineApfdc = baselineDetectedAt.length
      ? 1 - baselineDetectedAt.reduce((sum, value) => sum + value, 0) / baselineDetectedAt.length + 1 / (2 * baselineOrder.length)
      : undefined;
    const apfdc = detectedAt.length
      ? 1 - detectedAt.reduce((sum, value) => sum + value, 0) / detectedAt.length + 1 / (2 * nextOrder.length)
      : undefined;
    let cumulative = 0;
    const earlyFaults = knownFaults.filter((failure) => {
      const index = nextOrder.findIndex((scenario) => scenario.name === failure.scenarioName);
      cumulative = nextOrder.slice(0, index + 1).reduce((sum, item) => sum + cost(item), 0);
      return cumulative / totalCost <= 0.4;
    }).length;
    setScores(Object.fromEntries(nextOrder.map((scenario) => [scenario.id, score(scenario)])));
    setOrder(nextOrder);
    const durationMinutes = Math.round(totalCost);
    const duration = durationMinutes >= 60 ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : `${durationMinutes}m`;
    const result = {
      apfd: apfd === undefined ? "Unavailable" : apfd.toFixed(2),
      apfdc: apfdc === undefined ? "Unavailable" : apfdc.toFixed(2),
      early: knownFaults.length ? `${earlyFaults} / ${knownFaults.length}` : "No linked faults",
      duration,
      baselineApfd: baselineApfd === undefined ? "Unavailable" : baselineApfd.toFixed(2),
      baselineApfdc: baselineApfdc === undefined ? "Unavailable" : baselineApfdc.toFixed(2),
    };
    setMetrics(result);
    const savedRanking = { strategy, weights, order: nextOrder.map((scenario) => scenario.id), ...result, calculatedAt: new Date().toISOString() };
    if (campaign) {
      void api.saveCampaignRanking(campaign.id, savedRanking).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not save the ranking to the backend."));
    }
    setRanked(true);
    notify(`Scenario ranking generated for ${campaign?.name ?? "the active scenario set"} with ${strategy.toLowerCase()}.`);
  };
  const exportEvaluation = () => {
    if (!ranked || !campaign) return;
    const knownFaults = failures.filter((failure) => order.some((scenario) => scenario.name === failure.scenarioName));
    const baselineOrder = [...candidateScenarios].sort((left, right) => stableHash(`${campaign.id}:${left.id}`) - stableHash(`${campaign.id}:${right.id}`));
    const rows: (string | number)[][] = [
      ["AutoScenarioX prioritization evaluation"],
      ["Campaign", campaign.name],
      ["Campaign ID", campaign.id],
      ["Calculated at", new Date().toLocaleString()],
      ["Proposed strategy", strategy],
      ["Risk / history / cost weights", `${weights.risk}% / ${weights.history}% / ${weights.cost}%`],
      ["Proposed APFD", metrics.apfd],
      ["Seeded random baseline APFD", metrics.baselineApfd],
      ["Proposed APFDc", metrics.apfdc],
      ["Seeded random baseline APFDc", metrics.baselineApfdc],
      ["Known failure clusters", knownFaults.length],
      [],
      ["Proposed rank", "Scenario ID", "Scenario", "Priority score", "Estimated cost (min)", "Linked failure clusters"],
      ...order.map((scenario, index) => [
        index + 1,
        scenario.id,
        scenario.name,
        scores[scenario.id] ?? scenario.priorityScore,
        cost(scenario).toFixed(2),
        knownFaults.filter((failure) => failure.scenarioName === scenario.name).map((failure) => failure.id).join(", ") || "—",
      ]),
      [],
      ["Failure cluster", "Proposed detection rank", "Baseline detection rank"],
      ...knownFaults.map((failure) => [
        failure.id,
        order.findIndex((scenario) => scenario.name === failure.scenarioName) + 1,
        baselineOrder.findIndex((scenario) => scenario.name === failure.scenarioName) + 1,
      ]),
    ];
    downloadCsv(`${campaign.id}-prioritization-evaluation.csv`, rows);
  };
  return (
    <div className="content-stack">
      <div className="priority-banner">
        <div>
          <small className="section-kicker">CAMPAIGN TO OPTIMIZE</small>
          <label className="field-inline">
            Campaign
            <select value={campaign?.id ?? ""} onChange={(event) => { setCampaignId(event.target.value); setRanked(false); }}>
              {campaigns.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.id}</option>)}
            </select>
          </label>
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
          <div className="actions">
            <button className="btn btn-light" disabled={!ranked} onClick={exportEvaluation}>
              <Icon name="download" size={14} /> Export evaluation
            </button>
            <button className="btn btn-primary" onClick={run}>
              <Icon name="spark" size={15} />
              {ranked ? "Re-run" : "Run prioritization"}
            </button>
          </div>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="APFD score"
          value={ranked ? metrics.apfd : "—"}
          delta={ranked && metrics.apfd !== "Unavailable" && metrics.baselineApfd !== "Unavailable" ? `${Number(metrics.apfd) >= Number(metrics.baselineApfd) ? "+" : ""}${(Number(metrics.apfd) - Number(metrics.baselineApfd)).toFixed(2)} vs baseline` : "Not calculated"}
          text={`proposed vs seeded baseline · ${faultCount} known faults`}
          icon="activity"
          color="purple"
        />
        <Metric
          label="APFDc score"
          value={ranked ? metrics.apfdc : "—"}
          delta={ranked && metrics.apfdc !== "Unavailable" && metrics.baselineApfdc !== "Unavailable" ? `${Number(metrics.apfdc) >= Number(metrics.baselineApfdc) ? "+" : ""}${(Number(metrics.apfdc) - Number(metrics.baselineApfdc)).toFixed(2)} vs baseline` : ranked ? "Unavailable" : "Not calculated"}
          text={ranked ? `seeded random baseline ${metrics.baselineApfdc}` : "weighted by estimated run cost"}
          icon="clock"
          color="blue"
        />
        <Metric
          label="Faults found early"
          value={ranked ? metrics.early : "—"}
          delta={ranked && faultCount ? `${Math.round((Number(metrics.early.split(" /")[0]) / faultCount) * 100)}%` : "—"}
          text="within first 40% of estimated cost"
          icon="failures"
          color="orange"
        />
        <Metric
          label="Estimated suite time"
          value={ranked ? metrics.duration : "—"}
          delta={ranked ? `${candidateScenarios.length} scenarios` : "—"}
          text="based on actor count estimate"
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
              ["Risk-first", "Orders by scenario risk score.", "warning"],
              ["History-based", "Uses prior pass rate and run history.", "activity"],
              ["Shortest-first", "Reduces estimated execution time.", "clock"],
              [
                "Random baseline",
                "Uses a reproducible seeded baseline order.",
                "refresh",
              ],
            ].map(([name, description, icon]) => (
              <button
                className={strategy === name ? "picked" : ""}
                key={name}
                onClick={() => { setStrategy(name); setRanked(false); }}
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
          <div className="priority-weights">
            {(["risk", "history", "cost"] as const).map((key) => (
              <label key={key}>
                <span>{key === "risk" ? "Risk weight" : key === "history" ? "Failure-history weight" : "Cost weight"}<b>{weights[key]}%</b></span>
                <input type="range" min="0" max="100" value={weights[key]} onChange={(event) => { setWeights((current) => ({ ...current, [key]: Number(event.target.value) })); setRanked(false); }} />
              </label>
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
          <DetectionChart positions={detectionPositions} baselinePositions={baselineDetectionPositions} scenarioCount={order.length || candidateScenarios.length} faultCount={faultCount} />
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
                ? `${strategy} ranking for ${campaign?.name ?? "selected scenarios"}; ${faultCount ? `${faultCount} linked faults included` : "no linked failure clusters"}.`
                : "Run prioritization to apply the selected strategy."}
            </p>
          </div>
          <button
            className="btn btn-light"
            disabled={!ranked || order.length === 0}
            onClick={() => downloadCsv("scenario-ranking.csv", [["Rank", "Scenario ID", "Scenario", "Strategy", "Priority score"], ...order.map((scenario, index) => [index + 1, scenario.id, scenario.name, strategy, scores[scenario.id] ?? scenario.priorityScore])])}
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
                      {Math.round((100 - s.passRate) / 4)} signals
                    </span>
                  </td>
                  <td>~{(4 + s.actors * 0.48).toFixed(1)} min</td>
                  <td>
                    <Priority score={scores[s.id] ?? s.priorityScore} />
                  </td>
                  <td>
                    {s.priorityScore > 90
                      ? "High risk · prioritize early"
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
            onClick={() => notify(ranked ? `APFD ${metrics.apfd}; estimated APFDc ${metrics.apfdc}; ${faultCount} linked failure clusters used for ${campaign?.name ?? "this ranking"}.` : "Run prioritization to calculate APFD/APFDc from the selected campaign's linked failures.")}
          >
            Evaluation details <Icon name="arrow-right" size={13} />
          </button>
        </div>
      </section>
    </div>
  );
}

function failureAgeDays(lastDetected: string): number | undefined {
  const now = new Date();
  const relative = lastDetected.match(/^(\d+)\s*(min|minute|minutes|h|hr|hour|hours|d|day|days)\s+ago$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const days = unit.startsWith("d") ? amount : unit.startsWith("h") ? amount / 24 : amount / 1440;
    return days;
  }
  if (/^today$/i.test(lastDetected)) return 0;
  if (/^yesterday$/i.test(lastDetected)) return 1;
  const numericDate = lastDetected.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const year = Number(numericDate[3]);
    const candidates = [new Date(year, first - 1, second), new Date(year, second - 1, first)]
      .filter((date) => !Number.isNaN(date.getTime()) && date.getFullYear() === year)
      .map((date) => (now.getTime() - date.getTime()) / 86400000);
    const pastCandidates = candidates.filter((days) => days >= -1);
    if (pastCandidates.length) return Math.max(0, Math.min(...pastCandidates));
  }
  const parsed = Date.parse(lastDetected);
  return Number.isNaN(parsed) ? undefined : Math.max(0, (now.getTime() - parsed) / 86400000);
}

function Failures({
  failures,
  runs,
  notify,
  onConfirm,
  onReexecute,
}: {
  failures: FailureCluster[];
  runs: ScenarioRun[];
  notify: (s: string) => void;
  onConfirm: (failure: FailureCluster, changes?: Partial<FailureCluster>) => void;
  onReexecute: (failure: FailureCluster) => void;
}) {
  const [open, setOpen] = useState<FailureCluster | null>(null);
  const [reviewFilter, setReviewFilter] = useState("All statuses");
  const [timeRange, setTimeRange] = useState("This week");
  const [draftRootCause, setDraftRootCause] = useState("");
  const visibleFailures = failures.filter(
    (failure) =>
      reviewFilter === "All statuses" || failure.reviewStatus === reviewFilter,
  );
  const periodDays = timeRange === "This week" ? 7 : 30;
  const periodFailures = failures.filter((failure) => {
    const ageDays = failureAgeDays(failure.lastDetected);
    return ageDays === undefined || ageDays <= periodDays;
  });
  const similarFailures = open ? failures.filter((failure) => failure.id !== open.id && (failure.map === open.map || failure.evidence.some((item) => open.evidence.some((source) => source.rule === item.rule)))).slice(0, 3) : [];
  const typeCounts = new Map<string, number>();
  periodFailures.forEach((failure) => {
    if (!failure.evidence.length) {
      typeCounts.set("Unclassified oracle failure", (typeCounts.get("Unclassified oracle failure") ?? 0) + failure.affectedRuns);
    }
    failure.evidence.forEach((evidence) => {
      typeCounts.set(evidence.rule, (typeCounts.get(evidence.rule) ?? 0) + failure.affectedRuns);
    });
  });
  const typeColors = ["red", "orange", "purple", "blue", "green"];
  const types = [...typeCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([label, count], index) => ({ label, count, color: typeColors[index % typeColors.length] }));
  const maxTypeCount = Math.max(1, ...types.map((item) => item.count));
  const safetyCriticalCount = [...typeCounts.entries()].reduce((sum, [rule, count]) =>
    /collision|lane|traffic.light|speed/i.test(rule) ? sum + count : sum, 0);
  const behavioralCount = [...typeCounts.entries()].reduce((sum, [rule, count]) =>
    /collision|lane|traffic.light|speed/i.test(rule) ? sum : sum + count, 0);
  const topFailure = [...periodFailures].sort((left, right) => right.affectedRuns - left.affectedRuns)[0];
  const topType = types[0];
  const periodAffectedRuns = periodFailures.reduce((sum, failure) => sum + failure.affectedRuns, 0);
  const topFailureShare = topFailure ? Math.round((topFailure.affectedRuns / Math.max(1, periodAffectedRuns)) * 100) : 0;
  const failedRunCount = runs.filter((run) => run.verdict === "FAIL" || run.verdict === "TIMEOUT").length;
  const clusterRunCount = failures.reduce((sum, failure) => sum + failure.affectedRuns, 0);
  const averageConfidence = failures.length
    ? Math.round(failures.reduce((sum, failure) => sum + failure.confidence, 0) / failures.length)
    : 0;
  const generateExplanation = () => {
    if (!open?.evidence.length) {
      notify("No oracle evidence is available to generate an explanation.");
      return;
    }
    const evidenceSummary = open.evidence.map((evidence) =>
      `${evidence.rule} measured ${evidence.measured} at ${evidence.timestamp} against ${evidence.threshold}`,
    );
    setDraftRootCause(`The failure is classified as “${open.label}”. Recorded oracle evidence: ${evidenceSummary.join("; ")}. Verify this explanation against the source run before confirming.`);
  };
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
          value={String(failedRunCount || clusterRunCount)}
          delta={failedRunCount ? "Recorded run verdicts" : "Historical cluster links"}
          text={failedRunCount ? "failed or timed-out executions" : "affected-run counts across clusters"}
          icon="activity"
          color="purple"
        />
        <Metric
          label="Mean confidence"
          value={averageConfidence + "%"}
          delta="Across current clusters"
          text="explanation confidence"
          icon="spark"
          color="blue"
        />
        <Metric
          label="Confirmed clusters"
          value={String(
            failures.filter((f) => f.reviewStatus === "Confirmed").length,
          )}
          delta="Current status"
          text="reviewed root-cause classifications"
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
            }}
          />
          {types.length ? <div className="failure-types">
            {types.map(({ label, count, color }) => (
              <div key={label}>
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
                    style={{ width: `${Math.max(4, (count / maxTypeCount) * 100)}%` }}
                  />
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div> : <Empty title="No oracle evidence in this period" detail="Failure type counts appear when runs produce linked oracle evidence." />}
          <div className="chart-foot">
            Safety-critical <b>{safetyCriticalCount}</b>
            <span>
              Behavioral <b>{behavioralCount}</b>
            </span>
            <button onClick={() => {
              const failure = periodFailures[0];
              if (failure) { setOpen(failure); setDraftRootCause(failure.rootCause); }
            }}>
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
              {topFailure
                ? `${topFailure.scenarioName} accounts for ${topFailureShare}% of affected cluster runs in ${timeRange.toLowerCase()}.`
                : `No failure clusters were recorded in ${timeRange.toLowerCase()}.`}
            </b>{" "}
            {topType
              ? `${topType.label} is the most frequent linked oracle signal (${topType.count} affected-run references).`
              : "No oracle evidence is linked to these clusters yet."}
          </blockquote>
          <div className="insight-tags">
            <span>
              <Icon name="map" size={13} /> {topFailure?.map ?? "No map data"}
            </span>
            <span>
              <Icon name="cloud" size={13} /> {topType?.label ?? "No oracle signal"}
            </span>
            <span>
              <Icon name="users" size={13} /> {topFailure?.affectedRuns ?? 0} related runs
            </span>
          </div>
          <button
            className="link-button"
            onClick={() => {
              const failure = periodFailures[0];
              if (failure) { setOpen(failure); setDraftRootCause(failure.rootCause); }
            }}
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
                <tr key={f.id} onClick={() => { setOpen(f); setDraftRootCause(f.rootCause); }}>
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
            const form = new FormData(e.currentTarget);
            onConfirm(open, {
              label: String(form.get("label") ?? open.label).trim(),
              rootCause: String(form.get("rootCause") ?? open.rootCause).trim(),
              reviewerNote: String(form.get("reviewerNote") ?? "").trim(),
              reviewedBy: "Test Reviewer",
            });
            setOpen(null);
          }}
          submitLabel="Confirm root cause"
        >
          <div className="evidence-modal">
            <button className="btn btn-light" type="button" onClick={() => downloadCsv(`${open.id}-failure-report.csv`, [
              ["Failure cluster", open.id],
              ["Classification", open.label],
              ["Root cause", open.rootCause],
              ["Scenario", open.scenarioName],
              ["Map", open.map],
              ["Source run", open.sourceRunId ?? "Seeded example"],
              ["Rule", "Timestamp", "Measured", "Threshold", "Evidence"],
              ...open.evidence.map((item) => [item.rule, item.timestamp, item.measured, item.threshold, item.note]),
            ])}>
              <Icon name="download" size={14} /> Export failure report
            </button>
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
            <h3>Verify classification</h3>
            <label>
              Root-cause label
              <input name="label" defaultValue={open.label} required maxLength={160} />
            </label>
            <label>
              Verified explanation
              <textarea name="rootCause" value={draftRootCause} onChange={(event) => setDraftRootCause(event.target.value)} rows={3} required maxLength={1200} />
            </label>
            <button className="btn btn-light" type="button" disabled={!open.evidence.length} onClick={generateExplanation}>
              <Icon name="spark" size={14} /> Generate explanation from evidence
            </button>
            <label>
              Reviewer note
              <textarea name="reviewerNote" rows={2} maxLength={1000} placeholder="Why does the evidence support this classification?" />
            </label>
            {similarFailures.length > 0 && (
              <div className="similar-failures">
                <h3>Similar historical failures</h3>
                {similarFailures.map((failure) => <small key={failure.id}>{failure.id} · {failure.label} · {Math.round(failure.similarity * 100)}% similarity</small>)}
              </div>
            )}
            <button className="btn btn-light" type="button" onClick={() => { onReexecute(open); setOpen(null); }}>
              Request scenario re-execution
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Nodes({
  workers,
  config,
  notify,
  onSaveConfig,
  onTestConfig,
  onActivateConfig,
  onTestWorker,
  onWorkerAvailability,
  onAddWorker,
}: {
  workers: WorkerNode[];
  config: CarlaIntegrationConfig;
  notify: (s: string) => void;
  onSaveConfig: (config: CarlaIntegrationConfig) => boolean | Promise<boolean>;
  onTestConfig: () => void;
  onActivateConfig: () => void;
  onTestWorker: (worker: WorkerNode) => void;
  onWorkerAvailability: (worker: WorkerNode, online: boolean) => void;
  onAddWorker: (worker: WorkerNode) => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [draftConfig, setDraftConfig] = useState(config);
  useEffect(() => setDraftConfig(config), [config]);
  const configDirty = (["host", "rpcPort", "streamingPort", "carlaVersion", "scenarioRunnerPath"] as const)
    .some((key) => draftConfig[key] !== config[key]);
  const updateConfig = (changes: Partial<CarlaIntegrationConfig>) =>
    setDraftConfig((current) => ({
      ...current,
      ...changes,
      qualityLevel: "Low",
      validated: false,
      active: false,
      connectionStatus: "Not tested",
    }));
  const saveConfig = async () => {
    if (await onSaveConfig(draftConfig)) {
      setDraftConfig({ ...draftConfig, qualityLevel: "Low", validated: true, active: false, connectionStatus: "Not tested" });
    }
  };
  return (
    <div className="content-stack">
      <section className="card carla-config-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">CARLA INTEGRATION · LOW QUALITY ONLY</small>
            <h3>Connection profile</h3>
            <p>Configure the local CARLA and ScenarioRunner worker. Executions are pinned to Low quality.</p>
          </div>
          <Badge value={config.active ? "Active" : config.connectionStatus} />
        </div>
        <div className="carla-config-grid">
          <label>Host / IP<input value={draftConfig.host} onChange={(event) => updateConfig({ host: event.target.value })} placeholder="127.0.0.1" /></label>
          <label>RPC port<input type="number" min="1" max="65535" value={draftConfig.rpcPort} onChange={(event) => updateConfig({ rpcPort: Number(event.target.value) })} /></label>
          <label>Streaming port<input type="number" min="1" max="65535" value={draftConfig.streamingPort} onChange={(event) => updateConfig({ streamingPort: Number(event.target.value) })} /></label>
          <label>CARLA version<input value={draftConfig.carlaVersion} onChange={(event) => updateConfig({ carlaVersion: event.target.value })} /></label>
          <label className="carla-path-field">ScenarioRunner installation path<input value={draftConfig.scenarioRunnerPath} onChange={(event) => updateConfig({ scenarioRunnerPath: event.target.value })} placeholder="C:\\Users\\admin\\Downloads\\CARLA_0.9.16\\ScenarioRunner" /></label>
          <label>Quality level<select value="Low" disabled><option value="Low">Low</option></select></label>
        </div>
        <div className="carla-config-footer">
          <span>Saved {config.updatedAt} · {config.validated ? "Settings validated" : "Settings need validation"}</span>
          <div className="actions">
            <button className="btn btn-light" onClick={saveConfig}><Icon name="check" size={14} /> Save settings</button>
            <button className="btn btn-light" disabled={!config.validated || configDirty} onClick={onTestConfig}><Icon name="activity" size={14} /> Test installation</button>
            <button className="btn btn-primary" disabled={configDirty || !(config.connectionStatus === "Ready" || config.connectionStatus === "Connected") || config.active} onClick={onActivateConfig}><Icon name="play" size={14} /> Activate worker</button>
          </div>
        </div>
        <small className="carla-config-note">The .NET worker starts CARLA only when a run is claimed. Quality is locked to Low.</small>
      </section>
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
                <div className="node-actions">
                  <button className="text-button" onClick={() => onTestWorker(w)}>
                    Test mock connection <Icon name="arrow-right" size={12} />
                  </button>
                  <button className="text-button" disabled={w.activeRuns > 0} onClick={() => onWorkerAvailability(w, w.status === "Offline")}>
                    {w.status === "Offline" ? "Bring online" : "Take offline"}
                  </button>
                </div>
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
  profile,
  onSave,
}: {
  rules: OracleRule[];
  profile: { version: number; active: boolean; validated: boolean; updatedAt: string };
  onSave: (r: OracleRule[]) => void | Promise<void>;
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
        <Badge value={`Configuration v${profile.version}`} />
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
            <p>Version {profile.version} · {profile.active && profile.validated ? "Validated & active" : "Not active"}</p>
            <div>
              <span>
                ENABLED RULES{" "}
                <b>
                  {draft.filter((r) => r.enabled).length}/{draft.length}
                </b>
              </span>
              <span>
                LAST UPDATED <b>{profile.updatedAt}</b>
              </span>
            </div>
            <span className="oracle-history-note">Each save creates a new local profile version and audit event.</span>
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
function DetectionChart({ positions, baselinePositions, scenarioCount, faultCount }: {
  positions: number[];
  baselinePositions: number[];
  scenarioCount: number;
  faultCount: number;
}) {
  const makePath = (faultPositions: number[]) => {
    const count = Math.max(1, scenarioCount);
    let detected = 0;
    const points = Array.from({ length: count }, (_, index) => {
      detected += faultPositions.filter((position) => position === index + 1).length;
      const x = 24 + (511 * (index + 1)) / count;
      const y = 173 - 154 * (faultCount ? detected / faultCount : 0);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M24 173 L${points.join(" L")}`;
  };
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
        d={makePath(positions)}
        fill="none"
        stroke="#FF6363"
        strokeWidth="3"
      />
      <path
        d={makePath(baselinePositions)}
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
      {faultCount === 0 && <text x="190" y="94">No linked failure data</text>}
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
function evaluateOracleEvidence(evidence: FailureCluster["evidence"], rules: OracleRule[]) {
  const aliases: Record<string, string[]> = {
    collision: ["collision", "contact"],
    "lane-invasion": ["lane invasion", "lane marking"],
    ttc: ["time-to-collision", "ttc"],
    speed: ["speed"],
    "traffic-light": ["traffic-light", "red signal"],
    route: ["route", "incomplete", "stationary"],
    freezing: ["freez", "stationary", "stagnation"],
  };
  return evidence.flatMap((item) => {
    const text = `${item.rule} ${item.note}`.toLowerCase();
    const rule = rules.find((candidate) => candidate.enabled && (aliases[candidate.id] ?? [candidate.name.toLowerCase()]).some((alias) => text.includes(alias)));
    if (!rule) return [];
    const measured = Number(item.measured.match(/-?\d+(?:\.\d+)?/)?.[0] ?? NaN);
    let violated = true;
    if (rule.id === "ttc" && Number.isFinite(measured)) violated = measured <= rule.threshold;
    else if (rule.id === "lane-invasion" && Number.isFinite(measured)) violated = measured > rule.threshold;
    else if (rule.id === "speed" && Number.isFinite(measured)) violated = measured > rule.threshold;
    else if (rule.id === "freezing") {
      const seconds = Number(item.measured.match(/([\d.]+)\s*s/i)?.[1] ?? NaN);
      violated = Number.isFinite(seconds) ? seconds > rule.threshold : /stationary|stagnant|freez/i.test(text);
    } else if (rule.id === "route") {
      const percent = Number(item.measured.match(/([\d.]+)\s*%/)?.[1] ?? NaN);
      violated = Number.isFinite(percent) ? percent < rule.threshold : /incomplete|0\.0\s*m|stationary/i.test(text);
    }
    return violated ? [{ ...item, threshold: `${rule.threshold} ${rule.unit}` }] : [];
  });
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
