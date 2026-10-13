import type {
  AutoScenarioApi,
  Campaign,
  CreateCampaignInput,
  CreateScenarioInput,
  OracleRule,
  OverviewData,
  Scenario,
  ScenarioFilters,
  FailureCluster,
  WorkerNode,
} from "../types";

export class HttpAutoScenarioApi implements AutoScenarioApi {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
    /\/$/,
    "",
  );

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
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
  listCampaigns() {
    return this.request<Campaign[]>("/api/campaigns");
  }
  createCampaign(input: CreateCampaignInput) {
    return this.request<Campaign>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  listFailures() {
    return this.request<FailureCluster[]>("/api/analytics/failure-clusters");
  }
  confirmFailureCluster(id: string) {
    return this.request<FailureCluster>(
      "/api/analytics/failure-clusters/" + encodeURIComponent(id) + "/confirm",
      { method: "POST" },
    );
  }
  listWorkers() {
    return this.request<WorkerNode[]>("/api/simulation-nodes");
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
