import type { Campaign, ScenarioRun, OracleRule } from "../types";
import type { TeamApiClient, TeamPage, TeamReadyVersion } from "./teamContracts";

export type ReadyVersion = TeamReadyVersion;
export interface TeamCampaign {
  id: string; code: string; name: string; description: string | null; strategy: string;
  status: string; progress: number; passRate: number; failedRuns: number; estimatedDuration: string;
  owner: string; createdAt: string; startedAt: string | null; runCount: number;
  sut: { type: string; behavior: string; carlaVersion: string };
  scenarioVersionIds: string[];
  scenarios: { scenarioVersionId: string; scenarioId: string; scenarioCode: string; scenarioName: string;
    versionNumber: number; mapName: string | null; weatherPreset: string | null; category: string; sortOrder: number }[];
}
export interface TeamRun {
  id: string; campaignId: string; scenarioVersionId: string; scenarioId: string;
  scenarioCode: string; scenarioName: string; versionNumber: number; status: string;
  category: string; mapName: string | null; weatherPreset: string | null; sortOrder: number;
  verdict: string | null; contentHash: string | null; seed: number | null;
  startedAt: string | null; finishedAt: string | null; errorMessage: string | null;
}
export interface OracleConfig {
  id: string; version: number; name: string; description: string | null;
  speedingToleranceKmh: number; speedingMinDurationS: number; freezingMaxStillS: number;
  ttcThresholdS: number; routeGoalToleranceM: number; createdAt: string;
}
export interface RunResult {
  runId: string; campaignId: string; campaignCode: string | null; campaignName: string; scenarioId: string; scenarioVersionId: string;
  scenarioCode: string; scenarioName: string; versionNumber: number; status: string; seed: number | null;
  startedAt: string | null; finishedAt: string | null; outcome: string | null;
  telemetryReceivedAt: string | null;
  durationS: number | null; verdict: string | null; hasVideo: boolean; infraRetryCount: number;
  evaluations: { id: string; oracleConfigId: string; oracleVersion: number; verdict: string;
    errorReason: string | null; evaluatedAt: string;
    violations: { id: string; check: string; severity: string; t: number; durationS: number | null; details: unknown }[] }[];
}
export interface RankResult {
  runId: string; strategy: string; createdAt: string;
  metrics: { apfdEstimate: number; apfdcEstimate: number; faultsFoundEarlyEstimate: number;
    faultsTotalEstimate: number; estimatedSuiteMinutes: number; note: string };
  ordered: { rank: number; scenarioVersionId: string; scenarioId: string; scenarioCode: string;
    scenarioName: string; category: string; mapName: string | null; weatherPreset: string | null;
    severity: string; failureSignalEstimate: number; score: number; rationale: string; estimatedCostMinutes: number }[];
  featureNames: string[]; distanceMatrix: number[][] | null;
}
export interface CampaignCreateInput {
  name: string; description?: string | null; strategy?: string; scenarioVersionIds: string[];
  sutType?: string; sutBehavior?: string; sutCarlaVersion?: string;
}
export type CampaignUpdateInput = Partial<CampaignCreateInput>;
export interface ReadyVersionQuery {
  q?: string; category?: string; map?: string; scenarioId?: string;
  latestOnly?: boolean; page?: number; pageSize?: number;
}
export interface PrioritizationStrategy { id: string; label: string; description: string }
export interface PrioritizationInput {
  scenarioVersionIds?: string[]; strategy: string;
  params?: { diversityWeight?: number; riskWeight?: number; seed?: number; limit?: number };
}

/** Contract-specific helpers retain the injected Redux Saga transport for every request. */
export function operationsApi(client: TeamApiClient) {
  const id = encodeURIComponent;
  const write = (method: "POST" | "PATCH", body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
  return {
    listCampaigns: () => client.request<TeamCampaign[]>("/api/v1/campaigns"),
    getCampaign: (campaignId: string) => client.request<TeamCampaign>(`/api/v1/campaigns/${id(campaignId)}`),
    createCampaign: (body: CampaignCreateInput) => client.request<TeamCampaign>("/api/v1/campaigns", write("POST", body)),
    updateCampaign: (campaignId: string, body: CampaignUpdateInput) => client.request<TeamCampaign>(`/api/v1/campaigns/${id(campaignId)}`, write("PATCH", body)),
    startCampaign: (campaignId: string) => client.request<TeamCampaign>(`/api/v1/campaigns/${id(campaignId)}/start`, { method: "POST" }),
    rerunCampaign: (campaignId: string) => client.request<TeamCampaign>(`/api/v1/campaigns/${id(campaignId)}/rerun`, { method: "POST" }),
    listRuns: (campaignId: string) => client.request<TeamRun[]>(`/api/v1/campaigns/${id(campaignId)}/runs`),
    availableReady: (query: ReadyVersionQuery = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      }
      return client.request<TeamPage<ReadyVersion>>(`/api/v1/campaigns/available-scenarios${params.size ? `?${params}` : ""}`);
    },
    listStrategies: () => client.request<PrioritizationStrategy[]>("/api/v1/prioritization/strategies"),
    rank: (body: PrioritizationInput) => client.request<RankResult>("/api/v1/prioritization/rank", write("POST", body)),
    listOracleConfigs: () => client.request<OracleConfig[]>("/api/v1/oracle-configs"),
    getRunResult: (runId: string) => client.request<RunResult>(`/api/v1/runs/${id(runId)}/result`),
    downloadRunResult: (runId: string, fileName = `oracle-${runId}.json`) => client.download(`/api/v1/runs/${id(runId)}/result`, fileName),
    downloadVideo: (runId: string, fileName = `carla-${runId}.mp4`) => client.download(`/api/v1/runs/${id(runId)}/video`, fileName),
    videoMedia: (runId: string) => client.media ? client.media(`/api/v1/runs/${id(runId)}/video`) : Promise.reject(new Error("Authenticated video preview is unavailable.")),
    supportsVideoMedia: Boolean(client.media),
  };
}
export interface WorkerIntegration {
  carlaRoot: string; pythonExecutable: string; host: string; rpcPort: number; trafficManagerPort: number;
  qualityLevel: "Low"; recordVideo: boolean; workerRunning: boolean; workerPid: number | null;
  connectionStatus: string; validated: boolean; active: boolean; message: string; updatedAt: string;
}
export const workerDefaults: WorkerIntegration = {
  carlaRoot: "C:\\Users\\admin\\Downloads\\CARLA_0.9.16",
  pythonExecutable: "C:\\Users\\admin\\Downloads\\CARLA_0.9.16\\ScenarioRunner\\.venv\\Scripts\\python.exe",
  host: "127.0.0.1", rpcPort: 2000, trafficManagerPort: 8000, qualityLevel: "Low", recordVideo: true,
  workerRunning: false, workerPid: null, connectionStatus: "Not tested", validated: false,
  active: false, message: "", updatedAt: "",
};

export function campaignToUi(c: TeamCampaign): Campaign {
  const statuses: Record<string, Campaign["status"]> = { NeedsReview: "Needs review", Cancelled: "Cancelled" };
  return { id: c.id, name: c.name, description: c.description ?? "", strategy: c.strategy,
    scenarioIds: c.scenarios.map(s => s.scenarioId), status: statuses[c.status] ?? c.status as Campaign["status"],
    progress: c.progress, passRate: c.passRate, failedRuns: c.failedRuns, owner: c.owner,
    createdAt: c.createdAt, estimatedDuration: c.estimatedDuration, sutName: c.sut.type,
    sutVersion: c.sut.carlaVersion, agent: c.sut.type === "autopilot" ? "Autopilot" : "Behavior Agent" };
}
export function runToUi(r: TeamRun): ScenarioRun {
  const state: ScenarioRun["state"] = r.status === "Queued" ? "Queued"
    : r.status === "Claimed" ? "Assigned" : r.status === "Running" ? "Running"
    : r.status === "TimedOut" ? "Timed Out" : r.verdict === "PASS" ? "Passed" : "Failed";
  return { id: r.id, campaignId: r.campaignId, scenarioId: r.scenarioId, scenarioName: r.scenarioName,
    scenarioVersion: `v${r.versionNumber}`, state, progress: state === "Queued" ? 0 : state === "Assigned" ? 10 : state === "Running" ? 35 : 100,
    verdict: r.verdict === "PASS" || r.verdict === "FAIL" || r.verdict === "ERROR" ? r.verdict : undefined,
    randomSeed: r.seed ?? undefined, startedAt: r.startedAt ?? undefined, artifacts: ["oracle-result.json"],
    evidence: r.errorMessage ? [{ timestamp: r.finishedAt ?? "", rule: "Execution", measured: r.status,
      threshold: "Completed", note: r.errorMessage }] : [] };
}
export function oracleRulesToUi(c: OracleConfig): OracleRule[] {
  return [
    { id: "speeding", name: "Speed limit", description: "Tolerance above the road speed limit", enabled: true, threshold: c.speedingToleranceKmh, unit: "km/h" },
    { id: "stagnation", name: "Vehicle freezing", description: "Maximum stationary interval", enabled: true, threshold: c.freezingMaxStillS, unit: "s" },
    { id: "unsafe-ttc", name: "Unsafe time to collision", description: "Minimum TTC", enabled: true, threshold: c.ttcThresholdS, unit: "s" },
  ];
}
