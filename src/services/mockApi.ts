import {
  mockCampaigns,
  mockFailures,
  mockOracleRules,
  mockOverview,
  mockScenarios,
  mockWorkers,
} from "../data/mockData";
import type {
  AutoScenarioApi,
  Campaign,
  CarlaIntegrationConfig,
  AnalyticsPreferences,
  AuditEvent,
  CreateCampaignInput,
  CreateScenarioInput,
  FailureCluster,
  OracleRule,
  OverviewData,
  Scenario,
  ScenarioFilters,
  ScenarioStatus,
  ScenarioVersionRecord,
  ScenarioRun,
  WorkerNode,
} from "../types";
import {
  appendAuditEvent,
  getAnalyticsPreferences,
  getCarlaConfig,
  getRanking,
  listAuditEvents as readAuditEvents,
  listRuns,
  saveCarlaConfig,
  saveAnalyticsPreferences,
  saveRanking,
  saveRuns,
  getOracleProfileState,
  saveOracleProfileState,
  recordScenarioVersion,
  scenarioVersionHistory,
} from "./workflowStore";

const storageKeys = {
  scenarios: "autoscenariox.mock.scenarios",
  campaigns: "autoscenariox.mock.campaigns",
  oracles: "autoscenariox.mock.oracles",
  failures: "autoscenariox.mock.failures",
  workers: "autoscenariox.mock.workers",
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The mock remains usable if browser storage is disabled.
  }
}

function makeId(prefix: string, items: { id: string }[]): string {
  const next =
    items.reduce((max, item) => {
      const value = Number(item.id.split("-").at(-1));
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0) + 1;
  return prefix + "-" + String(next).padStart(3, "0");
}

export const mockApi: AutoScenarioApi = {
  async getOverview(): Promise<OverviewData> {
    return readStored("autoscenariox.mock.overview", mockOverview);
  },
  async getCarlaIntegration(): Promise<CarlaIntegrationConfig> {
    return getCarlaConfig();
  },
  async saveCarlaIntegration(config: CarlaIntegrationConfig): Promise<CarlaIntegrationConfig> {
    saveCarlaConfig(config);
    return config;
  },
  async testCarlaIntegration(): Promise<CarlaIntegrationConfig> {
    throw new Error("A real CARLA readiness check requires API mode and the .NET backend.");
  },
  async getAnalyticsPreferences(): Promise<AnalyticsPreferences> {
    return getAnalyticsPreferences();
  },
  async saveAnalyticsPreferences(preferences: AnalyticsPreferences): Promise<AnalyticsPreferences> {
    saveAnalyticsPreferences(preferences);
    return preferences;
  },
  async listAuditEvents(): Promise<AuditEvent[]> {
    return readAuditEvents();
  },
  async listScenarios(filters: ScenarioFilters = {}): Promise<Scenario[]> {
    const query = (filters.query ?? "").trim().toLowerCase();
    const status = filters.status ?? "All statuses";
    return readStored(storageKeys.scenarios, mockScenarios).filter(
      (scenario) => {
        const matchesQuery =
          !query ||
          [
            scenario.id,
            scenario.name,
            scenario.description,
            scenario.map,
            ...scenario.tags,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesStatus =
          status === "All statuses" || scenario.status === status;
        return matchesQuery && matchesStatus;
      },
    );
  },
  async createScenario(input: CreateScenarioInput): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const created: Scenario = {
      ...input,
      id: makeId("SCN", items),
      status: "Draft",
      version: "v1.0",
      actors: 2,
      runCount: 0,
      passRate: 0,
      lastRun: "Never",
      owner: "Bao Doan",
      tags: [
        input.category.toLowerCase(),
        input.weather.toLowerCase().replaceAll(" ", "-"),
      ],
      priorityScore:
        input.severity === "Critical"
          ? 92
          : input.severity === "High"
            ? 80
            : 62,
    };
    writeStored(storageKeys.scenarios, [created, ...items]);
    recordScenarioVersion(created, "Scenario created");
    appendAuditEvent({ actor: "Current user", action: "Create scenario", target: created.id, result: "Success" });
    const overview = readStored("autoscenariox.mock.overview", mockOverview);
    writeStored("autoscenariox.mock.overview", {
      ...overview,
      totalScenarios: overview.totalScenarios + 1,
    });
    return created;
  },
  async persistImportedScenario(scenario: Scenario, sourceContent: string): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const created = { ...scenario, id: makeId("SCN", items), version: "v1.0" };
    try { localStorage.setItem(`autoscenariox.mock.scenario-source:${created.id}:${created.version}`, sourceContent); } catch { /* Keep the mock usable if storage is unavailable. */ }
    writeStored(storageKeys.scenarios, [created, ...items]);
    recordScenarioVersion(created, `Imported ${scenario.sourceFileName ?? "OpenSCENARIO file"}`);
    appendAuditEvent({ actor: "Current user", action: "Import scenario", target: created.id, result: "Success" });
    const overview = readStored("autoscenariox.mock.overview", mockOverview);
    writeStored("autoscenariox.mock.overview", { ...overview, totalScenarios: overview.totalScenarios + 1 });
    return created;
  },
  async updateScenario(id: string, changes: Partial<Scenario>): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const current = items.find((scenario) => scenario.id === id);
    if (!current) throw new Error("Scenario not found: " + id);
    scenarioVersionHistory(current);
    const versionParts = current.version.match(/^v(\d+)\.(\d+)$/);
    const nextVersion = versionParts
      ? `v${versionParts[1]}.${Number(versionParts[2]) + 1}`
      : "v1.1";
    const updated: Scenario = { ...current, ...changes, id, version: nextVersion, status: "Draft" };
    writeStored(storageKeys.scenarios, items.map((scenario) => scenario.id === id ? updated : scenario));
    recordScenarioVersion(updated, "Edited scenario definition");
    appendAuditEvent({ actor: "Current user", action: "Create scenario version", target: `${id} ${nextVersion}`, result: "Success" });
    return updated;
  },
  async cloneScenario(id: string): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const original = items.find((scenario) => scenario.id === id);
    if (!original) throw new Error("Scenario not found: " + id);
    const cloned: Scenario = {
      ...original,
      id: makeId("SCN", items),
      name: `Copy of ${original.name}`,
      version: "v1.0",
      status: "Draft",
      runCount: 0,
      passRate: 0,
      lastRun: "Never",
      owner: "Current user",
      tags: [...original.tags, "clone"],
    };
    writeStored(storageKeys.scenarios, [cloned, ...items]);
    recordScenarioVersion(cloned, `Cloned from ${original.id}`);
    appendAuditEvent({ actor: "Current user", action: "Clone scenario", target: `${original.id} → ${cloned.id}`, result: "Success" });
    const overview = readStored("autoscenariox.mock.overview", mockOverview);
    writeStored("autoscenariox.mock.overview", { ...overview, totalScenarios: overview.totalScenarios + 1 });
    return cloned;
  },
  async updateScenarioStatus(id: string, status: ScenarioStatus, note = ""): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const current = items.find((scenario) => scenario.id === id);
    if (!current) throw new Error("Scenario not found: " + id);
    const updated = { ...current, status };
    writeStored(storageKeys.scenarios, items.map((scenario) => scenario.id === id ? updated : scenario));
    appendAuditEvent({ actor: "Current user", action: `Scenario status: ${status}${note ? ` (${note})` : ""}`, target: id, result: "Success" });
    return updated;
  },
  async listScenarioVersions(id: string): Promise<ScenarioVersionRecord[]> {
    const scenario = readStored(storageKeys.scenarios, mockScenarios).find((item) => item.id === id);
    return scenario ? scenarioVersionHistory(scenario) : [];
  },
  async listCampaigns(): Promise<Campaign[]> {
    return readStored(storageKeys.campaigns, mockCampaigns);
  },
  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const items = readStored(storageKeys.campaigns, mockCampaigns);
    const created: Campaign = {
      ...input,
      id: makeId("CMP", items),
      status: "Draft",
      progress: 0,
      owner: "Bao Doan",
      createdAt: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(new Date())
        .replace(",", ""),
      passRate: 0,
      failedRuns: 0,
      estimatedDuration: "00:00:00",
    };
    writeStored(storageKeys.campaigns, [created, ...items]);
    return created;
  },
  async updateCampaign(id: string, changes: Partial<Campaign>): Promise<Campaign> {
    const items = readStored(storageKeys.campaigns, mockCampaigns);
    const current = items.find((campaign) => campaign.id === id);
    if (!current) throw new Error("Campaign not found: " + id);
    const updated = { ...current, ...changes, id };
    writeStored(storageKeys.campaigns, items.map((campaign) => campaign.id === id ? updated : campaign));
    if (changes.status && changes.status !== current.status) {
      appendAuditEvent({ actor: "Current user", action: `Campaign status: ${changes.status}`, target: id, result: "Success" });
    }
    return updated;
  },
  async getCampaignRanking(id: string): Promise<Record<string, unknown> | null> {
    return getRanking<Record<string, unknown>>(id) ?? null;
  },
  async saveCampaignRanking(id: string, ranking: Record<string, unknown>): Promise<void> {
    saveRanking(id, ranking);
  },
  async updateScenarioMetrics(id: string, changes: Pick<Scenario, "runCount" | "passRate" | "lastRun">): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const current = items.find((scenario) => scenario.id === id);
    if (!current) throw new Error("Scenario not found: " + id);
    const updated = { ...current, ...changes };
    writeStored(storageKeys.scenarios, items.map((scenario) => scenario.id === id ? updated : scenario));
    return updated;
  },
  async listRuns(): Promise<ScenarioRun[]> {
    return listRuns();
  },
  async downloadRunArtifact(): Promise<void> {
    throw new Error("Run artifact downloads are available in API mode.");
  },
  async queueCampaignRuns(campaignId: string, scenarioIds?: string[], retryOf?: string): Promise<ScenarioRun[]> {
    const campaign = (await mockApi.listCampaigns()).find((item) => item.id === campaignId);
    if (!campaign) throw new Error("Campaign not found: " + campaignId);
    const scenarios = await mockApi.listScenarios();
    const selected = (scenarioIds ?? campaign.scenarioIds).map((id) => scenarios.find((item) => item.id === id)).filter((item): item is Scenario => Boolean(item));
    if (!selected.length) throw new Error("The campaign has no available scenarios.");
    const stamp = Date.now();
    let sequence = 0;
    const queued = selected.flatMap((scenario) => Array.from({ length: Math.max(1, campaign.repetitions ?? 1) }, (_, index): ScenarioRun => ({
      id: `RUN-${stamp}-${++sequence}`,
      campaignId,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioVersion: scenario.version,
      state: "Queued",
      progress: 0,
      retryOf,
      repetition: index + 1,
      artifacts: [],
      evidence: [],
    })));
    saveRuns([...listRuns(), ...queued]);
    return queued;
  },
  async cancelCampaignRuns(campaignId: string): Promise<ScenarioRun[]> {
    const cancelled = listRuns().filter((run) => run.campaignId === campaignId && ["Queued", "Assigned", "Running"].includes(run.state)).map((run) => ({ ...run, state: "Cancelled" as const, progress: 0 }));
    const ids = new Set(cancelled.map((run) => run.id));
    saveRuns(listRuns().map((run) => ids.has(run.id) ? cancelled.find((item) => item.id === run.id)! : run));
    return cancelled;
  },
  async listFailures() {
    return readStored(storageKeys.failures, mockFailures);
  },
  async addFailureCluster(failure: FailureCluster): Promise<FailureCluster> {
    const items = readStored(storageKeys.failures, mockFailures);
    const failureRules = new Set(failure.evidence.map((item) => item.rule));
    const existing = items.find((item) => item.id === failure.id || (
      item.scenarioName === failure.scenarioName &&
      item.evidence.some((evidence) => failureRules.has(evidence.rule))
    ));
    const updated = existing
      ? {
          ...existing,
          affectedRuns: existing.affectedRuns + 1,
          evidence: [...failure.evidence, ...existing.evidence],
          lastDetected: failure.lastDetected,
          sourceRunId: failure.sourceRunId ?? existing.sourceRunId,
          reviewStatus: "Needs review" as const,
        }
      : failure;
    writeStored(storageKeys.failures, existing
      ? items.map((item) => item.id === existing.id ? updated : item)
      : [updated, ...items]);
    appendAuditEvent({ actor: "AutoScenarioX System", action: "Failure cluster updated", target: updated.id, result: "Success" });
    return updated;
  },
  async confirmFailureCluster(id: string, changes: Partial<FailureCluster> = {}) {
    const items = readStored(storageKeys.failures, mockFailures);
    const failure = items.find((item) => item.id === id);
    if (!failure) throw new Error("Failure cluster not found: " + id);
    const updated = {
      ...failure,
      ...changes,
      originalLabel: changes.label && changes.label !== failure.label ? failure.originalLabel ?? failure.label : failure.originalLabel,
      reviewStatus: "Confirmed" as const,
    };
    writeStored(
      storageKeys.failures,
      items.map((item) => (item.id === id ? updated : item)),
    );
    appendAuditEvent({ actor: changes.reviewedBy ?? "Current user", action: changes.label && changes.label !== failure.label ? `Corrected failure classification: ${failure.label} → ${changes.label}` : "Confirmed failure classification", target: id, result: "Success" });
    return updated;
  },
  async listWorkers() {
    return readStored(storageKeys.workers, mockWorkers);
  },
  async saveWorkers(workers: WorkerNode[]) {
    writeStored(storageKeys.workers, workers);
    return workers;
  },
  async listOracleRules() {
    return readStored(storageKeys.oracles, mockOracleRules);
  },
  async saveOracleRules(rules: OracleRule[]) {
    writeStored(storageKeys.oracles, rules);
    return rules;
  },
  async getOracleProfileState() {
    return getOracleProfileState();
  },
  async saveOracleProfileState(profile) {
    saveOracleProfileState(profile);
    return profile;
  },
};
