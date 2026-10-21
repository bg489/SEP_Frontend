import { call, takeEvery } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";
import { workflowDataApi } from "../../services/workflowDataApi";
import {
  settleWorkflowApiRequest,
  workflowApiRequested,
  type WorkflowApiRequest,
} from "../../services/workflowApiBridge";

function* processWorkflowRequest(action: PayloadAction<WorkflowApiRequest>) {
  const { requestId, method, args } = action.payload;
  try {
    const result: unknown = yield call(async () => {
      const handler = Reflect.get(workflowDataApi, method);
      if (typeof handler !== "function") {
        throw new Error(`Workflow API method '${String(method)}' is not available.`);
      }
      return Reflect.apply(handler, workflowDataApi, args) as Promise<unknown>;
    });
    settleWorkflowApiRequest(requestId, result);
  } catch (error) {
    settleWorkflowApiRequest(
      requestId,
      undefined,
      error instanceof Error ? error.message : "Workflow API request failed.",
    );
  }
}

export function* workflowSaga() {
  yield takeEvery(workflowApiRequested.type, processWorkflowRequest);
}
