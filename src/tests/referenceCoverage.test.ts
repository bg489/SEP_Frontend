import { describe, expect, it, vi } from "vitest";
import { coverageAxis, coverageMatrix, coverageValues, NO_COVERAGE_EVENT, type TeamCoverage, type TeamCoverageItem } from "../services/teamReferenceData";
import { operationsApi } from "../services/teamOperations";
import { failureActionAllowed } from "../services/teamFailureAnalysis";
import type { TeamApiClient } from "../services/teamContracts";

const item = (changes: Partial<TeamCoverageItem> = {}): TeamCoverageItem => ({ scenarioId: "scenario", scenarioVersionId: "version", code: "SCN-1", name: "Scenario", versionNumber: 1, isLatestReady: true, category: "pedestrian", mapName: "Town01", weatherPreset: "ClearNoon", eventTypes: [], ...changes });
const data = (items: TeamCoverageItem[]): TeamCoverage => ({ scope: "latest", scenarioCount: items.length, versionCount: items.length, axes: { maps: ["Town01", "Town02"], weatherPresets: ["ClearNoon"], categories: ["pedestrian"], eventTypes: ["pedestrian_crossing"] }, items });

describe("coverage calculations from real backend records", () => {
  it("FE-UT-042 deduplicates repeated events and retains scenarios with no event", () => {
    expect(coverageValues(item({ eventTypes: ["pedestrian_crossing", "pedestrian_crossing"] }), "event")).toEqual(["pedestrian_crossing"]);
    expect(coverageValues(item(), "event")).toEqual([NO_COVERAGE_EVENT]);
  });
  it("FE-UT-043 preserves catalogue gaps and exposes unknown or missing metadata", () => {
    expect(coverageAxis(data([item({ mapName: null }), item({ mapName: "FutureTown" })]), "map")).toEqual(["Town01", "Town02", "—", "FutureTown"]);
  });
  it("FE-UT-044 counts occupied combinations once and handles an empty denominator", () => {
    const matrix = coverageMatrix(data([item(), item({ scenarioId: "other" })]), "map", "weather");
    expect(matrix.covered).toBe(1); expect(matrix.combinations).toBe(2); expect(matrix.ratio).toBe(.5);
    const empty = { ...data([]), axes: { maps: [], categories: [], eventTypes: [], weatherPresets: [] } };
    expect(coverageMatrix(empty, "map", "weather").ratio).toBe(0);
  });
  it("FE-UT-045 READY filters preserve values and omit blank filters", async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    const api = operationsApi({ request, download: vi.fn() } as TeamApiClient);
    await api.availableReady({ q: "rain & fog", map: "Town01_Opt", category: "", page: 2, latestOnly: false });
    const query = new URL(String(request.mock.calls[0][0]), "http://test.invalid").searchParams;
    expect(query.get("q")).toBe("rain & fog"); expect(query.get("map")).toBe("Town01_Opt");
    expect(query.has("category")).toBe(false); expect(query.get("latestOnly")).toBe("false"); expect(query.get("page")).toBe("2");
  });
  it("FE-UT-049 only allows legal failure-analysis transitions", () => {
    const steps = ["grouped", "verified", "similar_found", "unexplained", "explainable", "report_draft", "needs_more", "evaluated"];
    const expected = { verify: ["grouped"], similar: ["verified"], explainability: ["similar_found"], "return-to-flow3": ["unexplained"], generate: ["explainable"], review: ["report_draft", "needs_more"], evaluation: ["evaluated"] } as const;
    for (const [action, allowed] of Object.entries(expected)) for (const step of steps) {
      expect(failureActionAllowed(action as keyof typeof expected, step), `${action} in ${step}`).toBe((allowed as readonly string[]).includes(step));
    }
    expect(failureActionAllowed("group", null)).toBe(true);
  });
});
