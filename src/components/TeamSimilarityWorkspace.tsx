import { useEffect, useMemo, useState } from "react";
import type { TeamApiClient, TeamReadyVersion } from "../services/teamContracts";
import { TeamScenarioService } from "../services/teamScenarios";
import { similarityApi, type SimilarityResult } from "../services/teamSimilarity";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useLocale } from "../localeContext";

export function TeamSimilarityWorkspace({ client }: { client: TeamApiClient }) {
  const api = useMemo(() => similarityApi(client), [client]);
  const scenarios = useMemo(() => new TeamScenarioService(client), [client]);
  const { locale } = useLocale(); const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const [versions, setVersions] = useState<TeamReadyVersion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState(""); const [method, setMethod] = useState<"gower" | "dtw">("gower");
  const [threshold, setThreshold] = useState(0.25); const [result, setResult] = useState<SimilarityResult | null>(null);
  const [savedId, setSavedId] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const actions = useAsyncAction();
  useEffect(() => {
    let alive = true; setLoading(true);
    void scenarios.allReady().then(data => { if (alive) setVersions(data); }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "Cannot load versions."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [scenarios]);
  const run = (key: string, work: () => Promise<SimilarityResult>) => void actions.run(key, async () => {
    setError(""); try { const value = await work(); setResult(value); setSavedId(value.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Comparison failed."); }
  });
  const visible = versions.filter(item => `${item.scenarioCode} ${item.scenarioName} ${item.mapName} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="role-page-stack admin-live" aria-busy={loading || actions.pending}>
    <section className="card admin-live-panel"><small className="section-kicker">FLOW 2 · GOWER / DTW</small><h3>{t("Scenario similarity and groups", "So sánh và gom nhóm kịch bản")}</h3><p>{t("Compare immutable READY versions. Results and their source version IDs are saved by the backend.", "So sánh các phiên bản READY bất biến. Backend lưu kết quả cùng ID phiên bản nguồn.")}</p>
      {error && <div className="auth-message auth-error" role="alert">{error}</div>}{loading && <p role="status">{t("Loading READY versions…", "Đang tải phiên bản READY…")}</p>}
      <div className="admin-live-grid"><label>{t("Search versions", "Tìm phiên bản")}<input value={query} onChange={event => setQuery(event.target.value)} /></label><label>{t("Method", "Phương pháp")}<select value={method} disabled={actions.pending} onChange={event => setMethod(event.target.value as "gower" | "dtw")}><option value="gower">Gower</option><option value="dtw">DTW</option></select></label><label>{t("Grouping distance threshold", "Ngưỡng khoảng cách gom nhóm")}<input type="number" min={0} max={1} step={0.05} value={threshold} disabled={actions.pending} onChange={event => setThreshold(Number(event.target.value))} /></label><div><p>{selected.length} / 100 {t("versions selected", "phiên bản đã chọn")}</p><button className="btn btn-primary" disabled={loading || actions.pending || selected.length < 2 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1} onClick={() => run("compare", () => api.compare(selected, method, threshold))}>{actions.isPending("compare") && <i className="button-spinner" />}{t("Compare and save", "So sánh và lưu")}</button></div></div>
      <div className="admin-live-scroll"><table><thead><tr><th>{t("Select", "Chọn")}</th><th>{t("Scenario", "Kịch bản")}</th><th>{t("Map", "Bản đồ")}</th><th>{t("Weather", "Thời tiết")}</th></tr></thead><tbody>{visible.map(version => <tr key={version.scenarioVersionId}><td><input type="checkbox" aria-label={`${version.scenarioCode} ${version.scenarioName} v${version.versionNumber}`} checked={selected.includes(version.scenarioVersionId)} disabled={actions.pending || !selected.includes(version.scenarioVersionId) && selected.length >= 100} onChange={event => setSelected(current => event.target.checked ? [...current, version.scenarioVersionId] : current.filter(id => id !== version.scenarioVersionId))} /></td><td>{version.scenarioCode} · {version.scenarioName} · v{version.versionNumber}</td><td>{version.mapName}</td><td>{version.weatherPreset}</td></tr>)}</tbody></table></div>
      <form className="admin-live-toolbar" onSubmit={event => { event.preventDefault(); run("read", () => api.get(savedId.trim())); }}><label>{t("Saved comparison ID", "ID kết quả đã lưu")}<input value={savedId} onChange={event => setSavedId(event.target.value)} required pattern="[0-9a-fA-F-]{36}" /></label><button className="btn btn-light" disabled={actions.pending || !savedId.trim()}>{t("Load saved result", "Tải kết quả đã lưu")}</button></form>
    </section>
    {result && <section className="card admin-live-panel"><h3>{result.method.toUpperCase()} · {t("Saved result", "Kết quả đã lưu")}</h3><p>{result.note}</p><code>{result.id}</code><p>{result.featureNames.join(", ")}</p><div className="admin-live-grid">{result.clusters.map(cluster => <article className="card admin-live-panel" key={cluster.clusterId}><h4>{t("Group", "Nhóm")} {cluster.clusterId}</h4>{cluster.scenarioVersionIds.map(id => <p key={id}>{versions.find(version => version.scenarioVersionId === id)?.scenarioName ?? id}</p>)}</article>)}</div><div className="admin-live-scroll"><table><thead><tr><th>{t("First version", "Phiên bản thứ nhất")}</th><th>{t("Second version", "Phiên bản thứ hai")}</th><th>{t("Distance", "Khoảng cách")}</th><th>{t("Similarity", "Độ tương đồng")}</th></tr></thead><tbody>{result.pairs.map(pair => <tr key={`${pair.leftVersionId}:${pair.rightVersionId}`}><td>{versions.find(version => version.scenarioVersionId === pair.leftVersionId)?.scenarioName ?? pair.leftVersionId}</td><td>{versions.find(version => version.scenarioVersionId === pair.rightVersionId)?.scenarioName ?? pair.rightVersionId}</td><td>{pair.distance.toFixed(4)}</td><td>{(pair.similarity * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></section>}
  </div>;
}
