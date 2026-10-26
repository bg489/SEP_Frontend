import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "../localeContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { AppPage, UserRole } from "../types";
import type { TeamApiClient, TeamCatalog, TeamMap, TeamPage } from "../services/teamContracts";
import type { OracleConfig, RankResult, ReadyVersion, RunResult, TeamCampaign, TeamRun, WorkerIntegration } from "../services/teamOperations";
import { workerDefaults } from "../services/teamOperations";
import { Icon } from "./Icon";
import "./TeamOperationsWorkspace.css";

type Props = {
  client: TeamApiClient; page: AppPage; role?: UserRole;
  onNavigate?: (page: AppPage) => void;
  onChanged?: () => void | Promise<void>;
  onNotify?: (message: string) => void;
};
type Strategy = { id: string; label: string; description: string };
type CampaignForm = { id: string; name: string; description: string; strategy: string; sutType: string; sutBehavior: string; scenarioVersionIds: string[] };
const newForm = (): CampaignForm => ({ id: "", name: "", description: "", strategy: "proposed_failure_history", sutType: "behavior_agent", sutBehavior: "normal", scenarioVersionIds: [] });
const json = (value: unknown) => JSON.stringify(value);
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const safeDate = (value: string | null | undefined, locale: string) => value ? new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB") : "—";
const editable = (campaign: TeamCampaign) => campaign.runCount === 0 && ["Draft", "Queued"].includes(campaign.status);
const activeRun = (run: TeamRun) => ["Queued", "Claimed", "Running"].includes(run.status);
const workerProfileKey = "autoscenariox.team-worker.mock-profile";
const loadLocalWorkerProfile = (): WorkerIntegration => {
  let saved: Partial<WorkerIntegration> = {};
  try { saved = JSON.parse(localStorage.getItem(workerProfileKey) ?? "{}") as Partial<WorkerIntegration>; } catch { /* Local settings are optional. */ }
  return { ...workerDefaults, ...saved, qualityLevel: "Low", validated: false, active: false, workerRunning: false, workerPid: null, connectionStatus: "mock / local only", message: "" };
};
const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** All requests use the injected Redux Saga client, including binary artifacts. */
export function TeamOperationsWorkspace({ client, page, role, onNavigate, onChanged, onNotify }: Props) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const action = useAsyncAction();
  const canManage = role === "Test Engineer" || role === "Administrator";
  const [campaigns, setCampaigns] = useState<TeamCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [runs, setRuns] = useState<TeamRun[]>([]);
  const [runId, setRunId] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategy, setStrategy] = useState("proposed_failure_history");
  const [seed, setSeed] = useState(42);
  const [riskWeight, setRiskWeight] = useState(0.55);
  const [storedRank, setRank] = useState<(RankResult & { requestScope: string }) | null>(null);
  const [oracles, setOracles] = useState<OracleConfig[]>([]);
  const [worker, setWorker] = useState<WorkerIntegration>(loadLocalWorkerProfile);
  const [workerForm, setWorkerForm] = useState<WorkerIntegration>(loadLocalWorkerProfile);
  const [workerDirty, setWorkerDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(newForm);
  const [readyPage, setReadyPage] = useState<TeamPage<ReadyVersion> | null>(null);
  const [readyCache, setReadyCache] = useState<Record<string, ReadyVersion>>({});
  const [readyLoading, setReadyLoading] = useState(false);
  const [readyQuery, setReadyQuery] = useState("");
  const [readyMap, setReadyMap] = useState("");
  const [readyCategory, setReadyCategory] = useState("");
  const [readyPageNumber, setReadyPageNumber] = useState(1);
  const [maps, setMaps] = useState<TeamMap[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [rerunTarget, setRerunTarget] = useState<TeamCampaign | null>(null);
  const [rerunAccepted, setRerunAccepted] = useState(false);
  const selected = campaigns.find(item => item.id === campaignId) ?? null;
  const rankScope = json([campaignId, strategy, seed, riskWeight]);
  const rank = storedRank?.requestScope === rankScope ? storedRank : null;
  const visibleCampaigns = useMemo(() => campaigns.filter(item => `${item.code} ${item.name} ${item.status}`.toLowerCase().includes(campaignFilter.toLowerCase())), [campaigns, campaignFilter]);
  const isWorkerPage = page === "nodes";
  const isOraclePage = page === "oracles";
  const isPriorityPage = page === "priority";
  const isExecutionPage = ["execution", "run-detail", "failures", "review", "report"].includes(page);
  const manualWorkerCommand = [
    `cd ${psQuote("C:\\Users\\admin\\Desktop\\Hoc Bai\\SEP\\Project\\AutoScenarioX\\AutoScenarioX")}`,
    "$env:ASX_DEV_ROLE = 'TEST_ENGINEER'",
    `& ${psQuote(workerForm.pythonExecutable)} '.\\tools\\campaign_worker.py' --api 'http://localhost:5080' --carla-root ${psQuote(workerForm.carlaRoot)} --host ${psQuote(workerForm.host)} --port ${workerForm.rpcPort} --tm-port ${workerForm.trafficManagerPort} --poll 3 --out recordings${workerForm.recordVideo ? "" : " --no-video"}`,
  ].join("\n");
  const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  const announce = (message: string) => { setNotice(message); onNotify?.(message); };
  const changed = () => { setRevision(value => value + 1); void onChanged?.(); };
  const perform = async (key: string, task: () => Promise<void>) => {
    setError(""); setNotice("");
    try { await action.run(key, task); } catch (reason) { setError(errorText(reason)); }
  };
  const pending = (key: string) => action.isPending(key);
  const spinner = <span className="button-spinner" aria-hidden="true" />;

  useEffect(() => { setNotice(""); }, [page]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    if (isWorkerPage) { setLoading(false); return () => { alive = false; }; }
    const requests = isOraclePage ? [client.request<OracleConfig[]>("/api/v1/oracle-configs")]
      : [client.request<TeamCampaign[]>("/api/v1/campaigns"), client.request<Strategy[]>("/api/v1/prioritization/strategies")];
    void Promise.allSettled(requests).then(values => {
      if (!alive) return;
      if (isOraclePage) {
        if (values[0].status === "fulfilled") setOracles(values[0].value as OracleConfig[]);
      } else {
        if (values[0].status === "fulfilled") {
          const data = values[0].value as TeamCampaign[];
          setCampaigns(data);
          setCampaignId(current => data.some(item => item.id === current) ? current : data[0]?.id ?? "");
        }
        if (values[1].status === "fulfilled") setStrategies(values[1].value as Strategy[]);
      }
      const rejected = values.find(value => value.status === "rejected");
      if (rejected?.status === "rejected") setError(errorText(rejected.reason));
      setUpdatedAt(new Date().toISOString()); setLoading(false);
    });
    return () => { alive = false; };
  }, [client, page, revision]);

  useEffect(() => {
    if (!isExecutionPage) return;
    let alive = true;
    let busy = false;
    const timer = window.setInterval(() => {
      if (busy) return;
      busy = true;
      void client.request<TeamCampaign[]>("/api/v1/campaigns").then(data => {
        if (alive) { setCampaigns(data); setUpdatedAt(new Date().toISOString()); }
      }).catch(reason => { if (alive) setError(errorText(reason)); }).finally(() => { busy = false; });
    }, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, isExecutionPage]);

  useEffect(() => {
    if (!isExecutionPage || !campaignId) { setRuns([]); setRunId(""); setResult(null); return; }
    let alive = true;
    let busy = false;
    setRunsLoading(true); setRuns([]); setRunId(""); setResult(null);
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await client.request<TeamRun[]>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/runs`);
        if (alive) { setRuns(data); setRunId(current => data.some(item => item.id === current) ? current : data[0]?.id ?? ""); setUpdatedAt(new Date().toISOString()); }
      } catch (reason) { if (alive) setError(errorText(reason)); }
      finally { busy = false; if (alive) setRunsLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, campaignId, isExecutionPage, revision]);

  useEffect(() => {
    if (!runId || !isExecutionPage) { setResult(null); return; }
    let alive = true;
    let busy = false;
    setResultLoading(true); setResult(null);
    const load = async () => {
      if (busy) return;
      busy = true;
      try { const data = await client.request<RunResult>(`/api/v1/runs/${encodeURIComponent(runId)}/result`); if (alive) setResult(data); }
      catch (reason) { if (alive) setError(errorText(reason)); }
      finally { busy = false; if (alive) setResultLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, runId, isExecutionPage]);

  useEffect(() => {
    if (!builderOpen) return;
    let alive = true;
    setReadyLoading(true);
    const query = new URLSearchParams({ page: String(readyPageNumber), pageSize: "12", latestOnly: "true" });
    if (readyQuery) query.set("q", readyQuery);
    if (readyMap) query.set("map", readyMap);
    if (readyCategory) query.set("category", readyCategory);
    const timer = window.setTimeout(() => {
      void client.request<TeamPage<ReadyVersion>>(`/api/v1/campaigns/available-scenarios?${query}`).then(data => {
        if (!alive) return;
        setReadyPage(data); setReadyCache(current => ({ ...current, ...Object.fromEntries(data.items.map(item => [item.scenarioVersionId, item])) }));
      }).catch(reason => { if (alive) setError(errorText(reason)); }).finally(() => { if (alive) setReadyLoading(false); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [client, builderOpen, readyQuery, readyMap, readyCategory, readyPageNumber]);

  const openBuilder = (campaign?: TeamCampaign) => {
    setError(""); setNotice(""); setReadyPageNumber(1); setReadyQuery(""); setReadyMap(""); setReadyCategory("");
    setForm(campaign ? { id: campaign.id, name: campaign.name, description: campaign.description ?? "", strategy: campaign.strategy, sutType: campaign.sut.type, sutBehavior: campaign.sut.behavior, scenarioVersionIds: [...campaign.scenarioVersionIds] } : newForm());
    setBuilderOpen(true);
    void perform("references", async () => {
      const [catalog, mapList] = await Promise.all([client.request<TeamCatalog>("/api/v1/reference/catalog"), client.request<TeamMap[]>("/api/v1/reference/maps")]);
      setCategories(catalog.categories); setMaps(mapList);
    });
  };
  const saveCampaign = (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !form.scenarioVersionIds.length) return;
    void perform("save-campaign", async () => {
      const payload = { name: form.name.trim(), description: form.description, strategy: form.strategy, scenarioVersionIds: form.scenarioVersionIds, sutType: form.sutType, sutBehavior: form.sutBehavior, sutCarlaVersion: "0.9.16" };
      const saved = await client.request<TeamCampaign>(form.id ? `/api/v1/campaigns/${encodeURIComponent(form.id)}` : "/api/v1/campaigns", { method: form.id ? "PATCH" : "POST", body: json(payload) });
      setCampaignId(saved.id); setBuilderOpen(false); changed(); announce(t("Campaign saved to the backend.", "Đã lưu campaign vào backend."));
    });
  };
  const startCampaign = (campaign: TeamCampaign, rerun = false) => void perform(`start-${campaign.id}`, async () => {
    await client.request<TeamCampaign>(`/api/v1/campaigns/${encodeURIComponent(campaign.id)}/${rerun ? "rerun" : "start"}`, { method: "POST" });
    setCampaignId(campaign.id); setRerunTarget(null); setRerunAccepted(false); changed();
    announce(t("Runs queued in the database. Start the existing Python worker manually to execute them in CARLA (Low quality); see Worker setup for instructions.", "Đã xếp run vào database. Chạy worker Python hiện có thủ công để thực thi trong CARLA (chất lượng Low); xem hướng dẫn ở Cấu hình worker."));
    onNavigate?.("execution");
  });
  const chooseCampaign = (id: string) => { setCampaignId(id); setRank(null); };
  const rankCampaign = () => void perform("rank", async () => {
    if (!selected) return;
    const data = await client.request<RankResult>("/api/v1/prioritization/rank", { method: "POST", body: json({ scenarioVersionIds: selected.scenarioVersionIds, strategy, params: { seed, riskWeight, diversityWeight: Number((1 - riskWeight).toFixed(2)) } }) });
    setRank({ ...data, requestScope: json([selected.id, strategy, seed, riskWeight]) });
  });
  const applyRank = () => void perform("apply-rank", async () => {
    if (!selected || !rank) return;
    await client.request<TeamCampaign>(`/api/v1/campaigns/${encodeURIComponent(selected.id)}`, { method: "PATCH", body: json({ strategy: rank.strategy, scenarioVersionIds: rank.ordered.map(item => item.scenarioVersionId) }) });
    changed(); announce(t("Ranked execution order saved to the campaign.", "Đã lưu thứ tự thực thi vào campaign."));
  });
  const saveLocalWorker = () => void perform("worker-save", async () => {
    if (!workerForm.carlaRoot.trim() || !workerForm.pythonExecutable.trim() || !workerForm.host.trim()) throw new Error(t("Provide the CARLA folder, Python executable and host.", "Nhập thư mục CARLA, tệp Python và host."));
    if (![workerForm.rpcPort, workerForm.trafficManagerPort].every(port => Number.isInteger(port) && port > 0 && port <= 65535)) throw new Error(t("Ports must be integers between 1 and 65535.", "Cổng phải là số nguyên từ 1 đến 65535."));
    const data = { ...workerForm, qualityLevel: "Low" as const, updatedAt: new Date().toISOString(), validated: false, active: false, workerRunning: false, workerPid: null, connectionStatus: "mock / local only" };
    localStorage.setItem(workerProfileKey, json(data));
    setWorker(data); setWorkerForm(data); setWorkerDirty(false);
    announce(t("Mock profile saved in this browser only. No worker was started and no backend settings were changed.", "Đã lưu hồ sơ mock trong trình duyệt này. Chưa chạy worker và chưa thay đổi cấu hình backend."));
  });
  const workerField = <K extends keyof WorkerIntegration>(key: K, value: WorkerIntegration[K]) => { setWorkerForm(current => ({ ...current, [key]: value })); setWorkerDirty(true); };
  const moveVersion = (index: number, direction: number) => setForm(current => {
    const ids = [...current.scenarioVersionIds]; const target = index + direction;
    if (target < 0 || target >= ids.length) return current;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return { ...current, scenarioVersionIds: ids };
  });
  const versionLabel = (id: string) => {
    const item = readyCache[id];
    const existing = campaigns.find(campaign => campaign.id === form.id)?.scenarios.find(version => version.scenarioVersionId === id);
    return item ? `${item.scenarioCode} · ${item.scenarioName} · v${item.versionNumber}` : existing ? `${existing.scenarioCode} · ${existing.scenarioName} · v${existing.versionNumber}` : id;
  };

  return <div className="team-operations">
    <section className="ops-intro card">
      <div><span className="ops-eyebrow">AUTOSCENARIOX · {t("CONNECTED WORKSPACE", "KHÔNG GIAN KẾT NỐI")}</span>
        <h2>{isWorkerPage ? t("CARLA worker", "Worker CARLA") : isOraclePage ? t("Oracle configurations", "Cấu hình Oracle") : isPriorityPage ? t("Scenario prioritization", "Ưu tiên scenario") : isExecutionPage ? t("Execution & evidence", "Thực thi & bằng chứng") : t("Test campaigns", "Chiến dịch kiểm thử")}</h2>
        <p>{isWorkerPage ? t("Save a local reference profile and follow the manual worker instructions. The current backend does not expose worker management APIs.", "Lưu hồ sơ tham khảo cục bộ và làm theo hướng dẫn chạy worker thủ công. Backend hiện chưa có API quản lý worker.") : t("READY scenario versions, campaign configuration and simulation results come from the team backend.", "Phiên bản scenario READY, cấu hình campaign và kết quả mô phỏng được lấy từ backend của nhóm.")}</p>
      </div>
      <div className="ops-actions"><button className="btn btn-secondary" disabled={loading} onClick={() => { if (isWorkerPage) { const profile = loadLocalWorkerProfile(); setWorker(profile); setWorkerForm(profile); setWorkerDirty(false); setNotice(""); } else setRevision(value => value + 1); }}>{loading ? spinner : <Icon name="refresh" />}{t("Refresh", "Làm mới")}</button>
        {!isWorkerPage && !isOraclePage && canManage && <button className="btn btn-primary" onClick={() => openBuilder()}><Icon name="plus" />{t("Build campaign", "Tạo campaign")}</button>}
      </div>
    </section>
    {error && <div className="ops-message ops-error" role="alert"><Icon name="warning" /><span>{error}</span><button aria-label={t("Dismiss error", "Đóng lỗi")} onClick={() => setError("")}>×</button></div>}
    {notice && <div className="ops-message ops-success" role="status"><Icon name="circle-check" /><span>{notice}</span><button aria-label={t("Dismiss notification", "Đóng thông báo")} onClick={() => setNotice("")}>×</button></div>}
    {!canManage && <p className="ops-note">{t("Your role can inspect campaign data and results. Test Engineers and Administrators can configure and execute campaigns.", "Role của bạn có thể xem campaign và kết quả. Test Engineer và Administrator được cấu hình và chạy campaign.")}</p>}
    {loading && <div className="ops-loading" role="status">{spinner}{t("Loading backend data…", "Đang tải dữ liệu backend…")}</div>}

    {isWorkerPage ? <>
      <section className="card ops-panel">
        <div className="ops-panel-heading"><div><h3>{t("Local reference profile", "Hồ sơ tham khảo cục bộ")}</h3><p>{t("MOCK: these values are saved only in this browser. They do not configure the backend, check Python, launch CARLA or report live worker health.", "MOCK: thông tin chỉ được lưu trong trình duyệt này. Form không cấu hình backend, kiểm tra Python, mở CARLA hay báo trạng thái worker thực tế.")}</p></div><span className="ops-status estimate">{t("MOCK · BROWSER ONLY", "MOCK · TRÌNH DUYỆT")}</span></div>
        <div className="ops-form-grid">
          <label className="ops-span-2">{t("CARLA installation folder", "Thư mục cài đặt CARLA")}<input value={workerForm.carlaRoot} onChange={event => workerField("carlaRoot", event.target.value)} disabled={!canManage || action.pending} /></label>
          <label className="ops-span-2">{t("Python executable (.exe)", "Tệp thực thi Python (.exe)")}<input value={workerForm.pythonExecutable} onChange={event => workerField("pythonExecutable", event.target.value)} disabled={!canManage || action.pending} /><small>{t("Use the Python environment with the matching CARLA 0.9.16 package and worker requirements.", "Dùng môi trường Python đã cài gói CARLA 0.9.16 tương ứng và các thư viện worker.")}</small></label>
          <label>Host / IP<input value={workerForm.host} onChange={event => workerField("host", event.target.value)} disabled={!canManage || action.pending} /></label>
          <label>{t("CARLA RPC port", "Cổng CARLA RPC")}<input type="number" min={1} max={65535} value={workerForm.rpcPort} onChange={event => workerField("rpcPort", Number(event.target.value))} disabled={!canManage || action.pending} /></label>
          <label>{t("Traffic Manager port", "Cổng Traffic Manager")}<input type="number" min={1} max={65535} value={workerForm.trafficManagerPort} onChange={event => workerField("trafficManagerPort", Number(event.target.value))} disabled={!canManage || action.pending} /></label>
          <label>{t("Quality level", "Chất lượng")}<input className="ops-low" value="Low" readOnly /><small>{t("Locked to Low for every run.", "Cố định Low cho mọi lần chạy.")}</small></label>
          <label className="ops-check"><input type="checkbox" checked={workerForm.recordVideo} onChange={event => workerField("recordVideo", event.target.checked)} disabled={!canManage || action.pending} />{t("Record camera video for run evidence", "Ghi video camera làm bằng chứng")}</label>
        </div>
        <div className="ops-toolbar"><span className="ops-note">{workerDirty ? t("Unsaved local changes.", "Chưa lưu thay đổi cục bộ.") : t("Reference settings only. Worker state cannot be checked through the current API.", "Chỉ là cấu hình tham khảo. API hiện tại không kiểm tra được trạng thái worker.")}</span>
          {canManage && <div className="ops-actions">
            <button className="btn btn-secondary" disabled={action.pending} onClick={saveLocalWorker}>{pending("worker-save") ? spinner : <Icon name="check" />}{t("Save local mock profile", "Lưu hồ sơ mock cục bộ")}</button>
          </div>}
        </div>
        <dl className="ops-facts"><div><dt>{t("Storage", "Nơi lưu")}</dt><dd>{t("This browser (mock)", "Trình duyệt này (mock)")}</dd></div><div><dt>{t("Live worker state", "Trạng thái worker thực tế")}</dt><dd>{t("Unavailable in backend API", "Backend API chưa hỗ trợ")}</dd></div><div><dt>{t("Profile saved", "Hồ sơ được lưu")}</dt><dd>{safeDate(worker.updatedAt, locale)}</dd></div></dl>
        <div className="ops-callout"><b>{t("Run the existing worker manually", "Chạy worker hiện có thủ công")}</b><br />{t("First start the backend and queue a campaign using Start in the campaign list. Open PowerShell, use a Python environment with CARLA 0.9.16 and the recorder dependencies, then run the command below. Replace the Python path and API URL if needed. Stop the worker using Ctrl+C; its logs are printed in that terminal.", "Khởi động backend và bấm Chạy ở danh sách campaign để tạo hàng đợi. Mở PowerShell, dùng môi trường Python có CARLA 0.9.16 và các thư viện recorder, rồi chạy lệnh phía dưới. Thay đường dẫn Python và URL API nếu cần. Dừng worker bằng Ctrl+C; nhật ký nằm trong cửa sổ terminal đó.")}</div>
        <p className="ops-note">{t("The existing campaign_worker.py authenticates with X-Asx-Dev-Role, so this command requires the backend's existing Dev authentication mode. It cannot authenticate with a Supabase bearer session. The existing worker launches CARLA with -quality-level=Low. Browser settings do not change that worker code.", "campaign_worker.py hiện xác thực bằng X-Asx-Dev-Role, nên lệnh này cần chế độ xác thực Dev có sẵn của backend. Worker hiện chưa đăng nhập bằng bearer token Supabase. Worker sẵn có mở CARLA với -quality-level=Low. Cấu hình trình duyệt không thay đổi mã worker.")}</p>
        <pre className="ops-log">{manualWorkerCommand}</pre>
        <p className="ops-note">{t("Use campaign_worker.py directly: run_worker_town10.ps1 currently hardcodes a different repository location and Town10HD_Opt. Do not use --simulate or --fixture when collecting real CARLA evidence.", "Dùng trực tiếp campaign_worker.py: run_worker_town10.ps1 đang cố định đường dẫn repository khác và map Town10HD_Opt. Không dùng --simulate hoặc --fixture khi cần bằng chứng CARLA thực tế.")}</p>
        {onNavigate && <div className="ops-actions"><button className="btn btn-secondary" onClick={() => onNavigate("execution")}>{t("Open execution queue", "Mở hàng đợi thực thi")}<Icon name="arrow-right" /></button></div>}
      </section>
    </> : isOraclePage ? <section className="card ops-panel"><h3>{t("Versioned test oracles", "Test Oracle có phiên bản")}</h3><p className="ops-note">{t("These are the actual backend thresholds. Editing oracle configurations is not exposed by the current backend API.", "Đây là ngưỡng thực tế từ backend. API backend hiện chưa hỗ trợ chỉnh sửa cấu hình Oracle.")}</p><div className="ops-oracle-grid">{oracles.map(config => <article className="ops-oracle" key={config.id}><span className="ops-status">v{config.version}</span><h4>{config.name}</h4><p>{config.description}</p><dl><div><dt>{t("Speed tolerance", "Dung sai tốc độ")}</dt><dd>{config.speedingToleranceKmh} km/h</dd></div><div><dt>{t("Minimum speeding duration", "Thời gian vượt tốc tối thiểu")}</dt><dd>{config.speedingMinDurationS} s</dd></div><div><dt>{t("Maximum standstill", "Dừng xe tối đa")}</dt><dd>{config.freezingMaxStillS} s</dd></div><div><dt>TTC</dt><dd>{config.ttcThresholdS} s</dd></div><div><dt>{t("Goal tolerance", "Dung sai đích đến")}</dt><dd>{config.routeGoalToleranceM} m</dd></div></dl><small>{safeDate(config.createdAt, locale)}</small></article>)}</div>{!loading && !oracles.length && <div className="ops-empty">{t("No oracle configuration returned by the backend. Apply the backend database migrations.", "Backend chưa có cấu hình Oracle. Cần áp dụng migration database của backend.")}</div>}</section> : <>
      <section className="ops-stats"><article className="card"><Icon name="campaigns" /><span>{t("Campaigns", "Campaign")}</span><strong>{campaigns.length}</strong></article><article className="card"><Icon name="play" /><span>{t("Running", "Đang chạy")}</span><strong>{campaigns.filter(item => item.status === "Running").length}</strong></article><article className="card"><Icon name="clock" /><span>{t("Queued", "Trong hàng đợi")}</span><strong>{campaigns.filter(item => ["Draft", "Queued"].includes(item.status)).length}</strong></article><article className="card"><Icon name="check" /><span>{t("Completed", "Hoàn tất")}</span><strong>{campaigns.filter(item => ["Completed", "NeedsReview"].includes(item.status)).length}</strong></article></section>
      {isPriorityPage ? <section className="card ops-panel">
        <div className="ops-panel-heading"><div><h3>{t("Rank the execution suite", "Xếp thứ tự bộ kiểm thử")}</h3><p>{t("The backend ranks scenario content using heuristic features. APFD/APFDc values below are estimates, not measured failure-history results.", "Backend xếp hạng theo đặc trưng nội dung scenario. APFD/APFDc phía dưới là ước lượng, chưa phải kết quả đo từ lịch sử lỗi thực tế.")}</p></div><span className="ops-status estimate">{t("HEURISTIC ESTIMATES", "ƯỚC LƯỢNG HEURISTIC")}</span></div>
        <div className="ops-form-grid"><label>{t("Campaign", "Campaign")}<select value={campaignId} onChange={event => chooseCampaign(event.target.value)}><option value="">{t("Select campaign", "Chọn campaign")}</option>{campaigns.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label>{t("Strategy", "Chiến lược")}<select value={strategy} onChange={event => { setStrategy(event.target.value); setRank(null); }}>{strategies.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>{t("Random seed", "Seed ngẫu nhiên")}<input type="number" value={seed} onChange={event => { setSeed(Number(event.target.value)); setRank(null); }} /></label><label>{t("Risk weight (diversity = 1 − risk)", "Trọng số rủi ro (đa dạng = 1 − rủi ro)")}<input type="number" min={0} max={1} step={0.05} value={riskWeight} onChange={event => { setRiskWeight(Number(event.target.value)); setRank(null); }} /></label></div>
        <p className="ops-note">{strategies.find(item => item.id === strategy)?.description}</p><div className="ops-actions"><button className="btn btn-primary" disabled={!selected || pending("rank")} onClick={rankCampaign}>{pending("rank") ? spinner : <Icon name="priority" />}{t("Calculate ranking", "Tính thứ tự ưu tiên")}</button>{rank && canManage && <button className="btn btn-secondary" disabled={!selected || !editable(selected) || pending("apply-rank")} onClick={applyRank}>{pending("apply-rank") ? spinner : <Icon name="check" />}{t("Save order to campaign", "Lưu thứ tự vào campaign")}</button>}</div>
        {selected && !editable(selected) && <p className="ops-note">{t("The campaign already has runs. Its scenario order can no longer be changed; create a new campaign to use a different order.", "Campaign đã có run nên không được đổi thứ tự scenario; hãy tạo campaign mới nếu cần đổi thứ tự.")}</p>}
        {rank && <div className="ops-ranking"><div className="ops-metrics"><div><span>APFD ({t("estimate", "ước lượng")})</span><strong>{rank.metrics.apfdEstimate.toFixed(3)}</strong></div><div><span>APFDc ({t("estimate", "ước lượng")})</span><strong>{rank.metrics.apfdcEstimate.toFixed(3)}</strong></div><div><span>{t("Early faults (estimate)", "Lỗi sớm (ước lượng)")}</span><strong>{rank.metrics.faultsFoundEarlyEstimate} / {rank.metrics.faultsTotalEstimate}</strong></div><div><span>{t("Suite duration (estimate)", "Thời gian bộ test (ước lượng)")}</span><strong>{rank.metrics.estimatedSuiteMinutes.toFixed(1)} min</strong></div></div><p className="ops-callout">{rank.metrics.note}</p><div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>#</th><th>Scenario</th><th>{t("Severity", "Mức độ")}</th><th>{t("Score", "Điểm")}</th><th>{t("Estimated cost", "Chi phí ước lượng")}</th><th>{t("Rationale", "Lý do")}</th></tr></thead><tbody>{rank.ordered.map(item => <tr key={item.scenarioVersionId}><td>{item.rank}</td><td><b>{item.scenarioName}</b><small>{item.scenarioCode}</small></td><td>{item.severity}</td><td>{item.score.toFixed(3)}</td><td>{item.estimatedCostMinutes.toFixed(1)} min</td><td>{item.rationale}</td></tr>)}</tbody></table></div><details><summary>{t("Feature names and distance matrix", "Đặc trưng và ma trận khoảng cách")}</summary><pre className="ops-json">{pretty({ featureNames: rank.featureNames, distanceMatrix: rank.distanceMatrix })}</pre></details></div>}
      </section> : <>
        <section className="card ops-panel"><div className="ops-panel-heading"><div><h3>{t("Campaign library", "Danh sách campaign")}</h3><p>{t("Select a campaign to inspect its versioned scenarios and runs.", "Chọn campaign để xem phiên bản scenario và các run.")}</p></div><label className="ops-search"><Icon name="search" /><input placeholder={t("Search name, code or status…", "Tìm tên, mã hoặc trạng thái…")} value={campaignFilter} onChange={event => setCampaignFilter(event.target.value)} /></label></div>
          <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t("Campaign", "Campaign")}</th><th>{t("Status", "Trạng thái")}</th><th>{t("Scenarios / SUT", "Scenario / SUT")}</th><th>{t("Progress", "Tiến độ")}</th><th>{t("Estimate", "Ước lượng")}</th><th>{t("Actions", "Thao tác")}</th></tr></thead><tbody>{visibleCampaigns.map(campaign => <tr key={campaign.id} className={campaign.id === campaignId ? "selected" : ""}><td><button className="ops-text-button" onClick={() => chooseCampaign(campaign.id)}>{campaign.name}</button><small>{campaign.code} · {campaign.owner}</small></td><td><span className={`ops-status ${campaign.status === "Completed" ? "good" : ""}`}>{campaign.status}</span></td><td>{campaign.scenarioVersionIds.length} {t("versions", "phiên bản")}<small>{campaign.sut.type} · {campaign.sut.behavior}</small></td><td><div className="ops-progress"><span style={{ width: `${Math.min(100, Math.max(0, campaign.progress))}%` }} /></div><small>{campaign.progress}% · PASS {campaign.passRate}% · {campaign.failedRuns} {t("failed", "lỗi")}</small></td><td>{campaign.estimatedDuration}<small>{t("Content-based estimate", "Ước lượng theo nội dung")}</small></td><td><div className="ops-actions"><button className="btn btn-secondary" onClick={() => { chooseCampaign(campaign.id); onNavigate?.("execution"); }}><Icon name="eye" />{t("Runs", "Run")}</button>{canManage && editable(campaign) && <button className="btn btn-secondary" onClick={() => openBuilder(campaign)}>{t("Edit", "Sửa")}</button>}{canManage && campaign.runCount === 0 && <button className="btn btn-primary" disabled={pending(`start-${campaign.id}`)} onClick={() => startCampaign(campaign)}>{pending(`start-${campaign.id}`) ? spinner : <Icon name="play" />}{t("Start", "Chạy")}</button>}{canManage && campaign.runCount > 0 && campaign.status !== "Running" && <button className="btn btn-secondary" onClick={() => { setRerunTarget(campaign); setRerunAccepted(false); }}>{t("Rerun…", "Chạy lại…")}</button>}</div></td></tr>)}</tbody></table></div>{!loading && !visibleCampaigns.length && <div className="ops-empty">{campaignFilter ? t("No campaign matches your search.", "Không có campaign khớp tìm kiếm.") : t("No campaigns yet. Build a campaign from published READY scenario versions.", "Chưa có campaign. Hãy tạo từ các phiên bản scenario READY đã xuất bản.")}</div>}
        </section>
        {selected && <section className="card ops-panel"><div className="ops-panel-heading"><div><span className="ops-eyebrow">{selected.code}</span><h3>{selected.name}</h3><p>{selected.description || t("No description provided.", "Chưa có mô tả.")}</p></div><span className="ops-status">{selected.status}</span></div><dl className="ops-facts"><div><dt>SUT</dt><dd>{selected.sut.type} / {selected.sut.behavior}</dd></div><div><dt>CARLA</dt><dd>{selected.sut.carlaVersion} · Low</dd></div><div><dt>{t("Strategy", "Chiến lược")}</dt><dd>{selected.strategy}</dd></div><div><dt>{t("Created", "Ngày tạo")}</dt><dd>{safeDate(selected.createdAt, locale)}</dd></div></dl><div className="ops-version-chips">{selected.scenarios.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((scenario, index) => <span key={scenario.scenarioVersionId}><b>{index + 1}</b>{scenario.scenarioName} · v{scenario.versionNumber}<small>{scenario.mapName} · {scenario.weatherPreset}</small></span>)}</div>
          {!isExecutionPage && <div className="ops-actions ops-section-space"><button className="btn btn-secondary" onClick={() => onNavigate?.("priority")}><Icon name="priority" />{t("Prioritize this suite", "Ưu tiên bộ test")}</button><button className="btn btn-primary" onClick={() => onNavigate?.("execution")}><Icon name="play" />{t("Execution & results", "Thực thi & kết quả")}</button></div>}
        </section>}
        {isExecutionPage && selected && <section className="card ops-panel"><div className="ops-panel-heading"><div><h3>{t("Scenario runs", "Các run scenario")}</h3><p>{t("Updates every 5 seconds. A PASS verdict is shown only when returned by the backend oracle.", "Cập nhật mỗi 5 giây. Chỉ hiển thị PASS khi Oracle backend trả về kết quả đó.")}</p></div>{onNavigate && <button className="btn btn-secondary" onClick={() => onNavigate("nodes")}><Icon name="nodes" />{t("Worker status", "Trạng thái worker")}</button>}</div>{runsLoading && <div className="ops-loading">{spinner}{t("Loading runs…", "Đang tải run…")}</div>}<div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>Scenario</th><th>{t("State", "Trạng thái")}</th><th>{t("Verdict", "Kết luận")}</th><th>Seed</th><th>{t("Started / finished", "Bắt đầu / kết thúc")}</th><th>{t("Evidence", "Bằng chứng")}</th></tr></thead><tbody>{runs.map(run => <tr key={run.id} className={runId === run.id ? "selected" : ""}><td><b>{run.scenarioName}</b><small>{run.scenarioCode} · v{run.versionNumber}</small>{run.errorMessage && <p className="ops-run-error">{run.errorMessage}</p>}</td><td><span className={`ops-status ${activeRun(run) ? "active" : ""}`}>{run.status}</span></td><td><span className={`ops-verdict ${run.verdict?.toLowerCase() ?? "pending"}`}>{run.verdict ?? t("Pending", "Chưa có")}</span></td><td>{run.seed ?? "—"}</td><td>{safeDate(run.startedAt, locale)}<small>{safeDate(run.finishedAt, locale)}</small></td><td><button className="btn btn-secondary" onClick={() => setRunId(run.id)}><Icon name="eye" />{t("Inspect", "Xem chi tiết")}</button></td></tr>)}</tbody></table></div>{!runsLoading && !runs.length && <div className="ops-empty">{t("No runs exist for this campaign. Start the campaign, then activate the worker to execute queued runs.", "Campaign chưa có run. Hãy chạy campaign, rồi kích hoạt worker để thực thi run trong hàng đợi.")}</div>}</section>}
        {isExecutionPage && runId && <section className="card ops-panel">{resultLoading ? <div className="ops-loading">{spinner}{t("Loading oracle result…", "Đang tải kết quả Oracle…")}</div> : result && <><div className="ops-panel-heading"><div><span className="ops-eyebrow">{t("ACTUAL BACKEND RESULT", "KẾT QUẢ THỰC TẾ BACKEND")}</span><h3>{result.scenarioName} · v{result.versionNumber}</h3><p>{result.campaignName} · {result.status}</p></div><span className={`ops-verdict large ${result.verdict?.toLowerCase() ?? "pending"}`}>{result.verdict ?? t("Awaiting oracle", "Đợi Oracle")}</span></div><dl className="ops-facts"><div><dt>Run ID</dt><dd className="ops-id">{result.runId}</dd></div><div><dt>{t("Duration", "Thời gian")}</dt><dd>{result.durationS === null ? "—" : `${result.durationS.toFixed(2)} s`}</dd></div><div><dt>{t("Outcome", "Kết quả thực thi")}</dt><dd>{result.outcome ?? "—"}</dd></div><div><dt>{t("Infrastructure retries", "Lần thử lại hạ tầng")}</dt><dd>{result.infraRetryCount}</dd></div></dl><div className="ops-actions"><button className="btn btn-secondary" disabled={pending("download-result")} onClick={() => void perform("download-result", async () => { await client.download(`/api/v1/runs/${encodeURIComponent(result.runId)}/result`, `oracle-${result.runId}.json`); })}>{pending("download-result") ? spinner : <Icon name="download" />}{t("Download result JSON", "Tải kết quả JSON")}</button><button className="btn btn-secondary" disabled={!result.hasVideo || pending("download-video")} onClick={() => void perform("download-video", async () => { await client.download(`/api/v1/runs/${encodeURIComponent(result.runId)}/video`, `carla-${result.runId}.mp4`); })}>{pending("download-video") ? spinner : <Icon name="download" />}{t("Download camera video", "Tải video camera")}</button>{!result.hasVideo && <span className="ops-note">{t("No video has been uploaded for this run.", "Run này chưa có video được tải lên.")}</span>}</div>
          {!result.evaluations.length && <div className="ops-callout">{t("No oracle evaluation is available yet. Queued/running runs have no verdict; inspect worker logs if progress stops.", "Chưa có đánh giá Oracle. Run đang đợi/đang chạy chưa có kết luận; hãy xem nhật ký worker nếu tiến độ dừng.")}</div>}
          {result.evaluations.map(evaluation => <article className="ops-evaluation" key={evaluation.id}><div className="ops-panel-heading"><h4>Oracle v{evaluation.oracleVersion}</h4><span className={`ops-verdict ${evaluation.verdict.toLowerCase()}`}>{evaluation.verdict}</span></div><p className="ops-note">{safeDate(evaluation.evaluatedAt, locale)} · {evaluation.oracleConfigId}</p>{evaluation.errorReason && <p className="ops-run-error">{evaluation.errorReason}</p>}{evaluation.violations.length ? <div className="ops-table-scroll"><table className="ops-table"><thead><tr><th>{t("Check", "Điều kiện")}</th><th>{t("Severity", "Mức độ")}</th><th>{t("Time", "Thời điểm")}</th><th>{t("Duration", "Thời lượng")}</th><th>{t("Measured evidence", "Bằng chứng đo được")}</th></tr></thead><tbody>{evaluation.violations.map(violation => <tr key={violation.id}><td><b>{violation.check}</b></td><td>{violation.severity}</td><td>{violation.t.toFixed(2)} s</td><td>{violation.durationS === null ? "—" : `${violation.durationS.toFixed(2)} s`}</td><td><pre className="ops-evidence-json">{pretty(violation.details)}</pre></td></tr>)}</tbody></table></div> : <p className="ops-note">{t("No violations were reported by this oracle evaluation.", "Lần đánh giá Oracle này không báo vi phạm.")}</p>}</article>)}<details className="ops-section-space"><summary>{t("Raw result JSON", "JSON kết quả đầy đủ")}</summary><pre className="ops-json">{pretty(result)}</pre></details></>}</section>}
      </>}
    </>}
    <footer className="ops-footer"><span>AutoScenarioX · {t("Team backend", "Backend của nhóm")}</span><span>{updatedAt && `${t("Updated", "Cập nhật")} ${safeDate(updatedAt, locale)}`}</span></footer>

    {builderOpen && <div className="modal-backdrop ops-modal-backdrop"><form className="modal ops-builder" onSubmit={saveCampaign} aria-label={t("Campaign builder", "Tạo campaign")}><div className="modal-head"><div><h2>{form.id ? t("Edit campaign", "Chỉnh sửa campaign") : t("Build a campaign", "Tạo campaign")}</h2><p>{t("Choose published READY versions and save the SUT configuration to the backend.", "Chọn phiên bản READY đã xuất bản và lưu cấu hình SUT vào backend.")}</p></div><button type="button" className="icon-button" aria-label={t("Close", "Đóng")} disabled={pending("save-campaign")} onClick={() => setBuilderOpen(false)}><Icon name="close" /></button></div>
      <div className="ops-form-grid"><label>{t("Campaign name", "Tên campaign")}<input required minLength={3} maxLength={120} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label><label>{t("Strategy", "Chiến lược")}<select value={form.strategy} onChange={event => setForm(current => ({ ...current, strategy: event.target.value }))}>{strategies.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="ops-span-2">{t("Description", "Mô tả")}<textarea rows={2} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label><label>{t("SUT agent", "Tác nhân SUT")}<select value={form.sutType} onChange={event => setForm(current => ({ ...current, sutType: event.target.value }))}><option value="behavior_agent">Behavior Agent</option><option value="autopilot">Traffic Manager Autopilot</option></select></label><label>{t("Driving behavior", "Hành vi lái xe")}<select value={form.sutBehavior} onChange={event => setForm(current => ({ ...current, sutBehavior: event.target.value }))} disabled={form.sutType === "autopilot"}><option value="cautious">{t("Cautious", "Thận trọng")}</option><option value="normal">{t("Normal", "Bình thường")}</option><option value="aggressive">{t("Aggressive", "Quyết liệt")}</option></select></label></div><p className="ops-note">CARLA 0.9.16 · Low · {t("The API stores both SUT types. The current backend recorder executes Behavior Agent only; Autopilot requires backend worker support.", "API lưu được cả hai loại SUT. Recorder backend hiện chỉ chạy Behavior Agent; Autopilot cần được hỗ trợ trong worker backend.")}</p>
      <fieldset className="ops-ready-picker"><legend>{t("Ready for testing", "Sẵn sàng kiểm thử")}</legend><div className="ops-ready-filters"><label>{t("Search", "Tìm kiếm")}<input value={readyQuery} onChange={event => { setReadyQuery(event.target.value); setReadyPageNumber(1); }} placeholder={t("Scenario name / code", "Tên / mã scenario")} /></label><label>{t("Map", "Bản đồ")}<select value={readyMap} onChange={event => { setReadyMap(event.target.value); setReadyPageNumber(1); }}><option value="">{t("All maps", "Tất cả bản đồ")}</option>{maps.map(map => <option key={map.mapName}>{map.mapName}</option>)}</select></label><label>{t("Category", "Loại scenario")}<select value={readyCategory} onChange={event => { setReadyCategory(event.target.value); setReadyPageNumber(1); }}><option value="">{t("All categories", "Tất cả loại")}</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label></div>
        {readyLoading ? <div className="ops-loading">{spinner}{t("Finding READY versions…", "Đang tìm phiên bản READY…")}</div> : <div className="ops-ready-list">{readyPage?.items.map(item => <label key={item.scenarioVersionId} className={`ops-ready-card ${form.scenarioVersionIds.includes(item.scenarioVersionId) ? "selected" : ""}`}><input type="checkbox" checked={form.scenarioVersionIds.includes(item.scenarioVersionId)} disabled={!form.scenarioVersionIds.includes(item.scenarioVersionId) && form.scenarioVersionIds.length >= 100} onChange={event => setForm(current => ({ ...current, scenarioVersionIds: event.target.checked ? [...current.scenarioVersionIds, item.scenarioVersionId] : current.scenarioVersionIds.filter(id => id !== item.scenarioVersionId) }))} /><span><b>{item.scenarioName} <em>v{item.versionNumber}</em></b><small>{item.scenarioCode} · {item.category}</small><small>{item.mapName} · {item.weatherPreset} · {item.actorCount} {t("actors", "actor")} · {item.eventCount} {t("events", "sự kiện")}</small><small>{item.egoBlueprint ?? "—"}{item.speedLimitKmh !== null ? ` · ${item.speedLimitKmh} km/h` : ""}</small></span><span className="ops-status good">READY</span></label>)}</div>}
        {!readyLoading && !readyPage?.items.length && <div className="ops-empty">{t("No READY version matches. Publish a valid scenario version or adjust the filters.", "Không có phiên bản READY phù hợp. Hãy xuất bản phiên bản scenario hợp lệ hoặc đổi bộ lọc.")}</div>}
        <div className="ops-pagination"><span>{readyPage?.totalCount ?? 0} {t("matches", "kết quả")}</span><button type="button" className="btn btn-secondary" disabled={readyLoading || readyPageNumber <= 1} onClick={() => setReadyPageNumber(value => value - 1)}>←</button><span>{readyPageNumber} / {Math.max(1, readyPage?.totalPages ?? 1)}</span><button type="button" className="btn btn-secondary" disabled={readyLoading || readyPageNumber >= (readyPage?.totalPages ?? 1)} onClick={() => setReadyPageNumber(value => value + 1)}>→</button></div>
      </fieldset>
      <div className="ops-selection"><h4>{t("Execution order", "Thứ tự thực thi")} · {form.scenarioVersionIds.length} / 100</h4>{form.scenarioVersionIds.map((id, index) => <div className="ops-selection-row" key={id}><b>{index + 1}</b><span>{versionLabel(id)}</span><button type="button" disabled={index === 0} aria-label={t("Move up", "Đưa lên")} onClick={() => moveVersion(index, -1)}>↑</button><button type="button" disabled={index === form.scenarioVersionIds.length - 1} aria-label={t("Move down", "Đưa xuống")} onClick={() => moveVersion(index, 1)}>↓</button><button type="button" aria-label={t("Remove scenario", "Bỏ scenario")} onClick={() => setForm(current => ({ ...current, scenarioVersionIds: current.scenarioVersionIds.filter(value => value !== id) }))}>×</button></div>)}{!form.scenarioVersionIds.length && <p className="ops-note">{t("Select at least one version above.", "Chọn ít nhất một phiên bản phía trên.")}</p>}</div>
      {error && <div className="ops-message ops-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="btn btn-secondary" disabled={pending("save-campaign")} onClick={() => setBuilderOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" type="submit" disabled={!canManage || pending("save-campaign") || !form.scenarioVersionIds.length}>{pending("save-campaign") ? spinner : <Icon name="check" />}{t("Save campaign", "Lưu campaign")}</button></div>
    </form></div>}
    {rerunTarget && <div className="modal-backdrop"><section className="modal ops-confirm" role="dialog" aria-modal="true" aria-labelledby="rerun-title"><div className="modal-head"><div><span className="ops-eyebrow">{t("DELETES OLD RUN HISTORY", "XÓA LỊCH SỬ RUN CŨ")}</span><h2 id="rerun-title">{t("Rerun campaign?", "Chạy lại campaign?")}</h2></div></div><p>{t(`The backend rerun endpoint permanently removes the ${rerunTarget.runCount} existing runs for “${rerunTarget.name}” and creates a new queue. Oracle evaluations and linked run evidence can be lost. Download any evidence you need before continuing.`, `Endpoint chạy lại sẽ xóa ${rerunTarget.runCount} run hiện tại của “${rerunTarget.name}” và tạo hàng đợi mới. Đánh giá Oracle và bằng chứng gắn với run có thể bị mất. Hãy tải bằng chứng cần giữ trước khi tiếp tục.`)}</p><p className="ops-callout">{t("To preserve the existing run history, create a new campaign using the same scenario versions.", "Để giữ lịch sử hiện tại, hãy tạo campaign mới với cùng các phiên bản scenario.")}</p><label className="ops-check"><input type="checkbox" checked={rerunAccepted} onChange={event => setRerunAccepted(event.target.checked)} />{t("I understand that the existing run history will be deleted.", "Tôi hiểu lịch sử run hiện tại sẽ bị xóa.")}</label>{error && <div className="ops-message ops-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" disabled={pending(`start-${rerunTarget.id}`)} onClick={() => setRerunTarget(null)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={!rerunAccepted || pending(`start-${rerunTarget.id}`)} onClick={() => startCampaign(rerunTarget, true)}>{pending(`start-${rerunTarget.id}`) ? spinner : <Icon name="refresh" />}{t("Delete old runs & rerun", "Xóa run cũ và chạy lại")}</button></div></section></div>}
  </div>;
}
