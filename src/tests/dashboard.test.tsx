import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamOverview } from "../components/TeamOverview";
import { LocaleContext } from "../localeContext";
import type { OverviewData, UserRole } from "../types";

const empty: OverviewData = { totalScenarios: 0, activeCampaigns: 0, passRate: 0, failureClusters: 0,
  weeklyRuns: [], weeklyLabels: [], recentActivity: [] };
describe("API overview", () => {
  it.each(["Scenario Engineer", "Test Engineer", "Test Reviewer", "Administrator"] as UserRole[])("%s sees truthful empty data and the correct primary journey", async role => {
    const navigate = vi.fn();
    render(<LocaleContext.Provider value={{ locale: "en", setLocale: vi.fn() }}><TeamOverview overview={empty} scenarios={[]} campaigns={[]}
      role={role} onNavigate={navigate} onScenario={vi.fn()} /></LocaleContext.Provider>);
    expect(screen.getByText("Weekly activity is not available yet.")).toBeVisible();
    expect(screen.getByText("No campaigns have been created yet.")).toBeVisible();
    expect(screen.getByText("Not exposed by the current API")).toBeVisible();
    const primary = role === "Scenario Engineer" || role === "Administrator" ? ["Open scenario library", "scenarios"]
      : role === "Test Engineer" ? ["Open campaigns", "campaigns"] : ["Inspect run results", "run-detail"];
    await userEvent.click(screen.getByRole("button", { name: primary[0] })); expect(navigate).toHaveBeenCalledWith(primary[1]);
  });
  it("recorded zero activity remains zero rather than fabricated trends", () => {
    render(<LocaleContext.Provider value={{ locale: "vi", setLocale: vi.fn() }}><TeamOverview
      overview={{ ...empty, weeklyRuns: [0, 0], weeklyLabels: ["Mon", "Tue"] }} scenarios={[]} campaigns={[]}
      role="Test Engineer" onNavigate={vi.fn()} onScenario={vi.fn()} /></LocaleContext.Provider>);
    expect(screen.getByText("Chưa ghi nhận lượt chạy hoàn tất trong giai đoạn này.")).toBeVisible();
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Mon: 0; Tue: 0");
  });
});
