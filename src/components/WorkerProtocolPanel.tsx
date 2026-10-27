import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../localeContext";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { UserRole } from "../types";
import type { TeamApiClient, TeamExecutionPackage } from "../services/teamContracts";
import type { RunResult, TeamCampaign, TeamRun } from "../services/teamOperations";
import { canRequeueInfrastructure, hasMp4Header, isRunGuid, isWorkerUploadSizeValid, validateTelemetryText, workerProtocol,
  type ClaimedWorkerRun, type TelemetryPreview } from "../services/workerProtocol";
import "./WorkerProtocolPanel.css";

export interface WorkerProtocolPanelProps {
  client: TeamApiClient; role: UserRole; onNotify?: (message: string) => void;
}
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const size = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);

/** Advanced manual worker API access. Simulation and recording remain the external worker's responsibility. */
export function WorkerProtocolPanel({ client, role, onNotify }: WorkerProtocolPanelProps) {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const protocol = useMemo(() => workerProtocol(client), [client]);
  const action = useAsyncAction();
  const canManage = role === "Test Engineer" || role === "Administrator";
  const [campaigns, setCampaigns] = useState<TeamCampaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [runList, setRunList] = useState<{ campaignId: string; items: TeamRun[] }>({ campaignId: "", items: [] });
  const [selectedRunId, setSelectedRunId] = useState("");
  const [manual, setManual] = useState(false);
  const [manualRunId, setManualRunId] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [allCampaigns, setAllCampaigns] = useState(false);
  const [claimConfirmed, setClaimConfirmed] = useState(false);
  const [runConfirmed, setRunConfirmed] = useState(false);
  const [requeueConfirmed, setRequeueConfirmed] = useState(false);
  const [claimed, setClaimed] = useState<ClaimedWorkerRun | null>(null);
  const [executionPackage, setExecutionPackage] = useState<TeamExecutionPackage | null>(null);
  const [telemetryFile, setTelemetryFile] = useState<File | null>(null);
  const [telemetryPreview, setTelemetryPreview] = useState<TelemetryPreview | null>(null);
  const [telemetryReading, setTelemetryReading] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");
  const [telemetryConfirmed, setTelemetryConfirmed] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoReading, setVideoReading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoConfirmed, setVideoConfirmed] = useState(false);
  const telemetryGeneration = useRef(0);
  const videoGeneration = useRef(0);
  const panelAlive = useRef(true);
  const panelBusy = useRef(false);
  const runs = runList.campaignId === campaignId ? runList.items : [];
  const targetId = (manual ? manualRunId.trim() : selectedRunId).toLowerCase();
  const targetValid = isRunGuid(targetId);
  const currentResult = result?.runId.toLowerCase() === targetId ? result : null;
  const targetRun = runs.find(run => run.id.toLowerCase() === targetId);
  const campaign = campaigns.find(item => item.id === campaignId);
  const mutationAllowed = canManage && advanced && acknowledged && !action.pending && !resultLoading;
  const targetAllowed = mutationAllowed && Boolean(currentResult) && runConfirmed;
  const telemetryAllowed = targetAllowed && currentResult?.status !== "Queued" && !currentResult?.telemetryReceivedAt
    && Boolean(telemetryFile && telemetryPreview?.valid && telemetryConfirmed) && !telemetryReading;
  const videoAllowed = targetAllowed && Boolean(currentResult?.telemetryReceivedAt && videoFile && videoReady && videoConfirmed) && !videoReading;
  const packageVersionId = currentResult?.scenarioVersionId;

  const announce = (text: string) => { if (panelAlive.current) { setNotice(text); onNotify?.(text); } };
  const perform = async (key: string, task: () => Promise<void>) => {
    // Exclude different actions synchronously, before React renders disabled controls.
    if (panelBusy.current || !panelAlive.current) return;
    panelBusy.current = true;
    setError(""); setNotice("");
    try { await action.run(key, task); }
    catch (reason) { if (panelAlive.current) setError(message(reason)); }
    finally { panelBusy.current = false; }
  };
  const refresh = () => { if (panelAlive.current && !panelBusy.current) setRevision(value => value + 1); };
  const invalidate = () => { if (panelAlive.current) setRevision(value => value + 1); };
  const refreshResult = async (id: string) => { const updated = await protocol.result(id); if (panelAlive.current) { setResult(updated); invalidate(); } };
  const changeCampaign = (id: string) => {
    setCampaignId(id); setSelectedRunId(""); setClaimConfirmed(false); setClaimed(null);
    setNotice(""); setError("");
  };

  useEffect(() => {
    let alive = true;
    setCampaignsLoading(true);
    void protocol.campaigns().then(data => { if (alive) setCampaigns(data); })
      .catch(reason => { if (alive) setError(message(reason)); })
      .finally(() => { if (alive) setCampaignsLoading(false); });
    return () => { alive = false; };
  }, [protocol, revision]);

  useEffect(() => {
    let alive = true;
    setRunList({ campaignId, items: [] });
    if (!campaignId) { setRunsLoading(false); return () => { alive = false; }; }
    setRunsLoading(true);
    void protocol.runs(campaignId).then(data => { if (alive) setRunList({ campaignId, items: data }); })
      .catch(reason => { if (alive) setError(message(reason)); })
      .finally(() => { if (alive) setRunsLoading(false); });
    return () => { alive = false; };
  }, [protocol, campaignId, revision]);

  useEffect(() => {
    let alive = true;
    setResult(null); setExecutionPackage(null);
    if (!targetValid) { setResultLoading(false); return () => { alive = false; }; }
    setResultLoading(true);
    void protocol.result(targetId).then(data => { if (alive) setResult(data); })
      .catch(reason => { if (alive) setError(message(reason)); })
      .finally(() => { if (alive) setResultLoading(false); });
    return () => { alive = false; };
  }, [protocol, targetId, targetValid, revision]);

  useEffect(() => {
    telemetryGeneration.current += 1; videoGeneration.current += 1;
    setRunConfirmed(false); setRequeueConfirmed(false); setTelemetryConfirmed(false); setVideoConfirmed(false);
    setTelemetryFile(null); setTelemetryPreview(null); setTelemetryError(""); setTelemetryReading(false);
    setVideoFile(null); setVideoReady(false); setVideoError(""); setVideoReading(false);
  }, [targetId]);

  useEffect(() => {
    panelAlive.current = true;
    return () => { panelAlive.current = false; telemetryGeneration.current += 1; videoGeneration.current += 1; };
  }, []);

  const readTelemetry = async (file: File | undefined) => {
    const generation = ++telemetryGeneration.current;
    setTelemetryFile(file ?? null); setTelemetryPreview(null); setTelemetryError(""); setTelemetryConfirmed(false);
    if (!file || !currentResult) return;
    if (!isWorkerUploadSizeValid(file.size, "telemetry")) { setTelemetryError(t("Select a non-empty NDJSON recording up to 100 MiB.", "Chọn bản ghi NDJSON không rỗng, tối đa 100 MiB.")); return; }
    setTelemetryReading(true);
    try {
      const text = await file.text();
      if (generation !== telemetryGeneration.current) return;
      setTelemetryPreview(validateTelemetryText(text, { runId: currentResult.runId, scenarioVersionId: currentResult.scenarioVersionId,
        contentHash: targetRun?.contentHash ?? (claimed?.runId === targetId ? claimed.contentHash : undefined) }));
    } catch (reason) { if (generation === telemetryGeneration.current) setTelemetryError(message(reason)); }
    finally { if (generation === telemetryGeneration.current) setTelemetryReading(false); }
  };

  const readVideo = async (file: File | undefined) => {
    const generation = ++videoGeneration.current;
    setVideoFile(file ?? null); setVideoReady(false); setVideoError(""); setVideoConfirmed(false);
    if (!file) return;
    if (!isWorkerUploadSizeValid(file.size, "video")) { setVideoError(t("Select a non-empty MP4 recording up to 200 MiB.", "Chọn bản ghi MP4 không rỗng, tối đa 200 MiB.")); return; }
    setVideoReading(true);
    try {
      const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      if (generation !== videoGeneration.current) return;
      if (!hasMp4Header(bytes))
        setVideoError(t("The selected file does not have an MP4 ftyp header.", "Tệp đã chọn không có tiêu đề MP4 ftyp."));
      else setVideoReady(true);
    } catch (reason) { if (generation === videoGeneration.current) setVideoError(message(reason)); }
    finally { if (generation === videoGeneration.current) setVideoReading(false); }
  };

  const claim = () => {
    if (!mutationAllowed || !claimConfirmed || !allCampaigns && !campaignId) return;
    void perform("claim", async () => {
      const data = await protocol.claim(allCampaigns ? undefined : campaignId);
      if (!panelAlive.current) return;
      setClaimConfirmed(false);
      if (!data) { setClaimed(null); announce(t("No queued job in this scope (HTTP 204). Nothing was claimed.", "Không có tác vụ trong phạm vi này (HTTP 204). Không có run được nhận.")); return; }
      setClaimed(data); setCampaignId(data.campaignId); setManual(false); setSelectedRunId(data.runId); invalidate();
      announce(t(`Claimed ${data.runId} for manual handling. The normal queue worker cannot claim this job now. Continue the actual recording and callbacks for this run ID.`, `Đã nhận ${data.runId} để xử lý thủ công. Worker hàng đợi thông thường không còn nhận được tác vụ này. Tiếp tục ghi nhận mô phỏng thật và gửi callback cho đúng run ID.`));
    });
  };

  return <section className="worker-protocol">
    <header className="worker-protocol-heading"><div><span className="worker-protocol-eyebrow">WORKER API</span>
      <h2>{t("Manual worker protocol", "Giao thức worker thủ công")}</h2>
      <p>{t("Inspect real backend jobs and submit existing worker recordings. CARLA and the Python worker run outside this browser; no process or simulator health API is available.", "Xem tác vụ thật và nộp bản ghi worker có sẵn. CARLA và worker Python chạy bên ngoài trình duyệt; backend chưa có API quản lý tiến trình hoặc kiểm tra simulator.")}</p></div>
      <button type="button" disabled={action.pending || resultLoading || campaignsLoading || runsLoading} onClick={refresh}>{t("Refresh backend data", "Tải lại dữ liệu backend")}</button>
    </header>
    {error && <div className="worker-protocol-error" role="alert">{error}</div>}
    {notice && <div className="worker-protocol-notice" role="status">{notice}</div>}

    <section className="worker-protocol-card">
      <h3>{t("1. Select the actual target", "1. Chọn đối tượng thật")}</h3>
      <div className="worker-protocol-grid">
        <label>{t("Campaign", "Chiến dịch")}<select value={campaignId} disabled={action.pending || campaignsLoading} onChange={event => changeCampaign(event.target.value)}>
          <option value="">{campaignsLoading ? t("Loading campaigns…", "Đang tải chiến dịch…") : t("Select a campaign", "Chọn chiến dịch")}</option>
          {campaigns.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.status}</option>)}
        </select></label>
        <label>{t("Run in this campaign", "Run thuộc chiến dịch")}<select value={selectedRunId} disabled={action.pending || !campaignId || runsLoading || manual} onChange={event => setSelectedRunId(event.target.value)}>
          <option value="">{runsLoading ? t("Loading runs…", "Đang tải run…") : t("Select a run", "Chọn run")}</option>
          {runs.map(run => <option key={run.id} value={run.id}>{run.scenarioCode} · v{run.versionNumber} · {run.status} · {run.id}</option>)}
        </select></label>
      </div>
      <label className="worker-protocol-check"><input type="checkbox" checked={manual} disabled={action.pending} onChange={event => setManual(event.target.checked)} />{t("Look up a known run GUID manually", "Tra cứu GUID run đã biết")}</label>
      {manual && <label>{t("Run GUID", "GUID run")}<input value={manualRunId} disabled={action.pending} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" onChange={event => setManualRunId(event.target.value)} />
        {manualRunId.trim() && !targetValid && <span className="worker-protocol-error-text">{t("Enter a valid run GUID.", "Nhập GUID run hợp lệ.")}</span>}</label>}
      {campaignId && !runsLoading && runs.length === 0 && <p>{t("This campaign has no runs. Queue it through the campaign workflow first.", "Chiến dịch chưa có run. Đưa chiến dịch vào hàng đợi qua quy trình chiến dịch trước.")}</p>}
      {resultLoading && <p role="status">{t("Reading the selected run result…", "Đang đọc kết quả run đã chọn…")}</p>}
      {currentResult && <div className="worker-protocol-target">
        <strong>{currentResult.scenarioCode} · {currentResult.scenarioName} · v{currentResult.versionNumber}</strong>
        <code>{currentResult.runId}</code>
        <div className="worker-protocol-stats"><span>{t("State", "Trạng thái")}: <b>{currentResult.status}</b></span><span>{t("Verdict", "Kết luận")}: <b>{currentResult.verdict ?? "—"}</b></span>
          <span>Outcome: <b>{currentResult.outcome ?? "—"}</b></span><span>{t("Infrastructure retries", "Lần thử lại hạ tầng")}: {currentResult.infraRetryCount}</span></div>
        <p>{currentResult.campaignCode} · {currentResult.campaignName} · {t("Telemetry received", "Đã nhận telemetry")}: {currentResult.telemetryReceivedAt ?? "—"} · MP4: {currentResult.hasVideo ? t("available", "có") : t("absent", "chưa có")}</p>
        <div className="worker-protocol-actions">
          <button type="button" disabled={action.pending} onClick={() => void perform("result-download", () => protocol.downloadResult(targetId))}>{t("Download result JSON", "Tải JSON kết quả")}</button>
          <button type="button" disabled={action.pending || !packageVersionId} onClick={() => void perform("package", async () => { if (packageVersionId) { const data = await protocol.executionPackage(packageVersionId); if (panelAlive.current) setExecutionPackage(data); } })}>{t("Inspect execution package", "Xem execution package")}</button>
          {currentResult.hasVideo && <button type="button" disabled={action.pending} onClick={() => void perform("video-download", () => protocol.downloadVideo(targetId))}>{t("Download recorded MP4", "Tải MP4 đã ghi")}</button>}
        </div>
        <details><summary>{t("Run result and evaluations", "Kết quả run và các lần đánh giá")}</summary><pre>{pretty(currentResult)}</pre></details>
      </div>}
      {executionPackage && currentResult?.scenarioVersionId === executionPackage.scenarioVersionId && <details open><summary>{t("Execution package", "Execution package")} · {executionPackage.runnable ? t("runnable according to backend", "backend đánh dấu có thể chạy") : t("backend reports issues", "backend báo có vấn đề")}</summary><pre>{pretty(executionPackage)}</pre></details>}
    </section>

    <details className="worker-protocol-card worker-protocol-advanced" open={advanced} onToggle={event => { const open = event.currentTarget.open; setAdvanced(open); if (!open) { setAcknowledged(false); setRunConfirmed(false); setClaimConfirmed(false); } }}>
      <summary>{t("Advanced: mutate the worker queue and submit recordings", "Nâng cao: thay đổi hàng đợi worker và nộp bản ghi")}</summary>
      <p>{t("These endpoints change persisted queue state and evaluation evidence. They do not start CARLA, execute a scenario, or verify a recording's authenticity. Use the external worker for normal execution.", "Các endpoint này thay đổi hàng đợi và bằng chứng đánh giá đã lưu. Chúng không khởi động CARLA, chạy kịch bản hay xác thực nguồn bản ghi. Sử dụng worker bên ngoài cho quy trình chạy thông thường.")}</p>
      {!canManage && <p className="worker-protocol-error-text">{t("Only Test Engineer and Administrator roles can mutate worker state.", "Chỉ Test Engineer và Administrator được thay đổi trạng thái worker.")}</p>}
      <label className="worker-protocol-check"><input type="checkbox" checked={acknowledged} disabled={!canManage || action.pending} onChange={event => { setAcknowledged(event.target.checked); setClaimConfirmed(false); setRunConfirmed(false); }} />
        {t("I understand these are real backend mutations and will use only original worker recordings for the selected run.", "Tôi hiểu đây là thao tác thật trên backend và chỉ dùng bản ghi worker gốc cho run đã chọn.")}</label>

      <fieldset disabled={!mutationAllowed}><legend>{t("2. Claim one queued job", "2. Nhận một tác vụ trong hàng đợi")}</legend>
        <p>{t("POST /runs/claim moves one job from Queued to Claimed and sets its start time. A claimed job is no longer available to another worker. It does not execute the job.", "POST /runs/claim chuyển một tác vụ từ Queued sang Claimed và đặt thời gian bắt đầu. Worker khác không còn nhận được tác vụ đó. Thao tác này không chạy tác vụ.")}</p>
        <p className="worker-protocol-note">{t("Normal campaign execution does not require this manual claim. The current backend has no release/cancel endpoint for a claimed job; use it only when you are handling that exact run manually.", "Chạy campaign thông thường không cần nhận tác vụ thủ công ở đây. Backend hiện chưa có endpoint trả lại/hủy một run đã nhận; chỉ dùng khi bạn đang tự xử lý đúng run đó.")}</p>
        <label className="worker-protocol-check"><input type="checkbox" checked={allCampaigns} onChange={event => { setAllCampaigns(event.target.checked); setClaimConfirmed(false); }} />{t("Explicitly claim from ALL campaigns (omit campaignId)", "Chủ động nhận từ TẤT CẢ chiến dịch (bỏ campaignId)")}</label>
        <div className="worker-protocol-scope">{t("Claim scope", "Phạm vi nhận")}: <strong>{allCampaigns ? t("ALL campaigns", "TẤT CẢ chiến dịch") : campaign ? `${campaign.code} · ${campaign.name}` : t("Select a campaign first", "Chọn chiến dịch trước")}</strong></div>
        <label className="worker-protocol-check"><input type="checkbox" checked={claimConfirmed} disabled={!allCampaigns && !campaignId} onChange={event => setClaimConfirmed(event.target.checked)} />{t("I confirm claiming ONE queued job from this scope now.", "Tôi xác nhận nhận MỘT tác vụ trong phạm vi này ngay bây giờ.")}</label>
        <button type="button" className="worker-protocol-primary" disabled={!claimConfirmed || !allCampaigns && !campaignId} onClick={claim}>{action.isPending("claim") ? t("Claiming…", "Đang nhận…") : t("Claim one job", "Nhận một tác vụ")}</button>
        {claimed && <details open><summary>{t("Last claim response", "Phản hồi nhận tác vụ gần nhất")}</summary><pre>{pretty(claimed)}</pre></details>}
      </fieldset>

      <fieldset disabled={!mutationAllowed || !currentResult}><legend>{t("3. Confirm the selected target run", "3. Xác nhận run đích đã chọn")}</legend>
        <p>{t("Every action below targets this exact run:", "Mọi thao tác dưới đây nhắm đến đúng run này:")} <code>{currentResult?.runId ?? t("No run selected", "Chưa chọn run")}</code></p>
        <label className="worker-protocol-check"><input type="checkbox" checked={runConfirmed} onChange={event => { setRunConfirmed(event.target.checked); setRequeueConfirmed(false); setTelemetryConfirmed(false); setVideoConfirmed(false); }} />{t("I have checked the target run, scenario version and backend state.", "Tôi đã kiểm tra run đích, phiên bản kịch bản và trạng thái backend.")}</label>
        <div className="worker-protocol-actions">
          <button type="button" disabled={!targetAllowed || !["Claimed", "Running"].includes(currentResult?.status ?? "")} onClick={() => {
            if (!targetAllowed || !currentResult || !["Claimed", "Running"].includes(currentResult.status)) return;
            void perform("running", async () => { const data = await protocol.running(targetId); if (!panelAlive.current) return; setClaimed(data); setRunConfirmed(false); await refreshResult(targetId); announce(t("Backend state marked Running. Execute CARLA through the external worker.", "Backend đã đánh dấu Running. Thực thi CARLA bằng worker bên ngoài.")); });
          }}>{action.isPending("running") ? t("Marking…", "Đang đánh dấu…") : t("Mark Claimed → Running", "Đánh dấu Claimed → Running")}</button>
          <span>{t("Changes status/start time only; requires Claimed or Running.", "Chỉ đổi trạng thái/thời gian bắt đầu; yêu cầu Claimed hoặc Running.")}</span>
        </div>
      </fieldset>

      <fieldset disabled={!mutationAllowed || !currentResult || !runConfirmed}><legend>{t("4. Submit an existing telemetry recording", "4. Nộp bản ghi telemetry có sẵn")}</legend>
        <p>{t("PUT /runs/{id}/telemetry sends the file as raw NDJSON. The backend stores it, immediately evaluates it using the campaign's pinned Oracle config, and updates the run/campaign. One submission per attempt; queued jobs must be claimed first.", "PUT /runs/{id}/telemetry gửi trực tiếp tệp NDJSON. Backend lưu, đánh giá ngay bằng Oracle config đã ghim của chiến dịch và cập nhật run/chiến dịch. Mỗi lần thử chỉ nộp một lần; run Queued phải được nhận trước.")}</p>
        <label>{t("Original NDJSON / JSONL recording (default limit: 100 MiB)", "Bản ghi NDJSON / JSONL gốc (giới hạn mặc định: 100 MiB)")}<input key={`telemetry-${targetId}-${currentResult?.infraRetryCount ?? 0}-${currentResult?.telemetryReceivedAt ?? "none"}`} type="file" accept=".ndjson,.jsonl,application/x-ndjson,text/plain" disabled={Boolean(currentResult?.telemetryReceivedAt) || currentResult?.status === "Queued" || telemetryReading} onChange={event => void readTelemetry(event.target.files?.[0])} /></label>
        {telemetryReading && <p role="status">{t("Reading and validating the selected file…", "Đang đọc và kiểm tra tệp đã chọn…")}</p>}
        {telemetryError && <p className="worker-protocol-error-text" role="alert">{telemetryError}</p>}
        {telemetryFile && <p className="worker-protocol-file"><strong>{telemetryFile.name}</strong> · {size(telemetryFile.size)} · {t("Modified", "Sửa đổi")}: {new Date(telemetryFile.lastModified).toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}</p>}
        {telemetryPreview && <div className="worker-protocol-preview">
          <div className="worker-protocol-stats"><b>{telemetryPreview.valid ? t("Format checks passed", "Đã qua kiểm tra định dạng") : t("File blocked", "Tệp bị chặn")}</b><span>{telemetryPreview.recordCount} records · {telemetryPreview.ticks} ticks · {telemetryPreview.evaluatedTicks} {t("before post_stop", "trước post_stop")} · {telemetryPreview.events} events</span><span>{telemetryPreview.outcome} · {telemetryPreview.durationS ?? "—"} s</span></div>
          <dl><dt>run_id</dt><dd>{telemetryPreview.runId || "—"}</dd><dt>scenario_version_id</dt><dd>{telemetryPreview.scenarioVersionId || "—"}</dd><dt>content_hash</dt><dd>{telemetryPreview.contentHash || "—"}</dd><dt>carla_version</dt><dd>{telemetryPreview.carlaVersion || "—"}</dd></dl>
          {telemetryPreview.reason && <p>{t("Recorded reason", "Lý do đã ghi")}: {telemetryPreview.reason}</p>}
          {telemetryPreview.errors.length > 0 && <ul className="worker-protocol-error-text" role="alert">{telemetryPreview.errors.map((item, index) => <li key={index}>{item}</li>)}</ul>}
          {telemetryPreview.warnings.map((item, index) => <p key={index} className="worker-protocol-warning">{item}</p>)}
          <p>{t("Local format/provenance checks do not establish simulator health or predict PASS/FAIL. Zero-tick INFRA_FAILED reports are allowed; non-infrastructure recordings need real ticks.", "Kiểm tra định dạng/nguồn gốc tại trình duyệt không chứng minh sức khỏe simulator hay dự đoán PASS/FAIL. Cho phép INFRA_FAILED không có tick; bản ghi khác cần tick thật.")}</p>
        </div>}
        {currentResult?.telemetryReceivedAt && <p>{t("This attempt already has telemetry; duplicate submission is disabled.", "Lần thử này đã có telemetry; không thể nộp trùng.")}</p>}
        <label className="worker-protocol-check"><input type="checkbox" checked={telemetryConfirmed} disabled={!telemetryPreview?.valid || telemetryReading || Boolean(currentResult?.telemetryReceivedAt) || currentResult?.status === "Queued"} onChange={event => setTelemetryConfirmed(event.target.checked)} />{t(`I confirm this original recording belongs to ${targetId || "the selected run"}; submit and evaluate it now.`, `Tôi xác nhận bản ghi gốc thuộc ${targetId || "run đã chọn"}; nộp và đánh giá ngay.`)}</label>
        <button type="button" className="worker-protocol-primary" disabled={!telemetryAllowed} onClick={() => {
          if (!telemetryAllowed || !telemetryFile) return;
          void perform("telemetry", async () => { const data = await protocol.telemetry(targetId, telemetryFile); if (!panelAlive.current) return; setResult(data); setTelemetryConfirmed(false); setRunConfirmed(false); invalidate(); announce(t(`Telemetry stored. Backend verdict: ${data.verdict ?? "pending"}.`, `Đã lưu telemetry. Kết luận backend: ${data.verdict ?? "đang chờ"}.`)); });
        }}>{action.isPending("telemetry") ? t("Submitting and evaluating…", "Đang nộp và đánh giá…") : t("Submit raw telemetry and evaluate", "Nộp telemetry và đánh giá")}</button>
      </fieldset>

      <fieldset disabled={!mutationAllowed || !currentResult || !runConfirmed}><legend>{t("5. Upload an existing MP4 recording", "5. Tải lên bản ghi MP4 có sẵn")}</legend>
        <p>{t("PUT /runs/{id}/video sends raw MP4 after telemetry exists. Uploading again replaces the stored video for this run. The file is operator supplied; the browser cannot verify its run identity.", "PUT /runs/{id}/video gửi trực tiếp MP4 sau khi có telemetry. Tải lại sẽ thay thế video đã lưu của run. Người vận hành cung cấp tệp; trình duyệt không thể xác minh video thuộc run nào.")}</p>
        <label>{t("Original MP4 (default limit: 200 MiB)", "MP4 gốc (giới hạn mặc định: 200 MiB)")}<input key={`video-${targetId}-${currentResult?.infraRetryCount ?? 0}`} type="file" accept=".mp4,video/mp4" disabled={!currentResult?.telemetryReceivedAt || videoReading} onChange={event => void readVideo(event.target.files?.[0])} /></label>
        {videoReading && <p role="status">{t("Checking MP4 header…", "Đang kiểm tra tiêu đề MP4…")}</p>}
        {videoError && <p className="worker-protocol-error-text" role="alert">{videoError}</p>}
        {videoFile && <p className="worker-protocol-file"><strong>{videoFile.name}</strong> · {size(videoFile.size)} · {videoReady ? t("MP4 header checked", "Đã kiểm tra tiêu đề MP4") : t("Not ready", "Chưa sẵn sàng")} · {t("Target", "Đích")}: <code>{targetId}</code></p>}
        {!currentResult?.telemetryReceivedAt && <p>{t("Submit telemetry for this run before uploading video.", "Nộp telemetry cho run này trước khi tải video.")}</p>}
        <label className="worker-protocol-check"><input type="checkbox" checked={videoConfirmed} disabled={!videoReady || !currentResult?.telemetryReceivedAt || videoReading} onChange={event => setVideoConfirmed(event.target.checked)} />{t(`I confirm this MP4 records ${targetId || "the selected run"}${currentResult?.hasVideo ? " and will replace its existing video" : ""}.`, `Tôi xác nhận MP4 ghi lại ${targetId || "run đã chọn"}${currentResult?.hasVideo ? " và sẽ thay thế video hiện tại" : ""}.`)}</label>
        <button type="button" disabled={!videoAllowed} onClick={() => {
          if (!videoAllowed || !videoFile) return;
          void perform("video", async () => { await protocol.video(targetId, videoFile); if (!panelAlive.current) return; setVideoConfirmed(false); setRunConfirmed(false); await refreshResult(targetId); announce(t("MP4 stored by the backend.", "Backend đã lưu MP4.")); });
        }}>{action.isPending("video") ? t("Uploading MP4…", "Đang tải MP4…") : currentResult?.hasVideo ? t("Replace recorded MP4", "Thay MP4 đã ghi") : t("Upload raw MP4", "Tải MP4 trực tiếp")}</button>
      </fieldset>

      <fieldset disabled={!mutationAllowed || !currentResult || !runConfirmed}><legend>{t("6. Requeue an infrastructure ERROR", "6. Đưa ERROR hạ tầng vào hàng đợi lại")}</legend>
        <p className="worker-protocol-warning">{t("POST /runs/{id}/requeue-infra deletes this attempt's evaluation, telemetry and video, clears its verdict/timestamps and moves the same run to Queued. It increments the retry count. The backend decides whether the error is infrastructure related and whether retries remain; PASS/FAIL runs cannot use this action.", "POST /runs/{id}/requeue-infra xóa đánh giá, telemetry và video của lần thử; xóa kết luận/thời gian và đưa cùng run về Queued. Số lần thử lại tăng. Backend quyết định lỗi có thuộc hạ tầng và còn lượt thử hay không; run PASS/FAIL không dùng được thao tác này.")}</p>
        <label className="worker-protocol-check"><input type="checkbox" checked={requeueConfirmed} disabled={!canRequeueInfrastructure(currentResult)} onChange={event => setRequeueConfirmed(event.target.checked)} />{t("I confirm removing this infrastructure attempt's evidence and requeuing this run.", "Tôi xác nhận xóa bằng chứng của lần thử hạ tầng này và đưa run vào hàng đợi lại.")}</label>
        <button type="button" className="worker-protocol-danger" disabled={!targetAllowed || !canRequeueInfrastructure(currentResult) || !requeueConfirmed} onClick={() => {
          if (!targetAllowed || !canRequeueInfrastructure(currentResult) || !requeueConfirmed) return;
          void perform("requeue", async () => { const data = await protocol.requeue(targetId); if (!panelAlive.current) return; setRunConfirmed(false); setRequeueConfirmed(false); setTelemetryFile(null); setTelemetryPreview(null); setVideoFile(null); setVideoReady(false); await refreshResult(targetId); announce(t(`Requeued by backend: ${data.status}; infrastructure retries ${data.infraRetryCount}/${data.maxInfraRetries}.`, `Backend đã đưa vào hàng đợi: ${data.status}; lần thử hạ tầng ${data.infraRetryCount}/${data.maxInfraRetries}.`)); });
        }}>{action.isPending("requeue") ? t("Requeuing…", "Đang đưa vào hàng đợi…") : t("Remove infra evidence and requeue", "Xóa bằng chứng hạ tầng và xếp lại")}</button>
      </fieldset>
      <p className="worker-protocol-footnote">{t("Upload sizes above use the backend defaults (100/200 MiB); deployment limits and all authorization/state checks remain enforced by the server. Requests use the application's authenticated API client.", "Giới hạn trên dùng mặc định backend (100/200 MiB); máy chủ vẫn thực thi giới hạn triển khai, quyền và trạng thái. Yêu cầu đi qua API client đã xác thực của ứng dụng.")}</p>
    </details>
  </section>;
}
