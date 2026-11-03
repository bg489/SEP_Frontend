import { useEffect, useState } from "react";
import type { TeamApiClient } from "../services/teamContracts";
import type { RunProgress } from "../services/teamOperations";
import { useLocale } from "../localeContext";

/** Periodic snapshots are persisted by the worker; they are not a live video stream. */
export function RunProgressPanel({ client, runId }: { client: TeamApiClient; runId: string }) {
  const [snapshot, setSnapshot] = useState<RunProgress | null>(null);
  const [error, setError] = useState(""); const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  useEffect(() => {
    let alive = true; let busy = false; setSnapshot(null); setError("");
    const load = async () => {
      if (busy) return; busy = true;
      try { const value = await client.request<RunProgress>(`/api/v1/runs/${encodeURIComponent(runId)}/progress`); if (alive) { setSnapshot(value); setError(""); } }
      catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "Cannot read progress"); }
      finally { busy = false; }
    };
    void load(); const timer = window.setInterval(() => void load(), 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, runId]);
  const progress = snapshot?.runId === runId ? snapshot.progress : null;
  return <section className="card ops-panel" aria-label={t("Worker progress", "Tiến độ worker")}>
    <h3>{t("Worker progress", "Tiến độ worker")}</h3>
    {error && <p role="alert">{error}</p>}
    {progress ? <><dl className="ops-evidence-summary"><div><dt>{t("Simulation time", "Thời gian mô phỏng")}</dt><dd>{progress.simulationTimeS.toFixed(2)} s</dd></div><div><dt>Frame</dt><dd>{progress.frame}</dd></div><div><dt>{t("Ego speed", "Tốc độ Ego")}</dt><dd>{progress.speedKmh.toFixed(1)} km/h</dd></div><div><dt>CARLA x / y / z</dt><dd>{[progress.egoX, progress.egoY, progress.egoZ].map(v => v.toFixed(2)).join(" / ")}</dd></div></dl><p>{progress.message}</p><small>{t("Last snapshot", "Lần cập nhật cuối")}: {snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : "—"}</small></> : <p role="status">{t("Waiting for the worker's first progress snapshot…", "Đang chờ worker gửi tiến độ đầu tiên…")}</p>}
    <small>{t("Snapshots update every 3 seconds. Video is available after recording and upload finish.", "Tiến độ cập nhật mỗi 3 giây. Video có sau khi ghi hình và upload hoàn tất.")}</small>
  </section>;
}
