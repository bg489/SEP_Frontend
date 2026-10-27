import { useLocale } from "../localeContext";
import { Icon, type IconName } from "./Icon";
import type { AppPage, Campaign, OverviewData, Scenario, UserRole } from "../types";
import "./TeamOverview.css";

type Props = {
  overview: OverviewData;
  scenarios: Scenario[];
  campaigns: Campaign[];
  role: UserRole;
  onNavigate: (page: AppPage) => void;
  onScenario: (scenario: Scenario) => void;
};

/** A presentation of API-provided values, without simulated health or growth metrics. */
export function TeamOverview({ overview, scenarios, campaigns, role, onNavigate, onScenario }: Props) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const canAuthor = role === "Scenario Engineer" || role === "Administrator";
  const canRun = role === "Test Engineer" || role === "Administrator";
  const number = (value: number) => Number.isFinite(value) ? value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US") : "—";
  const weekly = overview.weeklyRuns.map((value, index) => ({
    value: Number.isFinite(value) && value >= 0 ? value : 0,
    label: overview.weeklyLabels[index] ?? String(index + 1),
  }));
  const weeklyTotal = weekly.reduce((sum, item) => sum + item.value, 0);
  const weeklyMax = Math.max(1, ...weekly.map(item => item.value));
  const primaryPage: AppPage = canAuthor ? "scenarios" : canRun ? "campaigns" : "run-detail";
  const primaryLabel = canAuthor ? t("Open scenario library", "Mở kho kịch bản") : canRun ? t("Open campaigns", "Mở chiến dịch") : t("Inspect run results", "Xem kết quả chạy");
  const currentCampaigns = [...campaigns].sort((a, b) => {
    const active = (value: Campaign) => value.status === "Running" ? 2 : value.status === "Queued" ? 1 : 0;
    return active(b) - active(a) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  }).slice(0, 4);
  const statusLabel = (value: string) => {
    if (locale !== "vi") return value;
    return ({ Draft: "Bản nháp", Active: "Đã xuất bản", Approved: "Đã xuất bản", Archived: "Đã lưu trữ", Queued: "Chờ chạy", Running: "Đang chạy", Completed: "Hoàn tất", Failed: "Thất bại", Cancelled: "Đã hủy", "Needs review": "Cần xem lại" } as Record<string,string>)[value] ?? value;
  };
  const dateLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  };
  const metrics: { icon: IconName; title: string; value: string; note: string; tone: string }[] = [
    { icon: "scenarios", title: canAuthor ? t("Repository scenarios", "Kịch bản trong kho") : t("Available READY scenarios", "Kịch bản READY khả dụng"), value: number(overview.totalScenarios), note: canAuthor ? t("Active scenario profiles", "Hồ sơ kịch bản đang hoạt động") : t("Published versions available to your role", "Phiên bản xuất bản mà vai trò có thể xem"), tone: "coral" },
    { icon: "play", title: t("Running campaigns", "Chiến dịch đang chạy"), value: number(overview.activeCampaigns), note: t("Current backend campaign status", "Trạng thái chiến dịch từ backend"), tone: "yellow" },
    { icon: "shield", title: t("Recorded pass rate", "Tỷ lệ đạt đã ghi nhận"), value: Number.isFinite(overview.passRate) ? `${number(overview.passRate)}%` : "—", note: t("Calculated from recorded verdicts", "Tính từ kết luận chạy đã lưu"), tone: "mint" },
    { icon: "activity", title: t("Completed runs this week", "Lượt hoàn tất trong tuần"), value: number(weeklyTotal), note: t("Total in the activity chart below", "Tổng số trong biểu đồ hoạt động"), tone: "blue" },
  ];

  return <div className="team-overview">
    <section className="team-overview-hero">
      <div className="team-overview-hero-copy"><span className="team-overview-eyebrow">AUTOSCENARIOX · {t("WORKSPACE OVERVIEW", "TỔNG QUAN HỆ THỐNG")}</span><h2>{t("From scenario to evidence.", "Từ kịch bản đến bằng chứng.")}</h2><p>{t("Follow scenario definitions, campaign execution and recorded results from the team backend in one place.", "Theo dõi cấu hình kịch bản, thực thi chiến dịch và kết quả đã lưu từ backend của nhóm tại cùng một nơi.")}</p><button className="btn btn-primary" onClick={() => onNavigate(primaryPage)}>{primaryLabel}<Icon name="arrow-right" size={16} /></button></div>
      <div className="team-overview-process" aria-label={t("Scenario workflow", "Quy trình kịch bản")}>{([ ["scenarios", "Design", "Thiết kế"], ["circle-check", "Validate", "Kiểm tra"], ["play", "Execute", "Thực thi"] ] as const).map(([icon,en,vi],index) => <div key={en}><span className="team-overview-process-icon"><Icon name={icon} size={24} /></span><small>0{index + 1}</small><b>{t(en,vi)}</b></div>)}</div>
    </section>

    <div className="team-overview-metrics">{metrics.map(metric => <section className="card team-overview-metric" key={metric.title}><span className={`team-overview-metric-icon ${metric.tone}`}><Icon name={metric.icon} size={20} /></span><small>{metric.title}</small><strong>{metric.value}</strong><p>{metric.note}</p></section>)}</div>

    <div className="team-overview-columns">
      <section className="card team-overview-panel"><div className="team-overview-panel-heading"><div><span className="team-overview-eyebrow">{t("EXECUTION ACTIVITY", "HOẠT ĐỘNG THỰC THI")}</span><h3>{t("Recorded weekly runs", "Lượt chạy được ghi nhận trong tuần")}</h3></div><span className="team-overview-total">{number(weeklyTotal)} {t("runs", "lượt")}</span></div>
        {weekly.length ? <><div className="team-overview-chart" role="img" aria-label={weekly.map(item => `${item.label}: ${item.value}`).join("; ")}>{weekly.map((item,index) => <div className="team-overview-chart-column" key={`${item.label}:${index}`}><span className="team-overview-chart-value">{number(item.value)}</span><div className="team-overview-bar-track"><i style={{ height: `${item.value / weeklyMax * 100}%` }} /></div><span className="team-overview-chart-label">{item.label}</span></div>)}</div>{weeklyTotal === 0 && <p className="team-overview-empty-note">{t("No completed runs were recorded in this period.", "Chưa ghi nhận lượt chạy hoàn tất trong giai đoạn này.")}</p>}</> : <div className="team-overview-empty"><Icon name="activity" size={22} /><p>{t("Weekly activity is not available yet.", "Chưa có dữ liệu hoạt động trong tuần.")}</p></div>}
        <p className="team-overview-panel-note">{t("Counts use the run completion dates returned by the API.", "Số liệu dựa trên ngày hoàn tất của lượt chạy do API trả về.")}</p>
      </section>
      <section className="card team-overview-panel"><div className="team-overview-panel-heading"><div><span className="team-overview-eyebrow">{t("CAMPAIGN SNAPSHOT", "TỔNG QUAN CHIẾN DỊCH")}</span><h3>{t("Current campaigns", "Chiến dịch hiện tại")}</h3></div>{canRun && <button className="team-overview-text-link" onClick={() => onNavigate("campaigns")}>{t("View all", "Xem tất cả")}<Icon name="arrow-right" size={14} /></button>}</div>
        {currentCampaigns.length ? <div className="team-overview-campaign-list">{currentCampaigns.map(campaign => <article key={campaign.id}><div className="team-overview-campaign-title"><b>{campaign.name}</b><span className={`team-overview-status status-${campaign.status.toLowerCase().replaceAll(" ", "-")}`}>{statusLabel(campaign.status)}</span></div><p>{campaign.scenarioIds.length} {t("scenario versions", "phiên bản kịch bản")} · {campaign.strategy}</p>{Number.isFinite(campaign.progress) && <div className="team-overview-progress-row"><div className="team-overview-progress"><i style={{ width: `${Math.min(100, Math.max(0, campaign.progress))}%` }} /></div><small>{number(campaign.progress)}%</small></div>}</article>)}</div> : <div className="team-overview-empty"><Icon name="campaigns" size={24} /><p>{t("No campaigns have been created yet.", "Chưa tạo chiến dịch nào.")}</p>{canRun && <button className="team-overview-text-link" onClick={() => onNavigate("campaigns")}>{t("Build a campaign", "Tạo chiến dịch")}<Icon name="arrow-right" size={14} /></button>}</div>}
      </section>
    </div>

    <section className="card team-overview-panel"><div className="team-overview-panel-heading"><div><span className="team-overview-eyebrow">{t("SCENARIO LIBRARY", "KHO KỊCH BẢN")}</span><h3>{t("Available scenario definitions", "Cấu hình kịch bản khả dụng")}</h3></div>{canAuthor && <button className="team-overview-text-link" onClick={() => onNavigate("scenarios")}>{t("Open library", "Mở thư viện")}<Icon name="arrow-right" size={14} /></button>}</div><div className="team-overview-table-scroll"><table className="team-overview-table"><thead><tr><th>{t("Scenario", "Kịch bản")}</th><th>{t("Map", "Bản đồ")}</th><th>{t("Weather", "Thời tiết")}</th><th>{t("Version", "Phiên bản")}</th><th>{t("Status", "Trạng thái")}</th></tr></thead><tbody>{scenarios.slice(0, 5).map(scenario => <tr key={scenario.id}><td>{canAuthor ? <button className="team-overview-scenario-link" onClick={() => onScenario(scenario)}>{scenario.name}<Icon name="arrow-right" size={14} /></button> : <b>{scenario.name}</b>}<small>{scenario.category}</small></td><td>{scenario.map || "—"}</td><td>{scenario.weather || "—"}</td><td>{scenario.version || "—"}</td><td><span className={`team-overview-status status-${scenario.status.toLowerCase()}`}>{statusLabel(scenario.status)}</span></td></tr>)}</tbody></table></div>{!scenarios.length && <div className="team-overview-empty"><Icon name="scenarios" size={22} /><p>{t("No scenario definitions are available to this role.", "Chưa có cấu hình kịch bản khả dụng với vai trò này.")}</p></div>}</section>

    <div className="team-overview-columns team-overview-bottom"><section className="card team-overview-panel"><div className="team-overview-panel-heading"><div><span className="team-overview-eyebrow">{t("RECENT RECORDS", "BẢN GHI GẦN ĐÂY")}</span><h3>{t("Workspace activity", "Hoạt động hệ thống")}</h3></div><Icon name="clock" size={19} /></div>{overview.recentActivity.length ? <ol className="team-overview-activity">{overview.recentActivity.slice(0, 5).map(item => <li key={item.id}><span className={`team-overview-activity-dot ${item.type}`} /><div><b>{item.title}</b><p>{item.detail}</p><time dateTime={item.time}>{dateLabel(item.time)}</time></div></li>)}</ol> : <p className="team-overview-empty-note">{t("The API has no recent activity records yet.", "API chưa có bản ghi hoạt động gần đây.")}</p>}</section>
      <aside className="team-overview-context"><span className="team-overview-context-icon"><Icon name="link" size={22} /></span><h3>{t("Understand the data", "Hiểu nguồn dữ liệu")}</h3><p>{t("Scenario, campaign and run summaries above use the team API. They do not measure the simulator connection.", "Tổng hợp kịch bản, chiến dịch và lượt chạy ở trên lấy từ API của nhóm. Các số liệu này không đo kết nối tới trình mô phỏng.")}</p><div><b>{t("Worker health", "Tình trạng worker")}</b><span>{t("Not exposed by the current API", "API hiện tại chưa cung cấp")}</span></div><div><b>{t("Failure clustering", "Phân cụm lỗi")}</b><span>{t("Campaign-scoped Oracle evidence and report workflow", "Bằng chứng Oracle và quy trình báo cáo theo chiến dịch")}</span></div><button className="team-overview-text-link" onClick={() => onNavigate("coverage")}>{t("Explore scenario coverage", "Xem độ bao phủ kịch bản")}<Icon name="arrow-right" size={14} /></button><button className="team-overview-text-link" onClick={() => onNavigate("failures")}>{t("Open failure analysis", "Mở phân tích lỗi")}<Icon name="arrow-right" size={14} /></button>{canRun && <button className="team-overview-text-link" onClick={() => onNavigate("execution")}>{t("Inspect execution queue", "Xem hàng đợi thực thi")}<Icon name="arrow-right" size={14} /></button>}</aside></div>
  </div>;
}
