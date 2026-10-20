import type {
  AnalyticsPreferences,
  AuditEvent,
  CarlaIntegrationConfig,
  Scenario,
  ScenarioRun,
  ScenarioVersionRecord,
} from "../types";

const keys = {
  versions: "autoscenariox.workflow.scenario-versions.v1",
  runs: "autoscenariox.workflow.runs.v1",
  audit: "autoscenariox.workflow.audit.v1",
  carla: "autoscenariox.workflow.carla.v1",
  analytics: "autoscenariox.workflow.analytics.v1",
  rankings: "autoscenariox.workflow.rankings.v1",
};

const defaultCarlaConfig: CarlaIntegrationConfig = {
  host: "127.0.0.1",
  rpcPort: 2000,
  streamingPort: 2001,
  carlaVersion: "0.9.16",
  scenarioRunnerPath: "",
  qualityLevel: "Low",
  validated: false,
  active: false,
  updatedAt: "Not configured",
};

const defaultAnalytics: AnalyticsPreferences = {
  similarityWarning: 0.78,
  similarityBlock: 0.93,
  featureWeights: { map: 1, category: 1, weather: 1, severity: 1, actors: 1 },
  retentionDays: 180,
};

function read<T>(key: string, fallback: T): T {
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The current workspace remains usable if browser storage is unavailable.
  }
}

function digest(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function scenarioVersionHistory(scenario: Scenario): ScenarioVersionRecord[] {
  const all = read<Record<string, ScenarioVersionRecord[]>>(keys.versions, {});
  const history = all[scenario.id] ?? [];
  if (history.some((item) => item.version === scenario.version)) return history;
  const initial: ScenarioVersionRecord = {
    version: scenario.version,
    savedAt: "Imported from workspace seed",
    note: "Initial scenario definition",
    hash: digest(JSON.stringify(scenario)),
    status: scenario.status,
  };
  const next = [initial,
    ...history,
  ];
  write(keys.versions, { ...all, [scenario.id]: next });
  return next;
}

export function recordScenarioVersion(scenario: Scenario, note: string): ScenarioVersionRecord[] {
  const all = read<Record<string, ScenarioVersionRecord[]>>(keys.versions, {});
  const current = all[scenario.id] ?? [];
  const record: ScenarioVersionRecord = {
    version: scenario.version,
    savedAt: new Date().toLocaleString(),
    note,
    hash: digest(JSON.stringify(scenario)),
    status: scenario.status,
  };
  const next = [record, ...current.filter((item) => item.version !== record.version)];
  write(keys.versions, { ...all, [scenario.id]: next });
  return next;
}

export function listRuns(): ScenarioRun[] {
  return read(keys.runs, []);
}

export function saveRuns(runs: ScenarioRun[]): void {
  write(keys.runs, runs);
}

export function appendAuditEvent(event: Omit<AuditEvent, "id" | "time"> & { time?: string }): AuditEvent {
  const events = read<AuditEvent[]>(keys.audit, []);
  const entry: AuditEvent = {
    ...event,
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: event.time ?? new Date().toLocaleString(),
  };
  write(keys.audit, [entry, ...events].slice(0, 500));
  return entry;
}

export function listAuditEvents(): AuditEvent[] {
  return read(keys.audit, []);
}

export function getCarlaConfig(): CarlaIntegrationConfig {
  return read(keys.carla, defaultCarlaConfig);
}

export function saveCarlaConfig(config: CarlaIntegrationConfig): void {
  write(keys.carla, config);
}

export function getAnalyticsPreferences(): AnalyticsPreferences {
  return read(keys.analytics, defaultAnalytics);
}

export function saveAnalyticsPreferences(preferences: AnalyticsPreferences): void {
  write(keys.analytics, preferences);
}

export function saveRanking(key: string, value: unknown): void {
  const rankings = read<Record<string, unknown>>(keys.rankings, {});
  write(keys.rankings, { ...rankings, [key]: value });
}

export function getRanking<T>(key: string): T | undefined {
  return read<Record<string, T>>(keys.rankings, {})[key];
}
