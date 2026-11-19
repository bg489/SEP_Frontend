import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamOperationsWorkspace } from "../components/TeamOperationsWorkspace";
import { LocaleContext } from "../localeContext";
import type { TeamApiClient, TeamReadyVersion } from "../services/teamContracts";
import type { RankResult, TeamCampaign, TeamRun, RunResult } from "../services/teamOperations";
import type { AppPage } from "../types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const versions = Array.from({ length: 13 }, (_, index) => ({
  scenarioVersionId: uuid(index + 100), scenarioId: uuid(index + 1), scenarioCode: `SCN-${index + 1}`,
  scenarioName: `Version ${index + 1}`, category: "following", versionNumber: 1, isLatestReady: true,
  contentHash: `hash-${index}`, mapName: "Town01", weatherPreset: "ClearNoon", eventTypes: [],
  eventCount: 0, actorCount: 1, npcVehicleCount: 0, pedestrianCount: 0, speedLimitKmh: 30,
  egoBlueprint: "vehicle.tesla.model3", publishedAt: "2026-11-19T00:00:00Z",
})) satisfies TeamReadyVersion[];
const campaign: TeamCampaign = {
  id: uuid(200), code: "CMP-1", name: "Current campaign", description: "", strategy: "proposed_failure_history",
  status: "Draft", progress: 0, passRate: 0, failedRuns: 0, estimatedDuration: "2 min", owner: "Fixture",
  createdAt: "2026-11-19T00:00:00Z", startedAt: null, runCount: 0,
  sut: { type: "behavior_agent", behavior: "normal", carlaVersion: "0.9.16" },
  scenarioVersionIds: versions.slice(0, 2).map(v => v.scenarioVersionId),
  scenarios: versions.slice(0, 2).map((v, sortOrder) => ({ ...v, sortOrder })),
};
const ranking: RankResult = {
  runId: uuid(300), strategy: "proposed_failure_history", createdAt: campaign.createdAt,
  metrics: { apfdEstimate: .6, apfdcEstimate: .5, faultsFoundEarlyEstimate: 1, faultsTotalEstimate: 2,
    estimatedSuiteMinutes: 2, note: "Feature estimates", observedRuns: 0 },
  ordered: versions.slice(0, 2).map((v, i) => ({ ...v, rank: i + 1, severity: "High", failureSignalEstimate: .4,
    score: .6, rationale: "Fixture feature", estimatedCostMinutes: 1 })), featureNames: [], distanceMatrix: null,
};
function transport(extra?: (path: string, init?: RequestInit) => unknown) {
  const request = vi.fn(async (path: string, init?: RequestInit): Promise<unknown> => {
    const custom = extra?.(path, init); if (custom !== undefined) return custom;
    const url = new URL(path, "https://fixture.invalid");
    if (path === "/api/v1/campaigns" && init?.method === "POST") return { ...campaign, ...JSON.parse(String(init.body)) };
    if (path === "/api/v1/campaigns") return [campaign, { ...campaign, id: uuid(201), name: "Second campaign" }];
    if (path.startsWith("/api/v1/campaigns/available-scenarios")) {
      const items = versions.filter(v => !url.searchParams.get("q") || v.scenarioName.includes(url.searchParams.get("q")!));
      const page = Number(url.searchParams.get("page") ?? 1), size = Number(url.searchParams.get("pageSize") ?? 12);
      return { items: items.slice((page - 1) * size, page * size), page, pageSize: size, totalCount: items.length, totalPages: Math.ceil(items.length / size) };
    }
    if (path.startsWith("/api/v1/campaigns/")) return campaign;
    if (path === "/api/v1/prioritization/strategies") return [
      { id: "proposed_failure_history", label: "History", description: "History" }, { id: "random", label: "Random", description: "Random" }];
    if (path === "/api/v1/prioritization/rank") return ranking;
    if (path === "/api/v1/reference/catalog") return { categories: ["following"] };
    if (path === "/api/v1/reference/maps" || path === "/api/v1/oracle-configs") return [];
    throw new Error(`Unexpected ${init?.method ?? "GET"} ${path}`);
  });
  return { request, download: vi.fn(), media: vi.fn() } as TeamApiClient & { request: typeof request; media: ReturnType<typeof vi.fn> };
}
function mount(client: TeamApiClient, page: AppPage) {
  return render(<LocaleContext.Provider value={{ locale: "en", setLocale: vi.fn() }}>
    <TeamOperationsWorkspace client={client} page={page} role="Test Engineer" />
  </LocaleContext.Provider>);
}

describe("campaign component contracts", () => {
  it.each([
    ["Random seed", "43"], ["Risk weight", ".7"], ["Diversity weight", ".2"],
    ["Strategy", "random"], ["Campaign", uuid(201)], ["Scenario source", "ready"],
  ])("FE-UT-046 %s changes invalidate a completed ranking before it can be applied", async (label, value) => {
    const client = transport(); mount(client, "priority");
    const rank = await screen.findByRole("button", { name: "Calculate ranking" });
    await waitFor(() => expect(rank).toBeEnabled()); await userEvent.click(rank);
    expect(await screen.findByRole("button", { name: "Save order to campaign" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
    expect(screen.queryByRole("button", { name: "Save order to campaign" })).not.toBeInTheDocument();
    expect(client.request.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("FE-UT-047 READY selections survive pages and filters and submit exact IDs once", async () => {
    const client = transport(); mount(client, "campaigns"); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Build campaign" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Campaign name"), "Cross page suite");
    await user.click(await dialog.findByRole("checkbox", { name: /Version 1 .*SCN-1 / }));
    await user.click(dialog.getByRole("button", { name: "Next page" }));
    await user.click(await dialog.findByRole("checkbox", { name: /Version 13 / }));
    await user.type(dialog.getByLabelText("Search", { exact: true }), "No match");
    expect(await dialog.findByText(/No READY version matches/)).toBeVisible();
    await user.click(dialog.getByRole("button", { name: "Save campaign" }));
    await waitFor(() => expect(client.request.mock.calls.some(([p, init]) => p === "/api/v1/campaigns" && init?.method === "POST")).toBe(true));
    const writes = client.request.mock.calls.filter(([p, init]) => p === "/api/v1/campaigns" && init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body)).scenarioVersionIds).toEqual([versions[0].scenarioVersionId, versions[12].scenarioVersionId]);
  }, 15000);

  it("FE-UT-048 late media cannot reopen another run and current Blob URLs are revoked", async () => {
    let release!: (blob: Blob) => void;
    const late = new Promise<Blob>(resolve => { release = resolve; });
    const runs: TeamRun[] = versions.slice(0, 2).map((v, i) => ({ ...v, id: uuid(401 + i), campaignId: campaign.id,
      status: "Completed", verdict: "PASS", contentHash: v.contentHash, seed: 42, sortOrder: i,
      startedAt: null, finishedAt: null, errorMessage: null }));
    const client = transport(path => {
      if (path.endsWith("/runs")) return runs;
      if (path.endsWith("/progress")) return { runId: path.split("/")[4], progress: null };
      if (path.endsWith("/result")) {
        const run = runs.find(r => r.id === path.split("/")[4])!;
        return { ...run, runId: run.id, campaignName: campaign.name, durationS: 1, outcome: "COMPLETED", telemetryReceivedAt: null,
          infraRetryCount: 0, hasVideo: true, evaluations: [] } satisfies Partial<RunResult>;
      }
    });
    client.media.mockReturnValueOnce(late).mockResolvedValueOnce(new Blob(["current"]));
    const create = vi.fn(() => "blob:current"); const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const view = mount(client, "execution"); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Watch camera video" }));
    const inspect = screen.getAllByRole("button", { name: "Inspect" }); await user.click(inspect[1]);
    await act(async () => { release(new Blob(["stale"])); await late; });
    expect(create).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Watch camera video" }));
    await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", "blob:current"));
    view.unmount(); expect(revoke).toHaveBeenCalledWith("blob:current");
  });
});
