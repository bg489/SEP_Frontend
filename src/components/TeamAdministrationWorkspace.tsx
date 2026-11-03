import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AppPage, UserRole } from "../types";
import type { TeamApiClient, TeamPage } from "../services/teamContracts";
import { administrationApi, type ManagedUser, type ManagedWorker, type AdminOracle, type OracleInput, type SystemSettings, type AuditEntry } from "../services/teamAdministration";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useLocale } from "../localeContext";
import { Icon } from "./Icon";
import "./TeamAdministrationWorkspace.css";

const roles = ["SCENARIO_ENGINEER", "TEST_ENGINEER", "TEST_REVIEWER", "ADMIN"];
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const defaultOracle: OracleInput = { name: "", description: "", speedingToleranceKmh: 5, speedingMinDurationS: 2, freezingMaxStillS: 20, ttcThresholdS: 1.5, routeGoalToleranceM: 5 };

export function TeamAdministrationWorkspace({ client, page, role }: { client: TeamApiClient; page: AppPage; role: UserRole }) {
  const api = useMemo(() => administrationApi(client), [client]);
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const actions = useAsyncAction();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<TeamPage<ManagedUser> | null>(null);
  const [workers, setWorkers] = useState<ManagedWorker[]>([]);
  const [oracles, setOracles] = useState<AdminOracle[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [oracle, setOracle] = useState<OracleInput>(defaultOracle);
  const admin = role === "Administrator";

  useEffect(() => {
    if (!admin && page !== "nodes") { setLoading(false); return; }
    let active = true;
    setLoading(true); setError("");
    const load = async () => {
      if (page === "users") { const value = await api.users(query, currentPage); if (active) setUsers(value); }
      if (page === "nodes") { const value = await api.workers(); if (active) setWorkers(value); }
      if (page === "oracles") { const value = await api.oracles(); if (active) setOracles(value); }
      if (page === "analytics") { const value = await api.settings(); if (active) setSettings(value); }
      if (page === "audit") { const value = await api.audit(currentPage); if (active) setAudit(value); }
    };
    const timer = setTimeout(() => { void load().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load administration data."); }).finally(() => { if (active) setLoading(false); }); }, query ? 200 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [api, page, query, currentPage, revision, admin]);

  const mutate = async (key: string, action: () => Promise<unknown>, notice: string) => {
    await actions.run(key, async () => {
      setError(""); setMessage("");
      try { await action(); setMessage(notice); setRevision(value => value + 1); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); }
    });
  };
  const register = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    void mutate("register", async () => {
      await api.registerWorker({ name: String(data.get("name") ?? "").trim(), host: String(data.get("host") ?? "").trim(), rpcPort: Number(data.get("rpcPort")), capacity: Number(data.get("capacity")), carlaVersion: "0.9.16", maps: String(data.get("maps") ?? "").split(",").map(value => value.trim()).filter(Boolean) });
      form.reset();
    }, t("Worker registered. Start its process to receive heartbeats.", "Đã đăng ký worker. Chạy tiến trình worker để gửi heartbeat."));
  };
  const busy = loading || actions.pending;
  if (!admin && page !== "nodes") return <div role="alert">{t("Administrator access is required.", "Chức năng này yêu cầu quyền Admin.")}</div>;

  return <div className="admin-live role-page-stack" aria-busy={busy}>
    <section className="card admin-live-heading"><div><span className="section-kicker">FLOW 5 · {t("PERSISTENT ADMINISTRATION", "QUẢN TRỊ HỆ THỐNG")}</span><h3>{t("Workspace administration", "Quản trị không gian làm việc")}</h3><p>{t("Changes are authorized by the backend and read back from the database.", "Backend kiểm tra quyền và lưu thay đổi vào database.")}</p></div><button className="btn btn-light" disabled={busy} onClick={() => setRevision(value => value + 1)}><Icon name="refresh" size={15} />{t("Refresh", "Tải lại")}</button></section>
    {error && <div className="auth-message auth-error" role="alert">{error}</div>}
    {message && <div className="auth-message" role="status">{message}</div>}
    {loading && <div role="status" className="loading-line"><i className="button-spinner" />{t("Loading administration data…", "Đang tải dữ liệu quản trị…")}</div>}

    {page === "users" && <section className="card admin-live-panel">
      <div className="admin-live-toolbar"><h3>{t("Accounts and roles", "Tài khoản và vai trò")}</h3><label>{t("Search users", "Tìm tài khoản")}<input value={query} onChange={event => { setQuery(event.target.value); setCurrentPage(1); }} placeholder={t("Name or email", "Tên hoặc email")} /></label></div>
      <div className="admin-live-scroll"><table><thead><tr><th>{t("Account", "Tài khoản")}</th><th>{t("Role", "Vai trò")}</th><th>{t("Status", "Trạng thái")}</th><th>{t("Action", "Thao tác")}</th></tr></thead><tbody>{users?.items.map(user => <tr key={user.id}><td><b>{user.displayName}</b><small>{user.email}</small></td><td><select aria-label={`${t("Role for", "Vai trò của")} ${user.email}`} value={user.role} disabled={busy} onChange={event => void mutate(`role-${user.id}`, () => api.updateUser(user.id, { role: event.target.value }), t("Role saved.", "Đã lưu vai trò."))}>{roles.map(value => <option key={value}>{value}</option>)}</select></td><td><span className={`badge ${user.isActive ? "approved" : "draft"}`}>{user.isActive ? t("Active", "Hoạt động") : t("Blocked", "Đã khóa")}</span></td><td><button className="btn btn-light" disabled={busy} onClick={() => void mutate(`status-${user.id}`, () => api.updateUser(user.id, { isActive: !user.isActive }), t("Account access saved.", "Đã lưu quyền truy cập."))}>{user.isActive ? t("Block account", "Khóa tài khoản") : t("Unblock account", "Mở tài khoản")}</button></td></tr>)}</tbody></table></div>
      {!loading && !users?.items.length && <p>{t("No users match this search.", "Không có tài khoản phù hợp.")}</p>}
      <div className="admin-live-toolbar"><span>{users?.totalCount ?? 0} {t("accounts", "tài khoản")}</span><div><button className="btn btn-light" disabled={busy || currentPage <= 1} onClick={() => setCurrentPage(value => value - 1)}>{t("Previous", "Trước")}</button><span> {currentPage} / {Math.max(1, users?.totalPages ?? 1)} </span><button className="btn btn-light" disabled={busy || currentPage >= (users?.totalPages ?? 1)} onClick={() => setCurrentPage(value => value + 1)}>{t("Next", "Sau")}</button></div></div>
    </section>}

    {page === "nodes" && <>
      <section className="card admin-live-panel"><div className="admin-live-toolbar"><h3>{t("Workers and available capacity", "Worker và sức chứa")}</h3><span className="badge approved">CARLA 0.9.16 · Low</span></div>
        <div className="admin-live-scroll"><table><thead><tr><th>Worker</th><th>{t("Connection", "Kết nối")}</th><th>{t("Capacity", "Sức chứa")}</th><th>{t("Heartbeat", "Nhịp kết nối")}</th>{admin && <th>{t("Action", "Thao tác")}</th>}</tr></thead><tbody>{workers.map(worker => <tr key={worker.id}><td><b>{worker.name}</b><small>{worker.host}:{worker.rpcPort}</small><small>{worker.maps.join(", ")}</small></td><td>{worker.health}<small>{worker.lastError}</small></td><td>{worker.activeRuns} / {worker.capacity}<small>{worker.availableCapacity} {t("available", "chỗ trống")}</small></td><td>{date(worker.lastHeartbeatAt)}</td>{admin && <td><button className="btn btn-light" disabled={busy} onClick={() => void mutate(worker.id, () => api.updateWorker(worker, !worker.enabled), t("Worker setting saved.", "Đã lưu cấu hình worker."))}>{worker.enabled ? t("Disable", "Tắt nhận việc") : t("Enable", "Cho nhận việc")}</button></td>}</tr>)}</tbody></table></div>
        {!loading && !workers.length && <p>{t("No worker is registered yet.", "Chưa có worker được đăng ký.")}</p>}
        {admin && <button className="btn btn-light" disabled={busy} onClick={() => void mutate("recover", api.recoverLost, t("Lost worker runs have been checked.", "Đã kiểm tra run của worker mất kết nối."))}>{t("Recover lost worker runs", "Thu hồi run từ worker mất kết nối")}</button>}
      </section>
      {admin && <form className="card admin-live-panel" onSubmit={register}><h3>{t("Register a worker", "Đăng ký worker")}</h3><div className="admin-live-grid"><label>{t("Worker name", "Tên worker")}<input name="name" required maxLength={120} disabled={busy} /></label><label>Host / IP<input name="host" defaultValue="127.0.0.1" required disabled={busy} /></label><label>RPC port<input name="rpcPort" type="number" min={1} max={65535} defaultValue={2000} required disabled={busy} /></label><label>{t("Capacity", "Sức chứa")}<input name="capacity" type="number" min={1} max={16} defaultValue={1} required disabled={busy} /></label><label className="admin-live-wide">{t("Supported maps (comma separated)", "Bản đồ hỗ trợ (cách nhau bằng dấu phẩy)")}<input name="maps" defaultValue="Town01,Town01_Opt,Town02,Town02_Opt,Town03,Town03_Opt,Town04,Town04_Opt,Town05,Town05_Opt,Town10HD,Town10HD_Opt" required disabled={busy} /></label></div><button className="btn btn-primary" disabled={busy}>{actions.isPending("register") && <i className="button-spinner" />}{t("Register worker", "Đăng ký worker")}</button></form>}
      <section className="card admin-live-panel"><h3>{t("Run the external CARLA worker", "Chạy worker CARLA bên ngoài")}</h3><p>{t("Start the API, queue a campaign, then run this command from the backend repository. The worker switches between all twelve maps using the execution package. Every simulation uses Low quality.", "Chạy API, đưa campaign vào hàng đợi, rồi chạy lệnh sau trong repo backend. Worker chọn một trong 12 map theo execution package. Mọi mô phỏng đều dùng Low.")}</p><pre className="admin-live-code">{'.\\Start-ASX-Worker.bat --carla-root "C:\\Users\\admin\\Downloads\\CARLA_0.9.16"'}</pre><p>{t("The web page cannot launch processes on another computer. Worker health comes from its actual heartbeat.", "Trang web không tự mở tiến trình trên máy khác. Sức khỏe worker được xác định từ heartbeat thực tế.")}</p></section>
    </>}

    {page === "oracles" && <>
      <section className="card admin-live-panel"><h3>{t("Immutable Oracle versions", "Phiên bản Oracle bất biến")}</h3><div className="admin-live-scroll"><table><thead><tr><th>{t("Configuration", "Cấu hình")}</th><th>{t("Thresholds", "Ngưỡng")}</th><th>{t("Action", "Thao tác")}</th></tr></thead><tbody>{oracles.map(config => <tr key={config.id}><td><b>{config.name} · v{config.version}</b><small>{config.description}</small><small>{date(config.createdAt)}</small></td><td>{t("Speed tolerance", "Dung sai tốc độ")}: {config.speedingToleranceKmh} km/h<small>Freeze: {config.freezingMaxStillS}s · TTC: {config.ttcThresholdS}s</small></td><td><button className="btn btn-light" disabled={busy || config.isActive} onClick={() => void mutate(config.id, () => api.activateOracle(config.id), t("Default configuration activated.", "Đã chọn cấu hình mặc định."))}>{config.isActive ? t("Active", "Đang dùng") : t("Activate", "Chọn mặc định")}</button></td></tr>)}</tbody></table></div></section>
      <form className="card admin-live-panel" onSubmit={event => { event.preventDefault(); void mutate("oracle", async () => { await api.createOracle(oracle); setOracle(defaultOracle); }, t("A new Oracle version was created.", "Đã tạo phiên bản Oracle mới.")); }}><h3>{t("Create a new version", "Tạo phiên bản mới")}</h3><p>{t("Existing evaluations keep their original configuration. New defaults affect future runs only.", "Kết quả cũ giữ nguyên cấu hình đã dùng. Mặc định mới chỉ áp dụng cho run về sau.")}</p><div className="admin-live-grid"><label>{t("Configuration name", "Tên cấu hình")}<input required maxLength={120} value={oracle.name} disabled={busy} onChange={event => setOracle(value => ({ ...value, name: event.target.value }))} /></label><label>{t("Description", "Mô tả")}<input maxLength={1000} value={oracle.description ?? ""} disabled={busy} onChange={event => setOracle(value => ({ ...value, description: event.target.value }))} /></label>{([
        ["speedingToleranceKmh", t("Speed tolerance (km/h)", "Dung sai tốc độ (km/h)"), 0, 100], ["speedingMinDurationS", t("Speeding duration (s)", "Thời gian vượt tốc độ (s)"), 0.1, 3600], ["freezingMaxStillS", t("Maximum stationary time (s)", "Thời gian đứng yên tối đa (s)"), 0.1, 3600], ["ttcThresholdS", "TTC (s)", 0.1, 60], ["routeGoalToleranceM", t("Goal tolerance (m)", "Dung sai đích đến (m)"), 0.1, 100],
      ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" step="0.1" min={min} max={max} required value={oracle[key]} disabled={busy} onChange={event => setOracle(value => ({ ...value, [key]: Number(event.target.value) }))} /></label>)}</div><button className="btn btn-primary" disabled={busy}>{actions.isPending("oracle") && <i className="button-spinner" />}{t("Create version", "Tạo phiên bản")}</button></form>
    </>}

    {page === "analytics" && settings && <form className="card admin-live-panel" onSubmit={event => { event.preventDefault(); void mutate("settings", () => api.saveSettings(settings), t("System settings saved.", "Đã lưu cài đặt hệ thống.")); }}><h3>{t("Similarity and evidence retention", "Độ tương đồng và thời hạn lưu bằng chứng")}</h3><div className="admin-live-grid"><label>{t("Similarity warning (%)", "Cảnh báo tương đồng (%)")}<input type="number" min={0} max={100} required value={settings.similarityWarningPercent} disabled={busy} onChange={event => setSettings(value => value && ({ ...value, similarityWarningPercent: Number(event.target.value) }))} /></label><label>{t("Similarity upper threshold (%)", "Ngưỡng tương đồng trên (%)")}<input type="number" min={settings.similarityWarningPercent} max={100} required value={settings.similarityBlockPercent} disabled={busy} onChange={event => setSettings(value => value && ({ ...value, similarityBlockPercent: Number(event.target.value) }))} /></label><label>{t("Retention days", "Số ngày lưu bằng chứng")}<input type="number" min={1} max={3650} required value={settings.retentionDays} disabled={busy} onChange={event => setSettings(value => value && ({ ...value, retentionDays: Number(event.target.value) }))} /></label><label className="ops-check"><input type="checkbox" checked={settings.retentionEnabled} disabled={busy} onChange={event => setSettings(value => value && ({ ...value, retentionEnabled: event.target.checked }))} />{t("Enable retention policy", "Bật chính sách lưu trữ")}</label></div><p>{t("The policy is saved. Referenced evidence is protected; saving a policy does not delete run artifacts.", "Chính sách được lưu lại. Bằng chứng đang được tham chiếu được bảo vệ; lưu chính sách không xóa artifact của run.")}</p><button className="btn btn-primary" disabled={busy}>{actions.isPending("settings") && <i className="button-spinner" />}{t("Save settings", "Lưu cài đặt")}</button></form>}

    {page === "audit" && <section className="card admin-live-panel"><h3>{t("Database audit history", "Lịch sử thao tác từ database")}</h3><div className="admin-live-scroll"><table><thead><tr><th>{t("Time", "Thời gian")}</th><th>{t("Action", "Thao tác")}</th><th>{t("Entity", "Đối tượng")}</th><th>{t("Details", "Chi tiết")}</th></tr></thead><tbody>{audit.map(entry => <tr key={entry.id}><td>{date(entry.createdAt)}</td><td>{entry.action}<small>{entry.actorId}</small></td><td>{entry.entityType}<small>{entry.entityId}</small></td><td><details><summary>{t("View details", "Xem chi tiết")}</summary><pre className="admin-live-code">{JSON.stringify(entry.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div>{!loading && !audit.length && <p>{t("No audit events on this page.", "Trang này không có sự kiện.")}</p>}<div className="admin-live-toolbar"><button className="btn btn-light" disabled={busy || currentPage <= 1} onClick={() => setCurrentPage(value => value - 1)}>{t("Previous", "Trước")}</button><span>{currentPage}</span><button className="btn btn-light" disabled={busy || audit.length < 50} onClick={() => setCurrentPage(value => value + 1)}>{t("Next", "Sau")}</button></div></section>}
  </div>;
}
