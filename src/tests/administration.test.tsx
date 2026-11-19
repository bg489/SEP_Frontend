import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamAdministrationWorkspace } from "../components/TeamAdministrationWorkspace";
import { LocaleContext } from "../localeContext";
import type { AppPage, UserRole } from "../types";
import type { TeamApiClient } from "../services/teamContracts";

const account = { id: "user-1", displayName: "Scenario User", email: "scenario@example.invalid", role: "SCENARIO_ENGINEER", isActive: true };
function mount(page: AppPage, request: ReturnType<typeof vi.fn>, role: UserRole = "Administrator") {
  const client = { request, download: vi.fn() } as TeamApiClient;
  return render(<LocaleContext.Provider value={{ locale: "en", setLocale: vi.fn() }}><TeamAdministrationWorkspace client={client} page={page} role={role} /></LocaleContext.Provider>);
}
describe("FE-UT-051 persisted administration", () => {
  it("a non-Admin cannot trigger account management requests", async () => {
    const request = vi.fn(); mount("users", request, "Test Engineer");
    expect(screen.getByRole("alert")).toHaveTextContent("Administrator access");
    await new Promise(resolve => setTimeout(resolve, 10)); expect(request).not.toHaveBeenCalled();
  });
  it("blocking an account waits for the API and reads its persisted status back", async () => {
    let active = true; let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const request = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") { await pending; active = false; return { ...account, isActive: false }; }
      return { items: [{ ...account, isActive: active }], totalCount: 1, totalPages: 1, page: 1, pageSize: 25 };
    });
    mount("users", request); const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Block account" }));
    expect(screen.getByRole("button", { name: "Block account" })).toBeDisabled(); expect(screen.queryByText("Account access saved.")).not.toBeInTheDocument();
    expect(JSON.parse(request.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body as string)).toEqual({ isActive: false });
    release(); expect(await screen.findByRole("button", { name: "Unblock account" })).toBeEnabled();
    expect(screen.getByText("Blocked")).toBeVisible(); expect(request.mock.calls.filter(([, init]) => !init)).toHaveLength(2);
  });
  it("last-Admin protection remains an error and offers a retry", async () => {
    const request = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") throw new Error("The last active administrator cannot be blocked.");
      return { items: [{ ...account, role: "ADMIN" }], totalCount: 1, totalPages: 1 };
    });
    mount("users", request); await userEvent.click(await screen.findByRole("button", { name: "Block account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("last active administrator");
    expect(screen.getByRole("button", { name: "Block account" })).toBeEnabled(); expect(screen.queryByText("Account access saved.")).not.toBeInTheDocument();
  });
  it("settings save the real policy without claiming evidence has been deleted", async () => {
    const settings = { similarityWarningPercent: 85, similarityBlockPercent: 98, retentionDays: 30, retentionEnabled: false, activeOracleConfigId: null, updatedAt: "2026-11-03T00:00:00Z" };
    const request = vi.fn(async (_path: string, init?: RequestInit) => init?.method === "PUT" ? JSON.parse(init.body as string) : settings);
    mount("analytics", request); const field = await screen.findByLabelText("Retention days"); await userEvent.clear(field); await userEvent.type(field, "60");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("System settings saved"));
    expect(JSON.parse(request.mock.calls.find(([, init]) => init?.method === "PUT")![1]!.body as string).retentionDays).toBe(60);
    expect(screen.getByText(/saving a policy does not delete run artifacts/)).toBeVisible();
  });
  it("an unavailable worker API is never replaced with a healthy mock worker", async () => {
    mount("nodes", vi.fn().mockRejectedValue(new Error("Worker service unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Worker service unavailable");
    expect(screen.queryByText("Healthy", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText(/Start-ASX-Worker.bat/)).toHaveTextContent("C:\\Users\\admin\\Downloads\\CARLA_0.9.16");
  });
});
