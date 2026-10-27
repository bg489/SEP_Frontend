import type { TeamApiClient, TeamCatalog, TeamMap, TeamObject } from "./teamContracts";

/** Wire contracts from the reference and coverage controllers. Coordinates are CARLA metres/degrees. */
export interface TeamSpawnPoint { index: number; x: number; y: number; z: number; yaw: number }
export interface TeamMapDetail { mapName: string; carlaVersion: string; spawnPointCount: number; spawnPoints: TeamSpawnPoint[] }
export interface TeamScenarioTemplate {
  key: string; title: string; summary: string; category: string; mapName: string; eventTypes: string[]; reference: string | null;
}
export interface TeamDatabaseHealth {
  status: string; postgres: string; missingTables?: string[];
  /** Older deployed API versions return counts. Never invent a missing-table list from those counts. */
  asxTables?: number; expectedTables?: number;
}
export interface TeamCoverageItem {
  scenarioId: string; code: string; name: string; scenarioVersionId: string; versionNumber: number;
  isLatestReady: boolean; category: string; mapName: string | null; weatherPreset: string | null; eventTypes: string[];
}
export interface TeamCoverage {
  scope: "latest" | "all"; scenarioCount: number; versionCount: number;
  axes: { maps: string[]; weatherPresets: string[]; categories: string[]; eventTypes: string[] };
  items: TeamCoverageItem[];
}
export type CoverageDimension = "map" | "weather" | "category" | "event";
export const NO_COVERAGE_EVENT = "(none)";
export const MISSING_COVERAGE_VALUE = "—";
export const coverageCellKey = (row: string, column: string) => JSON.stringify([row, column]);

export function coverageValues(item: TeamCoverageItem, dimension: CoverageDimension): string[] {
  if (dimension === "map") return [item.mapName ?? MISSING_COVERAGE_VALUE];
  if (dimension === "weather") return [item.weatherPreset ?? MISSING_COVERAGE_VALUE];
  if (dimension === "category") return [item.category];
  return item.eventTypes.length ? [...new Set(item.eventTypes)] : [NO_COVERAGE_EVENT];
}

export function coverageAxis(data: TeamCoverage, dimension: CoverageDimension): string[] {
  const known = dimension === "map" ? data.axes.maps : dimension === "weather" ? data.axes.weatherPresets
    : dimension === "category" ? data.axes.categories : [...data.axes.eventTypes, NO_COVERAGE_EVENT];
  // Preserve backend catalogue order and keep observed empty/unknown values inspectable.
  return [...new Set([...known, ...data.items.flatMap(item => coverageValues(item, dimension))])];
}

export function coverageMatrix(data: TeamCoverage, rows: CoverageDimension, columns: CoverageDimension) {
  const rowValues = coverageAxis(data, rows), columnValues = coverageAxis(data, columns);
  const cells = new Map<string, TeamCoverageItem[]>();
  for (const item of data.items) for (const row of coverageValues(item, rows)) for (const column of coverageValues(item, columns)) {
    const key = coverageCellKey(row, column);
    cells.set(key, [...(cells.get(key) ?? []), item]);
  }
  const combinations = rowValues.length * columnValues.length;
  return { rowValues, columnValues, cells, covered: cells.size, combinations, ratio: combinations ? cells.size / combinations : 0 };
}

export const referenceApi = (client: TeamApiClient) => ({
  maps: () => client.request<TeamMap[]>("/api/v1/reference/maps"),
  map: (mapName: string) => client.request<TeamMapDetail>(`/api/v1/reference/maps/${encodeURIComponent(mapName)}`),
  catalog: () => client.request<TeamCatalog>("/api/v1/reference/catalog"),
  templates: () => client.request<TeamScenarioTemplate[]>("/api/v1/reference/scenario-templates"),
  schema: () => client.request<TeamObject>("/api/v1/reference/scenario-schema"),
  coverage: (scope: "latest" | "all" = "latest") => client.request<TeamCoverage>(`/api/v1/coverage?scope=${scope}`),
  health: () => client.request<TeamDatabaseHealth>("/api/health/db"),
});
