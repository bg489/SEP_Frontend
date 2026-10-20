import { call, put, takeLatest } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { DemoUser, UserRole } from "../../types";
import { authApi, type AdminUser, type AuthSession, type LoginInput, type RegisterInput } from "../../services/authApi";
import { getAccessToken, setAccessToken } from "../../services/authToken";
import {
  authAnonymous,
  adminRoleChangeRequested,
  adminUserRoleChanged,
  adminUsersFailed,
  adminUsersLoaded,
  adminUsersRequested,
  authFailed,
  authSucceeded,
  bootstrapAuthRequested,
  loginRequested,
  logoutRequested,
  passwordResetRequested,
  passwordResetSucceeded,
  registerRequested,
  signedOut,
} from "./authSlice";

function* bootstrapAuth() {
  const token = getAccessToken();
  if (!token) {
    yield put(authAnonymous());
    return;
  }

  try {
    const user: DemoUser = yield call(authApi.currentUser);
    yield put(authSucceeded({ user, accessToken: token }));
  } catch {
    setAccessToken(null);
    yield put(authAnonymous());
  }
}

function* signIn(action: PayloadAction<LoginInput>): Generator<unknown, void, AuthSession> {
  try {
    const session: AuthSession = yield call(authApi.login, action.payload);
    setAccessToken(session.accessToken);
    yield put(authSucceeded(session));
  } catch (error) {
    setAccessToken(null);
    yield put(authFailed(error instanceof Error ? error.message : "Unable to sign in."));
  }
}

function* register(action: PayloadAction<RegisterInput>): Generator<unknown, void, AuthSession> {
  try {
    const session: AuthSession = yield call(authApi.register, action.payload);
    setAccessToken(session.accessToken);
    yield put(authSucceeded(session));
  } catch (error) {
    setAccessToken(null);
    yield put(authFailed(error instanceof Error ? error.message : "Unable to create account."));
  }
}

function* requestPasswordReset(action: PayloadAction<string>) {
  try {
    const message: string = yield call(authApi.requestPasswordReset, action.payload);
    yield put(passwordResetSucceeded(message));
  } catch (error) {
    yield put(authFailed(error instanceof Error ? error.message : "Unable to request a password reset."));
  }
}

function* signOut() {
  setAccessToken(null);
  localStorage.removeItem("asx-session");
  yield put(signedOut());
}

function* loadAdminUsers(): Generator<unknown, void, AdminUser[]> {
  try {
    const users: AdminUser[] = yield call(authApi.listUsers);
    yield put(adminUsersLoaded(users));
  } catch (error) {
    yield put(adminUsersFailed(error instanceof Error ? error.message : "Unable to load users."));
  }
}

function* changeAdminUserRole(
  action: PayloadAction<{ id: string; role: UserRole }>,
): Generator<unknown, void, AdminUser> {
  try {
    const user: AdminUser = yield call(authApi.setUserRole, action.payload.id, action.payload.role);
    yield put(adminUserRoleChanged(user));
  } catch (error) {
    yield put(adminUsersFailed(error instanceof Error ? error.message : "Unable to change user role."));
  }
}

export function* authSaga() {
  yield takeLatest(bootstrapAuthRequested.type, bootstrapAuth);
  yield takeLatest(loginRequested.type, signIn);
  yield takeLatest(registerRequested.type, register);
  yield takeLatest(passwordResetRequested.type, requestPasswordReset);
  yield takeLatest(logoutRequested.type, signOut);
  yield takeLatest(adminUsersRequested.type, loadAdminUsers);
  yield takeLatest(adminRoleChangeRequested.type, changeAdminUserRole);
}
