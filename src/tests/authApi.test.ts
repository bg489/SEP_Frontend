import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi, StaleAuthRequestError } from "../services/authApi";
import type { RegisterInput } from "../services/authApi";
import { requestTeamApi } from "../services/teamClient";
import { getTokenSession, setAccessToken } from "../services/authToken";

vi.mock("../services/teamClient", () => ({ requestTeamApi: vi.fn() }));
const request = vi.mocked(requestTeamApi);
const user = { id: "user-1", displayName: "Backend User", email: "user@example.com", role: "TEST_ENGINEER", isActive: true };
const session = () => ({ accessToken: "access", refreshToken: "refresh", expiresIn: 1800, user });
beforeEach(() => { request.mockReset(); setAccessToken(null); });

describe("account API contract", () => {
  it("FE-UT-007 login sends normalized input and stores only a valid backend session", async () => {
    request.mockResolvedValue(session());
    const result = await authApi.login({ email: " user@example.com ", password: "unchanged password" });
    expect(request).toHaveBeenCalledWith("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "user@example.com", password: "unchanged password" }) }, false);
    expect(result.user).toEqual({ name: "Backend User", email: "user@example.com", role: "Test Engineer" });
    expect(getTokenSession()).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
  });

  it.each([
    { ...session(), accessToken: "" }, { ...session(), refreshToken: "" },
    { ...session(), expiresIn: -1 }, { ...session(), user: { ...user, isActive: false } },
    { ...session(), user: { ...user, role: "OWNER" } },
  ])("FE-UT-008 rejects malformed, disabled or unsupported login sessions", async response => {
    request.mockResolvedValue(response);
    await expect(authApi.login({ email: user.email, password: "password" })).rejects.toThrow();
    expect(getTokenSession()).toBeNull();
  });

  it.each([
    ["Scenario Engineer", "SCENARIO_ENGINEER"], ["Test Engineer", "TEST_ENGINEER"], ["Test Reviewer", "TEST_REVIEWER"],
  ] as const)("FE-UT-009 registers %s with no automatic login before confirmation", async (role, backendRole) => {
    request.mockResolvedValue({ message: "Check your email", requiresEmailConfirmation: true, session: null });
    const result = await authApi.register({ name: " New User ", email: " User@Example.com ", password: "password-123", role });
    const body = JSON.parse((request.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ displayName: "New User", email: "user@example.com", password: "password-123", role: backendRole });
    expect(result.session).toBeNull(); expect(getTokenSession()).toBeNull();
  });

  it("registration rejects an injected Administrator role before any request", async () => {
    await expect(authApi.register({ name: "User", email: user.email, password: "password-123", role: "Administrator" } as unknown as RegisterInput)).rejects.toThrow("Administrator");
    expect(request).not.toHaveBeenCalled();
  });

  it("confirmed registration uses the returned session and preserves its role", async () => {
    request.mockResolvedValue({ message: "Created", requiresEmailConfirmation: false, session: session() });
    const result = await authApi.register({ name: "User", email: user.email, password: "password-123", role: "Test Engineer" });
    expect(result.session?.user.role).toBe("Test Engineer");
    expect(getTokenSession()?.refreshToken).toBe("refresh");
  });

  it("password recovery and reset call real account routes with the right payload", async () => {
    request.mockResolvedValue({ message: "Recovery requested" });
    expect(await authApi.requestPasswordReset(" USER@EXAMPLE.COM ")).toBe("Recovery requested");
    expect(request.mock.calls[0]).toEqual(["/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: "user@example.com" }) }, false]);
    request.mockResolvedValue({ message: "Updated" });
    const reset = { accessToken: "recovery-token", newPassword: "new-password" };
    expect(await authApi.resetPassword(reset)).toBe("Updated");
    expect(request.mock.calls[1]).toEqual(["/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(reset) }, false]);
  });

  it("profile and password updates send only editable fields", async () => {
    request.mockResolvedValue(user);
    expect((await authApi.updateProfile(" Changed ")).role).toBe("Test Engineer");
    expect(request.mock.calls[0]).toEqual(["/api/v1/auth/profile", { method: "PATCH", body: JSON.stringify({ displayName: "Changed" }) }]);
    request.mockResolvedValue({ message: "Password updated" });
    const password = { currentPassword: "old", newPassword: "new-password" };
    expect(await authApi.changePassword(password)).toBe("Password updated");
    expect(request.mock.calls[1]).toEqual(["/api/v1/auth/change-password", { method: "POST", body: JSON.stringify(password) }]);
  });

  it("admin users include disabled accounts and load all server pages", async () => {
    request.mockResolvedValueOnce({ items: [{ ...user, isActive: false }], totalCount: 2 }).mockResolvedValueOnce({ items: [{ ...user, id: "user-2" }], totalCount: 2 });
    const result = await authApi.listUsers();
    expect(result).toHaveLength(2); expect(result[0].isActive).toBe(false);
    expect(request.mock.calls.map(call => call[0])).toEqual(["/api/v1/admin/users?page=1&pageSize=100", "/api/v1/admin/users?page=2&pageSize=100"]);
  });

  it("admin role and active changes call the authoritative server instead of browser storage", async () => {
    request.mockResolvedValue({ ...user, role: "TEST_REVIEWER", isActive: false });
    expect((await authApi.setUserRole("user/1", "Test Reviewer")).role).toBe("Test Reviewer");
    expect(request.mock.calls[0]).toEqual(["/api/v1/admin/users/user%2F1", { method: "PATCH", body: JSON.stringify({ role: "TEST_REVIEWER" }) }]);
    await authApi.setUserActive("user-1", false);
    expect(request.mock.calls[1]).toEqual(["/api/v1/admin/users/user-1", { method: "PATCH", body: JSON.stringify({ isActive: false }) }]);
  });

  it("provider/network errors are not converted into a success message", async () => {
    request.mockRejectedValue(new Error("Supabase unavailable"));
    await expect(authApi.register({ name: "User", email: user.email, password: "password-123", role: "Test Engineer" })).rejects.toThrow("Supabase unavailable");
    expect(getTokenSession()).toBeNull();
  });

  it.each(["login", "register"] as const)("FE-UT-055 a late %s response never restores credentials after logout", async operation => {
    let resolve!: (value: unknown) => void;
    request.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
    const pending = operation === "login"
      ? authApi.login({ email: user.email, password: "password-123" })
      : authApi.register({ name: "User", email: user.email, password: "password-123", role: "Test Engineer" });
    setAccessToken(null);
    resolve(operation === "login" ? session() : { message: "Created", requiresEmailConfirmation: false, session: session() });
    await expect(pending).rejects.toBeInstanceOf(StaleAuthRequestError);
    expect(getTokenSession()).toBeNull();
  });

  it("an older failed login does not discard a newer account session", async () => {
    let reject!: (cause: Error) => void;
    request.mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
    const old = authApi.login({ email: user.email, password: "wrong" });
    setAccessToken("newer-session"); reject(new Error("Old password failed"));
    await expect(old).rejects.toBeInstanceOf(StaleAuthRequestError);
    expect(getTokenSession()?.accessToken).toBe("newer-session");
  });
});
