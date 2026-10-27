import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "../localeContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { TeamScenarioService } from "../services/teamScenarios";
import { isTeamDevAuth } from "../services/authConfig";
import { getTokenSession } from "../services/authToken";
import type { TeamApiClient, TeamCatalog, TeamExecutionPackage, TeamMap, TeamObject, TeamPage, TeamReadyVersion } from "../services/teamContracts";
import type { UserRole } from "../types";
import { Icon } from "./Icon";
import "./BackendDataWorkspace.css";

type Health = { status: string; asxTables: number; expectedTables: number; postgres: string };
type BackendUser = { id: string; email: string; displayName: string; role: string; isActive: boolean };
type Filters = { q: string; category: string; map: string; scenarioId: string; latestOnly: boolean; pageSize: number };
const initialFilters: Filters = { q: "", category: "", map: "", scenarioId: "", latestOnly: true, pageSize: 12 };
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BackendDataWorkspace({ client, role, onRefreshSession }: {
  client: TeamApiClient; role: UserRole; onRefreshSession?: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const service = useMemo(() => new TeamScenarioService(client), [client]);
  const actions = useAsyncAction();
  const [tab, setTab] = useState<"ready" | "reference" | "account" | "health">("ready");
  const [form, setForm] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<TeamPage<TeamReadyVersion> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<TeamCatalog | null>(null);
  const [maps, setMaps] = useState<TeamMap[]>([]);
  const [reference, setReference] = useState<"maps" | "catalog" | "schema">("maps");
  const [schema, setSchema] = useState<TeamObject | null>(null);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [pkg, setPackage] = useState<TeamExecutionPackage | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [account, setAccount] = useState<BackendUser | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB") : "—";
  const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
  const run = async (key: string, task: () => Promise<void>) => {
    setError("");
    try { await actions.run(key, task); } catch (reason) { setError(message(reason)); }
  };

  useEffect(() => {
    let active = true;
    void Promise.allSettled([service.catalog(), service.maps()]).then(([categories, locations]) => {
      if (!active) return;
      if (categories.status === "fulfilled") setCatalog(categories.value);
      if (locations.status === "fulfilled") setMaps(locations.value);
      const failed = [categories, locations].find(item => item.status === "rejected");
      if (failed?.status === "rejected") setError(message(failed.reason));
    });
    return () => { active = false; };
  }, [service]);

  useEffect(() => {
    if (tab !== "ready") return;
    let active = true;
    setLoading(true); setError("");
    void service.ready({ ...filters, page }).then(data => { if (active) setRows(data); })
      .catch(reason => { if (active) { setRows(null); setError(message(reason)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [service, tab, filters, page, revision]);

  useEffect(() => {
    if (!selectedVersion) { setPackage(null); return; }
    let active = true;
    setPackageLoading(true); setPackage(null); setError("");
    void service.executionPackage(selectedVersion).then(data => { if (active) setPackage(data); })
      .catch(reason => { if (active) setError(message(reason)); })
      .finally(() => { if (active) setPackageLoading(false); });
    return () => { active = false; };
  }, [service, selectedVersion]);

  useEffect(() => {
    if (tab !== "reference" || reference !== "schema") return;
    let active = true;
    setLoading(true); setError("");
    void service.schema().then(data => { if (active) setSchema(data); })
      .catch(reason => { if (active) setError(message(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [service, tab, reference]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (form.scenarioId.trim() && !guid.test(form.scenarioId.trim())) {
      setError(t("Scenario ID must be a UUID.", "Scenario ID phải là UUID.")); return;
    }
    setError(""); setPage(1); setSelectedVersion("");
    setFilters({ ...form, q: form.q.trim(), scenarioId: form.scenarioId.trim() });
  };
  const inspectAccount = () => run("account", async () => {
    setAccount(await client.request<BackendUser>("/api/v1/auth/me")); setCheckedAt(new Date().toISOString());
  });
  const inspectHealth = () => run("health", async () => {
    setHealth(await client.request<Health>("/api/health/db")); setCheckedAt(new Date().toISOString());
  });
  const spinner = <i className="button-spinner" aria-hidden="true" />;
  const downloadReference = () => run("reference-download", () => client.download(
    `/api/v1/reference/${reference === "schema" ? "scenario-schema" : reference}`,
    `${reference === "schema" ? "scenario-schema" : reference}.json`,
  ));
  const token = getTokenSession();

  return <div className="backend-data-workspace">
    <section className="card bd-intro"><div><span className="bd-eyebrow">AUTOSCENARIOX · {t("BACKEND EXPLORER", "TRA CỨU BACKEND")}</span><h2>{t("Inspect the actual backend contract", "Tra cứu dữ liệu thật từ backend")}</h2><p>{t("Published versions, runnable packages, reference data, account identity and database status are read through Redux Saga.", "Phiên bản đã xuất bản, gói thực thi, dữ liệu tham chiếu, danh tính tài khoản và trạng thái database được đọc qua Redux Saga.")}</p></div><Icon name="activity" size={30} /></section>
    <nav className="bd-tabs" aria-label={t("Backend data sections", "Các mục dữ liệu backend")}>
      {([ ["ready", "READY versions", "Phiên bản READY"], ["reference", "Maps & schema", "Bản đồ & schema"], ["account", "Account & session", "Tài khoản & phiên"], ["health", "Database status", "Trạng thái database"] ] as const).map(([id,en,vi]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setError(""); }}>{t(en,vi)}</button>)}
    </nav>
    {error && <div className="bd-message bd-error" role="alert"><Icon name="warning" size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label={t("Dismiss error", "Đóng lỗi")}>×</button></div>}

    {tab === "ready" && <>
      <form className="card bd-panel bd-filter" onSubmit={apply}>
        <label>{t("Search name or code", "Tìm tên hoặc mã")}<input value={form.q} onChange={event => setForm(current => ({ ...current, q: event.target.value }))} placeholder="SCN-00001" /></label>
        <label>{t("Map", "Bản đồ")}<select value={form.map} onChange={event => setForm(current => ({ ...current, map: event.target.value }))}><option value="">{t("All maps", "Tất cả bản đồ")}</option>{maps.map(map => <option key={map.mapName}>{map.mapName}</option>)}</select></label>
        <label>{t("Category", "Loại scenario")}<select value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}><option value="">{t("All categories", "Tất cả loại")}</option>{catalog?.categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Scenario ID<input value={form.scenarioId} onChange={event => setForm(current => ({ ...current, scenarioId: event.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>
        <label>{t("Page size", "Số dòng")}<select value={form.pageSize} onChange={event => setForm(current => ({ ...current, pageSize: Number(event.target.value) }))}>{[12,25,50,100].map(size => <option key={size}>{size}</option>)}</select></label>
        <label className="bd-check"><input type="checkbox" checked={form.latestOnly} onChange={event => setForm(current => ({ ...current, latestOnly: event.target.checked }))} />{t("Latest READY version only", "Chỉ phiên bản READY mới nhất")}</label>
        <div className="bd-actions"><button className="btn btn-primary" disabled={loading}>{loading ? spinner : <Icon name="search" size={15} />}{t("Apply filters", "Áp dụng bộ lọc")}</button><button type="button" className="btn btn-light" disabled={loading} onClick={() => { setForm(initialFilters); setFilters(initialFilters); setPage(1); setSelectedVersion(""); setRevision(value => value + 1); }}>{t("Reset", "Đặt lại")}</button></div>
      </form>
      <section className="card bd-panel"><div className="bd-heading"><div><h3>{t("Published versions available for handoff", "Phiên bản đã xuất bản để bàn giao")}</h3><p>{t("Turn off latest-only to inspect historical READY versions. An execution package reports whether a version is selectable and its metadata can resolve.", "Bỏ chọn mới nhất để xem các phiên bản READY trong lịch sử. Gói thực thi cho biết phiên bản có thể được chọn và metadata có thể phân giải hay không.")}</p></div><span className="bd-badge">{rows?.totalCount ?? 0} {t("versions", "phiên bản")}</span></div>
        {loading ? <div className="bd-empty" role="status">{spinner} {t("Loading READY versions…", "Đang tải phiên bản READY…")}</div> : <div className="bd-table-scroll"><table><thead><tr>{[t("Scenario", "Scenario"),t("Version", "Phiên bản"),t("Map / weather", "Bản đồ / thời tiết"),t("Actors / events", "Actor / sự kiện"),t("Published", "Xuất bản"),t("Package", "Gói thực thi")].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows?.items.map(row => <tr key={row.scenarioVersionId}><td><b>{row.scenarioName}</b><small>{row.scenarioCode} · {row.category}</small><code>{row.scenarioId}</code></td><td><b>v{row.versionNumber}</b><small>{row.isLatestReady ? t("Latest READY", "READY mới nhất") : t("Historical READY", "READY lịch sử")}</small><code>{row.scenarioVersionId}</code></td><td>{row.mapName ?? "—"}<small>{row.weatherPreset ?? "—"}</small></td><td>{row.actorCount} / {row.eventCount}<small>{row.eventTypes.join(", ") || "—"}</small></td><td>{date(row.publishedAt)}</td><td><button className="btn btn-light" disabled={packageLoading && selectedVersion === row.scenarioVersionId} onClick={() => setSelectedVersion(row.scenarioVersionId)}>{packageLoading && selectedVersion === row.scenarioVersionId ? spinner : <Icon name="eye" size={15} />}{t("Inspect", "Xem gói")}</button></td></tr>)}</tbody></table></div>}
        {!loading && rows?.items.length === 0 && <p className="bd-empty">{t("No READY version matches these filters.", "Không có phiên bản READY khớp bộ lọc.")}</p>}
        <div className="bd-pagination"><button className="btn btn-light" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>← {t("Previous", "Trước")}</button><span>{page} / {Math.max(1,rows?.totalPages ?? 1)}</span><button className="btn btn-light" disabled={loading || page >= (rows?.totalPages ?? 1)} onClick={() => setPage(value => value + 1)}>{t("Next", "Sau")} →</button></div>
      </section>
      {pkg && <section className="card bd-panel"><div className="bd-heading"><div><span className="bd-eyebrow">{pkg.scenarioCode} · v{pkg.versionNumber}</span><h3>{pkg.scenarioName}</h3><p>{t("Runnable describes package metadata, not a live CARLA connection or a completed simulation.", "Runnable mô tả metadata của gói, chưa xác nhận kết nối CARLA hay một lần mô phỏng hoàn tất.")}</p></div><button className="btn btn-primary" disabled={actions.pending} onClick={() => void run("package-download", () => client.download(`/api/v1/scenario-versions/${pkg.scenarioVersionId}/execution-package`, `${pkg.scenarioCode}-v${pkg.versionNumber}-execution-package.json`))}>{actions.isPending("package-download") ? spinner : <Icon name="download" size={15} />}{t("Download package", "Tải gói thực thi")}</button></div>
        <dl className="bd-facts"><div><dt>{t("Metadata runnable", "Metadata chạy được")}</dt><dd>{pkg.runnable ? t("Yes", "Có") : t("No", "Không")}</dd></div><div><dt>{t("Selectable for new campaign", "Chọn được cho campaign mới")}</dt><dd>{pkg.selectableForNewCampaign ? t("Yes", "Có") : t("No", "Không")}</dd></div><div><dt>{t("Lifecycle", "Vòng đời")}</dt><dd>{pkg.scenarioStatus} / {pkg.versionStatus}</dd></div><div><dt>Map / CARLA</dt><dd>{pkg.map.name} / {pkg.map.carlaVersion}</dd></div><div className="bd-wide"><dt>Content hash</dt><dd><code>{pkg.contentHash}</code></dd></div></dl>
        {pkg.issues.length > 0 && <div className="bd-message bd-warning"><ul>{pkg.issues.map((issue,index) => <li key={index}>{issue}</li>)}</ul></div>}
        <details><summary>{t("Resolved spawn locations", "Vị trí spawn đã phân giải")} ({pkg.locations.length})</summary><pre>{pretty(pkg.locations)}</pre></details><details><summary>{t("Parameters", "Tham số")}</summary><pre>{pretty(pkg.parameterValues)}</pre></details><details><summary>{t("Full execution package", "Gói thực thi đầy đủ")}</summary><pre>{pretty(pkg)}</pre></details>
      </section>}
    </>}

    {tab === "reference" && <section className="card bd-panel"><div className="bd-heading"><div><h3>{t("Backend reference data", "Dữ liệu tham chiếu backend")}</h3><p>{t("These values come from backend metadata and its embedded JSON schema. Installed CARLA assets still need runtime validation.", "Các giá trị lấy từ metadata backend và JSON schema nhúng trong backend. Tài nguyên CARLA cài trên máy vẫn cần được kiểm tra khi chạy.")}</p></div><button className="btn btn-light" disabled={actions.pending} onClick={() => void downloadReference()}>{actions.isPending("reference-download") ? spinner : <Icon name="download" size={15} />}{t("Download JSON", "Tải JSON")}</button></div>
      <div className="bd-tabs">{([ ["maps","Maps","Bản đồ"], ["catalog","Value catalogue","Danh mục giá trị"], ["schema","JSON schema","JSON schema"] ] as const).map(([id,en,vi]) => <button key={id} className={reference === id ? "active" : ""} onClick={() => setReference(id)}>{t(en,vi)}</button>)}</div>
      {reference === "maps" && <div className="bd-table-scroll"><table><thead><tr><th>Map</th><th>CARLA</th><th>{t("Spawn points", "Số điểm spawn")}</th><th>{t("Preview path", "Đường dẫn ảnh tham khảo")}</th></tr></thead><tbody>{maps.map(map => <tr key={map.mapName}><td><b>{map.mapName}</b></td><td>{map.carlaVersion}</td><td>{map.spawnPointCount}</td><td><code>{map.previewImagePath ?? "—"}</code></td></tr>)}</tbody></table></div>}
      {reference === "catalog" && catalog && <><p>Schema: <b>{catalog.schemaVersion}</b></p><div className="bd-catalog">{([ ["categories","Categories","Loại scenario"], ["weatherPresets","Weather presets","Mẫu thời tiết"], ["actorTypes","Actor types","Loại actor"], ["eventTypes","Event types","Loại event"], ["triggerTypes","Trigger types","Loại trigger"] ] as const).map(([key,en,vi]) => <article key={key}><h4>{t(en,vi)}</h4><div>{catalog[key].map(value => <code key={value}>{value}</code>)}</div></article>)}</div></>}
      {reference === "schema" && (loading ? <p className="bd-empty">{spinner} {t("Loading schema…", "Đang tải schema…")}</p> : <pre>{pretty(schema)}</pre>)}
    </section>}

    {tab === "account" && <section className="card bd-panel"><div className="bd-heading"><div><h3>{t("Current backend identity", "Danh tính hiện tại từ backend")}</h3><p>{t("Read-only identity from /auth/me. This screen does not edit the account or its persisted role.", "Danh tính chỉ đọc từ /auth/me. Màn hình này không chỉnh sửa tài khoản hay role đã lưu.")}</p></div><button className="btn btn-primary" disabled={actions.pending} onClick={() => void inspectAccount()}>{actions.isPending("account") ? spinner : <Icon name="refresh" size={15} />}{t("Load current account", "Tải tài khoản hiện tại")}</button></div>
      <dl className="bd-facts"><div><dt>{t("Authentication mode", "Chế độ xác thực")}</dt><dd>{isTeamDevAuth ? "Dev" : "Supabase"}</dd></div><div><dt>{t("Effective UI role", "Role hiệu lực trên giao diện")}</dt><dd>{role}</dd></div><div><dt>{t("Token expiration", "Thời điểm token hết hạn")}</dt><dd>{token?.expiresAt ? date(new Date(token.expiresAt).toISOString()) : t("No token in Dev mode", "Dev không dùng token")}</dd></div></dl>
      {isTeamDevAuth ? <div className="bd-message bd-warning">{t("Dev API permissions use the selected X-Asx-Dev-Role header. The role returned by /me is the database role, so these two values can differ without changing the account.", "Quyền API Dev dùng header X-Asx-Dev-Role đã chọn. Role trả về từ /me là role trong database, nên hai giá trị có thể khác nhau mà tài khoản không bị thay đổi.")}</div> : <button className="btn btn-light" disabled={!onRefreshSession || actions.pending || !token?.refreshToken} onClick={() => void run("session-refresh", async () => { await onRefreshSession?.(); })}>{actions.isPending("session-refresh") ? spinner : <Icon name="refresh" size={15} />}{t("Refresh Supabase session", "Làm mới phiên Supabase")}</button>}
      {account && <><dl className="bd-facts"><div><dt>User ID</dt><dd><code>{account.id}</code></dd></div><div><dt>{t("Display name", "Tên hiển thị")}</dt><dd>{account.displayName}</dd></div><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>{t("Database role", "Role trong database")}</dt><dd>{account.role}</dd></div><div><dt>{t("Account active", "Tài khoản hoạt động")}</dt><dd>{account.isActive ? t("Yes", "Có") : t("No", "Không")}</dd></div></dl><details><summary>{t("Full account response", "Phản hồi tài khoản đầy đủ")}</summary><pre>{pretty(account)}</pre></details></>}
    </section>}

    {tab === "health" && <section className="card bd-panel"><div className="bd-heading"><div><h3>{t("Database health reported by the API", "Tình trạng database do API báo cáo")}</h3><p>{t("This checks the backend database connection and table count. It does not probe CARLA or verify every table definition.", "Kiểm tra kết nối database và số lượng bảng của backend. Không kiểm tra CARLA hay xác minh định nghĩa của mọi bảng.")}</p></div><button className="btn btn-primary" disabled={actions.pending} onClick={() => void inspectHealth()}>{actions.isPending("health") ? spinner : <Icon name="activity" size={15} />}{t("Check database", "Kiểm tra database")}</button></div>
      {health ? <><dl className="bd-facts"><div><dt>{t("Backend status", "Trạng thái backend trả về")}</dt><dd><span className={`bd-badge ${health.status === "OK" ? "bd-good" : "bd-warn"}`}>{health.status}</span></dd></div><div><dt>{t("Actual asx tables", "Số bảng asx thực tế")}</dt><dd>{health.asxTables}</dd></div><div><dt>{t("Expected by health endpoint", "Số bảng health endpoint kỳ vọng")}</dt><dd>{health.expectedTables}</dd></div><div className="bd-wide"><dt>PostgreSQL</dt><dd>{health.postgres}</dd></div></dl>{health.status !== "OK" && <div className="bd-message bd-warning">{t("The API returned a schema-count warning. The table counts above are shown unchanged; a count mismatch alone does not identify a missing table. Ask the backend team to compare its migrations and health check.", "API trả cảnh báo số lượng bảng. Các con số phía trên được hiển thị nguyên trạng; chênh lệch số lượng chưa xác định được bảng nào thiếu. Nhóm backend cần đối chiếu migration và phép kiểm tra health.")}</div>}<details><summary>{t("Full health response", "Phản hồi health đầy đủ")}</summary><pre>{pretty(health)}</pre></details></> : <div className="bd-empty">{t("Run the check to see the current database response.", "Bấm kiểm tra để xem phản hồi database hiện tại.")}</div>}
    </section>}
    {checkedAt && (tab === "account" || tab === "health") && <p className="bd-footnote">{t("Last check", "Lần kiểm tra gần nhất")}: {date(checkedAt)}</p>}
  </div>;
}
