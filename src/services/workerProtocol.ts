import type { TeamApiClient, TeamExecutionPackage } from "./teamContracts";
import type { RunResult, TeamCampaign, TeamRun } from "./teamOperations";

/** TelemetryOptions defaults. The backend still enforces its deployed configuration. */
export const TELEMETRY_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const isRunGuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isWorkerUploadSizeValid = (bytes: number, kind: "telemetry" | "video") => Number.isSafeInteger(bytes) && bytes > 0
  && bytes <= (kind === "telemetry" ? TELEMETRY_MAX_BYTES : VIDEO_MAX_BYTES);
export const hasMp4Header = (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
const guid = (value: string) => {
  if (!isRunGuid(value)) throw new Error("A valid target GUID is required.");
  return encodeURIComponent(value);
};
const upload = (file: File, kind: "telemetry" | "video") => {
  if (!isWorkerUploadSizeValid(file.size, kind)) throw new Error(`${kind === "telemetry" ? "Telemetry" : "Video"} must be non-empty and at most ${kind === "telemetry" ? 100 : 200} MiB.`);
  return file;
};

export interface ClaimedWorkerRun {
  runId: string; campaignId: string; campaignCode: string | null; campaignName: string;
  scenarioVersionId: string; contentHash: string | null; seed: number | null; sortOrder: number;
  sutType: string; sutBehavior: string; sutCarlaVersion: string;
  infraRetryCount: number; maxInfraRetries: number;
}
export interface RequeuedWorkerRun { runId: string; infraRetryCount: number; maxInfraRetries: number; status: string }
export interface TelemetryTarget { runId: string; scenarioVersionId?: string; contentHash?: string | null }
export interface TelemetryPreview {
  valid: boolean; errors: string[]; warnings: string[]; recordCount: number; ticks: number;
  evaluatedTicks: number; events: number; outcome: string; durationS: number | null;
  runId: string; scenarioVersionId: string; contentHash: string; carlaVersion: string; reason: string;
}
type RecordObject = Record<string, unknown>;
const object = (value: unknown): value is RecordObject => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const string = (value: unknown) => typeof value === "string" ? value : "";

/** Checks the fields consumed by TelemetryReader, plus UI provenance safeguards.
 * This inspects an existing recording; it never synthesizes records or predicts a verdict.
 */
export function validateTelemetryText(text: string, target: TelemetryTarget): TelemetryPreview {
  const preview: TelemetryPreview = { valid: false, errors: [], warnings: [], recordCount: 0, ticks: 0,
    evaluatedTicks: 0, events: 0, outcome: "", durationS: null, runId: "", scenarioVersionId: "",
    contentHash: "", carlaVersion: "", reason: "" };
  const error = (message: string) => { if (preview.errors.length < 24) preview.errors.push(message); };
  if (!isRunGuid(target.runId)) error("The target run GUID is invalid.");
  if (target.scenarioVersionId && !isRunGuid(target.scenarioVersionId)) error("The target scenario version GUID is invalid.");
  const requireNumber = (record: RecordObject, key: string, line: number, optional = false, path = key) => {
    if (optional && record[key] == null) return;
    if (!finite(record[key])) error(`Line ${line}: '${path}' must be a finite number.`);
  };
  const numbers = (record: RecordObject, key: string, fields: string[], line: number, optional = false) => {
    if (optional && record[key] == null) return;
    const value = record[key];
    if (!object(value)) { error(`Line ${line}: '${key}' must be an object.`); return; }
    fields.forEach(field => requireNumber(value, field, line, false, `${key}.${field}`));
  };
  let header: RecordObject | undefined;
  let end: RecordObject | undefined;
  let lastKind = "";
  let headers = 0;
  let ends = 0;
  let previousTickT = -Infinity;
  let maximumT = -Infinity;
  if (text.startsWith("\uFEFF")) error("Remove the UTF-8 byte-order mark in the original recording before submission; the backend expects plain NDJSON.");
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    const line = index + 1;
    let record: unknown;
    try { record = JSON.parse(raw); }
    catch { error(`Line ${line}: invalid JSON; incomplete recordings cannot be submitted here.`); continue; }
    if (!object(record)) { error(`Line ${line}: each record must be a JSON object.`); continue; }
    preview.recordCount += 1;
    if (typeof record.kind !== "string") { error(`Line ${line}: 'kind' must be a string.`); continue; }
    if (preview.recordCount === 1 && record.kind !== "header") error("The first record must be the header.");
    if (ends > 0) error(`Line ${line}: records cannot follow the end record.`);
    lastKind = record.kind;
    const provenance = [record.source, record.mode, record.provenance, record.generator].filter(value => typeof value === "string").join(" ");
    if (record.simulated === true || record.synthetic === true || record.mock === true || record.fixture === true
      || /\b(simulated|synthetic|mock|fixture)\b/i.test(provenance)) error(`Line ${line}: simulated, synthetic, mock or fixture telemetry is not accepted.`);
    if (record.kind === "header") {
      header = record; headers += 1;
      if (record.format !== "asx.telemetry/1") error(`Line ${line}: expected format 'asx.telemetry/1'.`);
      ["warmup_s", "route_speed_limit_kmh"].forEach(key => requireNumber(record, key, line, true));
      numbers(record, "ego_extent", ["x", "y"], line, true);
      numbers(record, "goal", ["x", "y"], line, true);
    } else if (record.kind === "tick" || record.kind === "event") {
      requireNumber(record, "t", line);
      if (typeof record.post_stop !== "boolean") error(`Line ${line}: 'post_stop' must be true or false.`);
      if (finite(record.t)) {
        if (record.t < 0) error(`Line ${line}: simulation time must be non-negative.`);
        if (record.kind === "tick") {
          if (record.t < previousTickT) error(`Line ${line}: tick timestamps must be ordered.`);
          previousTickT = record.t;
        }
        // CARLA sensor callbacks can arrive after the tick for their frame.
        // Preserve their original timestamps instead of rejecting or rewriting events.
        maximumT = Math.max(maximumT, record.t);
      }
      if (record.kind === "tick") {
        preview.ticks += 1;
        if (record.post_stop === false) preview.evaluatedTicks += 1;
        numbers(record, "ego", ["x", "y", "vx", "vy"], line);
        if (object(record.ego)) requireNumber(record.ego, "speed_limit_kmh", line, true, "ego.speed_limit_kmh");
        if (record.actors != null) {
          if (!Array.isArray(record.actors)) error(`Line ${line}: 'actors' must be an array.`);
          else record.actors.forEach(actor => {
            if (!object(actor)) { error(`Line ${line}: actors must contain objects.`); return; }
            ["x", "y", "vx", "vy"].forEach(key => requireNumber(actor, key, line, false, `actors[].${key}`));
            requireNumber(actor, "id", line, true, "actors[].id");
            numbers(actor, "extent", ["x", "y"], line);
          });
        }
      } else {
        preview.events += 1;
        if (typeof record.type !== "string") error(`Line ${line}: event 'type' must be a string.`);
        if (record.type === "lane_invasion" && (!Array.isArray(record.markings) || record.markings.some(value => typeof value !== "string")))
          error(`Line ${line}: 'markings' must be an array of strings.`);
      }
    } else if (record.kind === "end") {
      end = record; ends += 1;
      requireNumber(record, "t", line);
      if (finite(record.t) && (record.t < 0 || record.t < maximumT)) error(`Line ${line}: end time precedes recorded telemetry.`);
      if (typeof record.outcome !== "string") error(`Line ${line}: 'outcome' must be a string.`);
      if (record.reason != null && typeof record.reason !== "string") error(`Line ${line}: 'reason' must be a string.`);
    } else error(`Line ${line}: unknown record kind '${record.kind}'.`);
  }
  if (headers !== 1) error("Exactly one header record is required.");
  if (ends !== 1 || lastKind !== "end") error("Exactly one end record is required as the last record.");
  if (header) {
    preview.runId = string(header.run_id);
    preview.scenarioVersionId = string(header.scenario_version_id);
    preview.contentHash = string(header.content_hash);
    preview.carlaVersion = string(header.carla_version);
    // The backend compares run_id to Guid.ToString(), including lowercase formatting.
    if (preview.runId !== target.runId.toLowerCase()) error("Header run_id must exactly match the target run GUID in lowercase.");
    if (header.scenario_version_id != null && (typeof header.scenario_version_id !== "string"
      || target.scenarioVersionId && preview.scenarioVersionId.toLowerCase() !== target.scenarioVersionId.toLowerCase())) error("Header scenario_version_id does not match the target run.");
    if (header.content_hash != null && (typeof header.content_hash !== "string"
      || target.contentHash && preview.contentHash !== target.contentHash)) error("Header content_hash does not match the target run.");
    if (!preview.scenarioVersionId || !preview.contentHash || !preview.carlaVersion)
      preview.warnings.push("The header has incomplete version/hash/CARLA provenance. Verify the original recorder output; these fields do not prove a real simulation.");
  }
  if (end) {
    preview.outcome = string(end.outcome); preview.durationS = finite(end.t) ? end.t : null; preview.reason = string(end.reason);
    if (!["COMPLETED", "TIMED_OUT", "STOPPED_ON_VIOLATION", "TRUNCATED", "INFRA_FAILED"].includes(preview.outcome)) error("Unsupported run outcome.");
    if (preview.outcome === "INFRA_FAILED") {
      if (!preview.reason.trim()) error("INFRA_FAILED requires the original infrastructure failure reason.");
    } else if (preview.evaluatedTicks === 0) error("A non-infrastructure outcome requires recorded ticks before post_stop; zero-tick snapshots are not accepted.");
    if (preview.outcome === "TRUNCATED") preview.warnings.push("This is a partial recording. It does not establish that the full scenario completed; the backend determines its evaluation.");
  }
  preview.valid = preview.errors.length === 0;
  return preview;
}

export const workerProtocol = (client: TeamApiClient) => ({
  campaigns: () => client.request<TeamCampaign[]>("/api/v1/campaigns"),
  runs: (campaignId: string) => client.request<TeamRun[]>(`/api/v1/campaigns/${guid(campaignId)}/runs`),
  result: (runId: string) => client.request<RunResult>(`/api/v1/runs/${guid(runId)}/result`),
  claim: (campaignId?: string) => client.request<ClaimedWorkerRun | undefined>(`/api/v1/runs/claim${campaignId === undefined ? "" : `?campaignId=${guid(campaignId)}`}`, { method: "POST" }),
  running: (runId: string) => client.request<ClaimedWorkerRun>(`/api/v1/runs/${guid(runId)}/running`, { method: "POST" }),
  requeue: (runId: string) => client.request<RequeuedWorkerRun>(`/api/v1/runs/${guid(runId)}/requeue-infra`, { method: "POST" }),
  telemetry: (runId: string, file: File) => client.request<RunResult>(`/api/v1/runs/${guid(runId)}/telemetry`, { method: "PUT", headers: { "Content-Type": "application/x-ndjson" }, body: upload(file, "telemetry") }),
  video: (runId: string, file: File) => client.request<void>(`/api/v1/runs/${guid(runId)}/video`, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: upload(file, "video") }),
  executionPackage: (versionId: string) => client.request<TeamExecutionPackage>(`/api/v1/scenario-versions/${guid(versionId)}/execution-package`),
  downloadResult: (runId: string) => client.download(`/api/v1/runs/${guid(runId)}/result`, `${runId}-result.json`),
  downloadVideo: (runId: string) => client.download(`/api/v1/runs/${guid(runId)}/video`, `${runId}.mp4`),
});

export function canRequeueInfrastructure(result: RunResult | null): boolean {
  if (!result || result.status !== "Error" || result.verdict !== "ERROR") return false;
  const latest = [...result.evaluations].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))[0];
  return result.outcome === "INFRA_FAILED" || /simulator|connection|timeout|CARLA/i.test(latest?.errorReason ?? "");
}
