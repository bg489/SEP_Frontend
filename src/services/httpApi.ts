import type {
  AutoScenarioApi,
  Campaign,
  CarlaIntegrationConfig,
  AnalyticsPreferences,
  AuditEvent,
  CreateCampaignInput,
  CreateScenarioInput,
  OracleRule,
  OracleProfileState,
  OverviewData,
  Scenario,
  ScenarioFilters,
  ScenarioStatus,
  ScenarioVersionRecord,
  ScenarioRun,
  FailureCluster,
  WorkerNode,
} from "../types";
import { getAccessToken } from "./authToken";

export class HttpAutoScenarioApi implements AutoScenarioApi {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
    /\/$/,
    "",
  );

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const accessToken = getAccessToken();
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let message = body;
      try {
        const payload = JSON.parse(body) as { message?: unknown; title?: unknown };
        if (typeof payload.message === "string") message = payload.message;
        else if (typeof payload.title === "string") message = payload.title;
      } catch {
        // Keep plain-text API errors readable.
      }
      throw new Error(
        message || "Request failed with status " + response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  getOverview() {
    return this.request<OverviewData>("/api/dashboard/overview");
  }
  getCarlaIntegration() {
    return this.request<CarlaIntegrationConfig>("/api/integration/carla");
  }
  getAnalyticsPreferences() {
    return this.request<AnalyticsPreferences>("/api/analytics/preferences");
  }
  saveAnalyticsPreferences(preferences: AnalyticsPreferences) {
    return this.request<AnalyticsPreferences>("/api/analytics/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    });
  }
  listAuditEvents() {
    return this.request<AuditEvent[]>("/api/audit-log");
  }
  saveCarlaIntegration(config: CarlaIntegrationConfig) {
    return this.request<CarlaIntegrationConfig>("/api/integration/carla", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }
  testCarlaIntegration() {
    return this.request<CarlaIntegrationConfig>("/api/integration/carla/test", { method: "POST" });
  }
  listScenarios(filters: ScenarioFilters = {}) {
    const params = new URLSearchParams();
    if (filters.query) params.set("search", filters.query);
    if (filters.status && filters.status !== "All statuses")
      params.set("status", filters.status);
    const query = params.toString();
    const suffix = query ? "?" + query : "";
    return this.request<Scenario[]>("/api/scenarios" + suffix);
  }
  createScenario(input: CreateScenarioInput) {
    return this.request<Scenario>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  persistImportedScenario(scenario: Scenario, sourceContent: string) {
    return this.request<Scenario>("/api/scenarios/import", {
      method: "POST",
      body: JSON.stringify({ scenario, sourceFileName: scenario.sourceFileName, sourceContent }),
    });
  }
  updateScenario(id: string, changes: Partial<Scenario>) {
    return this.request<Scenario>("/api/scenarios/" + encodeURIComponent(id) + "/versions", {
      method: "POST",
      body: JSON.stringify(changes),
    });
  }
  cloneScenario(id: string) {
    return this.request<Scenario>("/api/scenarios/" + encodeURIComponent(id) + "/clone", { method: "POST" });
  }
  updateScenarioStatus(id: string, status: ScenarioStatus, note = "") {
    return this.request<Scenario>("/api/scenarios/" + encodeURIComponent(id) + "/status", {
      method: "PUT",
      body: JSON.stringify({ status, note }),
    });
  }
  listScenarioVersions(id: string) {
    return this.request<ScenarioVersionRecord[]>("/api/scenarios/" + encodeURIComponent(id) + "/versions");
  }
  listCampaigns() {
    return this.request<Campaign[]>("/api/campaigns");
  }
  createCampaign(input: CreateCampaignInput) {
    return this.request<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  updateCampaign(id: string, changes: Partial<Campaign>) {
    return this.request<Campaign>("/api/campaigns/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  }
  async getCampaignRanking(id: string) {
    return (await this.request<Record<string, unknown> | null>("/api/campaigns/" + encodeURIComponent(id) + "/ranking")) ?? null;
  }
  async saveCampaignRanking(id: string, ranking: Record<string, unknown>) {
    await this.request<void>("/api/campaigns/" + encodeURIComponent(id) + "/ranking", {
      method: "PUT",
      body: JSON.stringify(ranking),
    });
  }
  updateScenarioMetrics(id: string, changes: Pick<Scenario, "runCount" | "passRate" | "lastRun">) {
    return this.request<Scenario>("/api/scenarios/" + encodeURIComponent(id) + "/execution-metrics", {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
  }
  listRuns() {
    return this.request<ScenarioRun[]>("/api/runs");
  }
  async downloadRunArtifact(runId: string, fileName: string): Promise<void> {
    const accessToken = getAccessToken();
    const response = await fetch(`${this.baseUrl}/api/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(fileName)}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!response.ok) throw new Error(await response.text() || `Artifact download failed (${response.status}).`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  queueCampaignRuns(campaignId: string, scenarioIds?: string[], retryOf?: string) {
    return this.request<ScenarioRun[]>("/api/campaigns/" + encodeURIComponent(campaignId) + "/runs", {
      method: "POST",
      body: JSON.stringify({ scenarioIds, retryOf }),
    });
  }
  cancelCampaignRuns(campaignId: string) {
    return this.request<ScenarioRun[]>("/api/campaigns/" + encodeURIComponent(campaignId) + "/runs/cancel", {
      method: "POST",
    });
  }
  listFailures() {
    return this.request<FailureCluster[]>("/api/analytics/failure-clusters");
  }
  addFailureCluster(failure: FailureCluster) {
    return this.request<FailureCluster>("/api/analytics/failure-clusters", {
      method: "POST",
      body: JSON.stringify(failure),
    });
  }
  confirmFailureCluster(id: string, changes: Partial<FailureCluster> = {}) {
    return this.request<FailureCluster>(
      "/api/analytics/failure-clusters/" + encodeURIComponent(id) + "/confirm",
      { method: "POST", body: JSON.stringify(changes) },
    );
  }
  listWorkers() {
    return this.request<WorkerNode[]>("/api/simulation-nodes");
  }
  saveWorkers(workers: WorkerNode[]) {
    return this.request<WorkerNode[]>("/api/simulation-nodes", {
      method: "PUT",
      body: JSON.stringify(workers),
    });
  }
  listOracleRules() {
    return this.request<OracleRule[]>("/api/oracles/rules");
  }
  saveOracleRules(rules: OracleRule[]) {
    return this.request<OracleRule[]>("/api/oracles/rules", {
      method: "PUT",
      body: JSON.stringify(rules),
    });
  }
  getOracleProfileState() {
    return this.request<OracleProfileState>("/api/oracles/profile");
  }
  saveOracleProfileState(profile: OracleProfileState) {
    return this.request<OracleProfileState>("/api/oracles/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
  }
}
