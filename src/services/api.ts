import type { AutoScenarioApi } from "../types";
import { requestWorkflowApi } from "./workflowApiBridge";
import { isMockMode } from "./workflowDataApi";

export { isMockMode };

/** All workflow data requests enter the Redux Saga middleware through this facade. */
export const api: AutoScenarioApi = new Proxy({} as AutoScenarioApi, {
  get: (_target, property) => {
    if (typeof property !== "string") return undefined;
    return (...args: unknown[]) =>
      requestWorkflowApi(property as keyof AutoScenarioApi, args);
  },
});
