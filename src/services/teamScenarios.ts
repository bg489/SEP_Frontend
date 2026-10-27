import type { CreateScenarioInput, Scenario, ScenarioFilters, ScenarioStatus, ScenarioVersionRecord } from "../types";
import type {
  TeamApiClient, TeamCatalog, TeamDiff, TeamDraft, TeamExecutionPackage, TeamImportRecord,
  TeamImportResult, TeamMap, TeamObject, TeamPage, TeamReadyVersion, TeamScenario,
  TeamScenarioDetail, TeamScenarioRow, TeamValidation, TeamVariantBatch, TeamVariantResult,
  TeamVersion, TeamVersionDetail,
} from "./teamContracts";
import { teamNumber, teamObject, teamString } from "./teamContracts";

const body = (value: unknown) => JSON.stringify(value);
const segment = encodeURIComponent;
const categoryAliases: Record<string, string> = { Urban: "free_driving", Highway: "following", Intersection: "intersection", Rural: "free_driving", Parking: "other" };
const weatherAliases: Record<string, string> = { "Clear noon": "ClearNoon", "Clear morning": "ClearNoon", Sunset: "ClearSunset", Overcast: "CloudyNoon", "Light rain": "SoftRainNoon", "Heavy rain": "HardRainNoon", Fog: "CloudyNoon" };

export function teamScenarioFromDetail(detail: TeamScenarioDetail, draft?: TeamDraft): TeamScenario {
  const content = draft?.content ?? detail.latestContent ?? {};
  const metadata = teamObject(content.metadata);
  const traffic = teamObject(content.traffic);
  const npc = teamObject(traffic.npc_vehicles);
  const actorList = Array.isArray(content.actors) ? content.actors.map(teamObject) : [];
  const version = detail.latestVersion;
  const ui = teamObject(teamObject(content.extensions).frontend);
  const severity = teamString(ui.severity, "Medium");
  return {
    id: detail.id, code: detail.code, name: detail.name, description: detail.description ?? teamString(metadata.description),
    category: detail.category, map: teamString(teamObject(content.map).name, version?.mapName ?? ""),
    weather: teamString(teamObject(content.weather).preset, version?.weatherPreset ?? ""),
    severity: (["Critical", "High", "Medium", "Low"].includes(severity) ? severity : "Medium") as Scenario["severity"],
    status: detail.status === "ARCHIVED" ? "Archived" : version?.status === "READY" ? "Active" : "Draft",
    version: version ? `v${version.versionNumber}` : "Draft", backendVersionId: version?.id,
    backendVersionNumber: version?.versionNumber, contentHash: version?.contentHash,
    hasDraft: detail.hasDraft, draftRevision: draft?.rowVersion, backendStatus: detail.status,
    canonicalContent: content, actors: 1 + teamNumber(npc.count, content) + teamNumber(teamObject(traffic.pedestrians).count, content) + actorList.length,
    runCount: 0, passRate: 0, lastRun: "Never", owner: "Backend workspace",
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((item): item is string => typeof item === "string") : [], priorityScore: 0,
    egoVehicle: teamString(teamObject(content.ego_vehicle).blueprint, "vehicle.tesla.model3"),
    trafficVehicle: teamString(npc.blueprint_filter, "vehicle.*"), trafficVehicleCount: teamNumber(npc.count, content),
    pedestrianCount: teamNumber(teamObject(traffic.pedestrians).count, content),
    obstacleCount: actorList.filter(actor => actor.type === "static_obstacle").length,
    executionMode: "CARLA actors", executionDurationSeconds: teamNumber(teamObject(content.execution).timeout_s, content),
    speedLimitOffsetPercent: teamNumber(npc.speed_difference_percent, content), trafficDensity: "Medium",
    routeDescription: teamString(ui.routeDescription, JSON.stringify(content.route ?? {})),
    triggerCondition: teamString(ui.triggerCondition), actions: teamString(ui.actions),
  };
}

export function teamScenarioFromReady(row: TeamReadyVersion): TeamScenario {
  return {
    id: row.scenarioId, code: row.scenarioCode, name: row.scenarioName, description: "",
    category: row.category, map: row.mapName ?? "", weather: row.weatherPreset ?? "", severity: "Medium",
    status: "Active", version: `v${row.versionNumber}`, backendVersionId: row.scenarioVersionId,
    backendVersionNumber: row.versionNumber, contentHash: row.contentHash, actors: row.actorCount,
    runCount: 0, passRate: 0, lastRun: "Never", owner: "Backend workspace", tags: row.eventTypes,
    priorityScore: 0, egoVehicle: row.egoBlueprint ?? undefined, trafficVehicleCount: row.npcVehicleCount ?? 0,
    pedestrianCount: row.pedestrianCount ?? 0, executionMode: "CARLA actors",
  };
}

/** All I/O is injected so the workspace can use the Redux Saga transport. */
export class TeamScenarioService {
  private readonly drafts = new Map<string, TeamDraft>();
  readonly client: TeamApiClient;
  constructor(client: TeamApiClient) { this.client = client; }
  catalog() { return this.client.request<TeamCatalog>("/api/v1/reference/catalog"); }
  maps() { return this.client.request<TeamMap[]>("/api/v1/reference/maps"); }
  schema() { return this.client.request<TeamObject>("/api/v1/reference/scenario-schema"); }
  search(query: Record<string, string | number | boolean | undefined> = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    return this.client.request<TeamPage<TeamScenarioRow>>("/api/v1/scenarios?" + params);
  }
  detail(id: string) { return this.client.request<TeamScenarioDetail>(`/api/v1/scenarios/${segment(id)}`); }
  createProfile(name: string, description: string, category: string) {
    return this.client.request<TeamScenarioDetail>("/api/v1/scenarios", { method: "POST", body: body({ name, description, category }) });
  }
  updateProfile(id: string, changes: { name?: string; description?: string; category?: string }) {
    return this.client.request<TeamScenarioDetail>(`/api/v1/scenarios/${segment(id)}`, { method: "PATCH", body: body(changes) });
  }
  async draft(id: string) {
    const value = await this.client.request<TeamDraft>(`/api/v1/scenarios/${segment(id)}/draft`);
    this.drafts.set(id, value); return value;
  }
  async createDraft(id: string, fromVersion?: number) {
    const value = await this.client.request<TeamDraft>(`/api/v1/scenarios/${segment(id)}/draft${fromVersion ? `?fromVersion=${fromVersion}` : ""}`, { method: "POST" });
    this.drafts.set(id, value); return value;
  }
  async saveDraft(id: string, content: TeamObject, rowVersion: number) {
    const value = await this.client.request<TeamDraft>(`/api/v1/scenarios/${segment(id)}/draft`, {
      method: "PUT", headers: { "If-Match": `"${rowVersion}"` }, body: body({ content }),
    });
    this.drafts.set(id, value); return value;
  }
  async discardDraft(id: string) {
    await this.client.request<void>(`/api/v1/scenarios/${segment(id)}/draft`, { method: "DELETE" }); this.drafts.delete(id);
  }
  validate(id: string) { return this.client.request<TeamValidation>(`/api/v1/scenarios/${segment(id)}/draft/validate`, { method: "POST" }); }
  async publish(id: string, changeNote = "Published from scenario workspace") {
    const result = await this.client.request<TeamVersionDetail>(`/api/v1/scenarios/${segment(id)}/versions`, { method: "POST", body: body({ changeNote }) });
    this.drafts.delete(id); return result;
  }
  versions(id: string) { return this.client.request<TeamVersion[]>(`/api/v1/scenarios/${segment(id)}/versions`); }
  version(id: string, number: number) { return this.client.request<TeamVersionDetail>(`/api/v1/scenarios/${segment(id)}/versions/${number}`); }
  diff(id: string, from: number, to: number) { return this.client.request<TeamDiff>(`/api/v1/scenarios/${segment(id)}/versions/diff?from=${from}&to=${to}`); }
  deprecate(id: string, number: number) { return this.client.request<TeamVersion>(`/api/v1/scenarios/${segment(id)}/versions/${number}/deprecate`, { method: "POST" }); }
  archive(id: string) { return this.client.request<TeamScenarioDetail>(`/api/v1/scenarios/${segment(id)}/archive`, { method: "POST" }); }
  restore(id: string) { return this.client.request<TeamScenarioDetail>(`/api/v1/scenarios/${segment(id)}/restore`, { method: "POST" }); }
  clone(id: string, name: string, description?: string, versionNumber?: number) {
    return this.client.request<TeamScenarioDetail>(`/api/v1/scenarios/${segment(id)}/clone`, { method: "POST", body: body({ name, description, versionNumber }) });
  }
  imports(id: string) { return this.client.request<TeamImportRecord[]>(`/api/v1/scenarios/${segment(id)}/imports`); }
  importFile(file: File, name?: string, category?: string, format?: "json" | "yaml") {
    const data = new FormData(); data.append("File", file);
    if (name) data.append("Name", name); if (category) data.append("Category", category);
    if (format) data.append("Format", format);
    return this.client.request<TeamImportResult>("/api/v1/scenarios/import", { method: "POST", body: data });
  }
  exportDraft(id: string, format: "json" | "yaml") { return this.client.download(`/api/v1/scenarios/${segment(id)}/draft/export?format=${format}`, `${id}-draft.${format}`); }
  exportVersion(id: string, number: number, format: "json" | "yaml") { return this.client.download(`/api/v1/scenarios/${segment(id)}/versions/${number}/export?format=${format}`, `${id}-v${number}.${format}`); }
  variants(id: string, number: number) { return this.client.request<TeamVariantBatch[]>(`/api/v1/scenarios/${segment(id)}/versions/${number}/variant-batches`); }
  variantBatch(id: string, number: number, batchId: string) { return this.client.request<TeamVariantResult>(`/api/v1/scenarios/${segment(id)}/versions/${number}/variant-batches/${segment(batchId)}`); }
  generateVariants(id: string, number: number, parameterGrid: Record<string, number[]>, namePrefix?: string, note?: string) {
    return this.client.request<TeamVariantResult>(`/api/v1/scenarios/${segment(id)}/versions/${number}/variant-batches`, { method: "POST", body: body({ parameterGrid, namePrefix, note }) });
  }
  ready(query: Record<string, string | number | boolean | undefined> = {}) {
    const params = new URLSearchParams({ pageSize: "100", latestOnly: "true" });
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    return this.client.request<TeamPage<TeamReadyVersion>>("/api/v1/scenario-versions/ready?" + params);
  }
  executionPackage(versionId: string) { return this.client.request<TeamExecutionPackage>(`/api/v1/scenario-versions/${segment(versionId)}/execution-package`); }
  async allReady() {
    const first = await this.ready(); const rows = [...first.items];
    for (let page = 2; page <= first.totalPages; page++) rows.push(...(await this.ready({ page })).items);
    return rows;
  }
  async listScenarios(filters: ScenarioFilters = {}): Promise<Scenario[]> {
    const query = { q: filters.query, pageSize: 100, status: filters.status === "Archived" ? "ARCHIVED" : "ACTIVE", hasDraft: filters.status === "Draft" ? true : undefined };
    const first = await this.search(query); const rows = [...first.items];
    for (let page = 2; page <= first.totalPages; page++) rows.push(...(await this.search({ ...query, page })).items);
    // Repository fields come from published versions; hydrate current drafts for accurate cards.
    const hydrated = await Promise.all(rows.map(async row => {
      const detail = await this.detail(row.id);
      const draft = detail.hasDraft ? await this.draft(row.id) : undefined;
      return teamScenarioFromDetail(detail, draft);
    }));
    return filters.status && !["All statuses", "Draft"].includes(filters.status)
      ? hydrated.filter(item => item.status === filters.status || filters.status === "Approved" && item.status === "Active") : hydrated;
  }
  async createScenario(input: CreateScenarioInput): Promise<Scenario> {
    if (input.executionMode === "OpenSCENARIO source") throw new Error("This backend imports canonical JSON/YAML. Use the scenario workspace to import a supported file.");
    if (input.obstacleCount > 0) throw new Error("Each obstacle needs an explicit spawn position. Create the scenario in the schema workspace and configure actors before publishing.");
    const created = await this.createProfile(input.name, input.description, categoryAliases[input.category] ?? input.category);
    const draft = await this.draft(created.id);
    return this.updateFlatDraft(created, draft, input);
  }
  private async updateFlatDraft(detail: TeamScenarioDetail, draft: TeamDraft, changes: Partial<Scenario>): Promise<Scenario> {
    const content = structuredClone(draft.content ?? {});
    if (changes.obstacleCount !== undefined && changes.obstacleCount !== (Array.isArray(content.actors) ? content.actors.map(teamObject).filter(actor => actor.type === "static_obstacle").length : 0))
      throw new Error("Edit obstacle actor positions in the schema workspace; a count alone cannot define executable obstacles.");
    if (changes.map !== undefined) content.map = { ...teamObject(content.map), name: changes.map };
    if (changes.weather !== undefined) {
      content.weather = { ...teamObject(content.weather), preset: weatherAliases[changes.weather] ?? changes.weather };
      if (changes.weather === "Clear morning") content.weather = { ...teamObject(content.weather), sun_altitude_angle: 15 };
      if (changes.weather === "Fog") content.weather = { ...teamObject(content.weather), fog_density: 65, fog_distance: 8 };
    }
    content.metadata = { ...teamObject(content.metadata), name: detail.name, category: detail.category, description: detail.description ?? "" };
    if (changes.egoVehicle !== undefined) content.ego_vehicle = { ...teamObject(content.ego_vehicle), blueprint: changes.egoVehicle };
    const traffic = teamObject(content.traffic); const npc = teamObject(traffic.npc_vehicles); const pedestrians = teamObject(traffic.pedestrians);
    if (changes.trafficVehicleCount !== undefined) npc.count = changes.trafficVehicleCount;
    if (changes.trafficVehicle !== undefined) npc.blueprint_filter = changes.trafficVehicle;
    if (changes.speedLimitOffsetPercent !== undefined) npc.speed_difference_percent = changes.speedLimitOffsetPercent;
    if (changes.pedestrianCount !== undefined) pedestrians.count = changes.pedestrianCount;
    content.traffic = { ...traffic, npc_vehicles: npc, pedestrians };
    if (changes.executionDurationSeconds !== undefined) content.execution = { ...teamObject(content.execution), timeout_s: changes.executionDurationSeconds };
    const ui = { ...teamObject(teamObject(content.extensions).frontend) };
    for (const key of ["severity", "routeDescription", "triggerCondition", "actions"] as const) if (changes[key] !== undefined) ui[key] = changes[key]!;
    content.extensions = { ...teamObject(content.extensions), frontend: ui };
    const saved = await this.saveDraft(detail.id, content, draft.rowVersion);
    return teamScenarioFromDetail(detail, saved);
  }
  async updateScenario(id: string, changes: Partial<Scenario>): Promise<Scenario> {
    let detail = await this.detail(id);
    if (changes.name !== undefined || changes.description !== undefined || changes.category !== undefined) detail = await this.updateProfile(id, {
      name: changes.name, description: changes.description, category: changes.category ? categoryAliases[changes.category] ?? changes.category : undefined,
    });
    const draft = this.drafts.get(id) ?? (detail.hasDraft ? await this.draft(id) : await this.createDraft(id));
    return this.updateFlatDraft(detail, draft, changes);
  }
  async cloneScenario(id: string): Promise<Scenario> {
    const detail = await this.detail(id);
    const cloned = await this.clone(id, `${detail.name.slice(0, 110)} copy`, detail.description ?? undefined);
    return teamScenarioFromDetail(cloned, await this.draft(cloned.id));
  }
  async updateScenarioStatus(id: string, status: ScenarioStatus, note = ""): Promise<Scenario> {
    if (status === "Archived") return teamScenarioFromDetail(await this.archive(id));
    const detail = await this.detail(id);
    if (detail.status === "ARCHIVED") return teamScenarioFromDetail(await this.restore(id));
    if (status === "Active" || status === "Approved") {
      const draft = detail.hasDraft ? await this.draft(id) : null;
      if (draft) {
        const report = await this.validate(id);
        if (!report.isValid) throw new Error(report.errors.map(issue => `${issue.path}: ${issue.message}`).join("\n"));
        if (report.warnings.length) throw new Error("Review validation warnings in the scenario workspace before explicitly publishing this version.");
        await this.publish(id, note || "Validated and published from frontend");
      } else if (detail.latestVersion?.status !== "READY") throw new Error("Create, validate and publish a draft in the scenario workspace first.");
      return teamScenarioFromDetail(await this.detail(id));
    }
    if (status !== "Draft") throw new Error("This backend uses draft validation and READY version publication; manual review status is not supported.");
    return teamScenarioFromDetail(detail, detail.hasDraft ? await this.draft(id) : await this.createDraft(id));
  }
  async listScenarioVersions(id: string): Promise<ScenarioVersionRecord[]> {
    return (await this.versions(id)).map(version => ({ version: `v${version.versionNumber}`, savedAt: version.publishedAt,
      note: version.changeNote ?? version.sourceType, hash: version.contentHash, status: version.status === "READY" ? "Active" : "Archived" }));
  }
  async persistImportedScenario(scenario: Scenario, sourceContent: string): Promise<Scenario> {
    const fileName = scenario.sourceFileName ?? "scenario.json";
    if (!/\.(json|ya?ml)$/i.test(fileName)) throw new Error("The team backend accepts JSON/YAML scenario files; OpenSCENARIO import is not implemented.");
    const result = await this.importFile(new File([sourceContent], fileName), scenario.name);
    return teamScenarioFromDetail(result.scenario, await this.draft(result.scenario.id));
  }
}
