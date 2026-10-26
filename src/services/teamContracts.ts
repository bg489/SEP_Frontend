/** Wire contracts from AutoScenarioX.Api /api/v1. Keep full canonical JSON intact. */
import type { Scenario } from "../types";

export type TeamJson = null | boolean | number | string | TeamJson[] | { [key: string]: TeamJson };
export type TeamObject = { [key: string]: TeamJson };
export interface TeamApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  download(path: string, fileName: string): Promise<void>;
}
export interface TeamPage<T> { items: T[]; page: number; pageSize: number; totalCount: number; totalPages: number }
export interface TeamScenarioRow {
  id: string; code: string; name: string; category: string; status: string;
  latestVersionNumber: number; latestVersionStatus: string | null;
  mapName: string | null; weatherPreset: string | null; eventTypes: string[];
  hasDraft: boolean; tags: string[]; updatedAt: string;
}
export interface TeamVersion {
  id: string; versionNumber: number; status: string; contentHash: string;
  mapName: string | null; weatherPreset: string | null; eventTypes: string[];
  actorCount: number; eventCount: number; sourceType: string;
  changeNote: string | null; publishedAt: string;
}
export interface TeamScenarioDetail {
  id: string; code: string; name: string; description: string | null; category: string;
  status: string; originType: string; hasDraft: boolean; createdAt: string;
  updatedAt: string; latestVersion: TeamVersion | null; latestContent: TeamObject | null;
}
export interface TeamVersionDetail {
  summary: TeamVersion; scenarioId: string; schemaVersion: string;
  npcVehicleCount: number | null; pedestrianCount: number | null;
  speedLimitKmh: number | null; egoBlueprint: string | null;
  parentVersionId: string | null; validationReportId: string; content: TeamObject;
}
export interface TeamDraft {
  scenarioId: string; rowVersion: number; lastValidationReportId: string | null;
  baseVersionId: string | null; updatedAt: string; content: TeamObject;
}
export interface TeamIssue { tier: string; path: string; message: string }
export interface TeamValidation {
  id: string; scenarioId: string; contentHash: string; isValid: boolean;
  stoppedAt: string | null; errors: TeamIssue[]; warnings: TeamIssue[];
  schemaVersion: string; validatorVersion: string; createdAt: string;
  duplicateOfVersionNumber?: number | null;
}
export interface TeamCatalog {
  schemaVersion: string; categories: string[]; weatherPresets: string[];
  eventTypes: string[]; triggerTypes: string[]; actorTypes: string[];
}
export interface TeamMap { mapName: string; carlaVersion: string; spawnPointCount: number; previewImagePath: string | null }
export interface TeamReadyVersion {
  scenarioVersionId: string; scenarioId: string; scenarioCode: string; scenarioName: string;
  category: string; versionNumber: number; isLatestReady: boolean; contentHash: string;
  mapName: string | null; weatherPreset: string | null; eventTypes: string[];
  eventCount: number; actorCount: number; npcVehicleCount: number | null;
  pedestrianCount: number | null; speedLimitKmh: number | null; egoBlueprint: string | null;
  publishedAt: string;
}
export interface TeamExecutionPackage {
  packageFormat: string; scenarioVersionId: string; scenarioId: string; scenarioCode: string;
  scenarioName: string; category: string; versionNumber: number; versionStatus: string;
  scenarioStatus: string; selectableForNewCampaign: boolean; schemaVersion: string;
  contentHash: string; publishedAt: string;
  map: { name: string | null; carlaVersion: string | null; spawnPointCount: number | null };
  parameterValues: Record<string, TeamJson>;
  locations: { path: string; spawnPointIndex: number; transform: { x: number; y: number; z: number; yaw: number } | null }[];
  runnable: boolean; issues: string[]; resolvedContent: TeamObject;
}
export interface TeamImportResult {
  importRecordId: string; format: string; originalFileName: string; originalHash: string;
  scenario: TeamScenarioDetail;
  report: { mapped: string[]; ignored: string[]; defaulted: { path: string; value: string }[]; warnings: TeamIssue[] };
}
export interface TeamImportRecord { id: string; scenarioId: string | null; format: string; originalFileName: string; originalHash: string; status: string; createdAt: string }
export interface TeamDiff {
  scenarioId: string; fromVersion: number; toVersion: number; fromContentHash: string; toContentHash: string;
  executionChanged: boolean; changes: { path: string; change: string; before: TeamJson; after: TeamJson }[];
}
export interface TeamVariantBatch {
  id: string; baseVersionId: string; parameterGrid: Record<string, TeamJson>;
  requestedCount: number; generatedCount: number; note: string | null;
  createdBy: string; createdAt: string;
}
export interface TeamVariantResult {
  batch: TeamVariantBatch;
  scenarios: { id: string; code: string; name: string; status: string; latestVersionId: string | null; latestVersionNumber: number; hasDraft: boolean }[];
}
export type TeamScenario = Scenario & {
  code?: string; backendVersionId?: string; backendVersionNumber?: number;
  canonicalContent?: TeamObject; hasDraft?: boolean; draftRevision?: number;
  backendStatus?: string; contentHash?: string;
};

export function teamObject(value: TeamJson | undefined): TeamObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function teamNumber(value: TeamJson | undefined, content?: TeamObject): number {
  if (typeof value === "number") return value;
  const ref = teamObject(value).$param;
  return typeof ref === "string" ? Number(teamObject(teamObject(content?.parameters)[ref]).value ?? 0) : 0;
}
export const teamString = (value: TeamJson | undefined, fallback = "") => typeof value === "string" ? value : fallback;
