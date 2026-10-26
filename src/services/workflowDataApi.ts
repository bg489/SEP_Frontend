import type { AutoScenarioApi } from "../types";
import { teamBackendApi } from "./teamBackendApi";
import { mockApi } from "./mockApi";

export const workflowDataMode = import.meta.env.VITE_DATA_MODE ?? "api";
export const isMockMode = workflowDataMode !== "api";
export const workflowDataApi: AutoScenarioApi = isMockMode
  ? mockApi
  : teamBackendApi;
