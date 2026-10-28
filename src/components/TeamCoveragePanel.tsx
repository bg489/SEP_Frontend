import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../localeContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { TeamApiClient } from "../services/teamContracts";
import { coverageAxis, coverageCellKey, coverageMatrix, coverageValues, NO_COVERAGE_EVENT, referenceApi,
  type CoverageDimension, type TeamCoverage } from "../services/teamReferenceData";
import { Icon } from "./Icon";
import "./TeamCoveragePanel.css";

export function TeamCoveragePanel({ client }: { client: TeamApiClient }) {
  const { locale } = useLocale(), vi = locale === "vi";
  const t = (en: string, translated: string) => vi ? translated : en;
  const api = useMemo(() => referenceApi(client), [client]), actions = useAsyncAction();
  const [scope, setScope] = useState<"latest" | "all">("latest"), [rows, setRows] = useState<CoverageDimension>("map"), [columns, setColumns] = useState<CoverageDimension>("weather");
  const [data, setData] = useState<TeamCoverage | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState<[string, string] | null>(null), [query, setQuery] = useState("");
  const dimensions: [CoverageDimension, string, string][] = [["map", "Map", "Bản đồ"], ["weather", "Weather", "Thời tiết"], ["category", "Category", "Loại scenario"], ["event", "Event type", "Loại sự kiện"]];
  const dimensionLabel = (value: CoverageDimension) => { const item = dimensions.find(([key]) => key === value)!; return t(item[1], item[2]); };
  const valueLabel = (value: string) => value === NO_COVERAGE_EVENT ? t("No events", "Không có sự kiện") : value;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setData(null); setSelected(null);
    void api.coverage(scope).then(value => { if (active) setData(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, scope, revision]);

  const current = data?.scope === scope ? data : null;
  const matrix = useMemo(() => current ? coverageMatrix(current, rows, columns) : null, [current, rows, columns]);
  const cellItems = matrix && selected ? matrix.cells.get(coverageCellKey(...selected)) ?? [] : current?.items ?? [];
  const matching = cellItems.filter(item => `${item.name} ${item.code} ${item.category} ${item.mapName ?? ""} ${item.weatherPreset ?? ""} ${item.eventTypes.join(" ")} ${item.scenarioVersionId}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const run = async (key: string, task: () => Promise<void>) => {
    setError(""); try { await actions.run(key, task); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const spinner = <i className="button-spinner" aria-hidden="true" />;
  const bucket = (count: number) => count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;

  return <div className="team-coverage-workspace">
    <section className="card tc-intro"><div><span className="tc-eyebrow">AUTOSCENARIOX · {t("SCENARIO COVERAGE", "ĐỘ BAO PHỦ KỊCH BẢN")}</span><h2>{t("Find gaps in your READY library", "Tìm khoảng trống trong thư viện READY")}</h2><p>{t("Compare map, weather, category and event combinations using published versions from the backend. This measures configuration coverage, not test execution or safety performance.", "So sánh tổ hợp bản đồ, thời tiết, loại scenario và sự kiện từ phiên bản backend đã xuất bản. Đây là độ bao phủ cấu hình, không phải độ bao phủ thực thi hay kết quả an toàn.")}</p></div><Icon name="scenarios" size={28} /></section>
    <section className="card tc-controls">
      <label>{t("Versions", "Phiên bản")}<select value={scope} disabled={actions.pending} onChange={event => setScope(event.target.value as "latest" | "all")}><option value="latest">{t("Latest READY of each ACTIVE scenario", "READY mới nhất của từng scenario ACTIVE")}</option><option value="all">{t("All READY versions of ACTIVE scenarios", "Tất cả READY của các scenario ACTIVE")}</option></select></label>
      <label>{t("Rows", "Hàng")}<select value={rows} onChange={event => { const next = event.target.value as CoverageDimension; setRows(next); if (next === columns) setColumns(rows); setSelected(null); }}>{dimensions.map(([value,en,translated]) => <option key={value} value={value}>{t(en,translated)}</option>)}</select></label>
      <label>{t("Columns", "Cột")}<select value={columns} onChange={event => { const next = event.target.value as CoverageDimension; setColumns(next); if (next === rows) setRows(columns); setSelected(null); }}>{dimensions.map(([value,en,translated]) => <option key={value} value={value}>{t(en,translated)}</option>)}</select></label>
      <button type="button" className="btn btn-light" disabled={loading} onClick={() => setRevision(n => n + 1)}>{loading ? spinner : <Icon name="refresh" size={15} />}{t("Refresh", "Tải lại")}</button>
    </section>
    {error && <div className="tc-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRevision(n => n + 1)}>{t("Retry", "Thử lại")}</button></div>}
    {loading && <div className="card tc-loading" role="status">{spinner} {t("Loading coverage…", "Đang tải độ bao phủ…")}</div>}
    {current && matrix && <>
      <div className="tc-stats"><article className="card"><span>{t("READY scenarios", "Scenario READY")}</span><b>{current.scenarioCount}</b><small>{current.versionCount} {t("READY versions", "phiên bản READY")}</small></article><article className="card"><span>{dimensionLabel(rows)} × {dimensionLabel(columns)}</span><b>{new Intl.NumberFormat(vi ? "vi-VN" : "en-GB", { style: "percent", maximumFractionDigits: 1 }).format(matrix.ratio)}</b><small>{matrix.covered} / {matrix.combinations} {t("combinations represented", "tổ hợp được bao phủ")}</small></article>{dimensions.map(([dimension,en,translated]) => {
        const axis = coverageAxis(current, dimension).filter(value => value !== NO_COVERAGE_EVENT && value !== "—"), used = new Set(current.items.flatMap(item => coverageValues(item, dimension)));
        return <article className="card compact" key={dimension}><span>{t(en,translated)}</span><b>{axis.filter(value => used.has(value)).length}<em> / {axis.length}</em></b><small>{t("catalogue values represented", "giá trị danh mục đã có")}</small></article>;
      })}</div>
      <section className="card tc-panel"><div className="tc-heading"><div><h3>{dimensionLabel(rows)} × {dimensionLabel(columns)}</h3><p>{t("Select a cell to inspect its versions, including empty combinations. Each version with several event types contributes once to each matching event type.", "Chọn ô để xem các phiên bản hoặc tổ hợp đang trống. Một phiên bản có nhiều loại sự kiện được tính một lần cho mỗi loại tương ứng.")}</p></div><div className="tc-legend">{[0,1,2,3,4].map(value => <span key={value}><i className={`tc-b${value}`} />{value === 0 ? t("Gap", "Trống") : value === 3 ? "3–4" : value === 4 ? "5+" : value}</span>)}</div></div>
        {current.items.length === 0 && <p className="tc-note">{t("No READY versions in this scope yet. The matrix still shows catalogue combinations that have no scenarios.", "Chưa có phiên bản READY trong phạm vi này. Ma trận vẫn hiển thị các tổ hợp danh mục chưa có scenario.")}</p>}
        <div className="tc-matrix-scroll"><table className="tc-matrix"><thead><tr><th>{dimensionLabel(rows)} / {dimensionLabel(columns)}</th>{matrix.columnValues.map(value => <th key={value}><span>{valueLabel(value)}</span></th>)}<th>{t("Versions", "Phiên bản")}</th></tr></thead><tbody>{matrix.rowValues.map(row => <tr key={row}><th>{valueLabel(row)}</th>{matrix.columnValues.map(column => {
          const count = matrix.cells.get(coverageCellKey(row,column))?.length ?? 0, active = selected?.[0] === row && selected[1] === column;
          return <td key={column}><button type="button" className={`tc-cell tc-b${bucket(count)}${active ? " selected" : ""}`} aria-pressed={active} aria-label={`${valueLabel(row)} × ${valueLabel(column)}: ${count} ${t("READY versions", "phiên bản READY")}`} onClick={() => { setSelected([row,column]); setQuery(""); }}>{count || "·"}</button></td>;
        })}<td className="tc-total">{current.items.filter(item => coverageValues(item,rows).includes(row)).length}</td></tr>)}</tbody></table></div>
      </section>
      <section className="card tc-panel"><div className="tc-heading"><div><h3>{selected ? `${valueLabel(selected[0])} × ${valueLabel(selected[1])}` : t("All versions in this scope", "Tất cả phiên bản trong phạm vi")}</h3><p>{cellItems.length} {t("versions in selection", "phiên bản được chọn")}</p></div>{selected && <button type="button" className="btn btn-light" onClick={() => setSelected(null)}>{t("Show all", "Xem tất cả")}</button>}</div>
        <label className="tc-search">{t("Search selected versions", "Tìm trong các phiên bản được chọn")}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Code, name, event or version UUID", "Mã, tên, sự kiện hoặc UUID phiên bản")} /></label>
        {matching.length ? <div className="tc-table-scroll"><table><thead><tr><th>{t("Scenario", "Scenario")}</th><th>{t("Version", "Phiên bản")}</th><th>Map / {t("Weather", "Thời tiết")}</th><th>{t("Events", "Sự kiện")}</th><th>{t("Handoff", "Bàn giao")}</th></tr></thead><tbody>{matching.map(item => <tr key={item.scenarioVersionId}><td><b>{item.name}</b><small>{item.code} · {item.category}</small><code>{item.scenarioId}</code></td><td>v{item.versionNumber}<small>{item.isLatestReady ? t("Latest READY", "READY mới nhất") : t("Historical READY", "READY lịch sử")}</small><code>{item.scenarioVersionId}</code></td><td>{item.mapName ?? "—"}<small>{item.weatherPreset ?? "—"}</small></td><td>{item.eventTypes.join(", ") || t("No events", "Không có sự kiện")}</td><td><button type="button" className="btn btn-light" disabled={actions.pending} onClick={() => void run(`package:${item.scenarioVersionId}`, () => client.download(`/api/v1/scenario-versions/${item.scenarioVersionId}/execution-package`, `${item.code}-v${item.versionNumber}-execution-package.json`))}>{actions.isPending(`package:${item.scenarioVersionId}`) ? spinner : <Icon name="download" size={14} />}{t("Execution package", "Gói thực thi")}</button></td></tr>)}</tbody></table></div> : <p className="tc-empty">{query ? t("No version matches this search.", "Không có phiên bản khớp tìm kiếm.") : t("This combination has no READY version. Create or publish a suitable scenario to fill this gap.", "Tổ hợp này chưa có phiên bản READY. Tạo hoặc xuất bản scenario phù hợp để bổ sung.")}</p>}
        <details><summary>{t("Full backend coverage response", "Phản hồi coverage đầy đủ từ backend")}</summary><pre>{JSON.stringify(current,null,2)}</pre></details>
        <button type="button" className="btn btn-light" disabled={actions.pending} onClick={() => void run("coverage-download", () => client.download(`/api/v1/coverage?scope=${scope}`, `scenario-coverage-${scope}.json`))}>{actions.isPending("coverage-download") ? spinner : <Icon name="download" size={14} />}{t("Download coverage JSON", "Tải JSON coverage")}</button>
      </section>
    </>}
  </div>;
}
