import { describe, expect, it } from "vitest";
import reducer, {
  accountOperationFailed, accountOperationSucceeded, adminUsersFailed, adminUsersLoaded,
  adminUsersRequested, authDemoCompleted, authFailed, authSucceeded, changePasswordRequested,
  loginRequested, profileUpdateRequested, registerRequested, signedOut, switchDevRoleRequested,
} from "../features/auth/authSlice";
import type { AuthSession } from "../services/authApi";

const session: AuthSession = { accessToken: "real-token", user: { name: "Test User", email: "test@example.com", role: "Test Engineer" } };

describe("authentication state", () => {
  it("FE-UT-001 starts checking without inventing an authenticated account", () => {
    expect(reducer(undefined, { type: "init" })).toMatchObject({ status: "checking", user: null, busy: false });
  });

  it("FE-UT-001 login starts loading and clears errors without granting access", () => {
    const failed = reducer(undefined, authFailed("Wrong password"));
    const state = reducer(failed, loginRequested({ email: "test@example.com", password: "secret" }));
    expect(state).toMatchObject({ status: "anonymous", user: null, busy: true, error: null, message: null });
  });

  it.each(["Scenario Engineer", "Test Engineer", "Test Reviewer", "Administrator"] as const)("FE-UT-002 accepts the backend-returned role %s", role => {
    const state = reducer(undefined, authSucceeded({ ...session, user: { ...session.user, role } }));
    expect(state).toMatchObject({ status: "authenticated", user: { role }, busy: false, error: null });
  });

  it("FE-UT-003 failed credentials remove access and show the actual error", () => {
    const state = reducer(reducer(undefined, authSucceeded(session)), authFailed("Account disabled"));
    expect(state).toMatchObject({ status: "anonymous", user: null, busy: false, error: "Account disabled" });
  });
  it("FE-UT-004 ignores role switching outside explicit Dev authentication", () => {
    const loggedIn = reducer(undefined, authSucceeded(session));
    expect(reducer(loggedIn, switchDevRoleRequested("ADMIN"))).toEqual(loggedIn);
  });

  it("FE-UT-005 registration awaiting confirmation never creates a fake session", () => {
    const state = reducer(reducer(undefined, registerRequested({ name: "User", email: "a@example.com", password: "password", role: "Test Reviewer" })), authDemoCompleted("Confirm your email"));
    expect(state).toMatchObject({ status: "anonymous", user: null, busy: false, message: "Confirm your email" });
  });

  it("FE-UT-006 logout clears the identity and auth notices", () => {
    const state = reducer(reducer(undefined, authSucceeded(session)), signedOut());
    expect(state).toMatchObject({ status: "anonymous", user: null, busy: false, error: null, message: null });
  });

  it("account profile/password writes keep the valid session when the operation fails", () => {
    const loggedIn = reducer(undefined, authSucceeded(session));
    const saving = reducer(loggedIn, profileUpdateRequested("Updated"));
    expect(saving.busy).toBe(true);
    const failure = reducer(saving, accountOperationFailed("Connection lost"));
    expect(failure).toMatchObject({ status: "authenticated", user: session.user, error: "Connection lost", busy: false });
    const password = reducer(failure, changePasswordRequested({ currentPassword: "old", newPassword: "newpassword" }));
    expect(password).toMatchObject({ busy: true, error: null, message: null });
    const changed = reducer(password, accountOperationSucceeded({ user: { ...session.user, name: "Updated" }, message: "Saved" }));
    expect(changed).toMatchObject({ status: "authenticated", user: { name: "Updated", role: "Test Engineer" }, busy: false, message: "Saved" });
  });

  it("admin list loading and errors do not overwrite the signed-in account", () => {
    const loggedIn = reducer(undefined, authSucceeded(session));
    const loading = reducer(loggedIn, adminUsersRequested());
    expect(loading).toMatchObject({ adminUsersBusy: true, user: session.user });
    const users = [{ ...session.user, id: "u-1", isActive: false }];
    expect(reducer(loading, adminUsersLoaded(users)).adminUsers).toEqual(users);
    expect(reducer(loading, adminUsersFailed("Forbidden"))).toMatchObject({ adminUsersError: "Forbidden", adminUsersBusy: false, user: session.user });
  });
});
