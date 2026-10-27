import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../localeContext";
import type { UserRole } from "../types";
import type { TeamApiClient } from "../services/teamContracts";
import type { RunResult, TeamCampaign } from "../services/teamOperations";
import { failureActionAllowed, failureAnalysisApi, type FailureAnalysis, type FailureAnalysisAction, type FailureEffectiveness, type FailureReviewDecision, type OrderEffectiveness } from "../services/teamFailureAnalysis";
import { Icon } from "./Icon";
import "./TeamFailureAnalysisWorkspace.css";

type View = "analysis" | "review" | "effectiveness";
type Props = {
  client: TeamApiClient;
  role: UserRole;
  initialView?: View;
  onNotify?: (message: string) => void;
  onChanged?: () => void | Promise<void>;
};
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
const isNotFound = (reason: unknown) => typeof reason === "object" && reason !== null && "status" in reason && reason.status === 404;

/** Actual Flow 4 transitions and server-calculated metrics, through the Saga client. */
export function TeamFailureAnalysisWorkspace({ client, role, initialView = "analysis", onNotify, onChanged }: Props) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const api = useMemo(() => failureAnalysisApi(client), [client]);
  const [view, setView] = useState<View>(initialView);
  const [campaigns, setCampaigns] = useState<TeamCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<FailureAnalysis | null>(null);
  const [evaluation, setEvaluation] = useState<FailureEffectiveness | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loadedScope, setLoadedScope] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState<"group" | "return-to-flow3" | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [evidenceRun, setEvidenceRun] = useState("");
  const [evidence, setEvidence] = useState<RunResult | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const mounted = useRef(true);
  const scope = useRef(0);
  const lock = useRef(false);
  const evidenceScope = useRef(0);
  const blobUrl = useRef("");
  const selected = campaigns.find(item => item.id === campaignId);
  const busy = Boolean(pending);
  const spinner = <i className="button-spinner" aria-hidden="true" />;
  const number = (value: number | null | undefined, digits = 4) => typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: digits }) : "—";
  const stepLabels: Record<string, string> = {
    grouped: t("Grouped", "Đã gom lỗi"), verified: t("Verified", "Đã kiểm chứng"), similar_found: t("Similar faults linked", "Đã liên kết lỗi tương tự"),
    unexplained: t("Additional evidence required", "Cần thêm bằng chứng"), awaiting_flow3: t("Awaiting re-execution", "Chờ thực thi lại"),
    explainable: t("Explainable", "Đủ căn cứ giải thích"), report_draft: t("Report ready for review", "Báo cáo chờ xem xét"),
    needs_more: t("Review needs more work", "Báo cáo cần bổ sung"), evaluated: t("Completed and evaluated", "Đã hoàn thành và đánh giá"), returned_to_flow3: t("Returned to execution", "Đã đưa về thực thi"),
  };

  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; scope.current += 1; evidenceScope.current += 1;
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
  }; }, []);
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => {
    let active = true;
    setCampaignsLoading(true); setError(""); setCampaigns([]); setCampaignId("");
    void api.campaigns().then(data => {
      if (!active) return;
      const sorted = [...data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setCampaigns(sorted); setCampaignId(sorted[0]?.id ?? "");
    }).catch(reason => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setCampaignsLoading(false); });
    return () => { active = false; };
  }, [api, role]);
  useEffect(() => {
    const generation = ++scope.current;
    let active = true;
    setLoadedScope(""); setAnalysis(null); setEvaluation(null); setNote(""); setError(""); setNotice(""); setConfirmation(null); setAccepted(false); setEvidenceRun("");
    if (!campaignId) { setAnalysisLoading(false); return; }
    setAnalysisLoading(true);
    void api.get(campaignId).then(data => {
      if (!active || generation !== scope.current) return;
      setAnalysis(data); setEvaluation(data.effectiveness); setNote(data.reviewNote ?? ""); setLoadedScope(`${role}:${campaignId}`);
    }).catch(reason => {
      if (!active || generation !== scope.current) return;
      if (isNotFound(reason)) setLoadedScope(`${role}:${campaignId}`);
      else setError(errorMessage(reason));
    })
      .finally(() => { if (active && generation === scope.current) setAnalysisLoading(false); });
    return () => { active = false; scope.current += 1; };
  }, [api, campaignId, revision, role]);
  useEffect(() => {
    const generation = ++evidenceScope.current;
    setEvidence(null); setEvidenceError(""); setVideoUrl("");
    if (blobUrl.current) { URL.revokeObjectURL(blobUrl.current); blobUrl.current = ""; }
    if (!evidenceRun) { setEvidenceLoading(false); return; }
    setEvidenceLoading(true);
    void api.runResult(evidenceRun).then(data => { if (mounted.current && generation === evidenceScope.current) setEvidence(data); })
      .catch(reason => { if (mounted.current && generation === evidenceScope.current) setEvidenceError(errorMessage(reason)); })
      .finally(() => { if (mounted.current && generation === evidenceScope.current) setEvidenceLoading(false); });
    return () => { evidenceScope.current += 1; };
  }, [api, evidenceRun]);

  const perform = async (key: string, operation: () => Promise<void>) => {
    if (lock.current) return;
    const generation = scope.current;
    lock.current = true; setPending(key); setError(""); setNotice("");
    try { await operation(); }
    catch (reason) { if (mounted.current && generation === scope.current) setError(errorMessage(reason)); }
    finally { lock.current = false; if (mounted.current) setPending(""); }
  };
  const mutate = (action: Exclude<FailureAnalysisAction, "evaluation">, decision?: FailureReviewDecision) => {
    if (!campaignId || loadedScope !== `${role}:${campaignId}` || analysis && analysis.campaignId !== campaignId || !failureActionAllowed(action, analysis?.step)) return;
    const generation = scope.current;
    const target = campaignId;
    return perform(action, async () => {
      const result = action === "review" ? await api.review(target, decision ?? "needs_more", note)
        : action === "return-to-flow3" ? await api.returnToFlow3(target) : await api[action](target);
      if (mounted.current && generation === scope.current) {
        setAnalysis(result); setEvaluation(result.effectiveness); setNote(result.reviewNote ?? ""); setConfirmation(null); setAccepted(false);
        if (action === "return-to-flow3") setEvidenceRun("");
        setNotice(result.summary); onNotify?.(result.summary);
        if (result.step === "evaluated") setView("effectiveness");
      }
      await onChanged?.();
      if (action === "return-to-flow3") {
        const refreshed = await api.campaigns();
        if (mounted.current && generation === scope.current) setCampaigns([...refreshed].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      }
    });
  };
  const readEvaluation = () => {
    const generation = scope.current;
    void perform("evaluation", async () => {
      const data = await api.evaluation(campaignId);
      if (mounted.current && generation === scope.current) setEvaluation(data);
    });
  };
  const previewVideo = () => {
    const generation = evidenceScope.current;
    void perform("video", async () => {
      try {
        const blob = await api.video(evidenceRun);
        if (!mounted.current || generation !== evidenceScope.current) return;
        if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = URL.createObjectURL(blob); setVideoUrl(blobUrl.current);
      } catch (reason) { if (mounted.current && generation === evidenceScope.current) setEvidenceError(errorMessage(reason)); }
    });
  };
  const visibleCampaigns = campaigns.filter(item => `${item.code} ${item.name} ${item.status}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const allowed = (action: FailureAnalysisAction) => Boolean(campaignId) && loadedScope === `${role}:${campaignId}`
    && (!analysis || analysis.campaignId === campaignId) && !busy && !analysisLoading && failureActionAllowed(action, analysis?.step);
  const actionButton = (action: "verify" | "similar" | "explainability" | "generate", label: string) => <button className="btn btn-light" disabled={!allowed(action)} onClick={() => void mutate(action)}>{pending === action && spinner}{label}</button>;
  const returnRuns = [...new Set(analysis?.faults.filter(fault => fault.status === "unexplained").flatMap(fault => fault.runIds) ?? [])];
  const orders = evaluation ? [evaluation.proposed, evaluation.reverseBaseline, evaluation.randomBaseline] : [];
  const orderLabel = (order: OrderEffectiveness) => order === evaluation?.proposed ? t("Campaign order", "Thứ tự campaign")
    : order === evaluation?.reverseBaseline ? t("Reverse baseline", "Đối chứng đảo ngược") : t("Random baseline", "Đối chứng ngẫu nhiên");

  return <div className="team-failure-analysis">
    <section className="card fa-intro"><div><span className="fa-eyebrow">{t("FAILURE ANALYSIS · LIVE BACKEND", "PHÂN TÍCH LỖI · BACKEND THẬT")}</span><h2>{t("Evidence to reviewed results", "Từ bằng chứng đến kết quả đã xem xét")}</h2><p>{t("Follow the backend workflow to group, verify, explain and review Oracle failures, then compare measured detection effectiveness.", "Thực hiện luồng backend để gom, kiểm chứng, giải thích và xem xét lỗi Oracle, sau đó so sánh hiệu quả phát hiện từ kết quả thực tế.")}</p></div><span className="fa-role">{role}</span></section>
    {error && <div className="fa-message error" role="alert"><Icon name="warning"/><span>{error}</span><button aria-label={t("Dismiss error", "Đóng lỗi")} onClick={() => setError("")}>×</button></div>}
    {notice && <div className="fa-message success" role="status"><Icon name="circle-check"/><span>{notice}</span><button aria-label={t("Dismiss notice", "Đóng thông báo")} onClick={() => setNotice("")}>×</button></div>}
    <section className="card fa-panel"><div className="fa-campaign-picker"><label>{t("Search campaigns", "Tìm campaign")}<input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Code, name or status", "Mã, tên hoặc trạng thái")}/></label><label>{t("Campaign", "Campaign")}<select value={campaignId} disabled={busy || campaignsLoading} onChange={event => setCampaignId(event.target.value)}><option value="">{t("Select a campaign", "Chọn campaign")}</option>{selected && !visibleCampaigns.some(item => item.id === selected.id) && <option value={selected.id}>{selected.code} · {selected.name}</option>}{visibleCampaigns.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.status}</option>)}</select></label><button className="btn btn-light" disabled={!campaignId || busy || analysisLoading} onClick={() => setRevision(value => value + 1)}><Icon name="refresh"/>{t("Refresh analysis", "Tải lại phân tích")}</button></div>
      {campaignsLoading ? <p className="fa-loading" role="status">{spinner}{t("Loading campaigns…", "Đang tải campaign…")}</p> : !campaigns.length && <p className="fa-empty">{t("Create and execute a campaign before analyzing its results.", "Tạo và thực thi campaign trước khi phân tích kết quả.")}</p>}
      {selected && <p className="fa-help">{selected.code} · {selected.status} · {selected.runCount} {t("runs", "lượt chạy")} · <code>{selected.id}</code></p>}
    </section>
    {analysisLoading && <div className="fa-loading" role="status">{spinner}{t("Loading persisted failure analysis…", "Đang tải phân tích lỗi đã lưu…")}</div>}
    {campaignId && !analysisLoading && <>
      <section className="card fa-panel"><div className="fa-heading"><div><h3>{t("Analysis workflow", "Luồng phân tích")}</h3><p>{analysis ? analysis.summary : t("This campaign has no analysis yet. Group faults after every execution has finished.", "Campaign chưa có phân tích. Bắt đầu gom lỗi khi mọi lượt thực thi đã kết thúc.")}</p></div><span className={`fa-status ${analysis?.step === "evaluated" ? "good" : ""}`}>{analysis ? stepLabels[analysis.step] ?? analysis.step : t("Not started", "Chưa bắt đầu")}</span></div><div className="fa-actions">
        <button className="btn btn-primary" disabled={!allowed("group")} onClick={() => { if (analysis) { setConfirmation("group"); setAccepted(false); } else void mutate("group"); }}>{pending === "group" && spinner}{analysis ? t("Regroup faults", "Gom lỗi lại") : t("Group faults", "Gom lỗi")}</button>
        {actionButton("verify", t("Verify classifications", "Kiểm chứng phân loại"))}{actionButton("similar", t("Find similar failures", "Tìm lỗi tương tự"))}{actionButton("explainability", t("Check explanations", "Kiểm tra khả năng giải thích"))}{actionButton("generate", t("Generate failure report", "Tạo báo cáo lỗi"))}
        {analysis?.step === "unexplained" && <button className="btn btn-danger" disabled={!allowed("return-to-flow3")} onClick={() => { setConfirmation("return-to-flow3"); setAccepted(false); }}>{pending === "return-to-flow3" && spinner}{t("Return unexplained runs to execution", "Đưa lượt thiếu bằng chứng về thực thi")}</button>}
      </div><p className="fa-help">{t("Actions unlock in the order required by the backend. ERROR runs are excluded from the judged suite; warning checks remain separate from failing checks. Returning runs to execution requires an external CARLA worker.", "Các thao tác mở theo thứ tự backend yêu cầu. Lượt ERROR được loại khỏi tập đã chấm; cảnh báo được tách riêng khỏi lỗi FAIL. Những lượt đưa về thực thi cần worker CARLA bên ngoài.")}</p>
      {analysis && <><dl className="fa-identifiers"><div><dt>{t("Analysis ID", "ID phân tích")}</dt><dd>{analysis.analysisId}</dd></div><div><dt>{t("Backend step", "Bước backend")}</dt><dd>{analysis.step}</dd></div></dl><div className="fa-stats">{[[t("Judged runs", "Lượt đã chấm"), analysis.runsJudged], ["PASS", analysis.passCount], ["FAIL", analysis.failCount], [t("ERROR excluded", "ERROR đã loại"), analysis.errorExcluded], [t("Without evaluation", "Chưa có đánh giá"), analysis.pendingCount], [t("Fault groups", "Nhóm lỗi"), analysis.faults.length]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div></>}
      </section>
      {analysis && <>
        <nav className="fa-tabs" aria-label={t("Failure analysis views", "Các màn hình phân tích lỗi")}>{(["analysis", "review", "effectiveness"] as View[]).map(item => <button className={view === item ? "selected" : ""} aria-current={view === item ? "page" : undefined} key={item} onClick={() => setView(item)}>{item === "analysis" ? t("Faults and evidence", "Lỗi và bằng chứng") : item === "review" ? t("Report and review", "Báo cáo và xem xét") : t("Effectiveness", "Hiệu quả")}</button>)}</nav>
        {view === "analysis" && <>
          <section className="card fa-panel"><div className="fa-heading"><div><h3>{t("Fault groups", "Nhóm lỗi")}</h3><p>{t("The backend links failures by root scenario and failing Oracle check, following variant ancestry.", "Backend liên kết lỗi theo scenario gốc và quy tắc Oracle gây FAIL, có truy ngược nguồn biến thể.")}</p></div></div><div className="fa-faults">{analysis.faults.map((fault, index) => <article className="fa-fault" key={`${fault.rootScenarioId}:${fault.check}:${index}`}><div className="fa-heading"><div><span className="fa-eyebrow">{fault.check}</span><h4>{fault.rootScenarioCode} · {fault.rootScenarioName}</h4></div><span className={`fa-status ${fault.needsAdditionalVerification ? "attention" : ""}`}>{stepLabels[fault.status] ?? fault.status}</span></div><p className="fa-help">{t("First event", "Sự kiện đầu tiên")}: {number(fault.firstT, 3)} s · {fault.runIds.length} {t("linked runs", "lượt liên kết")}</p>{fault.explanation ? <p className="fa-explanation">{fault.explanation}</p> : <p className="fa-help">{t("No explanation has been established at this stage.", "Chưa có giải thích ở bước hiện tại.")}</p>}<p className="fa-help">{t("Root scenario ID", "ID scenario gốc")}: <code>{fault.rootScenarioId}</code></p><div className="fa-run-links">{fault.runIds.map(runId => <button key={runId} className="fa-run-link" onClick={() => setEvidenceRun(runId)}>{runId === fault.firstDetectedRunId ? t("First detection", "Phát hiện đầu") : fault.similarRunIds.includes(runId) ? t("Similar run", "Lượt tương tự") : t("Linked run", "Lượt liên kết")} <code>{runId}</code><Icon name="eye" size={13}/></button>)}</div>{fault.needsAdditionalVerification && <p className="fa-help fa-attention">{t("The backend requires additional verification for this group. Inspect the run evidence before requesting re-execution.", "Backend yêu cầu kiểm chứng thêm nhóm này. Xem bằng chứng lượt chạy trước khi yêu cầu thực thi lại.")}</p>}</article>)}</div>{!analysis.faults.length && <p className="fa-empty">{t("No fault groups in this analysis. Continue the workflow to review the report and inspect effectiveness availability.", "Phân tích này không có nhóm lỗi. Tiếp tục luồng để xem xét báo cáo và kiểm tra khả năng đánh giá hiệu quả.")}</p>}</section>
          <section className="card fa-panel"><h3>{t("Execution features", "Đặc trưng lượt thực thi")}</h3><div className="fa-table-wrap"><table className="fa-table"><thead><tr><th>{t("Order / scenario", "Thứ tự / scenario")}</th><th>{t("Verdict / outcome", "Kết quả / trạng thái kết thúc")}</th><th>{t("Duration", "Thời lượng")}</th><th>{t("Failing checks", "Quy tắc gây FAIL")}</th><th>{t("Warnings", "Cảnh báo")}</th><th>{t("Evidence", "Bằng chứng")}</th></tr></thead><tbody>{analysis.features.map(feature => <tr key={feature.runId}><td><b>{feature.sortOrder} · {feature.scenarioCode}</b><span>{feature.scenarioName}</span><code>{feature.runId}</code></td><td><b>{feature.verdict}</b><span>{feature.outcome ?? "—"}</span></td><td>{number(feature.durationS, 3)} s</td><td>{feature.failingChecks.join(", ") || "—"}</td><td>{feature.warningChecks.join(", ") || "—"}</td><td><button className="btn btn-light" onClick={() => setEvidenceRun(feature.runId)}>{t("Inspect run", "Xem lượt chạy")}</button><span>{feature.hasVideo ? t("Video available", "Có video") : t("No video", "Chưa có video")}</span></td></tr>)}</tbody></table></div>{!analysis.features.length && <p className="fa-empty">{t("No judged PASS/FAIL runs are available.", "Chưa có lượt PASS/FAIL đã chấm.")}</p>}</section>
        </>}
        {view === "review" && <section className="card fa-panel"><div className="fa-heading"><div><h3>{t("Failure report", "Báo cáo lỗi")}</h3><p>{t("Report text and explanations are produced by the backend from persisted Oracle evidence.", "Nội dung báo cáo và giải thích được backend tạo từ bằng chứng Oracle đã lưu.")}</p></div><button className="btn btn-light" disabled={busy} onClick={() => void perform("download", () => api.download(campaignId))}>{pending === "download" && spinner}<Icon name="download"/>{t("Download analysis JSON", "Tải JSON phân tích")}</button></div>{analysis.faults.map((fault, index) => <article className="fa-report-section" key={`${fault.rootScenarioId}:${fault.check}:${index}`}><h4>{fault.rootScenarioCode} · {fault.check}</h4><p>{fault.report ?? t("Generate the report after all faults are explainable.", "Tạo báo cáo sau khi mọi nhóm lỗi đủ căn cứ giải thích.")}</p></article>)}{!analysis.faults.length && <p className="fa-help">{t("This report has no fault groups.", "Báo cáo này không có nhóm lỗi.")}</p>}<label className="fa-note-label">{t("Review note", "Ghi chú xem xét")}<textarea rows={4} value={note} disabled={!allowed("review")} onChange={event => setNote(event.target.value)} placeholder={t("Describe the evidence reviewed or work still required", "Mô tả bằng chứng đã xem hoặc nội dung còn cần bổ sung")}/></label><div className="fa-actions"><button className="btn btn-light" disabled={!allowed("review")} onClick={() => void mutate("review", "needs_more")}>{pending === "review" && spinner}{t("Request more work", "Yêu cầu bổ sung")}</button><button className="btn btn-primary" disabled={!allowed("review")} onClick={() => void mutate("review", "complete")}>{pending === "review" && spinner}{t("Complete review and evaluate", "Hoàn thành xem xét và đánh giá")}</button></div><p className="fa-help">{t("Effectiveness is calculated only when review is completed. Requesting more work keeps the report open and does not start a CARLA run.", "Hiệu quả chỉ được tính khi hoàn thành xem xét. Yêu cầu bổ sung giữ báo cáo mở và không tự chạy CARLA.")}</p>{analysis.reviewNote && <p className="fa-stored-note"><b>{t("Stored note", "Ghi chú đã lưu")}</b>{analysis.reviewNote}</p>}</section>}
        {view === "effectiveness" && <section className="card fa-panel"><div className="fa-heading"><div><h3>{t("Measured prioritization effectiveness", "Hiệu quả ưu tiên từ thực thi")}</h3><p>{t("APFD, APFDc and detection curves are returned by the backend. No estimates or client-side replacements are added here.", "APFD, APFDc và đường cong phát hiện do backend trả về từ kết quả thực thi.")}</p></div><button className="btn btn-light" disabled={!allowed("evaluation")} onClick={readEvaluation}>{pending === "evaluation" && spinner}{t("Refresh evaluation", "Tải lại đánh giá")}</button></div>{evaluation ? <><div className="fa-score-grid">{orders.map((order, index) => <article key={`${order.label}:${index}`}><h4>{orderLabel(order)}</h4><span className="fa-help">{order.label}</span><dl><div><dt>APFD</dt><dd>{number(order.apfd)}</dd></div><div><dt>APFDc</dt><dd>{number(order.apfdc)}</dd></div></dl></article>)}</div><p className="fa-help">{t("APFD difference versus reverse baseline", "Chênh lệch APFD so với đối chứng đảo ngược")}: <b>{number(evaluation.apfdGainVsReverse)}</b></p><DetectionChart orders={orders} labels={orders.map(orderLabel)} locale={locale}/>{orders.map((order, index) => <details className="fa-curve-details" key={`${order.label}:${index}`}><summary>{orderLabel(order)} · {t("Detection points", "Các điểm phát hiện")} ({order.curve.length})</summary><div className="fa-table-wrap"><table className="fa-table"><thead><tr><th>{t("Tests run", "Số test đã chạy")}</th><th>{t("Faults found", "Số lỗi đã thấy")}</th><th>{t("Fraction", "Tỷ lệ")}</th></tr></thead><tbody>{order.curve.map((point, position) => <tr key={position}><td>{point.testsRun}</td><td>{point.faultsFound}</td><td>{number(point.fraction)}</td></tr>)}</tbody></table></div></details>)}<p className="fa-help">{t("A missing metric is displayed as —. The backend may return null when there are no faults or insufficient data to score an order. ERROR runs are excluded.", "Chỉ số thiếu được hiển thị —. Backend có thể trả null khi không có lỗi hoặc thiếu dữ liệu để chấm thứ tự. Lượt ERROR được loại khỏi đánh giá.")}</p></> : <p className="fa-empty">{t("Complete the report review to make the backend evaluation available.", "Hoàn thành xem xét báo cáo để có đánh giá từ backend.")}</p>}</section>}
        <section className="card fa-panel"><details><summary>{t("Full persisted analysis JSON", "JSON đầy đủ của phân tích đã lưu")}</summary><pre className="fa-json">{pretty(analysis)}</pre></details></section>
      </>}
    </>}
    {confirmation && <div className="modal-backdrop"><section className="modal fa-confirm" role="dialog" aria-modal="true" aria-labelledby="fa-confirm-title"><div className="fa-heading"><h3 id="fa-confirm-title">{confirmation === "group" ? t("Replace this analysis?", "Thay phiên phân tích này?") : t("Send these runs back to execution?", "Đưa các lượt này về thực thi?")}</h3><button className="icon-button" aria-label={t("Close", "Đóng")} disabled={busy} onClick={() => setConfirmation(null)}><Icon name="close"/></button></div><p>{confirmation === "group" ? t("Grouping again replaces the existing analysis session, generated report, review note and effectiveness for this campaign. The execution results remain available.", "Gom lỗi lại thay phiên phân tích, báo cáo đã tạo, ghi chú xem xét và đánh giá hiệu quả của campaign này. Kết quả thực thi vẫn còn.") : t("The backend reuses these run IDs, removes their saved telemetry, evaluations and video, and puts them back in the execution queue. A CARLA worker must run them again.", "Backend dùng lại các Run ID này, xóa telemetry, đánh giá và video đã lưu của chúng, rồi đưa về hàng chờ thực thi. Cần worker CARLA chạy lại các lượt này.")}</p>{confirmation === "return-to-flow3" && <div className="fa-confirm-runs">{returnRuns.map(id => <code key={id}>{id}</code>)}</div>}<label className="fa-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy}/>{t("I understand and want to continue for this campaign.", "Tôi hiểu và muốn tiếp tục với campaign này.")}</label><div className="fa-actions"><button className="btn btn-light" disabled={busy} onClick={() => setConfirmation(null)}>{t("Cancel", "Hủy")}</button><button className="btn btn-primary" disabled={!accepted || busy} onClick={() => void mutate(confirmation)}>{busy && spinner}{t("Confirm", "Xác nhận")}</button></div></section></div>}
    {evidenceRun && <div className="modal-backdrop"><section className="modal fa-evidence" role="dialog" aria-modal="true" aria-labelledby="fa-evidence-title"><div className="fa-heading"><div><h3 id="fa-evidence-title">{t("Original Oracle evidence", "Bằng chứng Oracle gốc")}</h3><code>{evidenceRun}</code></div><button className="icon-button" aria-label={t("Close evidence", "Đóng bằng chứng")} onClick={() => setEvidenceRun("")}><Icon name="close"/></button></div>{evidenceLoading && <p className="fa-loading" role="status">{spinner}{t("Loading run evidence…", "Đang tải bằng chứng lượt chạy…")}</p>}{evidenceError && <p className="fa-message error" role="alert">{evidenceError}</p>}{evidence && <><p>{evidence.scenarioCode} · v{evidence.versionNumber} · <b>{evidence.verdict ?? "—"}</b> · {evidence.outcome ?? "—"}</p><div className="fa-actions"><button className="btn btn-light" disabled={busy} onClick={() => void perform("run-download", () => api.downloadRun(evidenceRun))}>{pending === "run-download" && spinner}{t("Download result JSON", "Tải JSON kết quả")}</button>{evidence.hasVideo && <><button className="btn btn-light" disabled={busy || !api.supportsVideo} onClick={previewVideo}>{pending === "video" && spinner}{t("View video", "Xem video")}</button><button className="btn btn-light" disabled={busy} onClick={() => void perform("video-download", () => api.downloadVideo(evidenceRun))}>{pending === "video-download" && spinner}{t("Download video", "Tải video")}</button></>}</div>{videoUrl && <video className="fa-video" src={videoUrl} controls preload="metadata"/>}{!evidence.hasVideo && <p className="fa-help">{t("No video is stored for this run.", "Lượt này chưa có video được lưu.")}</p>}{evidence.evaluations.map(item => <article className="fa-report-section" key={item.id}><h4>Oracle v{item.oracleVersion} · {item.verdict}</h4>{item.errorReason && <p className="fa-message error">{item.errorReason}</p>}{item.violations.map(violation => <div className="fa-violation" key={violation.id}><b>{violation.check} · {violation.severity} · {number(violation.t, 3)} s</b>{violation.durationS !== null && <span>{t("Duration", "Thời lượng")}: {number(violation.durationS, 3)} s</span>}<pre className="fa-json">{pretty(violation.details)}</pre></div>)}</article>)}<details><summary>{t("Full run result JSON", "JSON đầy đủ của kết quả lượt chạy")}</summary><pre className="fa-json">{pretty(evidence)}</pre></details></>}</section></div>}
  </div>;
}

function DetectionChart({ orders, labels, locale }: { orders: OrderEffectiveness[]; labels: string[]; locale: string }) {
  const colors = ["#e65260", "#5685bd", "#9a8a31"];
  const points = orders.flatMap(order => order.curve);
  if (!points.length) return null;
  const maxTests = Math.max(1, ...points.map(point => point.testsRun));
  const x = (value: number) => 56 + value / maxTests * 654;
  const y = (value: number) => 220 - value * 180;
  return <figure className="fa-chart"><figcaption>{locale === "vi" ? "Tỷ lệ lỗi đã phát hiện theo số test đã chạy" : "Fault detection fraction by executed test count"}</figcaption><svg viewBox="0 0 760 270" role="img" aria-label={locale === "vi" ? "Đường cong phát hiện lỗi từ backend" : "Fault detection curves returned by the backend"}>{[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1="56" y1={y(fraction)} x2="710" y2={y(fraction)} stroke="#e5ebf1"/><text x="44" y={y(fraction) + 4} textAnchor="end">{fraction * 100}%</text></g>)}<line x1="56" y1="220" x2="710" y2="220" stroke="#aebccd"/><text x="56" y="245" textAnchor="middle">0</text><text x="710" y="245" textAnchor="middle">{maxTests}</text>{orders.map((order, index) => <g key={`${order.label}:${index}`}><polyline fill="none" stroke={colors[index]} strokeWidth="3" points={order.curve.map(point => `${x(point.testsRun)},${y(point.fraction)}`).join(" ")}/>{order.curve.map((point, position) => <circle key={position} cx={x(point.testsRun)} cy={y(point.fraction)} r="3" fill={colors[index]}><title>{labels[index]} · {point.testsRun} tests · {point.faultsFound} faults · {point.fraction}</title></circle>)}</g>)}</svg><div className="fa-chart-legend">{orders.map((order, index) => <span key={`${order.label}:${index}`}><i style={{ background: colors[index] }}/>{labels[index]}</span>)}</div></figure>;
}
