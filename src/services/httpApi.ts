import type {
  AutoScenarioApi,
  Campaign,
  CreateCampaignInput,
  CreateScenarioInput,
  OracleRule,
  OverviewData,
  Scenario,
  ScenarioFilters,
  ScenarioStatus,
  ScenarioVersionRecord,
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
      const message = await response.text().catch(() => "");
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
  persistImportedScenario(scenario: Scenario) {
    return this.request<Scenario>("/api/scenarios/import", {
      method: "POST",
      body: JSON.stringify(scenario),
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
  updateScenarioMetrics(id: string, changes: Pick<Scenario, "runCount" | "passRate" | "lastRun">) {
    return this.request<Scenario>("/api/scenarios/" + encodeURIComponent(id) + "/execution-metrics", {
      method: "PATCH",
      body: JSON.stringify(changes),
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
}
