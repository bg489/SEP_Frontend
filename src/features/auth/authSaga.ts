import { eventChannel } from "redux-saga";
import { call, fork, put, race, take, takeLatest, takeLeading } from "redux-saga/effects";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { DemoUser, UserRole } from "../../types";
import { authApi, StaleAuthRequestError, type AdminUser, type AuthSession, type LoginInput, type RegisterInput, type RegistrationResult, type ResetPasswordInput, type ChangePasswordInput } from "../../services/authApi";
import { getAccessToken, getSessionGeneration, sessionExpiredEvent, setAccessToken } from "../../services/authToken";
import { isTeamDevAuth } from "../../services/authConfig";
import { setDevRole, type DevRole } from "../../services/devRole";
import {
  authAnonymous,
  authDemoCompleted,
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
  switchDevRoleRequested,
  resetPasswordRequested,
  profileUpdateRequested,
  changePasswordRequested,
  accountOperationSucceeded,
  accountOperationFailed,
  adminStatusChangeRequested,
} from "./authSlice";

function* bootstrapAuth() {
  const token = getAccessToken();
  const generation = getSessionGeneration();
  if (!token) {
    yield put(authAnonymous());
    return;
  }

  try {
    const user: DemoUser = yield call(authApi.currentUser);
    if (generation !== getSessionGeneration()) return;
    yield put(authSucceeded({ user, accessToken: token }));
  } catch {
    if (generation !== getSessionGeneration()) return;
    setAccessToken(null);
    yield put(authAnonymous());
  }
}

function* signIn(action: PayloadAction<LoginInput>) {
  try {
    const { session }: { session?: AuthSession } = yield race({ session: call(authApi.login, action.payload), logout: take(logoutRequested.type) });
    if (!session) return;
    setAccessToken(session.accessToken);
    yield put(authSucceeded(session));
  } catch (error) {
    if (error instanceof StaleAuthRequestError) return;
    setAccessToken(null);
    yield put(authFailed(error instanceof Error ? error.message : "Unable to sign in."));
  }
}

function* register(action: PayloadAction<RegisterInput>) {
  try {
    const { result }: { result?: RegistrationResult } = yield race({ result: call(authApi.register, action.payload), logout: take(logoutRequested.type) });
    if (!result) return;
    if (result.session) yield put(authSucceeded(result.session));
    else yield put(authDemoCompleted(result.message));
  } catch (error) {
    if (error instanceof StaleAuthRequestError) return;
    yield put(authFailed(error instanceof Error ? error.message : "Unable to create account."));
  }
}

function* resetPassword(action: PayloadAction<ResetPasswordInput>) {
  try {
    const message: string = yield call(authApi.resetPassword, action.payload);
    yield put(passwordResetSucceeded(message));
  } catch (error) {
    yield put(accountOperationFailed(error instanceof Error ? error.message : "Unable to reset your password."));
  }
}

function* updateProfile(action: PayloadAction<string>) {
  const generation = getSessionGeneration();
  try {
    const user: DemoUser = yield call(authApi.updateProfile, action.payload);
    if (generation !== getSessionGeneration()) return;
    yield put(accountOperationSucceeded({ user, message: "Profile saved to your account." }));
  } catch (error) {
    if (generation !== getSessionGeneration()) return;
    yield put(accountOperationFailed(error instanceof Error ? error.message : "Unable to save your profile."));
  }
}

function* changePassword(action: PayloadAction<ChangePasswordInput>) {
  try {
    const message: string = yield call(authApi.changePassword, action.payload);
    yield put(accountOperationSucceeded({ message }));
  } catch (error) {
    yield put(accountOperationFailed(error instanceof Error ? error.message : "Unable to change your password."));
  }
}

function* switchDevRole(action: PayloadAction<DevRole>): Generator<unknown, void, AuthSession> {
  if (!isTeamDevAuth) return;
  try {
    setDevRole(action.payload);
    const session: AuthSession = yield call(authApi.login, { email: "", password: "" });
    setAccessToken(null);
    yield put(authSucceeded(session));
  } catch (error) {
    setAccessToken(null);
    yield put(authFailed(error instanceof Error ? error.message : "Unable to switch development role."));
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

function* watchExpiredSessions() {
  const expired = eventChannel<boolean>((emit) => {
    const onExpired = () => emit(true);
    window.addEventListener(sessionExpiredEvent, onExpired);
    return () => window.removeEventListener(sessionExpiredEvent, onExpired);
  });
  try {
    while (true) {
      yield take(expired);
      yield put(authAnonymous());
    }
  } finally { expired.close(); }
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

function* changeAdminUserStatus(action: PayloadAction<{ id: string; isActive: boolean }>) {
  try {
    const user: AdminUser = yield call(authApi.setUserActive, action.payload.id, action.payload.isActive);
    yield put(adminUserRoleChanged(user));
  } catch (error) {
    yield put(adminUsersFailed(error instanceof Error ? error.message : "Unable to change account access."));
  }
}

export function* authSaga() {
  yield fork(watchExpiredSessions);
  yield takeLatest(bootstrapAuthRequested.type, bootstrapAuth);
  yield takeLeading(loginRequested.type, signIn);
  yield takeLatest(switchDevRoleRequested.type, switchDevRole);
  yield takeLeading(registerRequested.type, register);
  yield takeLeading(passwordResetRequested.type, requestPasswordReset);
  yield takeLeading(resetPasswordRequested.type, resetPassword);
  yield takeLeading(profileUpdateRequested.type, updateProfile);
  yield takeLeading(changePasswordRequested.type, changePassword);
  yield takeLatest(logoutRequested.type, signOut);
  yield takeLatest(adminUsersRequested.type, loadAdminUsers);
  yield takeLeading(adminRoleChangeRequested.type, changeAdminUserRole);
  yield takeLeading(adminStatusChangeRequested.type, changeAdminUserStatus);
}
