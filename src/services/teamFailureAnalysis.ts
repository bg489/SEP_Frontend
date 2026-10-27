import type { TeamApiClient } from "./teamContracts";
import type { RunResult, TeamCampaign } from "./teamOperations";

export interface DetectionPoint {
  testsRun: number;
  faultsFound: number;
  fraction: number;
}
export interface OrderEffectiveness {
  label: string;
  apfd: number | null;
  apfdc: number | null;
  curve: DetectionPoint[];
}
export interface FailureEffectiveness {
  proposed: OrderEffectiveness;
  reverseBaseline: OrderEffectiveness;
  randomBaseline: OrderEffectiveness;
  apfdGainVsReverse: number | null;
}
export interface RunFeature {
  runId: string;
  sortOrder: number;
  scenarioCode: string;
  scenarioName: string;
  verdict: string;
  outcome: string | null;
  durationS: number | null;
  hasVideo: boolean;
  failingChecks: string[];
  warningChecks: string[];
}
export interface FaultGroup {
  rootScenarioId: string;
  rootScenarioCode: string;
  rootScenarioName: string;
  check: string;
  runIds: string[];
  firstDetectedRunId: string;
  firstT: number;
  explanation: string | null;
  report: string | null;
  needsAdditionalVerification: boolean;
  status: string;
  similarRunIds: string[];
}
export interface FailureAnalysis {
  analysisId: string;
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  step: string;
  runsJudged: number;
  passCount: number;
  failCount: number;
  errorExcluded: number;
  pendingCount: number;
  summary: string;
  reviewNote: string | null;
  features: RunFeature[];
  faults: FaultGroup[];
  effectiveness: FailureEffectiveness | null;
}
export type FailureReviewDecision = "needs_more" | "complete";
export type FailureAnalysisAction = "group" | "verify" | "similar" | "explainability" | "return-to-flow3" | "generate" | "review" | "evaluation";

/** Mirror the backend transition gates; the server remains authoritative. */
export function failureActionAllowed(action: FailureAnalysisAction, step: string | null | undefined): boolean {
  if (action === "group") return true;
  if (action === "verify") return step === "grouped";
  if (action === "similar") return step === "verified";
  if (action === "explainability") return step === "similar_found";
  if (action === "return-to-flow3") return step === "unexplained";
  if (action === "generate") return step === "explainable";
  if (action === "review") return step === "report_draft" || step === "needs_more";
  return action === "evaluation" && step === "evaluated";
}

/** Every request retains the injected, authenticated Redux Saga transport. */
export function failureAnalysisApi(client: TeamApiClient) {
  const segment = encodeURIComponent;
  const base = (campaignId: string) => `/api/v1/campaigns/${segment(campaignId)}/failure-analysis`;
  const post = (campaignId: string, suffix = "") => client.request<FailureAnalysis>(`${base(campaignId)}${suffix}`, { method: "POST" });
  return {
    campaigns: () => client.request<TeamCampaign[]>("/api/v1/campaigns"),
    get: (campaignId: string) => client.request<FailureAnalysis>(base(campaignId)),
    group: (campaignId: string) => post(campaignId),
    verify: (campaignId: string) => post(campaignId, "/verify"),
    similar: (campaignId: string) => post(campaignId, "/similar"),
    explainability: (campaignId: string) => post(campaignId, "/explainability"),
    returnToFlow3: (campaignId: string) => post(campaignId, "/return-to-flow3"),
    generate: (campaignId: string) => post(campaignId, "/generate"),
    review: (campaignId: string, decision: FailureReviewDecision, note?: string | null) => client.request<FailureAnalysis>(`${base(campaignId)}/review`, {
      method: "POST", body: JSON.stringify({ decision, note: note ?? null }),
    }),
    evaluation: (campaignId: string) => client.request<FailureEffectiveness>(`${base(campaignId)}/evaluation`),
    download: (campaignId: string, fileName = `failure-analysis-${campaignId}.json`) => client.download(base(campaignId), fileName),
    runResult: (runId: string) => client.request<RunResult>(`/api/v1/runs/${segment(runId)}/result`),
    downloadRun: (runId: string) => client.download(`/api/v1/runs/${segment(runId)}/result`, `oracle-${runId}.json`),
    downloadVideo: (runId: string) => client.download(`/api/v1/runs/${segment(runId)}/video`, `carla-${runId}.mp4`),
    video: (runId: string) => client.media ? client.media(`/api/v1/runs/${segment(runId)}/video`) : Promise.reject(new Error("Authenticated video preview is unavailable.")),
    supportsVideo: Boolean(client.media),
  };
}
