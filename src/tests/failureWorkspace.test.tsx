import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamFailureAnalysisWorkspace } from "../components/TeamFailureAnalysisWorkspace";
import { LocaleContext } from "../localeContext";
import type { TeamApiClient } from "../services/teamContracts";
import type { UserRole } from "../types";

const campaigns = [{ id: "campaign-a", code: "CMP-A", name: "First campaign", createdAt: "2026-11-03T00:00:00Z", status: "Completed" }, { id: "campaign-b", code: "CMP-B", name: "Second campaign", createdAt: "2026-11-02T00:00:00Z", status: "Completed" }];
const analysis = (id: string, step = "grouped") => ({ analysisId: `analysis-${id}`, campaignId: id, step, campaignCode: id, campaignName: id,
  runsJudged: 3, passCount: 1, failCount: 2, errorExcluded: 0, pendingCount: 0, summary: `Evidence for ${id}`, reviewNote: null, features: [], faults: [], effectiveness: null });
function mount(request: ReturnType<typeof vi.fn>, role: UserRole = "Test Reviewer") {
  render(<LocaleContext.Provider value={{ locale: "en", setLocale: vi.fn() }}><TeamFailureAnalysisWorkspace client={{ request, download: vi.fn() } as TeamApiClient} role={role} /></LocaleContext.Provider>);
}
describe("FE-UT-050 failure analysis", () => {
  it.each(["Scenario Engineer", "Test Engineer", "Test Reviewer", "Administrator"] as UserRole[])("%s sees only actions allowed for that role and workflow step", async role => {
    const request = vi.fn(async (path: string) => path === "/api/v1/campaigns" ? campaigns : analysis("campaign-a")); mount(request, role);
    const verify = await screen.findByRole("button", { name: "Verify classifications" });
    await waitFor(() => expect(screen.getByText("Evidence for campaign-a")).toBeVisible());
    if (role === "Test Reviewer" || role === "Administrator") expect(verify).toBeEnabled(); else expect(verify).toBeDisabled();
    expect(screen.getByRole("button", { name: "Find similar failures" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generate failure report" })).toBeDisabled();
  });
  it("a 403 verification error preserves the current workflow step", async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("Reviewer access required (403)");
      return path === "/api/v1/campaigns" ? campaigns : analysis("campaign-a");
    }); mount(request); const verify = await screen.findByRole("button", { name: "Verify classifications" }); await waitFor(() => expect(verify).toBeEnabled());
    await userEvent.click(verify); expect(await screen.findByRole("alert")).toHaveTextContent("Reviewer access required");
    expect(screen.getByRole("button", { name: "Find similar failures" })).toBeDisabled(); expect(verify).toBeEnabled();
  });
  it("FE-UT-051 regroup requires acknowledgement and Cancel sends no mutation", async () => {
    const request = vi.fn(async (path: string) => path === "/api/v1/campaigns" ? campaigns : analysis("campaign-a")); mount(request);
    const regroup = await screen.findByRole("button", { name: "Regroup faults" }); await waitFor(() => expect(regroup).toBeEnabled());
    await userEvent.click(regroup); expect(screen.getByRole("dialog")).toHaveTextContent("execution results remain available");
    expect(screen.getByRole("button", { name: /^Confirm$/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(request.mock.calls.every(call => call.length === 1)).toBe(true);
  });
  it("late analysis for the previous campaign cannot replace the current evidence", async () => {
    let release!: (value: unknown) => void; const old = new Promise(resolve => { release = resolve; });
    const request = vi.fn((path: string) => path === "/api/v1/campaigns" ? Promise.resolve(campaigns) : path.includes("campaign-a/") ? old : Promise.resolve(analysis("campaign-b")));
    mount(request); const chooser = await screen.findByRole("combobox"); await waitFor(() => expect(chooser).toHaveValue("campaign-a"));
    await userEvent.selectOptions(chooser, "campaign-b"); expect(await screen.findByText("Evidence for campaign-b")).toBeVisible();
    await act(async () => { release(analysis("campaign-a")); await old; }); expect(screen.queryByText("Evidence for campaign-a")).not.toBeInTheDocument();
    expect(screen.getByText("Evidence for campaign-b")).toBeVisible();
  });
});
