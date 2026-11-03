import type { RankResult } from "../services/teamOperations";
import { useLocale } from "../localeContext";

export function RankingHistory({ metrics }: { metrics: RankResult["metrics"] }) {
  const { locale } = useLocale(); const t = (en: string, vi: string) => locale === "vi" ? vi : en;
  const display = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "—";
  return <div className="ops-callout" aria-label={t("Observed Oracle history", "Lịch sử Oracle đã quan sát")}>
    <b>{t("Observed Oracle history", "Lịch sử Oracle đã quan sát")}</b>
    <p>{metrics.observedRuns ?? 0} {t("judged runs", "run đã được chấm")} · APFD: {display(metrics.observedApfd)} · APFDc: {display(metrics.observedApfdc)}</p>
    {!metrics.observedRuns && <p>{t("No observed history is available for these versions. Ranking uses content features as a fallback.", "Chưa có lịch sử đã quan sát cho các phiên bản này. Xếp hạng dựa vào đặc trưng nội dung.")}</p>}
  </div>;
}
