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
} from "../types";

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
    const overview = readStored("autoscenariox.mock.overview", mockOverview);
    writeStored("autoscenariox.mock.overview", {
      ...overview,
      totalScenarios: overview.totalScenarios + 1,
    });
    return created;
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
