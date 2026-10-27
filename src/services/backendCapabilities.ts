import type { AppPage, UserRole } from "../types";

export const usesTeamBackend = (import.meta.env.VITE_DATA_MODE ?? "api") === "api";
export const teamScenarioPages: AppPage[] = ["scenarios", "scenario-editor", "import", "compare"];
export const teamOperationPages: AppPage[] = ["campaigns", "priority", "execution", "run-detail", "nodes", "oracles"];
export const teamUtilityPages: AppPage[] = ["backend-data", "worker-protocol"];
export const mockFeaturePages: AppPage[] = ["nodes", "clusters", "failures", "review", "report", "users", "analytics", "audit"];

export function moduleSource(page: AppPage, role?: UserRole): "live" | "mock" | "mixed" {
  if (!usesTeamBackend) return "mock";
  if (mockFeaturePages.includes(page)) return "mock";
  if (page === "oracles") return !role || role === "Administrator" ? "mixed" : "live";
  if (page === "overview" || page === "profile") return "mixed";
  return "live";
}
