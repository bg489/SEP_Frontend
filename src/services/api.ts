import type { AutoScenarioApi } from "../types";
import { HttpAutoScenarioApi } from "./httpApi";
import { mockApi } from "./mockApi";

const mode = import.meta.env.VITE_DATA_MODE ?? "mock";
export const api: AutoScenarioApi =
  mode === "api" ? new HttpAutoScenarioApi() : mockApi;
export const isMockMode = mode !== "api";
