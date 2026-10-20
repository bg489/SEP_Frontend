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
  CreateCampaignInput,
  CreateScenarioInput,
  OracleRule,
  OverviewData,
  Scenario,
  ScenarioFilters,
  ScenarioStatus,
  ScenarioVersionRecord,
} from "../types";
import {
  appendAuditEvent,
  recordScenarioVersion,
  scenarioVersionHistory,
} from "./workflowStore";

const storageKeys = {
  scenarios: "autoscenariox.mock.scenarios",
  campaigns: "autoscenariox.mock.campaigns",
  oracles: "autoscenariox.mock.oracles",
  failures: "autoscenariox.mock.failures",
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
  async persistImportedScenario(scenario: Scenario): Promise<Scenario> {
    const items = readStored(storageKeys.scenarios, mockScenarios);
    const created = { ...scenario, id: makeId("SCN", items), version: "v1.0" };
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
  async listFailures() {
    return readStored(storageKeys.failures, mockFailures);
  },
  async confirmFailureCluster(id: string) {
    const items = readStored(storageKeys.failures, mockFailures);
    const failure = items.find((item) => item.id === id);
    if (!failure) throw new Error("Failure cluster not found: " + id);
    const updated = { ...failure, reviewStatus: "Confirmed" as const };
    writeStored(
      storageKeys.failures,
      items.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  },
  async listWorkers() {
    return mockWorkers;
  },
  async listOracleRules() {
    return readStored(storageKeys.oracles, mockOracleRules);
  },
  async saveOracleRules(rules: OracleRule[]) {
    writeStored(storageKeys.oracles, rules);
    return rules;
  },
};
