import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import authReducer from "../features/auth/authSlice";
import { authSaga } from "../features/auth/authSaga";
import { workflowSaga } from "../features/workflow/workflowSaga";
import { setWorkflowApiDispatcher } from "../services/workflowApiBridge";

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: { auth: authReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(sagaMiddleware),
});

setWorkflowApiDispatcher(store.dispatch);
sagaMiddleware.run(authSaga);
sagaMiddleware.run(workflowSaga);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
