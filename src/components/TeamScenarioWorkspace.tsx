import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale } from "../localeContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type {
  TeamCatalog, TeamDiff, TeamDraft, TeamExecutionPackage, TeamImportRecord, TeamImportResult, TeamMap,
  TeamObject, TeamPage, TeamScenarioDetail, TeamScenarioRow, TeamValidation,
  TeamVariantBatch, TeamVariantResult, TeamVersion, TeamVersionDetail,
  TeamScenarioTemplate, TeamTag, TeamScenarioHistoryEvent,
} from "../services/teamContracts";
import { teamObject } from "../services/teamContracts";
import { TeamScenarioService } from "../services/teamScenarios";
import { parameterRangeValues, schemaUpdate } from "../services/teamSchemaEditor";
import { TeamSchemaEditor } from "./TeamSchemaEditor";
import { TeamMapView } from "./TeamMapView";
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
/** Uses the canonical schema rather than flattening away routes, actors or events. */
export function TeamScenarioWorkspace({ service, page: workspacePage = "scenarios", initialScenarioId, onChanged, onNotify }: Props) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const actions = useAsyncAction();
  const actionLock = useRef(false);
  const [schemaFocus, setSchemaFocus] = useState<{path: string; nonce: number} | undefined>();
  const [catalog, setCatalog] = useState<TeamCatalog | null>(null);
  const [maps, setMaps] = useState<TeamMap[]>([]);
  const [repository, setRepository] = useState<TeamPage<TeamScenarioRow> | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [mapFilter, setMapFilter] = useState("");
  const [weatherFilter, setWeatherFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<TeamTag[]>([]);
  const [tagText, setTagText] = useState("");
  const [templates, setTemplates] = useState<TeamScenarioTemplate[]>([]);
  const [createTemplate, setCreateTemplate] = useState("");
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("free_driving");
  const [fullSchema, setFullSchema] = useState<TeamObject | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [history, setHistory] = useState<TeamPage<TeamScenarioHistoryEvent> | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mapScope, setMapScope] = useState<"route" | "actors" | "events">("route");
  const [status, setStatus] = useState("ACTIVE");
  const [draftFilter, setDraftFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
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
  const [tab, setTab] = useState<"definition" | "versions" | "variants" | "imports" | "history">("definition");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [schemaResult, setSchemaResult] = useState<TeamObject | null>(null);
  const [importFormat, setImportFormat] = useState("");
  const [variantNamePrefix, setVariantNamePrefix] = useState("");
  const [variantNote, setVariantNote] = useState("");
  const [variantStrategy, setVariantStrategy] = useState<"cartesian" | "pairwise">("cartesian");
  const [grid, setGrid] = useState("{}");
  const [diffFrom, setDiffFrom] = useState(1);
  const [diffTo, setDiffTo] = useState(2);
  const content = useMemo(() => { try { return parseObject(text); } catch { return null; } }, [text]);
  const busy = actions.pending || detailLoading;

  async function perform(key: string, task: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setError(""); setNotice("");
    try { await actions.run(key, task); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { actionLock.current = false; }
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
    setDetail(item); setDraft(current); setVersions(history); setImports(imported); setTagText((item.tags ?? []).join(", "));
    setText(pretty(current?.content ?? item.latestContent ?? {})); setDirty(false);
    setReport(null); setAcknowledgeWarnings(false); setPackageResult(null); setVersionResult(null); setDiff(null);
    setVersionNumber(history[0]?.versionNumber ?? 1); setBatches([]); setBatchResult(null);
    if (history[0]) { setDiffFrom(history[1]?.versionNumber ?? history[0].versionNumber); setDiffTo(history[0].versionNumber); }
  }

  useEffect(() => {
    let disposed = false;
    setSchemaLoading(true);
    Promise.allSettled([service.catalog(), service.maps(), service.schema(), service.templates(), service.tags()]).then(results => {
      if (disposed) return;
      if (results[0].status === "fulfilled") setCatalog(results[0].value as TeamCatalog);
      if (results[1].status === "fulfilled") setMaps(results[1].value as TeamMap[]);
      if (results[2].status === "fulfilled") setFullSchema(results[2].value as TeamObject);
      if (results[3].status === "fulfilled") setTemplates(results[3].value as TeamScenarioTemplate[]);
      if (results[4].status === "fulfilled") setKnownTags(results[4].value as TeamTag[]);
      const failed = results.find(item => item.status === "rejected");
      if (failed?.status === "rejected") setError(failed.reason instanceof Error ? failed.reason.message : String(failed.reason));
      setSchemaLoading(false);
    });
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
      service.search({ q: query, category, map: mapFilter, weather: weatherFilter, eventType: eventFilter, tag: tagFilter, status, hasDraft: draftFilter === "" ? undefined : draftFilter === "yes", page, pageSize })
        .then(result => { if (!disposed) setRepository(result); })
        .catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); })
        .finally(() => { if (!disposed) setListLoading(false); });
    }, 200);
    return () => { disposed = true; window.clearTimeout(timeout); };
  }, [service, query, category, mapFilter, weatherFilter, eventFilter, tagFilter, status, draftFilter, page, pageSize, revision]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDraft(null); return; }
    let disposed = false;
    setDetailLoading(true); setError("");
    // This effect owns a selection token: an older response must never replace a newer selection.
    (async () => {
      const [item, history, imported] = await Promise.all([service.detail(selectedId), service.versions(selectedId), service.imports(selectedId)]);
      const current = item.hasDraft ? await service.draft(selectedId) : null;
      if (disposed) return;
      setDetail(item); setDraft(current); setVersions(history); setImports(imported); setTagText((item.tags ?? []).join(", "));
      setText(pretty(current?.content ?? item.latestContent ?? {})); setDirty(false); setReport(null);
      setAcknowledgeWarnings(false); setPackageResult(null); setVersionResult(null); setDiff(null); setBatchResult(null); setBatches([]);
      setVersionNumber(history[0]?.versionNumber ?? 1); setGrid("{}"); setVariantNamePrefix(""); setVariantNote(""); setHistory(null); setHistoryPage(1);
      if (history[0]) { setDiffFrom(history[1]?.versionNumber ?? history[0].versionNumber); setDiffTo(history[0].versionNumber); }
    })().catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); })
      .finally(() => { if (!disposed) setDetailLoading(false); });
    return () => { disposed = true; };
  }, [service, selectedId]);
  useEffect(() => {
    if (!selectedId || tab !== "history") return;
    let disposed = false; setHistoryLoading(true);
    service.history(selectedId, historyPage, historyPageSize).then(next => { if (!disposed) setHistory(next); })
      .catch(caught => { if (!disposed) setError(caught instanceof Error ? caught.message : String(caught)); })
      .finally(() => { if (!disposed) setHistoryLoading(false); });
    return () => { disposed = true; };
  }, [service, selectedId, tab, historyPage, historyPageSize, revision]);
  function selectVersion(number: number) {
    setVersionNumber(number); setBatches([]); setBatchResult(null); setVersionResult(null);
  }

  const profileEditable = !!detail && detail.status !== "ARCHIVED" && !busy;
  const editable = !!draft && profileEditable;
  function edit(next: TeamObject) { setText(pretty(next)); setDirty(true); setReport(null); setAcknowledgeWarnings(false); }
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
    if (dirty && !window.confirm(t("Discard unsaved editor changes and open the new scenario?", "Bỏ thay đổi chưa lưu và mở kịch bản mới?"))) return;
    await perform("create", async () => {
      const item = await service.createProfile(String(data.get("name") ?? "").trim(), String(data.get("description") ?? "").trim(), String(data.get("category") ?? "free_driving"), createTemplate || undefined);
      setSelectedId(item.id); setCreateOpen(false); setTab("definition"); await changed();
      announce("Scenario created with a draft template. Configure the route and actors before publishing.", "Đã tạo kịch bản cùng bản nháp mẫu. Hãy cấu hình tuyến đường và actor trước khi xuất bản.");
    });
  }
  async function importScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const file = data.get("file");
    if (!(file instanceof File) || !file.size) return;
    if (dirty && !window.confirm(t("Discard unsaved editor changes and open the imported scenario?", "Bỏ thay đổi chưa lưu và mở kịch bản đã nhập?"))) return;
    await perform("import", async () => {
      if (!importFormat && !/\.(json|ya?ml)$/i.test(file.name)) throw new Error(t("Choose JSON or YAML format when the file has no recognized extension.", "Chọn định dạng JSON hoặc YAML khi tệp không có đuôi được nhận diện."));
      const result = await service.importFile(file, String(data.get("name") ?? "").trim() || undefined,
        String(data.get("category") ?? "") || undefined, importFormat === "json" || importFormat === "yaml" ? importFormat : undefined);
      setImportResult(result);
      setSelectedId(result.scenario.id); setImportOpen(false); setTab("definition"); await changed();
      announce(`Imported ${result.originalFileName}; review the draft before publishing.`, `Đã nhập ${result.originalFileName}; hãy xem lại bản nháp trước khi xuất bản.`);
    });
  }
  async function cloneScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    const data = new FormData(event.currentTarget);
    if (dirty && !window.confirm(t("Discard unsaved editor changes and open the clone?", "Bỏ thay đổi chưa lưu và mở bản nhân bản?"))) return;
    await perform("clone", async () => {
      const version = String(data.get("versionNumber") ?? "");
      const next = await service.clone(detail.id, String(data.get("name") ?? "").trim(), String(data.get("description") ?? "").trim() || undefined, version ? Number(version) : undefined);
      setCloneOpen(false); setSelectedId(next.id); setTab("definition"); await changed();
      announce("Published version cloned into a new editable draft.", "Đã nhân bản phiên bản xuất bản thành bản nháp mới.");
    });
  }
  function selectScenario(id: string) {
    if (dirty && !window.confirm(t("Discard unsaved editor changes?", "Bỏ các thay đổi chưa lưu trong trình soạn thảo?"))) return;
    setSelectedId(id); setTab(workspacePage === "compare" ? "versions" : "definition");
  }
  async function loadParameterRanges() {
    if (!detail) return;
    const source = await service.version(detail.id, versionNumber);
    const grid: Record<string, number[]> = {};
    for (const [name, definition] of Object.entries(teamObject(source.content?.parameters))) grid[name] = parameterRangeValues(teamObject(definition));
    setGrid(pretty(grid));
    setVersionResult(source);
  }
  function toggleWeatherAxis(preset: string, checked: boolean) {
    try {
      const parsed = parseObject(grid);
      const values = Array.isArray(parsed["weather.preset"]) ? parsed["weather.preset"].filter((value): value is string => typeof value === "string") : [];
      const next = checked ? [...new Set([...values, preset])] : values.filter(value => value !== preset);
      if (next.length) parsed["weather.preset"] = next; else delete parsed["weather.preset"];
      setGrid(pretty(parsed)); setError("");
    } catch { setError(t("Fix the parameter grid JSON before choosing weather presets.", "Sửa JSON lưới tham số trước khi chọn thời tiết.")); }
  }
  const gridSummary = useMemo(() => {
    try {
      const parsed = parseObject(grid);
      const lengths = Object.values(parsed).map(value => Array.isArray(value) ? value.length : 0);
      return { cartesian: lengths.length ? lengths.reduce((a, b) => a * b, 1) : 0, weather: Array.isArray(parsed["weather.preset"]) ? parsed["weather.preset"] : [] };
    } catch { return { cartesian: 0, weather: [] }; }
  }, [grid]);
  const button = (key: string, en: string, vi: string, task: () => Promise<void>, disabled = false, primary = false) => (
    <button type="button" className={`btn ${primary ? "btn-primary" : "btn-light"}`} disabled={busy || disabled} onClick={() => void perform(key, task)}>
      {actions.isPending(key) && <i className="button-spinner" />}{t(en, vi)}
    </button>
  );

  return <div className="team-scenario-workspace">
    <section className="card team-workspace-intro">
      <div><small className="section-kicker">SCENARIO MANAGEMENT · /api/v1</small><h2>{workspacePage === "compare" ? t("Scenario version comparison", "So sánh phiên bản kịch bản") : workspacePage === "import" ? t("Import canonical scenarios", "Nhập kịch bản theo schema") : workspacePage === "scenario-editor" ? t("Scenario authoring", "Soạn kịch bản") : t("Canonical scenario workspace", "Không gian cấu hình kịch bản")}</h2>
        <p>{t("Draft → schema, business and CARLA validation → immutable READY version. Every edit retains the full backend JSON contract.", "Bản nháp → kiểm tra cấu trúc, nghiệp vụ và CARLA → phiên bản READY bất biến. Mọi chỉnh sửa giữ nguyên hợp đồng JSON đầy đủ của backend.")}</p></div>
      <div className="team-actions">{button("schema", "View scenario schema", "Xem schema kịch bản", async () => setSchemaResult(await service.schema()))}<button className="btn btn-light" disabled={busy} onClick={() => setImportOpen(true)}>{t("Import JSON / YAML", "Nhập JSON / YAML")}</button><button className="btn btn-primary" disabled={busy} onClick={() => setCreateOpen(true)}>{t("New scenario", "Tạo kịch bản")}</button></div>
    </section>
    {error && <div className="team-message team-error" role="alert"><b>{t("Request needs attention", "Yêu cầu cần xử lý")}</b><span>{error}</span><small>{t("Your unsaved JSON is preserved. For a revision conflict, copy your changes before reloading the latest draft.", "JSON chưa lưu vẫn được giữ. Nếu xung đột phiên bản, hãy sao chép thay đổi trước khi tải lại bản nháp mới nhất.")}</small></div>}
    {notice && <div className="team-message team-success" role="status">{notice}</div>}
    {schemaResult && <details className="card team-result" open><summary>{t("Backend scenario JSON Schema", "JSON Schema kịch bản từ backend")} · {catalog?.schemaVersion}</summary><p className="team-help">{t("The full JSON editor accepts every field defined here. Saving keeps the entire document; validation reports point to JSON paths that need changes.", "Trình soạn JSON đầy đủ hỗ trợ mọi trường định nghĩa tại đây. Lưu giữ nguyên tài liệu; báo cáo kiểm tra chỉ ra đường dẫn JSON cần sửa.")}</p><pre>{pretty(schemaResult)}</pre><button className="btn btn-light" onClick={() => setSchemaResult(null)}>{t("Close schema", "Đóng schema")}</button></details>}
    {importResult && <details className="card team-result"><summary>{t("Import mapping report", "Báo cáo ánh xạ tệp nhập")} · {importResult.originalFileName}</summary><p>SHA-256: <code>{importResult.originalHash}</code></p>{importResult.report.warnings.map((issue,index) => <p className="team-warning-text" key={index}>{issue.path} · {issue.message}</p>)}<pre>{pretty({ mapped: importResult.report.mapped, ignored: importResult.report.ignored, defaulted: importResult.report.defaulted })}</pre></details>}
    <section className="card team-repository">
      <div className="team-repository-filters">
        <label>{t("Search name or code", "Tìm tên hoặc mã")}<input value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="SCN-00001" /></label>
        <label>{t("Category", "Phân loại")}<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="">{t("All categories", "Tất cả phân loại")}</option>{catalog?.categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>{t("Map", "Bản đồ")}<select value={mapFilter} onChange={event => { setMapFilter(event.target.value); setPage(1); }}><option value="">{t("All maps", "Tất cả bản đồ")}</option>{maps.map(item => <option key={item.mapName}>{item.mapName}</option>)}</select></label>
        <label>{t("Weather", "Thời tiết")}<select value={weatherFilter} onChange={event => { setWeatherFilter(event.target.value); setPage(1); }}><option value="">{t("All weather", "Tất cả thời tiết")}</option>{catalog?.weatherPresets.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>{t("Event type", "Loại event")}<select value={eventFilter} onChange={event => { setEventFilter(event.target.value); setPage(1); }}><option value="">{t("All events", "Tất cả event")}</option>{catalog?.eventTypes.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>{t("Lifecycle", "Vòng đời")}<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></label>
        <label>{t("Draft", "Bản nháp")}<select value={draftFilter} onChange={event => { setDraftFilter(event.target.value); setPage(1); }}><option value="">{t("All", "Tất cả")}</option><option value="yes">{t("Has draft", "Có bản nháp")}</option><option value="no">{t("Published only", "Chỉ đã xuất bản")}</option></select></label>
        <label>{t("Items per page", "Số mục mỗi trang")}<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[12, 24, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="team-tag-filter"><b>{t("Tags · must match all selected", "Tag · phải có đủ các tag đã chọn")}</b>{knownTags.map(tag => <label className="team-tag-chip" key={tag.name}><input type="checkbox" checked={tagFilter.includes(tag.name)} onChange={event => { setTagFilter(current => event.target.checked ? [...current, tag.name] : current.filter(item => item !== tag.name)); setPage(1); }} />{tag.name}<small>{tag.activeScenarioCount}</small></label>)}{tagFilter.length > 0 && <button type="button" className="btn btn-light" onClick={() => { setTagFilter([]); setPage(1); }}>{t("Clear tags", "Bỏ lọc tag")}</button>}{!knownTags.length && <span>{t("No repository tags yet.", "Kho chưa có tag.")}</span>}</div>
      <div className="team-scenario-cards" aria-busy={listLoading}>
        {listLoading && <p className="team-loading"><i className="button-spinner" />{t("Loading repository…", "Đang tải kho kịch bản…")}</p>}
        {!listLoading && !repository?.items.length && <p>{t("No scenarios match these filters.", "Không có kịch bản phù hợp bộ lọc.")}</p>}
        {repository?.items.map(item => <button key={item.id} className={`team-scenario-card ${selectedId === item.id ? "selected" : ""}`} disabled={busy} onClick={() => selectScenario(item.id)}>
          <small>{item.code} · {item.category}</small><b>{item.name}</b><span>{item.mapName ?? t("Configure map", "Chưa cấu hình map")} · {item.weatherPreset ?? "—"}</span>
          <span className="team-card-status">{item.latestVersionNumber ? `${item.latestVersionStatus} v${item.latestVersionNumber}` : t("Not published", "Chưa xuất bản")}{item.hasDraft ? t(" · Draft changes", " · Có bản nháp") : ""}</span><span>{item.tags?.join(" · ")}</span>
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
        <button type="button" className="btn btn-light" disabled={busy || !detail.latestVersion} onClick={() => setCloneOpen(true)}>{t("Clone published version", "Nhân bản phiên bản")}</button>
        {button("archive", detail.status === "ARCHIVED" ? "Restore scenario" : "Archive scenario", detail.status === "ARCHIVED" ? "Khôi phục kịch bản" : "Lưu trữ kịch bản", async () => { const next = detail.status === "ARCHIVED" ? await service.restore(detail.id) : await service.archive(detail.id); setDetail(next); await changed(); })}
      </div>
      <nav className="team-tabs">{([ ["definition", "Definition", "Cấu hình"], ["versions", "Versions and handoff", "Phiên bản và bàn giao"], ["variants", "Parameter variants", "Biến thể tham số"], ["history", "Activity history", "Lịch sử thao tác"], ["imports", "Import history", "Lịch sử nhập"] ] as const).map(([key,en,vi]) => <button key={key} className={tab === key ? "active" : ""} disabled={busy} onClick={() => setTab(key)}>{t(en,vi)}</button>)}</nav>
      {tab === "definition" && <>
        {!draft && <div className="team-message">{t("This is a published immutable version. Create a draft to edit it.", "Đây là phiên bản đã xuất bản, bất biến. Tạo bản nháp để chỉnh sửa.")}</div>}
        <form className="team-profile-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void perform("profile", async () => { const next = await service.updateProfile(detail.id, { name: String(data.get("name")), description: String(data.get("description")), category: String(data.get("category")) }); setDetail(next); await changed(); announce("Scenario profile saved.", "Đã lưu hồ sơ kịch bản."); }); }}>
          <label>{t("Scenario name", "Tên kịch bản")}<input name="name" key={`${detail.id}:${detail.name}`} defaultValue={detail.name} minLength={3} maxLength={120} required disabled={!profileEditable} /></label>
          <label>{t("Category", "Phân loại")}<select name="category" key={`${detail.id}:${detail.category}`} defaultValue={detail.category} disabled={!profileEditable}>{catalog?.categories.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>{t("Description", "Mô tả")}<input name="description" key={`${detail.id}:${detail.description}`} defaultValue={detail.description ?? ""} maxLength={2000} disabled={!profileEditable} /></label>
          <button className="btn btn-light" disabled={!profileEditable}>{actions.isPending("profile") && <i className="button-spinner" />}{t("Save profile", "Lưu hồ sơ")}</button>
        </form>
        <form className="team-tags-editor" onSubmit={event => { event.preventDefault(); void perform("tags", async () => { const values = tagText.split(/[,\n]/).map(value => value.trim()).filter(Boolean); const next = await service.replaceTags(detail.id, values); setDetail(current => current ? { ...current, tags: next.tags } : current); setTagText(next.tags.join(", ")); setKnownTags(await service.tags()); await changed(); announce("Repository tags saved.", "Đã lưu tag của kho kịch bản."); }); }}><label>{t("Repository tags (comma-separated, maximum 20)", "Tag của kho (phân cách dấu phẩy, tối đa 20)")}<input value={tagText} disabled={!profileEditable} onChange={event => setTagText(event.target.value)} placeholder="night, rain, pedestrian" /><small>{t("1–32 lowercase letters, digits, hyphens or underscores. Saving replaces the entire tag set; blank removes all tags. Published JSON metadata stays unchanged.", "1–32 chữ thường, số, dấu gạch ngang hoặc gạch dưới. Lưu thay toàn bộ bộ tag; để trống gỡ hết. Metadata JSON đã xuất bản giữ nguyên.")}</small></label><button className="btn btn-light" disabled={!profileEditable}>{actions.isPending("tags") && <i className="button-spinner" />}{t("Save tags", "Lưu tag")}</button></form>
        <p className="team-help">{t("Profile changes update the repository. Edit metadata in the JSON separately when the next published definition should contain the same changes.", "Thay đổi hồ sơ cập nhật kho kịch bản. Chỉnh metadata trong JSON riêng nếu cấu hình xuất bản tiếp theo cần có cùng thay đổi.")}</p>
        {content && <>
          {Object.keys(teamObject(content.parameters)).length > 0 && <details className="team-subpanel" open><summary>{t("Quick setup · key test parameters", "Cấu hình nhanh · tham số kiểm thử chính")}</summary><div className="team-form-grid">{Object.entries(teamObject(content.parameters)).map(([name, raw]) => { const definition = teamObject(raw); return <label key={name}>{name} {typeof definition.unit === "string" ? `(${definition.unit})` : ""}<input type="number" min={Number(definition.min)} max={Number(definition.max)} step={definition.type === "integer" ? 1 : typeof definition.step === "number" ? definition.step : "any"} value={typeof definition.value === "number" ? definition.value : ""} disabled={!editable} onChange={event => { if (event.target.value !== "") edit(schemaUpdate(content, ["parameters", name, "value"], Number(event.target.value))); }} /><small>{String(definition.description ?? "")} · {String(definition.min)} → {String(definition.max)}</small></label>; })}</div><p className="team-help">{t("These values resolve the fields linked with $param. Edit ranges and links in Reusable numeric parameters below.", "Các giá trị này áp dụng cho ô liên kết bằng $param. Chỉnh miền giá trị và liên kết ở Tham số số tái sử dụng bên dưới.")}</p></details>}
          <details className="team-subpanel" open><summary>{t("Interactive map and scenario geometry", "Bản đồ tương tác và hình học kịch bản")}</summary>
            <label>{t("Position selection scope", "Nhóm vị trí cần chọn")}<select value={mapScope} disabled={!editable} onChange={event => setMapScope(event.target.value as "route" | "actors" | "events")}><option value="route">{t("Route", "Tuyến đường")}</option><option value="actors">{t("Actors", "Actor")}</option><option value="events">{t("Events", "Event")}</option></select></label>
            <TeamMapView client={service.client} content={content} readOnly={!editable} pick={editable ? { scope: mapScope, onPick: (path, value) => edit(schemaUpdate(content, path, value)) } : undefined} />
          </details>
          {schemaLoading ? <p className="team-loading"><i className="button-spinner" />{t("Loading backend schema…", "Đang tải schema backend…")}</p> : fullSchema ? <TeamSchemaEditor schema={fullSchema} content={content} maps={maps} disabled={!editable} report={report} onChange={edit} focusTarget={schemaFocus} /> : <div className="team-message team-error"><span>{t("The guided editor requires the backend schema. Your full JSON remains available below.", "Trình cấu hình cần schema backend. JSON đầy đủ vẫn được giữ bên dưới.")}</span>{button("reload-schema", "Retry schema", "Tải lại schema", async () => setFullSchema(await service.schema()))}</div>}
        </>}
        <label className="team-json-label">{t("Full canonical scenario JSON", "JSON đầy đủ của kịch bản")}<textarea className="team-json-editor" value={text} spellCheck={false} readOnly={!editable} onChange={event => { setText(event.target.value); setDirty(true); setReport(null); setAcknowledgeWarnings(false); }} rows={24} /></label>
        {!content && <p className="team-error-text">{t("JSON is incomplete or invalid. Fix its syntax before saving; your text is preserved.", "JSON chưa hoàn chỉnh hoặc sai cú pháp. Sửa cú pháp trước khi lưu; nội dung vẫn được giữ.")}</p>}
        {draft && <label className="team-publication-note">{t("Publication change note", "Ghi chú phiên bản xuất bản")}<input maxLength={1000} value={changeNote} disabled={busy} onChange={event => setChangeNote(event.target.value)} placeholder={t("Describe what changed in this version", "Mô tả thay đổi trong phiên bản này")} /></label>}
        <div className="team-actions">
          {button("save", "Save draft", "Lưu bản nháp", async () => { await saveCurrent(); await changed(); announce("Draft saved with revision control.", "Đã lưu bản nháp có kiểm soát phiên bản."); }, !editable || !content, true)}
          {button("validate", "Save and validate", "Lưu và kiểm tra", async () => { await saveCurrent(); const next = await service.validate(detail.id); setReport(next); setAcknowledgeWarnings(false); await changed(); }, !editable || !content)}
          {button("publish", "Publish READY version", "Xuất bản phiên bản READY", async () => { const next = await service.publish(detail.id, changeNote || undefined); setDraft(null); setText(pretty(next.content ?? {})); setDirty(false); setChangeNote(""); await loadSelected(detail.id); await changed(); announce("Immutable READY version published.", "Đã xuất bản phiên bản READY bất biến."); }, !editable || dirty || !report?.isValid || report.duplicateOfVersionNumber != null || !!report.warnings.length && !acknowledgeWarnings)}
          {button("export-json", "Export JSON", "Xuất JSON", async () => { if (draft) { if (dirty) throw new Error(t("Save your draft before exporting.", "Lưu bản nháp trước khi xuất tệp.")); await service.exportDraft(detail.id, "json"); } else if (detail.latestVersion) await service.exportVersion(detail.id, detail.latestVersion.versionNumber, "json"); }, !draft && !detail.latestVersion)}
          {button("export-yaml", "Export YAML", "Xuất YAML", async () => { if (draft) { if (dirty) throw new Error(t("Save your draft before exporting.", "Lưu bản nháp trước khi xuất tệp.")); await service.exportDraft(detail.id, "yaml"); } else if (detail.latestVersion) await service.exportVersion(detail.id, detail.latestVersion.versionNumber, "yaml"); }, !draft && !detail.latestVersion)}
          {draft && button("discard", "Discard saved draft", "Xóa bản nháp đã lưu", async () => { if (!window.confirm(t("Delete the saved draft and all unsaved edits? Published versions remain intact.", "Xóa bản nháp đã lưu và mọi thay đổi chưa lưu? Các phiên bản đã xuất bản vẫn giữ nguyên."))) return; await service.discardDraft(detail.id); await loadSelected(detail.id); await changed(); })}
        </div>
        {report && <div className={`team-validation ${report.isValid ? "valid" : "invalid"}`} role="status"><h4>{report.isValid ? t("Validation passed", "Đã qua kiểm tra") : t("Configuration needs changes", "Cấu hình cần sửa")}</h4><p>{t("Stopped at", "Tầng dừng")}: {report.stoppedAt ?? "—"} · {report.validatorVersion} · {report.contentHash}</p>
          {report.duplicateOfVersionNumber != null && <p className="team-error-text">{t("Execution content duplicates version", "Nội dung thực thi trùng phiên bản")} {report.duplicateOfVersionNumber}. {t("Reuse that version or change an execution field.", "Dùng lại phiên bản đó hoặc thay đổi cấu hình thực thi.")}</p>}
          {report.errors.map((issue,index) => <p className="team-error-text" key={`e${index}`}><button type="button" className="team-issue-link" onClick={() => setSchemaFocus(current => ({ path: issue.path, nonce: (current?.nonce ?? 0) + 1 }))}><code>{issue.path}</code></button> · {issue.tier} · {issue.message}</p>)}
          {report.warnings.map((issue,index) => <p className="team-warning-text" key={`w${index}`}><button type="button" className="team-issue-link" onClick={() => setSchemaFocus(current => ({ path: issue.path, nonce: (current?.nonce ?? 0) + 1 }))}><code>{issue.path}</code></button> · {issue.message}</p>)}
          {report.isValid && report.warnings.length > 0 && <label className="team-checkbox"><input type="checkbox" checked={acknowledgeWarnings} disabled={busy} onChange={event => setAcknowledgeWarnings(event.target.checked)} />{t("I reviewed these warnings. A published version may still be non-runnable until metadata and runtime requirements are satisfied.", "Tôi đã xem cảnh báo. Phiên bản xuất bản vẫn có thể chưa chạy được cho đến khi metadata và điều kiện runtime đầy đủ.")}</label>}
        </div>}
      </>}
      {tab === "versions" && <>
        <div className="team-actions"><label>{t("Read a historical definition", "Xem cấu hình phiên bản cũ")}<select value={versionNumber} disabled={busy || !versions.length} onChange={event => selectVersion(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber} · {item.status}</option>)}</select></label>{button("view-version", "View original JSON", "Xem JSON gốc", async () => setVersionResult(await service.version(detail.id, versionNumber)), !versions.length)}</div>
        {versionResult && <div className="team-result"><h4>{t("Immutable version definition", "Cấu hình phiên bản bất biến")} · v{versionResult.summary.versionNumber}</h4><p>{versionResult.summary.changeNote}</p><pre>{pretty(versionResult)}</pre></div>}
        <div className="team-table-scroll"><table className="team-table"><thead><tr><th>{t("Version", "Phiên bản")}</th><th>{t("Status", "Trạng thái")}</th><th>{t("Published", "Xuất bản")}</th><th>{t("Content hash", "Hash nội dung")}</th><th>{t("Actions", "Thao tác")}</th></tr></thead><tbody>{versions.map(version => <tr key={version.id}><td>v{version.versionNumber}</td><td>{version.status}</td><td>{new Date(version.publishedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</td><td><code>{version.contentHash}</code></td><td><div className="team-actions">{button(`package-${version.id}`, "Execution package", "Gói thực thi", async () => setPackageResult(await service.executionPackage(version.id)))}{button(`version-json-${version.id}`, "JSON", "JSON", () => service.exportVersion(detail.id, version.versionNumber, "json"))}{button(`version-yaml-${version.id}`, "YAML", "YAML", () => service.exportVersion(detail.id, version.versionNumber, "yaml"))}{button(`edit-${version.id}`, "Draft from version", "Tạo nháp từ bản này", async () => { const next = await service.createDraft(detail.id, version.versionNumber); setDraft(next); setText(pretty(next.content)); setDirty(false); setTab("definition"); await changed(); }, !!draft || detail.status === "ARCHIVED")}{version.status === "READY" && button(`deprecate-${version.id}`, "Deprecate", "Ngừng dùng", async () => { if (!window.confirm(t("Deprecation cannot be undone. Continue?", "Không thể khôi phục READY sau khi ngừng dùng. Tiếp tục?"))) return; await service.deprecate(detail.id, version.versionNumber); const [nextDetail, nextVersions] = await Promise.all([service.detail(detail.id), service.versions(detail.id)]); setDetail(nextDetail); setVersions(nextVersions); setPackageResult(null); await changed(); })}</div></td></tr>)}</tbody></table></div>
        {!versions.length && <p>{t("No published versions. Validate and publish a draft first.", "Chưa có phiên bản xuất bản. Hãy kiểm tra và xuất bản một bản nháp.")}</p>}
        {versions.length > 1 && <div className="team-actions"><label>{t("From", "Từ")}<select value={diffFrom} onChange={event => setDiffFrom(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber}</option>)}</select></label><label>{t("To", "Đến")}<select value={diffTo} onChange={event => setDiffTo(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber}</option>)}</select></label>{button("diff", "Compare versions", "So sánh phiên bản", async () => setDiff(await service.diff(detail.id, diffFrom, diffTo)), diffFrom === diffTo)}</div>}
        {diff && <div className="team-result"><h4>{t("Version differences", "Khác biệt phiên bản")}</h4><p>{t("Execution content changed", "Cấu hình thực thi thay đổi")}: {String(diff.executionChanged)}</p><pre>{pretty(diff.changes)}</pre></div>}
        {packageResult && <div className="team-result"><h4>{t("Execution package", "Gói thực thi")} · {packageResult.runnable ? "RUNNABLE" : "NOT RUNNABLE"}</h4><p>{t("Selectable for new campaigns", "Được chọn cho campaign mới")}: {String(packageResult.selectableForNewCampaign)}</p>{packageResult.issues.map((issue,index) => <p key={index} className="team-error-text">{issue}</p>)}<pre>{pretty(packageResult)}</pre></div>}
      </>}
      {tab === "variants" && <>
        <p>{t("Generate validated draft scenarios from parameter values and weather presets. Cartesian uses every combination; pairwise covers each pair with fewer scenarios. Review and publish each generated draft before selecting it in a campaign.", "Sinh kịch bản nháp đã kiểm tra từ giá trị tham số và mẫu thời tiết. Cartesian dùng mọi tổ hợp; pairwise phủ từng cặp với ít kịch bản hơn. Xem lại và xuất bản mỗi bản nháp trước khi đưa vào campaign.")}</p>
        <div className="team-actions"><label>{t("Base version", "Phiên bản gốc")}<select value={versionNumber} onChange={event => selectVersion(Number(event.target.value))}>{versions.map(item => <option key={item.id} value={item.versionNumber}>v{item.versionNumber} · {item.status}</option>)}</select></label>{button("batch-list", "Load batch history", "Tải lịch sử sinh", async () => setBatches(await service.variants(detail.id, versionNumber)), !versions.length)}</div>
        <div className="team-actions">{button("range-grid", "Use published parameter ranges", "Dùng miền tham số đã xuất bản", loadParameterRanges, !versions.length)}<label>{t("Generation strategy", "Chiến lược sinh")}<select value={variantStrategy} disabled={busy} onChange={event => setVariantStrategy(event.target.value as "cartesian" | "pairwise")}><option value="cartesian">Cartesian · {t("all combinations", "mọi tổ hợp")}</option><option value="pairwise">Pairwise · {t("pair coverage", "phủ từng cặp")}</option></select></label><span>{t("Full Cartesian grid", "Lưới Cartesian đầy đủ")}: {gridSummary.cartesian.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span></div>
        <label>{t("Parameter grid JSON", "JSON lưới tham số")}<textarea className="team-json-editor" rows={7} value={grid} disabled={busy} onChange={event => setGrid(event.target.value)} placeholder={'{"npc_count": [5, 10], "weather.preset": ["ClearNoon", "ClearNight"]}'} /></label>
        <details className="team-subpanel"><summary>{t("Weather axis · optional", "Trục thời tiết · tùy chọn")}</summary><p className="team-help">{t("Select presets to combine with numeric parameters. Leave empty to keep the base version weather. A weather-only grid is supported.", "Chọn thời tiết để kết hợp với tham số số. Để trống giữ thời tiết phiên bản gốc. Có thể sinh chỉ từ trục thời tiết.")}</p><div className="team-weather-axis">{catalog?.weatherPresets.map(preset => <label className="team-tag-chip" key={preset}><input type="checkbox" disabled={busy} checked={gridSummary.weather.includes(preset)} onChange={event => toggleWeatherAxis(preset, event.target.checked)} />{preset}</label>)}</div></details>
        <div className="team-form-grid team-variant-options"><label>{t("Optional name prefix", "Tiền tố tên tùy chọn")}<input value={variantNamePrefix} maxLength={100} disabled={busy} onChange={event => setVariantNamePrefix(event.target.value)} placeholder={detail.name.slice(0,100)} /></label><label>{t("Batch note", "Ghi chú đợt sinh")}<input value={variantNote} maxLength={1000} disabled={busy} onChange={event => setVariantNote(event.target.value)} /></label></div>
        {detail.status === "ARCHIVED" || versions.find(item => item.versionNumber === versionNumber)?.status !== "READY" ? <p className="team-help">{t("Generating variants requires an ACTIVE scenario and a READY base version. Batch history remains available.", "Sinh biến thể cần kịch bản ACTIVE và phiên bản gốc READY. Lịch sử đợt sinh vẫn xem được.")}</p> : null}
        {button("generate", "Generate variants", "Sinh biến thể", async () => { const parsed = parseObject(grid); if (!Object.keys(parsed).length || Object.entries(parsed).some(([key, value]) => !Array.isArray(value) || !value.length || value.some(item => key === "weather.preset" ? typeof item !== "string" || !catalog?.weatherPresets.includes(item) : typeof item !== "number" || !Number.isFinite(item)))) throw new Error(t("Use non-empty numeric arrays for parameters; weather.preset accepts catalog preset names.", "Dùng mảng số không rỗng cho tham số; weather.preset nhận tên thời tiết trong catalogue.")); setBatchResult(await service.generateVariants(detail.id, versionNumber, parsed as Record<string,(number|string)[]>, variantNamePrefix.trim() || undefined, variantNote.trim() || undefined, variantStrategy)); setBatches(await service.variants(detail.id, versionNumber)); await changed(); }, !versions.length || detail.status === "ARCHIVED" || versions.find(item => item.versionNumber === versionNumber)?.status !== "READY", true)}
        {batches.map(batch => <div className="team-batch" key={batch.id}><b>{batch.generatedCount}/{batch.requestedCount} · {batch.strategy ?? "cartesian"}</b><span>{t("Full grid", "Lưới đầy đủ")}: {batch.cartesianCount ?? batch.requestedCount} · {new Date(batch.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}{batch.note && <> · {batch.note}</>}</span>{button(`batch-${batch.id}`, "View generated scenarios", "Xem kịch bản đã sinh", async () => setBatchResult(await service.variantBatch(detail.id, versionNumber, batch.id)))}</div>)}
        {batchResult && <div className="team-result"><h4>{t("Generated draft scenarios", "Các kịch bản nháp đã sinh")}</h4>{batchResult.scenarios.map(item => <button className="team-result-link" key={item.id} disabled={busy} onClick={() => selectScenario(item.id)}>{item.code} · {item.name} · {item.hasDraft ? "DRAFT" : item.status}{item.latestVersionNumber ? ` · v${item.latestVersionNumber}` : ""}</button>)}<pre>{pretty(batchResult)}</pre></div>}
      </>}
      {tab === "imports" && <><p>{t("The original import file and its SHA-256 hash are retained by the backend. Supported formats are canonical JSON and YAML.", "Backend giữ tệp nhập gốc và hash SHA-256. Các định dạng hỗ trợ là JSON và YAML theo schema của dự án.")}</p>{imports.length ? <div className="team-table-scroll"><table className="team-table"><thead><tr><th>{t("File", "Tệp")}</th><th>{t("Format", "Định dạng")}</th><th>{t("Status", "Trạng thái")}</th><th>SHA-256</th></tr></thead><tbody>{imports.map(item => <tr key={item.id}><td>{item.originalFileName}</td><td>{item.format}</td><td>{item.status}</td><td><code>{item.originalHash}</code></td></tr>)}</tbody></table></div> : <p>{t("No import records for this scenario.", "Kịch bản này chưa có lịch sử nhập.")}</p>}</>}
      {tab === "history" && <div aria-busy={historyLoading}><div className="team-actions"><label>{t("History page size", "Số thao tác mỗi trang")}<select value={historyPageSize} disabled={historyLoading} onChange={event => { setHistoryPageSize(Number(event.target.value)); setHistoryPage(1); }}>{[10,20,50,100].map(size => <option key={size}>{size}</option>)}</select></label>{button("history-reload", "Refresh history", "Làm mới lịch sử", async () => setHistory(await service.history(detail.id, historyPage, historyPageSize)))}</div>{historyLoading && <p className="team-loading"><i className="button-spinner" />{t("Loading history…", "Đang tải lịch sử…")}</p>}{history?.items.map(item => <article className="team-history-event" key={item.id}><div><b>{item.action} · {item.entityType}</b><time>{new Date(item.at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time></div><p>{item.actor.displayName}{item.actor.email ? ` · ${item.actor.email}` : ""}{item.versionNumber !== null ? ` · v${item.versionNumber}` : ""}</p>{item.relatedScenario && <button className="btn btn-light" disabled={busy} onClick={() => selectScenario(item.relatedScenario!.id)}>{item.relatedScenario.code} · {item.relatedScenario.name}</button>}<details><summary>{t("Event details", "Chi tiết thao tác")}</summary><pre className="team-mini-json">{pretty(item.details)}</pre></details></article>)}{!historyLoading && !history?.items.length && <p>{t("No recorded activity.", "Chưa có thao tác được ghi.")}</p>}<div className="team-pagination"><span>{history?.totalCount ?? 0} {t("events", "thao tác")}</span><button className="btn btn-light" disabled={historyLoading || historyPage <= 1} onClick={() => setHistoryPage(value => value - 1)}>{t("Previous", "Trước")}</button><span>{historyPage} / {Math.max(1,history?.totalPages ?? 1)}</span><button className="btn btn-light" disabled={historyLoading || historyPage >= (history?.totalPages ?? 1)} onClick={() => setHistoryPage(value => value + 1)}>{t("Next", "Sau")}</button></div></div>}
    </section>}
    {createOpen && <div className="modal-backdrop"><form className="modal team-create-modal" onSubmit={event => void create(event)}>
      <div className="modal-head"><div><h2>{t("Create scenario draft", "Tạo bản nháp kịch bản")}</h2><p>{t("Start from a backend situation template or a blank draft, then configure the map and actors.", "Bắt đầu từ mẫu tình huống backend hoặc bản nháp trống, sau đó cấu hình bản đồ và actor.")}</p></div><button type="button" disabled={busy} onClick={() => setCreateOpen(false)}>×</button></div>
      <fieldset className="team-template-picker" disabled={busy}><legend>{t("Starting situation", "Tình huống khởi đầu")}</legend><label className="team-template-option"><input type="radio" name="template" value="" checked={!createTemplate} onChange={() => setCreateTemplate("")} /><span><b>{t("Blank draft", "Bản nháp trống")}</b><small>{t("Configure a new scenario from its minimal definition.", "Tự cấu hình kịch bản từ định nghĩa tối thiểu.")}</small></span></label>{templates.map(template => <label className={`team-template-option${createTemplate === template.key ? " selected" : ""}`} key={template.key}><input type="radio" name="template" value={template.key} checked={createTemplate === template.key} onChange={() => { const previous = templates.find(item => item.key === createTemplate); if (!createName.trim() || createName === previous?.title) setCreateName(template.title); setCreateTemplate(template.key); setCreateCategory(template.category); }} /><span><b>{template.title}</b><small>{template.summary}</small><small>{template.mapName} · {template.category} · {template.eventTypes.join(", ") || t("No scripted event", "Không có event kịch bản")}</small>{template.reference && <small>{template.reference}</small>}</span></label>)}</fieldset>
      <label>{t("Name", "Tên")}<input name="name" value={createName} onChange={event => setCreateName(event.target.value)} minLength={3} maxLength={120} required disabled={busy} /></label><label>{t("Description", "Mô tả")}<textarea name="description" maxLength={2000} disabled={busy} /></label><label>{t("Category", "Phân loại")}<select name="category" value={createCategory} onChange={event => setCreateCategory(event.target.value)} disabled={busy}>{(catalog?.categories ?? ["free_driving"]).map(item => <option key={item}>{item}</option>)}</select></label><div className="modal-actions"><button type="button" className="btn btn-light" disabled={busy} onClick={() => setCreateOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={busy}>{actions.isPending("create") && <i className="button-spinner" />}{t("Create draft", "Tạo bản nháp")}</button></div>
    </form></div>}
    {importOpen && <div className="modal-backdrop"><form className="modal" onSubmit={event => void importScenario(event)}>
      <div className="modal-head"><div><h2>{t("Import scenario", "Nhập kịch bản")}</h2><p>{t("JSON / YAML · imports remain validated drafts. File size follows the backend configuration.", "JSON / YAML · nhập thành bản nháp đã kiểm tra. Kích thước tệp theo cấu hình backend.")}</p></div><button type="button" disabled={busy} onClick={() => setImportOpen(false)}>×</button></div>
      <label>{t("Format", "Định dạng")}<select value={importFormat} disabled={busy} onChange={event => setImportFormat(event.target.value)}><option value="">{t("Detect from file extension", "Nhận diện theo đuôi tệp")}</option><option value="json">JSON</option><option value="yaml">YAML</option></select></label>
      <label>{t("Scenario file", "Tệp kịch bản")}<input type="file" name="file" accept={importFormat ? undefined : ".json,.yaml,.yml"} required disabled={busy} /></label>
      <label>{t("Optional scenario name", "Tên kịch bản tùy chọn")}<input name="name" maxLength={120} disabled={busy} /></label>
      <label>{t("Optional category override", "Ghi đè phân loại tùy chọn")}<select name="category" disabled={busy}><option value="">{t("Use metadata.category from file", "Dùng metadata.category trong tệp")}</option>{catalog?.categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <p className="team-help">{t("Select a format explicitly for an extensionless or misnamed JSON/YAML file. OpenSCENARIO and CARLA route XML adapters are not available.", "Chọn định dạng cụ thể cho tệp JSON/YAML thiếu đuôi hoặc đặt sai đuôi. Chưa có adapter OpenSCENARIO và CARLA route XML.")}</p>
      <div className="modal-actions"><button type="button" className="btn btn-light" disabled={busy} onClick={() => setImportOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={busy}>{actions.isPending("import") && <i className="button-spinner" />}{t("Import draft", "Nhập bản nháp")}</button></div>
    </form></div>}
    {cloneOpen && detail && <div className="modal-backdrop"><form className="modal" onSubmit={event => void cloneScenario(event)}>
      <div className="modal-head"><div><h2>{t("Clone published version", "Nhân bản phiên bản xuất bản")}</h2><p>{t("Choose any published version, including deprecated versions, as the source of a new draft scenario.", "Chọn bất kỳ phiên bản đã xuất bản, kể cả phiên bản ngừng dùng, làm nguồn cho kịch bản nháp mới.")}</p></div><button type="button" disabled={busy} onClick={() => setCloneOpen(false)}>×</button></div>
      <label>{t("Source version", "Phiên bản nguồn")}<select name="versionNumber" disabled={busy}><option value="">{t("Latest published version", "Phiên bản xuất bản mới nhất")}</option>{versions.map(version => <option key={version.id} value={version.versionNumber}>v{version.versionNumber} · {version.status}</option>)}</select></label>
      <label>{t("New scenario name", "Tên kịch bản mới")}<input name="name" defaultValue={`${detail.name.slice(0, 110)} copy`} minLength={3} maxLength={120} required disabled={busy} /></label>
      <label>{t("Description override (blank keeps source)", "Ghi đè mô tả (để trống giữ nguồn)")}<textarea name="description" defaultValue={detail.description ?? ""} maxLength={2000} disabled={busy} /></label>
      <div className="modal-actions"><button type="button" className="btn btn-light" disabled={busy} onClick={() => setCloneOpen(false)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={busy}>{actions.isPending("clone") && <i className="button-spinner" />}{t("Create cloned draft", "Tạo bản nháp nhân bản")}</button></div>
    </form></div>}
  </div>;
}
