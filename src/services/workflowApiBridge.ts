import { createAction } from "@reduxjs/toolkit";
import type { Dispatch, UnknownAction } from "redux";
import type { AutoScenarioApi } from "../types";

export interface WorkflowApiRequest {
  requestId: string;
  method: keyof AutoScenarioApi;
  args: unknown[];
}

export const workflowApiRequested = createAction<WorkflowApiRequest>("workflowApi/requested");

type WorkflowApiDispatcher = Dispatch<UnknownAction>;
type Deferred = { resolve: (value: unknown) => void; reject: (error: Error) => void };

let dispatcher: WorkflowApiDispatcher | undefined;
let requestSequence = 0;
const pending = new Map<string, Deferred>();

export function setWorkflowApiDispatcher(next: WorkflowApiDispatcher): void {
  dispatcher = next;
}

export function requestWorkflowApi<T>(method: keyof AutoScenarioApi, args: unknown[]): Promise<T> {
  if (!dispatcher) return Promise.reject(new Error("Workflow API Saga is not ready."));

  const requestId = `workflow-${Date.now()}-${++requestSequence}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    dispatcher!(workflowApiRequested({ requestId, method, args }));
  });
}

export function settleWorkflowApiRequest(requestId: string, result?: unknown, error?: Error): void {
  const deferred = pending.get(requestId);
  if (!deferred) return;
  pending.delete(requestId);
  if (error) deferred.reject(error);
  else deferred.resolve(result);
}
