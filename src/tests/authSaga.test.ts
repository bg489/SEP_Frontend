import { afterEach, describe, expect, it, vi } from "vitest";
import { runSaga, stdChannel, type Task } from "redux-saga";
import { waitFor } from "@testing-library/react";
import type { UnknownAction } from "redux";
import { authSaga } from "../features/auth/authSaga";
import { authApi, type AuthSession } from "../services/authApi";
import { expireTokenSession, getAccessToken, setAccessToken } from "../services/authToken";
import { bootstrapAuthRequested, loginRequested, logoutRequested, registerRequested, profileUpdateRequested, passwordResetRequested } from "../features/auth/authSlice";

const session: AuthSession = { user: { name: "Tester", email: "tester@example.invalid", role: "Test Engineer" }, accessToken: "fixture-token" };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
const tasks: Task[] = [];
afterEach(async () => { for (const task of tasks.splice(0)) { task.cancel(); await task.toPromise(); } setAccessToken(null); });
function harness() {
  const channel = stdChannel(); const actions: UnknownAction[] = [];
  tasks.push(runSaga({ channel, dispatch: action => { if (action && typeof action === "object" && "type" in action) actions.push(action as UnknownAction); } }, authSaga));
  return { send: (action: UnknownAction) => channel.put(action), actions };
}
describe("Authentication Saga", () => {
  it("FE-UT-015 bootstrap handles absent and rejected stored identities", async () => {
    const { send, actions } = harness(); send(bootstrapAuthRequested());
    await waitFor(() => expect(actions.some(a => a.type === "auth/authAnonymous")).toBe(true));
    actions.length = 0; setAccessToken("expired-fixture"); vi.spyOn(authApi, "currentUser").mockRejectedValue(new Error("expired"));
    send(bootstrapAuthRequested()); await waitFor(() => expect(getAccessToken()).toBeNull());
    expect(actions.some(a => a.type === "auth/authAnonymous")).toBe(true);
  });
  it("FE-UT-016 leading login ignores a second click until the first request settles", async () => {
    const pending = deferred<AuthSession>(); const login = vi.spyOn(authApi, "login").mockReturnValue(pending.promise);
    const { send, actions } = harness(); const input = { email: "tester@example.invalid", password: "fixture-password" };
    send(loginRequested(input)); send(loginRequested(input)); expect(login).toHaveBeenCalledTimes(1);
    pending.resolve(session); await waitFor(() => expect(actions.some(a => a.type === "auth/authSucceeded")).toBe(true));
    expect(getAccessToken()).toBe(session.accessToken);
  });
  it("FE-UT-016 rejected credentials leave no token and expose the server error", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(new Error("Invalid credentials"));
    const { send, actions } = harness(); send(loginRequested({ email: "x@example.invalid", password: "wrong" }));
    await waitFor(() => expect(actions).toContainEqual({ type: "auth/authFailed", payload: "Invalid credentials" }));
    expect(getAccessToken()).toBeNull();
  });
  it("FE-UT-017 logging out while login is pending prevents a late login response", async () => {
    const pending = deferred<AuthSession>(); vi.spyOn(authApi, "login").mockReturnValue(pending.promise);
    const { send, actions } = harness(); send(loginRequested({ email: "x@example.invalid", password: "fixture" }));
    send(logoutRequested()); pending.resolve(session); await new Promise(resolve => setTimeout(resolve, 0));
    expect(actions.some(a => a.type === "auth/signedOut")).toBe(true);
    expect(actions.some(a => a.type === "auth/authSucceeded")).toBe(false); expect(getAccessToken()).toBeNull();
  });
  it("FE-UT-018 email confirmation does not create an authenticated session", async () => {
    vi.spyOn(authApi, "register").mockResolvedValue({ session: null, requiresEmailConfirmation: true, message: "Confirm your email" });
    const { send, actions } = harness(); send(registerRequested({ name: "New", email: "new@example.invalid", password: "fixture-password", role: "Test Reviewer" }));
    await waitFor(() => expect(actions).toContainEqual({ type: "auth/authDemoCompleted", payload: "Confirm your email" }));
    expect(getAccessToken()).toBeNull(); expect(actions.some(a => a.type === "auth/authSucceeded")).toBe(false);
  });
  it("FE-UT-017 an expired-session event removes the protected identity", async () => {
    const { actions } = harness(); expireTokenSession(); await waitFor(() => expect(actions.some(a => a.type === "auth/authAnonymous")).toBe(true));
  });
  it("FE-UT-018 recovery acknowledgement never authenticates", async () => {
    vi.spyOn(authApi, "requestPasswordReset").mockResolvedValue("Check your email"); const { send, actions } = harness(); send(passwordResetRequested("user@example.invalid"));
    await waitFor(() => expect(actions.some(a => a.type === "auth/passwordResetSucceeded")).toBe(true)); expect(actions.some(a => a.type === "auth/authSucceeded")).toBe(false);
  });
  it("a profile response received after logout cannot restore a user", async () => {
    const pending = deferred<AuthSession["user"]>(); vi.spyOn(authApi, "updateProfile").mockReturnValue(pending.promise);
    const { send, actions } = harness(); send(profileUpdateRequested("New name")); send(logoutRequested());
    pending.resolve({ ...session.user, name: "New name" }); await new Promise(resolve => setTimeout(resolve, 0));
    expect(actions.some(a => a.type === "auth/accountOperationSucceeded")).toBe(false);
  });
});
