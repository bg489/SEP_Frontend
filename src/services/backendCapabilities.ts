import type { AppPage, UserRole } from "../types";

export const usesTeamBackend = (import.meta.env.VITE_DATA_MODE ?? "api") === "api";
export const teamScenarioPages: AppPage[] = ["scenarios", "scenario-editor", "import", "compare"];
export const teamOperationPages: AppPage[] = ["campaigns", "priority", "execution", "run-detail", "nodes", "oracles"];
export const teamAnalysisPages: AppPage[] = ["failures", "review", "report"];
export const teamUtilityPages: AppPage[] = ["backend-data", "worker-protocol", "coverage"];
export const mockFeaturePages: AppPage[] = [];

export function moduleSource(page: AppPage, _role?: UserRole): "live" | "mock" | "mixed" {
  if (!usesTeamBackend) return "mock";
  if (mockFeaturePages.includes(page)) return "mock";
  if (page === "overview") return "mixed";
  return "live";
}
