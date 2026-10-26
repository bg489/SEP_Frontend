import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "../i18n";
import { carlaVehicles } from "../data/carlaVehicles";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type {
  TeamCatalog, TeamDiff, TeamDraft, TeamExecutionPackage, TeamImportRecord, TeamImportResult, TeamMap,
  TeamObject, TeamPage, TeamScenarioDetail, TeamScenarioRow, TeamValidation,
  TeamVariantBatch, TeamVariantResult, TeamVersion, TeamVersionDetail,
} from "../services/teamContracts";
import { teamNumber, teamObject, teamString } from "../services/teamContracts";
import { TeamScenarioService } from "../services/teamScenarios";
import type { AppPage } from "../types";
import "./TeamScenarioWorkspace.css";

type Props = {
  service: TeamScenarioService;
  page?: AppPage;
  initialScenarioId?: string;
  onChanged?: () => void | Promise<void>;
  onNotify?: (message: string) => void;
};
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const parseObject = (text: string): TeamObject => {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scenario content must be a JSON object.");
  return value as TeamObject;
};
function numericField(data: FormData, name: string): number {
  const raw = String(data.get(name) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) throw new Error(`Missing or invalid numeric value: ${name}`);
  return value;
}
function explicitLocation(data: FormData, prefix: string): TeamObject {
  if (data.get(`${prefix}_mode`) === "spawn") {
    const value = numericField(data, `${prefix}_index`);
    if (!Number.isInteger(value) || value < 0) throw new Error("Spawn index must be a non-negative integer.");
    return { spawn_point_index: value };
  }
  const value: TeamObject = { x: numericField(data, `${prefix}_x`), y: numericField(data, `${prefix}_y`) };
  for (const axis of ["z", "yaw"]) if (String(data.get(`${prefix}_${axis}`) ?? "").trim()) value[axis] = numericField(data, `${prefix}_${axis}`);
  return value;
}
function LocationFields({ prefix, t, disabled }: { prefix: string; t: (en: string, vi: string) => string; disabled: boolean }) {
  const [mode, setMode] = useState("spawn");
  return <div className="team-form-grid team-location-fields">
    <label>{t("Position format", "Dạng vị trí")}<select name={`${prefix}_mode`} value={mode} disabled={disabled} onChange={event => setMode(event.target.value)}><option value="spawn">Spawn point index</option><option value="coordinates">CARLA x / y / z / yaw</option></select></label>
    {mode === "spawn" ? <label>{t("Explicit spawn index", "Spawn index cụ thể")}<input name={`${prefix}_index`} type="number" min={0} step={1} required disabled={disabled} /></label> : <>{["x", "y", "z", "yaw"].map(axis => <label key={axis}>{axis}{axis === "yaw" ? " °" : " m"}<input name={`${prefix}_${axis}`} type="number" step="any" required={axis === "x" || axis === "y"} min={axis === "yaw" ? -180 : undefined} max={axis === "yaw" ? 180 : undefined} disabled={disabled} /></label>)}</>}
  </div>;
}

/** Uses the canonical schema rather than flattening away routes, actors or events. */
export function TeamScenarioWorkspace({ service, page: workspacePage = "scenarios", initialScenarioId, onChanged, onNotify }: Props) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const actions = useAsyncAction();
  const [catalog, setCatalog] = useState<TeamCatalog | null>(null);
  const [maps, setMaps] = useState<TeamMap[]>([]);
  const [repository, setRepository] = useState<TeamPage<TeamScenarioRow> | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [draftFilter, setDraftFilter] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(initialScenarioId ?? "");
  const [detail, setDetail] = useState<TeamScenarioDetail | null>(null);
  const [draft, setDraft] = useState<TeamDraft | null>(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [versions, setVersions] = useState<TeamVersion[]>([]);
  const [versionNumber, setVersionNumber] = useState(1);
  const [report, setReport] = useState<TeamValidation | null>(null);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [imports, setImports] = useState<TeamImportRecord[]>([]);
  const [batches, setBatches] = useState<TeamVariantBatch[]>([]);
  const [batchResult, setBatchResult] = useState<TeamVariantResult | null>(null);
  const [packageResult, setPackageResult] = useState<TeamExecutionPackage | null>(null);
  const [versionResult, setVersionResult] = useState<TeamVersionDetail | null>(null);
  const [importResult, setImportResult] = useState<TeamImportResult | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [diff, setDiff] = useState<TeamDiff | null>(null);
  const [tab, setTab] = useState<"definition" | "versions" | "variants" | "imports">("definition");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [actorType, setActorType] = useState("vehicle");
  const [eventType, setEventType] = useState("pedestrian_crossing");
  const [triggerType, setTriggerType] = useState("simulation_time");
  const [locationTarget, setLocationTarget] = useState<"start" | "goal">("start");
  const [grid, setGrid] = useState("{}");
  const [diffFrom, setDiffFrom] = useState(1);
  const [diffTo, setDiffTo] = useState(2);
  const content = useMemo(() => { try { return parseObject(text); } catch { return null; } }, [text]);
  const busy = actions.pending || detailLoading;

  async function perform(key: string, task: () => Promise<void>) {
    setError(""); setNotice("");
    try { await actions.run(key, task); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }
  function announce(en: string, vi: string) {
    const message = t(en, vi); setNotice(message); onNotify?.(message);
  }
  async function changed() {
    setRevision(value => value + 1);
    try { await onChanged?.(); } catch { /* Parent owns refresh errors; the saved mutation succeeded. */ }
  }
  async function loadSelected(id: string) {
    const [item, history, imported] = await Promise.all([service.detail(id), service.versions(id), service.imports(id)]);
    const current = item.hasDraft ? await service.draft(id) : null;
    setDetail(item); setDraft(current); setVersions(history); setImports(imported);
    setText(pretty(current?.content ?? item.latestContent ?? {})); setDirty(false);
    setReport(null); setAcknowledgeWarnings(false); setPackageResult(null); setVersionResult(null); setDiff(null);
    if (history[0]) { setVersionNumber(history[0].versionNumber); setDiffFrom(history[1]?.versionNumber ?? history[0].versionNumber); setDiffTo(history[0].versionNumber); }
  }

  useEffect(() => {
    let disposed = false;
    Promise.all([service.catalog(), service.maps()]).then(([nextCatalog, nextMaps]) => {
      if (!disposed) { setCatalog(nextCatalog); setMaps(nextMaps); }
    }).catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); });
    return () => { disposed = true; };
  }, [service]);
  useEffect(() => {
    setImportOpen(workspacePage === "import");
    setCreateOpen(workspacePage === "scenario-editor" && !initialScenarioId);
    setTab(workspacePage === "compare" ? "versions" : "definition");
    if (initialScenarioId) setSelectedId(initialScenarioId);
  }, [workspacePage, initialScenarioId]);
  useEffect(() => {
    let disposed = false;
    const timeout = window.setTimeout(() => {
      setListLoading(true);
      service.search({ q: query, category, map: mapFilter, status, hasDraft: draftFilter === "" ? undefined : draftFilter === "yes", page, pageSize: 12 })
        .then(result => { if (!disposed) setRepository(result); })
        .catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); })
        .finally(() => { if (!disposed) setListLoading(false); });
    }, 200);
    return () => { disposed = true; window.clearTimeout(timeout); };
  }, [service, query, category, mapFilter, status, draftFilter, page, revision]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDraft(null); return; }
    let disposed = false;
    setDetailLoading(true); setError("");
    // This effect owns a selection token: an older response must never replace a newer selection.
    (async () => {
      const [item, history, imported] = await Promise.all([service.detail(selectedId), service.versions(selectedId), service.imports(selectedId)]);
      const current = item.hasDraft ? await service.draft(selectedId) : null;
      if (disposed) return;
      setDetail(item); setDraft(current); setVersions(history); setImports(imported);
      setText(pretty(current?.content ?? item.latestContent ?? {})); setDirty(false); setReport(null);
      setAcknowledgeWarnings(false); setPackageResult(null); setVersionResult(null); setDiff(null); setBatchResult(null); setBatches([]);
      if (history[0]) { setVersionNumber(history[0].versionNumber); setDiffFrom(history[1]?.versionNumber ?? history[0].versionNumber); setDiffTo(history[0].versionNumber); }
    })().catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); })
      .finally(() => { if (!disposed) setDetailLoading(false); });
    return () => { disposed = true; };
  }, [service, selectedId]);

  const editable = !!draft && detail?.status !== "ARCHIVED" && !busy;
  function edit(next: TeamObject) { setText(pretty(next)); setDirty(true); setReport(null); setAcknowledgeWarnings(false); }
  function block(name: string, changes: TeamObject) { if (content) edit({ ...content, [name]: { ...teamObject(content[name]), ...changes } }); }
  async function saveCurrent(): Promise<TeamDraft> {
    if (!detail || !draft) throw new Error(t("Create a draft first.", "Hãy tạo bản nháp trước."));
    const nextContent = parseObject(text);
    if (!dirty) return draft;
    const saved = await service.saveDraft(detail.id, nextContent, draft.rowVersion);
    setDraft(saved); setText(pretty(saved.content)); setDirty(false); setReport(null);
    return saved;
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await perform("create", async () => {
      const item = await service.createProfile(String(data.get("name") ?? "").trim(), String(data.get("description") ?? "").trim(), String(data.get("category") ?? "free_driving"));
      setSelectedId(item.id); setCreateOpen(false); setTab("definition"); await changed();
      announce("Scenario created with a draft template. Configure the route and actors before publishing.", "Đã tạo kịch bản cùng bản nháp mẫu. Hãy cấu hình tuyến đường và actor trước khi xuất bản.");
    });
  }
  async function importScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    await perform("import", async () => {
      if (!/\.(json|ya?ml)$/i.test(file.name)) throw new Error(t("Only JSON, YAML and YML are supported by this backend.", "Backend này chỉ hỗ trợ JSON, YAML và YML."));
      const result = await service.importFile(file, String(data.get("name") ?? "").trim() || undefined);
      setImportResult(result);
      setSelectedId(result.scenario.id); setImportOpen(false); setTab("definition"); await changed();
      announce(`Imported ${result.originalFileName}; review the draft before publishing.`, `Đã nhập ${result.originalFileName}; hãy xem lại bản nháp trước khi xuất bản.`);
    });
  }
  function selectScenario(id: string) {
    if (dirty && !window.confirm(t("Discard unsaved editor changes?", "Bỏ các thay đổi chưa lưu trong trình soạn thảo?"))) return;
    setSelectedId(id); setTab(workspacePage === "compare" ? "versions" : "definition");
  }
  const route = teamObject(content?.route);
  const weather = teamObject(content?.weather);
  const traffic = teamObject(content?.traffic);
  const npc = teamObject(traffic.npc_vehicles);
  const pedestrians = teamObject(traffic.pedestrians);
  const execution = teamObject(content?.execution);
  function setRouteIndex(name: "start" | "goal", value: string) {
    if (value === "") return;
    block("route", { [name]: { spawn_point_index: Number(value) } });
  }
  const actorList = Array.isArray(content?.actors) ? content.actors.map(teamObject) : [];
  const eventList = Array.isArray(content?.events) ? content.events.map(teamObject) : [];
  const parameters = teamObject(content?.parameters);
  function localChange(task: () => void) {
    setError("");
    try { task(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }
  function addActor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    localChange(() => {
      if (!content) return;
      const id = String(data.get("id") ?? "").trim();
      if (actorList.some(item => item.id === id)) throw new Error(t("Actor ID must be unique.", "ID actor phải duy nhất."));
      const actor: TeamObject = { id, type: actorType, blueprint: String(data.get("blueprint") ?? "").trim(), spawn: explicitLocation(data, "actor"), behavior: actorType === "static_obstacle" ? "idle" : String(data.get("behavior") ?? "idle") };
      if (actorType !== "static_obstacle") actor.initial_speed_kmh = numericField(data, "initial_speed_kmh");
      edit({ ...content, actors: [...actorList, actor] }); form.reset();
    });
  }
  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    localChange(() => {
      if (!content) return;
      const id = String(data.get("id") ?? "").trim();
      if (eventList.some(item => item.id === id)) throw new Error(t("Event ID must be unique.", "ID event phải duy nhất."));
      const trigger: TeamObject = { type: triggerType };
      if (triggerType === "simulation_time") trigger.time_s = numericField(data, "time_s");
      else { trigger.distance_m = numericField(data, "distance_m"); if (triggerType === "ego_distance_to_actor") trigger.actor_ref = String(data.get("trigger_actor_ref")); else trigger.location = explicitLocation(data, "trigger"); }
      const params: TeamObject = eventType === "pedestrian_crossing" ? { speed_ms: numericField(data, "speed_ms"), direction: String(data.get("direction")) }
        : eventType === "vehicle_cut_in" ? { side: String(data.get("side")), cut_in_gap_m: numericField(data, "cut_in_gap_m"), lane_change_duration_s: numericField(data, "lane_change_duration_s") }
        : eventType === "lead_vehicle_brake" ? { deceleration_ms2: numericField(data, "deceleration_ms2"), target_speed_kmh: numericField(data, "target_speed_kmh") }
        : { target: "next_on_route", state: String(data.get("state")), duration_s: numericField(data, "duration_s") };
      const item: TeamObject = { id, type: eventType, description: String(data.get("description") ?? ""), trigger, params };
      if (eventType !== "traffic_light_override") item.actor_ref = String(data.get("actor_ref"));
      edit({ ...content, events: [...eventList, item] }); form.reset();
    });
  }
  function addParameter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    localChange(() => {
      if (!content) return;
      const id = String(data.get("id") ?? "").trim();
      if (parameters[id] !== undefined) throw new Error(t("Parameter already exists.", "Tham số đã tồn tại."));
      const type = String(data.get("type")); const value = numericField(data, "value"); const min = numericField(data, "min"); const max = numericField(data, "max");
      if (min > max || value < min || value > max || type === "integer" && !Number.isInteger(value)) throw new Error(t("Set min ≤ value ≤ max and use an integer for integer parameters.", "Đặt min ≤ value ≤ max và dùng số nguyên cho tham số integer."));
      const definition: TeamObject = { type, value, min, max, unit: String(data.get("unit") ?? "") };
      if (String(data.get("step") ?? "").trim()) definition.step = numericField(data, "step");
      edit({ ...content, parameters: { ...parameters, [id]: definition } }); form.reset();
    });
  }
  const button = (key: string, en: string, vi: string, task: () => Promise<void>, disabled = false, primary = false) => (
    <button type="button" className={`btn ${primary ? "btn-primary" : "btn-light"}`} disabled={busy || disabled} onClick={() => void perform(key, task)}>
      {actions.isPending(key) && <i className="button-spinner" />}{t(en, vi)}
    </button>
  );

  return <div className="team-scenario-workspace">
    <section className="card team-workspace-intro">
      <div><small className="section-kicker">SCENARIO MANAGEMENT · /api/v1</small><h2>{workspacePage === "compare" ? t("Scenario version comparison", "So sánh phiên bản kịch bản") : workspacePage === "import" ? t("Import canonical scenarios", "Nhập kịch bản theo schema") : workspacePage === "scenario-editor" ? t("Scenario authoring", "Soạn kịch bản") : t("Canonical scenario workspace", "Không gian cấu hình kịch bản")}</h2>
        <p>{t("Draft → schema, business and CARLA validation → immutable READY version. Every edit retains the full backend JSON contract.", "Bản nháp → kiểm tra cấu trúc, nghiệp vụ và CARLA → phiên bản READY bất biến. Mọi chỉnh sửa giữ nguyên hợp đồng JSON đầy đủ của backend.")}</p></div>
      <div className="team-actions"><button className="btn btn-light" disabled={busy} onClick={() => setImportOpen(true)}>{t("Import JSON / YAML", "Nhập JSON / YAML")}</button><button className="btn btn-primary" disabled={busy} onClick={() => setCreateOpen(true)}>{t("New scenario", "Tạo kịch bản")}</button></div>
    </section>
    {error && <div className="team-message team-error" role="alert"><b>{t("Request needs attention", "Yêu cầu cần xử lý")}</b><span>{error}</span><small>{t("Your unsaved JSON is preserved. For a revision conflict, copy your changes before reloading the latest draft.", "JSON chưa lưu vẫn được giữ. Nếu xung đột phiên bản, hãy sao chép thay đổi trước khi tải lại bản nháp mới nhất.")}</small></div>}
    {notice && <div className="team-message team-success" role="status">{notice}</div>}
    {importResult && <details className="card team-result"><summary>{t("Import mapping report", "Báo cáo ánh xạ tệp nhập")} · {importResult.originalFileName}</summary><p>SHA-256: <code>{importResult.originalHash}</code></p>{importResult.report.warnings.map((issue,index) => <p className="team-warning-text" key={index}>{issue.path} · {issue.message}</p>)}<pre>{pretty({ mapped: importResult.report.mapped, ignored: importResult.report.ignored, defaulted: importResult.report.defaulted })}</pre></details>}
    <section className="card team-repository">
      <div className="team-repository-filters">
        <label>{t("Search name or code", "Tìm tên hoặc mã")}<input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="SCN-00001" /></label>
        <label>{t("Category", "Phân loại")}<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">{t("All categories", "Tất cả phân loại")}</option>{catalog?.categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>{t("Map", "Bản đồ")}<select value={mapFilter} onChange={event => { setMapFilter(event.target.value); setPage(1); }}><option value="">{t("All maps", "Tất cả bản đồ")}</option>{maps.map(item => <option key={item.mapName}>{item.mapName}</option>)}</select></label>
        <label>{t("Lifecycle", "Vòng đời")}<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></label>
        <label>{t("Draft", "Bản nháp")}<select value={draftFilter} onChange={event => { setDraftFilter(event.target.value); setPage(1); }}><option value="">{t("All", "Tất cả")}</option><option value="yes">{t("Has draft", "Có bản nháp")}</option><option value="no">{t("Published only", "Chỉ đã xuất bản")}</option></select></label>
      </div>
      <div className="team-scenario-cards" aria-busy={listLoading}>
        {listLoading && <p className="team-loading"><i className="button-spinner" />{t("Loading repository…", "Đang tải kho kịch bản…")}</p>}
        {!listLoading && !repository?.items.length && <p>{t("No scenarios match these filters.", "Không có kịch bản phù hợp bộ lọc.")}</p>}
        {repository?.items.map(item => <button key={item.id} className={`team-scenario-card ${selectedId === item.id ? "selected" : ""}`} disabled={busy} onClick={() => selectScenario(item.id)}>
          <small>{item.code} · {item.category}</small><b>{item.name}</b><span>{item.mapName ?? t("Configure map", "Chưa cấu hình map")} · {item.weatherPreset ?? "—"}</span>
          <span className="team-card-status">{item.latestVersionStatus === "READY" ? `READY v${item.latestVersionNumber}` : t("Not published", "Chưa xuất bản")}{item.hasDraft ? t(" · Draft changes", " · Có bản nháp") : ""}</span>
        </button>)}
      </div>
      <div className="team-pagination"><span>{repository?.totalCount ?? 0} {t("scenarios", "kịch bản")}</span><button className="btn btn-light" disabled={listLoading || page <= 1} onClick={() => setPage(value => value - 1)}>{t("Previous", "Trước")}</button><span>{page} / {Math.max(1, repository?.totalPages ?? 1)}</span><button className="btn btn-light" disabled={listLoading || page >= (repository?.totalPages ?? 1)} onClick={() => setPage(value => value + 1)}>{t("Next", "Sau")}</button></div>
    </section>
    {detailLoading && <section className="card team-loading"><i className="button-spinner" />{t("Loading scenario and draft…", "Đang tải kịch bản và bản nháp…")}</section>}
    {detail && !detailLoading && <section className="card team-definition">
      <div className="team-definition-heading"><div><small className="section-kicker">{detail.code} · {detail.status}</small><h3>{detail.name}</h3><p>{detail.description}</p></div><span className={`badge ${draft ? "draft" : "approved"}`}>{draft ? `DRAFT · revision ${draft.rowVersion}${dirty ? " *" : ""}` : detail.latestVersion ? `v${detail.latestVersion.versionNumber} · ${detail.latestVersion.status}` : "DRAFT"}</span></div>
      <div className="team-actions team-lifecycle">
        {button("reload", "Reload saved draft", "Tải lại bản đã lưu", async () => { if (dirty && !window.confirm(t("Discard unsaved changes?", "Bỏ thay đổi chưa lưu?"))) return; await loadSelected(detail.id); })}
        {detail.status !== "ARCHIVED" && !draft && button("draft", "Create draft", "Tạo bản nháp", async () => { const next = await service.createDraft(detail.id); setDraft(next); setText(pretty(next.content)); setDirty(false); await changed(); })}
        {button("clone", "Clone published version", "Nhân bản phiên bản", async () => { const name = window.prompt(t("Name for the cloned scenario", "Tên kịch bản nhân bản"), `${detail.name.slice(0, 110)} copy`); if (!name) return; const next = await service.clone(detail.id, name); setSelectedId(next.id); await changed(); }, !detail.latestVersion)}
        {button("archive", detail.status === "ARCHIVED" ? "Restore scenario" : "Archive scenario", detail.status === "ARCHIVED" ? "Khôi phục kịch bản" : "Lưu trữ kịch bản", async () => { const next = detail.status === "ARCHIVED" ? await service.restore(detail.id) : await service.archive(detail.id); setDetail(next); await changed(); })}
      </div>
      <nav className="team-tabs">{([ ["definition", "Definition", "Cấu hình"], ["versions", "Versions and handoff", "Phiên bản và bàn giao"], ["variants", "Parameter variants", "Biến thể tham số"], ["imports", "Import history", "Lịch sử nhập"] ] as const).map(([key,en,vi]) => <button key={key} className={tab === key ? "active" : ""} disabled={busy} onClick={() => setTab(key)}>{t(en,vi)}</button>)}</nav>
      {tab === "definition" && <>
        {!draft && <div className="team-message">{t("This is a published immutable version. Create a draft to edit it.", "Đây là phiên bản đã xuất bản, bất biến. Tạo bản nháp để chỉnh sửa.")}</div>}
        {draft && <form className="team-profile-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void perform("profile", async () => { const next = await service.updateProfile(detail.id, { name: String(data.get("name")), description: String(data.get("description")), category: String(data.get("category")) }); setDetail(next); if (content) edit({ ...content, metadata: { ...teamObject(content.metadata), name: next.name, description: next.description ?? "", category: next.category } }); await changed(); }); }}>
          <label>{t("Scenario name", "Tên kịch bản")}<input name="name" key={`${detail.id}:${detail.name}`} defaultValue={detail.name} minLength={3} maxLength={120} required disabled={!editable} /></label>
          <label>{t("Category", "Phân loại")}<select name="category" key={`${detail.id}:${detail.category}`} defaultValue={detail.category} disabled={!editable}>{catalog?.categories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>{t("Description", "Mô tả")}<input name="description" key={`${detail.id}:${detail.description}`} defaultValue={detail.description ?? ""} maxLength={2000} disabled={!editable} /></label>
          <button className="btn btn-light" disabled={!editable}>{actions.isPending("profile") && <i className="button-spinner" />}{t("Save profile", "Lưu hồ sơ")}</button>
        </form>}
        {content && <fieldset className="team-schema-fields" disabled={!editable}>
          <legend>{t("Map route weather and actors", "Bản đồ tuyến đường thời tiết và actor")}</legend>
          <div className="team-form-grid">
            <label>{t("CARLA map", "Bản đồ CARLA")}<select value={teamString(teamObject(content.map).name)} onChange={event => block("map", { name: event.target.value })}>{!maps.some(item => item.mapName === teamString(teamObject(content.map).name)) && <option>{teamString(teamObject(content.map).name)}</option>}{maps.map(item => <option key={item.mapName} value={item.mapName}>{item.mapName} · {item.spawnPointCount} spawn points</option>)}</select></label>
            <label>{t("Weather preset", "Thời tiết")}<select value={teamString(weather.preset, "ClearNoon")} onChange={event => block("weather", { preset: event.target.value })}>{catalog?.weatherPresets.map(item => <option key={item}>{item}</option>)}</select></label>
            <label>{t("Start spawn index", "Vị trí spawn đầu")}<input type="number" min={0} value={typeof teamObject(route.start).spawn_point_index === "number" ? Number(teamObject(route.start).spawn_point_index) : ""} placeholder={t("Coordinates in JSON", "Tọa độ trong JSON")} onChange={event => setRouteIndex("start", event.target.value)} /></label>
            <label>{t("Goal spawn index", "Vị trí spawn đích")}<input type="number" min={0} value={typeof teamObject(route.goal).spawn_point_index === "number" ? Number(teamObject(route.goal).spawn_point_index) : ""} placeholder={t("Coordinates in JSON", "Tọa độ trong JSON")} onChange={event => setRouteIndex("goal", event.target.value)} /></label>
            <label>{t("Route speed limit km/h", "Giới hạn tốc độ tuyến km/h")}<input type="number" min={5} max={130} value={typeof route.speed_limit_kmh === "number" ? route.speed_limit_kmh : ""} placeholder={t("Use map signs", "Theo biển báo map")} onChange={event => { const next = { ...route }; if (event.target.value === "") delete next.speed_limit_kmh; else next.speed_limit_kmh = Number(event.target.value); edit({ ...content, route: next }); }} /></label>
            <label>{t("Goal tolerance m", "Dung sai đích m")}<input type="number" min={1} max={50} value={Number(route.goal_tolerance_m ?? 5)} onChange={event => block("route", { goal_tolerance_m: Number(event.target.value) })} /></label>
            <label>{t("Ego blueprint", "Mẫu xe chính")}<select value={teamString(teamObject(content.ego_vehicle).blueprint, "vehicle.tesla.model3")} onChange={event => block("ego_vehicle", { blueprint: event.target.value })}>{carlaVehicles.map(item => <option key={item.blueprint} value={item.blueprint}>{item.label} · {item.blueprint}</option>)}</select></label>
            <label>{t("NPC blueprint filter", "Bộ lọc mẫu xe NPC")}<input value={teamString(npc.blueprint_filter, "vehicle.*")} onChange={event => block("traffic", { npc_vehicles: { ...npc, blueprint_filter: event.target.value } })} /></label>
            <label>{t("NPC vehicle count", "Số xe NPC")}<input type="number" min={0} max={300} value={teamNumber(npc.count, content)} disabled={typeof npc.count === "object"} onChange={event => block("traffic", { npc_vehicles: { ...npc, count: Number(event.target.value) } })} /></label>
            <label>{t("Background pedestrian count", "Số người đi bộ nền")}<input type="number" min={0} max={300} value={teamNumber(pedestrians.count, content)} disabled={typeof pedestrians.count === "object"} onChange={event => block("traffic", { pedestrians: { ...pedestrians, count: Number(event.target.value) } })} /></label>
            <label>{t("Random seed", "Seed ngẫu nhiên")}<input type="number" min={0} max={2147483647} value={Number(execution.seed ?? 42)} onChange={event => block("execution", { seed: Number(event.target.value) })} /></label>
            <label>{t("Simulation timeout seconds", "Thời hạn mô phỏng giây")}<input type="number" min={10} max={3600} value={Number(execution.timeout_s ?? 120)} onChange={event => block("execution", { timeout_s: Number(event.target.value) })} /></label>
            <label>{t("Fixed time step seconds", "Bước mô phỏng giây")}<input type="number" min={0.01} max={0.1} step={0.01} value={Number(execution.fixed_delta_seconds ?? 0.05)} onChange={event => block("execution", { fixed_delta_seconds: Number(event.target.value), synchronous_mode: true })} /></label>
            <label>{t("Warm-up seconds", "Thời gian ổn định giây")}<input type="number" min={0} max={30} step={0.1} value={Number(execution.warmup_s ?? 2)} onChange={event => block("execution", { warmup_s: Number(event.target.value) })} /></label>
            <label>{t("Ego initial speed km/h", "Tốc độ xe chính ban đầu km/h")}<input type="number" min={0} max={130} value={Number(teamObject(content.ego_vehicle).initial_speed_kmh ?? 0)} onChange={event => block("ego_vehicle", { initial_speed_kmh: Number(event.target.value) })} /></label>
            <label>{t("NPC speed difference % (+ slower)", "Chênh tốc độ NPC % (+ chậm hơn)")}<input type="number" min={-100} max={100} value={Number(npc.speed_difference_percent ?? 0)} onChange={event => block("traffic", { npc_vehicles: { ...npc, speed_difference_percent: Number(event.target.value) } })} /></label>
            <label>{t("NPC following distance m", "Khoảng cách bám xe NPC m")}<input type="number" min={0} max={20} step={0.1} value={Number(npc.distance_to_leading_m ?? 2.5)} onChange={event => block("traffic", { npc_vehicles: { ...npc, distance_to_leading_m: Number(event.target.value) } })} /></label>
            <label className="team-checkbox"><input type="checkbox" checked={npc.four_wheels_only !== false} onChange={event => block("traffic", { npc_vehicles: { ...npc, four_wheels_only: event.target.checked } })} />{t("Only four-wheel background vehicles", "Chỉ xe nền bốn bánh")}</label>
            <label>{t("Pedestrian crossing probability", "Xác suất người nền qua đường")}<input type="number" min={0} max={1} step={0.05} value={Number(pedestrians.crossing_probability ?? 0)} onChange={event => block("traffic", { pedestrians: { ...pedestrians, crossing_probability: Number(event.target.value) } })} /></label>
            <label>{t("Pedestrian running probability", "Xác suất người nền chạy")}<input type="number" min={0} max={1} step={0.05} value={Number(pedestrians.running_probability ?? 0)} onChange={event => block("traffic", { pedestrians: { ...pedestrians, running_probability: Number(event.target.value) } })} /></label>
          </div>
          <details className="team-subpanel"><summary>{t("Detailed weather overrides", "Ghi đè thời tiết chi tiết")}</summary><p className="team-help">{t("Leave a field empty to retain the selected CARLA preset value.", "Để trống để giữ giá trị của preset CARLA đang chọn.")}</p><div className="team-form-grid">{([ ["cloudiness", "Cloudiness", "Độ mây", 0, 100], ["precipitation", "Rain", "Lượng mưa", 0, 100], ["precipitation_deposits", "Puddles", "Nước đọng", 0, 100], ["wind_intensity", "Wind", "Gió", 0, 100], ["sun_azimuth_angle", "Sun azimuth °", "Góc phương vị mặt trời °", 0, 360], ["sun_altitude_angle", "Sun altitude °", "Góc cao mặt trời °", -90, 90], ["fog_density", "Fog density", "Mật độ sương", 0, 100], ["fog_distance", "Fog start distance m", "Khoảng cách sương m", 0, undefined], ["wetness", "Road wetness", "Độ ướt đường", 0, 100] ] as const).map(([key,en,vi,min,max]) => <label key={key}>{t(en,vi)}<input type="number" min={min} max={max} step="any" value={typeof weather[key] === "number" ? Number(weather[key]) : ""} placeholder="Preset" onChange={event => { const next = { ...weather }; if (event.target.value === "") delete next[key]; else next[key] = Number(event.target.value); edit({ ...content, weather: next }); }} /></label>)}</div></details>
          <p className="team-help">{t("Spawn indices belong to the exact selected map. Set explicit coordinates, waypoints, weather overrides, scripted actors, events and parameter references in the full JSON below. Metadata validation does not guarantee a spawn succeeds in a live world.", "Spawn index thuộc đúng bản đồ đã chọn. Cấu hình tọa độ, waypoint, thời tiết chi tiết, actor kịch bản, event và tham chiếu tham số trong JSON đầy đủ bên dưới. Kiểm tra metadata chưa bảo đảm spawn thành công trong thế giới đang chạy.")}</p>
          <div className="team-event-guide"><b>{t("Supported event types", "Loại event hỗ trợ")}</b><span>{catalog?.eventTypes.join(" · ")}</span><b>{t("Trigger types", "Loại trigger")}</b><span>{catalog?.triggerTypes.join(" · ")}</span></div>
        </fieldset>}
        {content && <div className="team-structured-editor">
          <details className="team-subpanel"><summary>{t("Route coordinates and waypoints", "Tọa độ tuyến đường và waypoint")}</summary>
            <pre className="team-mini-json">{pretty(route)}</pre><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); localChange(() => { const location = explicitLocation(data, "route"); block("route", { [locationTarget]: location }); }); }}><fieldset disabled={!editable}><div className="team-form-grid"><label>{t("Edit route point", "Chỉnh điểm tuyến")}<select value={locationTarget} onChange={event => setLocationTarget(event.target.value as "start" | "goal")}><option value="start">route.start</option><option value="goal">route.goal</option></select></label></div><LocationFields prefix="route" t={t} disabled={!editable} /><button className="btn btn-light">{t("Apply position to draft", "Áp dụng vị trí vào nháp")}</button></fieldset></form>
            <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); localChange(() => { block("route", { waypoints: [...(Array.isArray(route.waypoints) ? route.waypoints : []), explicitLocation(data, "waypoint")] }); }); }}><fieldset disabled={!editable || Array.isArray(route.waypoints) && route.waypoints.length >= 50}><h4>{t("Add intermediate waypoint", "Thêm waypoint trung gian")}</h4><LocationFields prefix="waypoint" t={t} disabled={!editable} /><button className="btn btn-light">{t("Append waypoint", "Thêm waypoint")}</button></fieldset></form>
            {Array.isArray(route.waypoints) && route.waypoints.map((point,index) => <div className="team-item-row" key={index}><code>{index + 1}. {JSON.stringify(point)}</code><button className="btn btn-light" disabled={!editable} onClick={() => block("route", { waypoints: (route.waypoints as TeamObject[]).filter((_, position) => position !== index) })}>{t("Remove", "Xóa")}</button></div>)}
          </details>
          <details className="team-subpanel"><summary>{t("Scripted actors and obstacles", "Actor kịch bản và chướng ngại")} · {actorList.length}/50</summary>
            <p className="team-help">{t("Choose an explicit location for every actor. Background traffic is configured above; these actors are targets for scripted events. Edit an existing actor in the full JSON.", "Chọn vị trí cụ thể cho từng actor. Giao thông nền cấu hình bên trên; các actor này là mục tiêu của event kịch bản. Chỉnh actor hiện có trong JSON đầy đủ.")}</p>
            {actorList.map((actor,index) => <div className="team-item-row" key={`${teamString(actor.id)}:${index}`}><div><b>{teamString(actor.id)} · {teamString(actor.type)}</b><code>{teamString(actor.blueprint)} · {JSON.stringify(actor.spawn)}</code></div><button className="btn btn-light" disabled={!editable || eventList.some(item => item.actor_ref === actor.id || teamObject(item.trigger).actor_ref === actor.id)} title={t("Remove referencing events first", "Xóa event tham chiếu trước")} onClick={() => edit({ ...content, actors: actorList.filter((_, position) => position !== index) })}>{t("Remove", "Xóa")}</button></div>)}
            <form onSubmit={addActor}><fieldset disabled={!editable || actorList.length >= 50}><div className="team-form-grid">
              <label>ID<input name="id" pattern="[a-z][a-z0-9_]{0,31}" maxLength={32} required placeholder="crossing_actor_1" /></label>
              <label>{t("Actor type", "Loại actor")}<select value={actorType} onChange={event => setActorType(event.target.value)}>{(catalog?.actorTypes ?? ["vehicle", "pedestrian", "bicycle", "static_obstacle"]).map(item => <option key={item}>{item}</option>)}</select></label>
              <label>{t("Blueprint", "Mẫu blueprint")}<input name="blueprint" key={actorType} required list="team-actor-blueprints" placeholder={actorType === "pedestrian" ? "walker.pedestrian.0001" : actorType === "static_obstacle" ? "static.prop.trafficcone01" : "vehicle.tesla.model3"} /></label>
              {actorType !== "static_obstacle" && <><label>{t("Behavior", "Hành vi")}<select name="behavior"><option value="idle">idle</option><option value="scripted">scripted</option><option value="autopilot">autopilot</option></select></label><label>{t("Initial speed km/h", "Tốc độ ban đầu km/h")}<input name="initial_speed_kmh" type="number" min={0} max={130} step="any" defaultValue={0} required /></label></>}
            </div><datalist id="team-actor-blueprints">{carlaVehicles.map(item => <option key={item.blueprint} value={item.blueprint}>{item.label}</option>)}</datalist><LocationFields prefix="actor" t={t} disabled={!editable} /><button className="btn btn-light">{t("Add actor to draft", "Thêm actor vào nháp")}</button></fieldset></form>
          </details>
          <details className="team-subpanel"><summary>{t("Events and triggers", "Event và điều kiện kích hoạt")} · {eventList.length}/20</summary>
            {eventList.map((item,index) => <div className="team-item-row" key={`${teamString(item.id)}:${index}`}><div><b>{teamString(item.id)} · {teamString(item.type)}</b><code>{JSON.stringify(item.trigger)} · {JSON.stringify(item.params)}</code></div><button className="btn btn-light" disabled={!editable} onClick={() => edit({ ...content, events: eventList.filter((_, position) => position !== index) })}>{t("Remove", "Xóa")}</button></div>)}
            <form onSubmit={addEvent}><fieldset disabled={!editable || eventList.length >= 20}><div className="team-form-grid">
              <label>ID<input name="id" pattern="[a-z][a-z0-9_]{0,31}" maxLength={32} required placeholder="crossing_event_1" /></label>
              <label>{t("Event type", "Loại event")}<select value={eventType} onChange={event => setEventType(event.target.value)}>{(catalog?.eventTypes ?? ["pedestrian_crossing", "vehicle_cut_in", "lead_vehicle_brake", "traffic_light_override"]).map(item => <option key={item}>{item}</option>)}</select></label>
              <label>{t("Description", "Mô tả")}<input name="description" maxLength={500} /></label>
              {eventType !== "traffic_light_override" && <label>{t("Target actor", "Actor mục tiêu")}<select name="actor_ref" required><option value="">{t("Choose actor", "Chọn actor")}</option>{actorList.filter(actor => eventType === "pedestrian_crossing" ? actor.type === "pedestrian" : actor.type === "vehicle" || actor.type === "bicycle").map(actor => <option key={teamString(actor.id)} value={teamString(actor.id)}>{teamString(actor.id)}</option>)}</select></label>}
              <label>{t("Trigger type", "Điều kiện kích hoạt")}<select value={triggerType} onChange={event => setTriggerType(event.target.value)}>{(catalog?.triggerTypes ?? ["simulation_time", "ego_distance_to_actor", "ego_distance_to_location"]).map(item => <option key={item}>{item}</option>)}</select></label>
              {triggerType === "simulation_time" ? <label>{t("Simulation time seconds", "Thời điểm mô phỏng giây")}<input name="time_s" type="number" min={0} max={3600} step="any" required /></label> : <label>{t("Trigger distance m", "Khoảng cách kích hoạt m")}<input name="distance_m" type="number" min={0.5} max={200} step="any" required /></label>}
              {triggerType === "ego_distance_to_actor" && <label>{t("Trigger actor", "Actor kích hoạt")}<select name="trigger_actor_ref" required><option value="">{t("Choose actor", "Chọn actor")}</option>{actorList.map(actor => <option key={teamString(actor.id)} value={teamString(actor.id)}>{teamString(actor.id)}</option>)}</select></label>}
              {eventType === "pedestrian_crossing" && <><label>{t("Walking speed m/s", "Tốc độ đi bộ m/s")}<input name="speed_ms" type="number" min={0.3} max={6} step="any" required /></label><label>{t("Crossing direction", "Hướng qua đường")}<select name="direction"><option value="left_to_right">left_to_right</option><option value="right_to_left">right_to_left</option></select></label></>}
              {eventType === "vehicle_cut_in" && <><label>{t("Cut-in side", "Hướng chen làn")}<select name="side"><option value="left">left</option><option value="right">right</option></select></label><label>{t("Cut-in gap m", "Khoảng cách chen m")}<input name="cut_in_gap_m" type="number" min={2} max={50} step="any" required /></label><label>{t("Lane change duration seconds", "Thời gian đổi làn giây")}<input name="lane_change_duration_s" type="number" min={0.5} max={10} step="any" defaultValue={2} required /></label></>}
              {eventType === "lead_vehicle_brake" && <><label>{t("Deceleration m/s²", "Giảm tốc m/s²")}<input name="deceleration_ms2" type="number" min={1} max={10} step="any" required /></label><label>{t("Target speed km/h", "Tốc độ mục tiêu km/h")}<input name="target_speed_kmh" type="number" min={0} max={130} step="any" defaultValue={0} required /></label></>}
              {eventType === "traffic_light_override" && <><label>{t("Traffic light state", "Trạng thái đèn")}<select name="state"><option value="red">red</option><option value="yellow">yellow</option><option value="green">green</option></select></label><label>{t("Override duration seconds", "Thời gian đổi đèn giây")}<input name="duration_s" type="number" min={1} max={120} step="any" required /></label></>}
            </div>{triggerType === "ego_distance_to_location" && <LocationFields prefix="trigger" t={t} disabled={!editable} />}<button className="btn btn-light">{t("Add event to draft", "Thêm event vào nháp")}</button></fieldset></form>
          </details>
          <details className="team-subpanel"><summary>{t("Parameters for reproducible variants", "Tham số để sinh biến thể")} · {Object.keys(parameters).length}/30</summary><p className="team-help">{t('Use {"$param":"name"} in supported numeric JSON fields to link a parameter. The backend validates references, ranges and generated combinations.', 'Dùng {"$param":"tên"} trong các trường số JSON hỗ trợ để liên kết tham số. Backend kiểm tra tham chiếu, miền giá trị và các tổ hợp sinh ra.')}</p>
            {Object.entries(parameters).map(([name,definition]) => <div className="team-item-row" key={name}><div><b>{name}</b><code>{JSON.stringify(definition)}</code></div><button className="btn btn-light" disabled={!editable} onClick={() => { const next = { ...parameters }; delete next[name]; edit({ ...content, parameters: next }); }}>{t("Remove", "Xóa")}</button></div>)}
            <form onSubmit={addParameter}><fieldset disabled={!editable || Object.keys(parameters).length >= 30}><div className="team-form-grid"><label>{t("Parameter name", "Tên tham số")}<input name="id" pattern="[a-z][a-z0-9_]{0,31}" maxLength={32} required /></label><label>{t("Numeric type", "Kiểu số")}<select name="type"><option value="number">number</option><option value="integer">integer</option></select></label>{["value", "min", "max"].map(name => <label key={name}>{name}<input name={name} type="number" step="any" required /></label>)}<label>{t("Step optional", "Bước tùy chọn")}<input name="step" type="number" min={0.000001} step="any" /></label><label>{t("Unit", "Đơn vị")}<input name="unit" maxLength={16} /></label></div><button className="btn btn-light">{t("Add parameter to draft", "Thêm tham số vào nháp")}</button></fieldset></form>
          </details>
        </div>}
        <label className="team-json-label">{t("Full canonical scenario JSON", "JSON đầy đủ của kịch bản")}<textarea className="team-json-editor" value={text} spellCheck={false} disabled={!editable} onChange={event => { setText(event.target.value); setDirty(true); setReport(null); setAcknowledgeWarnings(false); }} rows={24} /></label>
        {!content && <p className="team-error-text">{t("JSON is incomplete or invalid. Fix its syntax before saving; your text is preserved.", "JSON chưa hoàn chỉnh hoặc sai cú pháp. Sửa cú pháp trước khi lưu; nội dung vẫn được giữ.")}</p>}
        {draft && <label className="team-publication-note">{t("Publication change note", "Ghi chú phiên bản xuất bản")}<input maxLength={1000} value={changeNote} disabled={busy} onChange={event => setChangeNote(event.target.value)} placeholder={t("Describe what changed in this version", "Mô tả thay đổi trong phiên bản này")} /></label>}
        <div className="team-actions">
          {button("save", "Save draft", "Lưu bản nháp", async () => { await saveCurrent(); await changed(); announce("Draft saved with revision control.", "Đã lưu bản nháp có kiểm soát phiên bản."); }, !draft || !content, true)}
          {button("validate", "Save and validate", "Lưu và kiểm tra", async () => { await saveCurrent(); const next = await service.validate(detail.id); setReport(next); setAcknowledgeWarnings(false); await changed(); }, !draft || !content)}
          {button("publish", "Publish READY version", "Xuất bản phiên bản READY", async () => { const next = await service.publish(detail.id, changeNote || undefined); setDraft(null); setText(pretty(next.content)); setDirty(false); setChangeNote(""); await loadSelected(detail.id); await changed(); announce("Immutable READY version published.", "Đã xuất bản phiên bản READY bất biến."); }, !draft || dirty || !report?.isValid || report.duplicateOfVersionNumber != null || !!report.warnings.length && !acknowledgeWarnings)}
          {button("export-json", "Export JSON", "Xuất JSON", async () => { if (draft) { if (dirty) throw new Error(t("Save your draft before exporting.", "Lưu bản nháp trước khi xuất tệp.")); await service.exportDraft(detail.id, "json"); } else if (detail.latestVersion) await service.exportVersion(detail.id, detail.latestVersion.versionNumber, "json"); }, !draft && !detail.latestVersion)}
          {button("export-yaml", "Export YAML", "Xuất YAML", async () => { if (draft) { if (dirty) throw new Error(t("Save your draft before exporting.", "Lưu bản nháp trước khi xuất tệp.")); await service.exportDraft(detail.id, "yaml"); } else if (detail.latestVersion) await service.exportVersion(detail.id, detail.latestVersion.versionNumber, "yaml"); }, !draft && !detail.latestVersion)}
          {draft && button("discard", "Discard saved draft", "Xóa bản nháp đã lưu", async () => { if (!window.confirm(t("Delete the saved draft and all unsaved edits? Published versions remain intact.", "Xóa bản nháp đã lưu và mọi thay đổi chưa lưu? Các phiên bản đã xuất bản vẫn giữ nguyên."))) return; await service.discardDraft(detail.id); await loadSelected(detail.id); await changed(); })}
        </div>
        {report && <div className={`team-validation ${report.isValid ? "valid" : "invalid"}`} role="status"><h4>{report.isValid ? t("Validation passed", "Đã qua kiểm tra") : t("Configuration needs changes", "Cấu hình cần sửa")}</h4><p>{t("Stopped at", "Tầng dừng")}: {report.stoppedAt ?? "—"} · {report.validatorVersion} · {report.contentHash}</p>
          {report.duplicateOfVersionNumber != null && <p className="team-error-text">{t("Execution content duplicates version", "Nội dung thực thi trùng phiên bản")} {report.duplicateOfVersionNumber}. {t("Reuse that version or change an execution field.", "Dùng lại phiên bản đó hoặc thay đổi cấu hình thực thi.")}</p>}
          {report.errors.map((issue,index) => <p className="team-error-text" key={`e${index}`}><code>{issue.path}</code> · {issue.tier} · {issue.message}</p>)}
          {report.warnings.map((issue,index) => <p className="team-warning-text" key={`w${index}`}><code>{issue.path}</code> · {issue.message}</p>)}
          {report.isValid && report.warnings.length > 0 && <label className="team-checkbox"><input type="checkbox" checked={acknowledgeWarnings} disabled={busy} onChange={event => setAcknowledgeWarnings(event.target.checked)} />{t("I reviewed these warnings. A published version may still be non-runnable until metadata and runtime requirements are satisfied.", "Tôi đã xem cảnh báo. Phiên bản xuất bản vẫn có thể chưa chạy được cho đến khi metadata và điều kiện runtime đầy đủ.")}</label>}
        </div>}
      </>}
      {tab === "versions" && <>
        <div className="team-actions"><label>{t("Read a historical definition", "Xem cấu hình phiên bản cũ")}<select value={versionNumber} disabled={busy || !versions.length} onChange={event => setVersionNumber(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber} · {item.status}</option>)}</select></label>{button("view-version", "View original JSON", "Xem JSON gốc", async () => setVersionResult(await service.version(detail.id, versionNumber)), !versions.length)}</div>
        {versionResult && <div className="team-result"><h4>{t("Immutable version definition", "Cấu hình phiên bản bất biến")} · v{versionResult.summary.versionNumber}</h4><p>{versionResult.summary.changeNote}</p><pre>{pretty(versionResult.content)}</pre></div>}
        <div className="team-table-scroll"><table className="team-table"><thead><tr><th>{t("Version", "Phiên bản")}</th><th>{t("Status", "Trạng thái")}</th><th>{t("Published", "Xuất bản")}</th><th>{t("Content hash", "Hash nội dung")}</th><th>{t("Actions", "Thao tác")}</th></tr></thead><tbody>{versions.map(version => <tr key={version.id}><td>v{version.versionNumber}</td><td>{version.status}</td><td>{new Date(version.publishedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</td><td><code>{version.contentHash}</code></td><td><div className="team-actions">{button(`package-${version.id}`, "Execution package", "Gói thực thi", async () => setPackageResult(await service.executionPackage(version.id)))}{button(`version-json-${version.id}`, "JSON", "JSON", () => service.exportVersion(detail.id, version.versionNumber, "json"))}{button(`version-yaml-${version.id}`, "YAML", "YAML", () => service.exportVersion(detail.id, version.versionNumber, "yaml"))}{button(`edit-${version.id}`, "Draft from version", "Tạo nháp từ bản này", async () => { const next = await service.createDraft(detail.id, version.versionNumber); setDraft(next); setText(pretty(next.content)); setDirty(false); setTab("definition"); await changed(); }, !!draft || detail.status === "ARCHIVED")}{version.status === "READY" && button(`deprecate-${version.id}`, "Deprecate", "Ngừng dùng", async () => { if (!window.confirm(t("Deprecation cannot be undone. Continue?", "Không thể khôi phục READY sau khi ngừng dùng. Tiếp tục?"))) return; await service.deprecate(detail.id, version.versionNumber); await loadSelected(detail.id); await changed(); })}</div></td></tr>)}</tbody></table></div>
        {!versions.length && <p>{t("No published versions. Validate and publish a draft first.", "Chưa có phiên bản xuất bản. Hãy kiểm tra và xuất bản một bản nháp.")}</p>}
        {versions.length > 1 && <div className="team-actions"><label>{t("From", "Từ")}<select value={diffFrom} onChange={event => setDiffFrom(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber}</option>)}</select></label><label>{t("To", "Đến")}<select value={diffTo} onChange={event => setDiffTo(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber}</option>)}</select></label>{button("diff", "Compare versions", "So sánh phiên bản", async () => setDiff(await service.diff(detail.id, diffFrom, diffTo)), diffFrom === diffTo)}</div>}
        {diff && <div className="team-result"><h4>{t("Version differences", "Khác biệt phiên bản")}</h4><p>{t("Execution content changed", "Cấu hình thực thi thay đổi")}: {String(diff.executionChanged)}</p><pre>{pretty(diff.changes)}</pre></div>}
        {packageResult && <div className="team-result"><h4>{t("Execution package", "Gói thực thi")} · {packageResult.runnable ? "RUNNABLE" : "NOT RUNNABLE"}</h4><p>{t("Selectable for new campaigns", "Được chọn cho campaign mới")}: {String(packageResult.selectableForNewCampaign)}</p>{packageResult.issues.map((issue,index) => <p key={index} className="team-error-text">{issue}</p>)}<pre>{pretty(packageResult)}</pre></div>}
      </>}
      {tab === "variants" && <>
        <p>{t("Generate validated draft scenarios from an explicit parameter grid. Every generated scenario must be reviewed and published separately.", "Sinh kịch bản nháp đã kiểm tra từ lưới giá trị tham số. Mỗi kịch bản sinh ra cần được xem lại và xuất bản riêng.")}</p>
        <div className="team-actions"><label>{t("Base version", "Phiên bản gốc")}<select value={versionNumber} onChange={event => { setVersionNumber(Number(event.target.value)); setBatches([]); setBatchResult(null); }}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber} · {item.status}</option>)}</select></label>{button("batch-list", "Load batch history", "Tải lịch sử sinh", async () => setBatches(await service.variants(detail.id, versionNumber)), !versions.length)}</div>
        <label>{t("Parameter grid JSON", "JSON lưới tham số")}<textarea className="team-json-editor" rows={7} value={grid} disabled={busy} onChange={event => setGrid(event.target.value)} placeholder={'{"npc_count": [5, 10], "trigger_distance_m": [8, 12]}'} /></label>
        {button("generate", "Generate variants", "Sinh biến thể", async () => { const parsed: unknown = JSON.parse(grid); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Object.keys(parsed).length || Object.values(parsed).some(value => !Array.isArray(value) || !value.length || value.some(item => typeof item !== "number" || !Number.isFinite(item)))) throw new Error(t("Use an object with non-empty numeric arrays for existing parameters.", "Dùng object gồm các mảng số không rỗng của tham số đang có.")); setBatchResult(await service.generateVariants(detail.id, versionNumber, parsed as Record<string,number[]>)); setBatches(await service.variants(detail.id, versionNumber)); await changed(); }, !versions.length, true)}
        {batches.map(batch => <div className="team-batch" key={batch.id}><b>{batch.generatedCount}/{batch.requestedCount}</b><span>{batch.createdAt}</span>{button(`batch-${batch.id}`, "View generated scenarios", "Xem kịch bản đã sinh", async () => setBatchResult(await service.variantBatch(detail.id, versionNumber, batch.id)))}</div>)}
        {batchResult && <div className="team-result"><h4>{t("Generated draft scenarios", "Các kịch bản nháp đã sinh")}</h4>{batchResult.scenarios.map(item => <button className="team-result-link" key={item.id} disabled={busy} onClick={() => selectScenario(item.id)}>{item.code} · {item.name} · {item.hasDraft ? "DRAFT" : item.status}</button>)}<pre>{pretty(batchResult.batch.parameterGrid)}</pre></div>}
      </>}
      {tab === "imports" && <><p>{t("The original import file and its SHA-256 hash are retained by the backend. Supported formats are canonical JSON and YAML.", "Backend giữ tệp nhập gốc và hash SHA-256. Các định dạng hỗ trợ là JSON và YAML theo schema của dự án.")}</p>{imports.length ? <div className="team-table-scroll"><table className="team-table"><thead><tr><th>{t("File", "Tệp")}</th><th>{t("Format", "Định dạng")}</th><th>{t("Status", "Trạng thái")}</th><th>SHA-256</th></tr></thead><tbody>{imports.map(item => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.format}</td><td>{item.status}</td><td><code>{item.originalHash}</code></td></tr>)}</tbody></table></div> : <p>{t("No import records for this scenario.", "Kịch bản này chưa có lịch sử nhập.")}</p>}</>}
    </section>}
    {createOpen && <div className="modal-backdrop"><form className="modal" onSubmit={event => void create(event)}><div className="modal-head"><div><h2>{t("Create scenario draft", "Tạo bản nháp kịch bản")}</h2><p>{t("The backend provides an editable schema 1.0 template.", "Backend tạo bản mẫu schema 1.0 có thể chỉnh sửa.")}</p></div><button type="button" disabled={busy} onClick={() => setCreateOpen(false)}>×</button></div><label>{t("Name", "Tên")}<input name="name" minLength={3} maxLength={120} required disabled={busy} /></label><label>{t("Description", "Mô tả")}<textarea name="description" maxLength={2000} disabled={busy} /></label><label>{t("Category", "Phân loại")}<select name="category" disabled={busy}>{(catalog?.categories ?? ["free_driving"]).map(item => <option key={item}>{item}</option>)}</select></label><div className="modal-actions"><button type="button" className="btn btn-light" disabled={busy} onClick={() => setCreateOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={busy}>{actions.isPending("create") && <i className="button-spinner" />}{t("Create draft", "Tạo bản nháp")}</button></div></form></div>}
    {importOpen && <div className="modal-backdrop"><form className="modal" onSubmit={event => void importScenario(event)}><div className="modal-head"><div><h2>{t("Import scenario", "Nhập kịch bản")}</h2><p>{t("JSON / YAML · maximum 2 MB request · imports remain drafts.", "JSON / YAML · yêu cầu tối đa 2 MB · nhập xong vẫn là bản nháp.")}</p></div><button type="button" disabled={busy} onClick={() => setImportOpen(false)}>×</button></div><label>{t("Scenario file", "Tệp kịch bản")}<input type="file" name="file" accept=".json,.yaml,.yml" required disabled={busy} /></label><label>{t("Optional scenario name", "Tên kịch bản tùy chọn")}<input name="name" maxLength={120} disabled={busy} /></label><p className="team-help">{t("OpenSCENARIO .xosc/.osc and CARLA route XML adapters are not available in this backend. Unsupported files are not converted into a fake runnable scenario.", "Backend chưa có adapter OpenSCENARIO .xosc/.osc và CARLA route XML. Tệp chưa hỗ trợ không được chuyển thành kịch bản chạy giả.")}</p><div className="modal-actions"><button type="button" className="btn btn-light" disabled={busy} onClick={() => setImportOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={busy}>{actions.isPending("import") && <i className="button-spinner" />}{t("Import draft", "Nhập bản nháp")}</button></div></form></div>}
  </div>;
}
