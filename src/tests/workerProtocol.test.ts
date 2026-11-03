import { describe, expect, it, vi } from "vitest";
import { canRequeueInfrastructure, hasMp4Header, isWorkerUploadSizeValid, TELEMETRY_MAX_BYTES, validateTelemetryText, VIDEO_MAX_BYTES, workerProtocol } from "../services/workerProtocol";
import type { RunResult } from "../services/teamOperations";

const runId = "00000000-0000-4000-8000-000000000001";
const versionId = "00000000-0000-4000-8000-000000000002";
const recording = (extra: object[] = []) => [
  { kind: "header", format: "asx.telemetry/1", run_id: runId, scenario_version_id: versionId, content_hash: "hash", carla_version: "0.9.16" },
  { kind: "tick", t: 1, post_stop: false, ego: { x: 1, y: 2, vx: 3, vy: 0 }, actors: [] },
  ...extra,
  { kind: "end", t: 2, outcome: "COMPLETED" },
].map(value => JSON.stringify(value)).join("\n");

describe("worker upload boundaries and observed telemetry", () => {
  it("FE-UT-052 validates nonempty upload bounds, MP4 header and upload headers", async () => {
    expect(isWorkerUploadSizeValid(TELEMETRY_MAX_BYTES, "telemetry")).toBe(true);
    expect(isWorkerUploadSizeValid(TELEMETRY_MAX_BYTES + 1, "telemetry")).toBe(false);
    expect(isWorkerUploadSizeValid(VIDEO_MAX_BYTES, "video")).toBe(true);
    for (const size of [0, -1, .5, Infinity]) expect(isWorkerUploadSizeValid(size, "video")).toBe(false);
    expect(hasMp4Header(new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112, 0, 0, 0, 0]))).toBe(true);
    expect(hasMp4Header(new Uint8Array(12))).toBe(false);
    const request = vi.fn().mockResolvedValue({}); const protocol = workerProtocol({ request, download: vi.fn() });
    const file = new File([recording()], "run.jsonl"); await protocol.telemetry(runId, file);
    expect(request).toHaveBeenCalledWith(`/api/v1/runs/${runId}/telemetry`, expect.objectContaining({ method: "PUT", headers: { "Content-Type": "application/x-ndjson" }, body: file }));
  });
  it("FE-UT-053 binds recording identity, orders ticks and permits delayed sensor events", () => {
    const valid = validateTelemetryText(recording([{ kind: "event", type: "collision", t: .7, post_stop: false }]), { runId, scenarioVersionId: versionId, contentHash: "hash" });
    expect(valid.errors).toEqual([]); expect(valid.valid).toBe(true); expect(valid.events).toBe(1);
    expect(validateTelemetryText(recording(), { runId: versionId }).valid).toBe(false);
    const reversed = recording([{ kind: "tick", t: .5, post_stop: false, ego: { x: 1, y: 2, vx: 0, vy: 0 } }]);
    expect(validateTelemetryText(reversed, { runId }).errors.join()).toContain("ordered");
    const synthetic = recording().replace('"carla_version":"0.9.16"', '"carla_version":"0.9.16","synthetic":true');
    expect(validateTelemetryText(synthetic, { runId }).valid).toBe(false);
  });
  it("FE-UT-054 infrastructure retry is separate from a driving FAIL", () => {
    const base = { status: "Error", verdict: "ERROR", outcome: "INFRA_FAILED", evaluations: [], infraRetryCount: 0 } as unknown as RunResult;
    expect(canRequeueInfrastructure(base)).toBe(true);
    expect(canRequeueInfrastructure({ ...base, status: "Completed", verdict: "FAIL", outcome: "STOPPED_ON_VIOLATION" })).toBe(false);
    expect(canRequeueInfrastructure(null)).toBe(false);
    const infrastructure = [{ evaluatedAt: "2026-11-03T00:00:00Z", errorReason: "CARLA simulator unavailable" }] as RunResult["evaluations"];
    expect(canRequeueInfrastructure({ ...base, outcome: null, evaluations: infrastructure })).toBe(true);
  });
});
