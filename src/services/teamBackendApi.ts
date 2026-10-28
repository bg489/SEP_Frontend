import type { AutoScenarioApi, CarlaIntegrationConfig, Campaign, OverviewData } from "../types";
import { mockApi } from "./mockApi";
import { TeamApiError, downloadTeamArtifact, readTeamMedia, refreshTeamSession, requestTeamApi, teamClient } from "./teamClient";
import { isTeamDevAuth } from "./authConfig";
import { TeamScenarioService, teamScenarioFromReady } from "./teamScenarios";
import { campaignToUi, runToUi, type TeamCampaign, type TeamRun } from "./teamOperations";

const scenarios = new TeamScenarioService(teamClient);
const endpoint = "/api/v1/campaigns";
const json = (method: string, value?: unknown): RequestInit => ({ method, body: value === undefined ? undefined : JSON.stringify(value) });
const campaigns = () => requestTeamApi<TeamCampaign[]>(endpoint);
const runsFor = (id: string) => requestTeamApi<TeamRun[]>(`${endpoint}/${encodeURIComponent(id)}/runs`);

async function allUiScenarios(filters: Parameters<AutoScenarioApi["listScenarios"]>[0] = {}) {
  try { return await scenarios.listScenarios(filters); }
  catch (error) {
    // Non-authoring roles can consume published READY versions. A permission
    // response is the only fallback; connection/server errors remain visible.
    if (!(error instanceof TeamApiError) || error.status !== 403) throw error;
    const items = (await scenarios.allReady()).map(teamScenarioFromReady);
    const query = filters.query?.toLowerCase();
    return items.filter(item => (!query || `${item.name} ${item.id} ${item.map}`.toLowerCase().includes(query)) &&
      (!filters.status || filters.status === "All statuses" || filters.status === item.status || filters.status === "Approved"));
  }
}

/** Explicit capability split. Unsupported modules use local mocks; live methods
 * never replace API failures with successful mock responses. */
export const teamBackendApi: AutoScenarioApi = {
  ...mockApi,
  backendRequest: requestTeamApi,
  backendDownload: downloadTeamArtifact,
  backendMedia: readTeamMedia,
  async backendRefreshSession() {
    if (isTeamDevAuth) throw new Error("Dev mode has no Supabase token to refresh.");
    await refreshTeamSession();
  },
  listScenarios: allUiScenarios,
  createScenario: input => scenarios.createScenario(input),
  persistImportedScenario: (scenario, content) => scenarios.persistImportedScenario(scenario, content),
  updateScenario: (id, changes) => scenarios.updateScenario(id, changes),
  cloneScenario: id => scenarios.cloneScenario(id),
  updateScenarioStatus: (id, status, note) => scenarios.updateScenarioStatus(id, status, note),
  listScenarioVersions: id => scenarios.listScenarioVersions(id),
  async updateScenarioMetrics() { throw new Error("Scenario metrics are computed by the team backend from run results."); },
  async listCampaigns() { return (await campaigns()).map(campaignToUi); },
  async createCampaign(input) {
    const ready = await scenarios.allReady();
    const scenarioVersionIds = input.scenarioIds.map(id => {
      const version = ready.find(item => item.scenarioId === id || item.scenarioVersionId === id);
      if (!version) throw new Error(`Scenario ${id} has no READY version. Publish a valid version first.`);
      return version.scenarioVersionId;
    });
    return campaignToUi(await requestTeamApi<TeamCampaign>(endpoint, json("POST", {
      name: input.name, description: input.description, strategy: input.strategy,
      scenarioVersionIds, sutType: input.agent === "Autopilot" ? "autopilot" : "behavior_agent",
      sutBehavior: "normal", sutCarlaVersion: "0.9.16",
    })));
  },
  async updateCampaign(id, changes) {
    const allowed: Partial<Campaign> = {};
    for (const key of ["name", "description", "strategy"] as const) if (changes[key] !== undefined) allowed[key] = changes[key];
    if (!Object.keys(allowed).length) throw new Error("Campaign status and metrics are owned by the backend. Use Start run to execute a campaign.");
    return campaignToUi(await requestTeamApi<TeamCampaign>(`${endpoint}/${encodeURIComponent(id)}`, json("PATCH", allowed)));
  },
  async getCampaignRanking() { return null; },
  async saveCampaignRanking() { throw new Error("Use the live prioritization workspace to rank and save campaign version order."); },
  // The former global mock cluster model has confidence/labels that the backend
  // does not return. Live analysis pages load the actual campaign-scoped DTO
  // through failureAnalysisApi instead of inventing those legacy fields.
  async listFailures() { return []; },
  async addFailureCluster() { throw new Error("Failure groups are produced by the backend. Open Failure insights and group the campaign results."); },
  async confirmFailureCluster() { throw new Error("Use the backend report review workflow in Review queue to record a review decision."); },
  async listRuns() {
    const all = await campaigns();
    return (await Promise.all(all.filter(item => item.runCount > 0).map(item => runsFor(item.id)))).flat().map(runToUi);
  },
  async queueCampaignRuns(id, _scenarioIds, retryOf) {
    if (retryOf) throw new Error("Open the execution workspace and explicitly rerun the campaign. Rerun replaces previous runs.");
    await requestTeamApi(`${endpoint}/${encodeURIComponent(id)}/start`, json("POST"));
    return (await runsFor(id)).map(runToUi);
  },
  async cancelCampaignRuns() { throw new Error("The team backend does not expose campaign cancellation. Stop the local worker from its control panel if needed."); },
  async downloadRunArtifact(runId, fileName) {
    const path = `/api/v1/runs/${encodeURIComponent(runId)}`;
    if (/\.mp4$/i.test(fileName)) return downloadTeamArtifact(`${path}/video`, fileName);
    if (fileName !== "oracle-result.json") throw new Error("This backend provides oracle-result.json and recorded run video.");
    const result = await requestTeamApi(`${path}/result`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${runId}-oracle-result.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async getCarlaIntegration(): Promise<CarlaIntegrationConfig> {
    return { ...await mockApi.getCarlaIntegration(), active: false, validated: false, connectionStatus: "Not tested" };
  },
  saveCarlaIntegration: config => mockApi.saveCarlaIntegration({ ...config, active: false, validated: false, connectionStatus: "Not tested" }),
  async testCarlaIntegration() { throw new Error("The team backend does not expose a CARLA connection or worker-management API. Start its existing worker manually and inspect real run results."); },
  async listWorkers() { return []; },
  saveWorkers: workers => mockApi.saveWorkers(workers),
  async getOverview(): Promise<OverviewData> {
    const all = await campaigns();
    const runs = (await Promise.all(all.filter(item => item.runCount > 0).map(item => runsFor(item.id)))).flat();
    let totalScenarios: number;
    try { totalScenarios = (await scenarios.search({ pageSize: 1 })).totalCount; }
    catch (error) { if (!(error instanceof TeamApiError) || error.status !== 403) throw error; totalScenarios = (await scenarios.ready({ pageSize: 1 })).totalCount; }
    const terminal = runs.filter(item => item.verdict);
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 6 + index); return date; });
    const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return { totalScenarios, activeCampaigns: all.filter(item => item.status === "Running").length,
      passRate: terminal.length ? Math.round(terminal.filter(item => item.verdict === "PASS").length / terminal.length * 1000) / 10 : 0,
      failureClusters: 0, weeklyRuns: days.map(date => runs.filter(run => run.finishedAt && dayKey(new Date(run.finishedAt)) === dayKey(date)).length),
      weeklyLabels: days.map(date => date.toLocaleDateString(undefined, { weekday: "short" })),
      recentActivity: all.slice(0, 5).map(item => ({ id: item.id, title: item.name, detail: `${item.code} · ${item.status} · ${item.runCount} runs`, time: item.createdAt, type: "info" })),
    };
  },
};
