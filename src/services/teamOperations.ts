import type { Campaign, ScenarioRun, OracleRule } from "../types";

export interface ReadyVersion {
  scenarioVersionId: string; scenarioId: string; scenarioCode: string; scenarioName: string;
  category: string; versionNumber: number; isLatestReady: boolean; mapName: string | null;
  weatherPreset: string | null; actorCount: number; eventCount: number; contentHash: string;
  egoBlueprint: string | null; speedLimitKmh: number | null;
}
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
  verdict: string | null; contentHash: string | null; seed: number | null;
  startedAt: string | null; finishedAt: string | null; errorMessage: string | null;
}
export interface OracleConfig {
  id: string; version: number; name: string; description: string | null;
  speedingToleranceKmh: number; speedingMinDurationS: number; freezingMaxStillS: number;
  ttcThresholdS: number; routeGoalToleranceM: number; createdAt: string;
}
export interface RunResult {
  runId: string; campaignId: string; campaignName: string; scenarioId: string; scenarioVersionId: string;
  scenarioName: string; versionNumber: number; status: string; seed: number | null;
  startedAt: string | null; finishedAt: string | null; outcome: string | null;
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
    scenarioName: string; severity: string; score: number; rationale: string; estimatedCostMinutes: number }[];
  featureNames: string[]; distanceMatrix: number[][] | null;
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
