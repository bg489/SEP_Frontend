import type { AppPage } from "../types";

export const usesTeamBackend = (import.meta.env.VITE_DATA_MODE ?? "api") === "api";
export const teamScenarioPages: AppPage[] = ["scenarios", "scenario-editor", "import", "compare"];
export const teamOperationPages: AppPage[] = ["campaigns", "priority", "execution", "run-detail", "nodes", "oracles"];
export const mockFeaturePages: AppPage[] = ["nodes", "clusters", "failures", "review", "report", "users", "analytics", "audit"];

export function moduleSource(page: AppPage): "live" | "mock" | "mixed" {
  if (!usesTeamBackend) return "mock";
  if (mockFeaturePages.includes(page)) return "mock";
  if (page === "overview" || page === "profile" || page === "oracles") return "mixed";
  return "live";
}
