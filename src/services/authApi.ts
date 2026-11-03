import type { DemoUser, UserRole } from "../types";
import { isTeamDevAuth } from "./authConfig";
import { getSessionGeneration, storeTokenSession } from "./authToken";
import { requestTeamApi } from "./teamClient";
import { devRoleToUserRole, getDevRole } from "./devRole";

export interface AuthSession {
  user: DemoUser;
  accessToken: string | null;
  expiresAt?: string;
}
export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string; role: RegistrationRole }
export type RegistrationRole = Exclude<UserRole, "Administrator">;
export interface AdminUser extends DemoUser { id: string; isActive?: boolean }
export interface RegistrationResult { message: string; requiresEmailConfirmation: boolean; session: AuthSession | null }
export interface ResetPasswordInput { accessToken: string; newPassword: string }
export interface ChangePasswordInput { currentPassword: string; newPassword: string }

interface TeamUser { id: string; displayName: string; email: string; role: string; isActive: boolean }
interface TeamSession { accessToken: string; refreshToken: string; expiresIn: number; user: TeamUser }
const roleNames: Record<string, UserRole> = {
  SCENARIO_ENGINEER: "Scenario Engineer", TEST_ENGINEER: "Test Engineer",
  TEST_REVIEWER: "Test Reviewer", ADMIN: "Administrator",
};

function userFromApi(user: TeamUser): DemoUser {
  if (!user.isActive) throw new Error("This account has been disabled.");
  const role = roleNames[user.role];
  if (!role) throw new Error(`The backend returned an unsupported role: ${user.role}.`);
  return { name: user.displayName || user.email, email: user.email, role };
}
function adminUserFromApi(user: TeamUser): AdminUser {
  const role = roleNames[user.role];
  if (!role) throw new Error(`Unsupported account role: ${user.role}.`);
  return { id: user.id, name: user.displayName || user.email, email: user.email, role, isActive: user.isActive };
}
function sessionFromApi(response: TeamSession): AuthSession {
  const user = userFromApi(response.user);
  if (!response.accessToken || !response.refreshToken || !Number.isFinite(response.expiresIn) || response.expiresIn <= 0) {
    throw new Error("The backend returned an invalid authentication session.");
  }
  const expiresAt = Date.now() + response.expiresIn * 1000;
  storeTokenSession({ accessToken: response.accessToken, refreshToken: response.refreshToken, expiresAt });
  return { user, accessToken: response.accessToken, expiresAt: new Date(expiresAt).toISOString() };
}
const roleToApi = (role: UserRole) => Object.entries(roleNames).find(([, value]) => value === role)?.[0];

/** A response started before logout/session replacement must not restore an older identity. */
export class StaleAuthRequestError extends Error {
  constructor() { super("The authentication request was superseded by a newer session."); this.name = "StaleAuthRequestError"; }
}

async function anonymousAuthRequest<T>(path: string, init: RequestInit): Promise<T> {
  const generation = getSessionGeneration();
  try {
    const result = await requestTeamApi<T>(path, init, false);
    if (generation !== getSessionGeneration()) throw new StaleAuthRequestError();
    return result;
  } catch (error) {
    if (generation !== getSessionGeneration()) throw new StaleAuthRequestError();
    throw error;
  }
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    if (isTeamDevAuth) {
      const role = getDevRole();
      const user = await anonymousAuthRequest<TeamUser>("/api/v1/auth/me", {});
      // /me returns the persisted DB role. Dev permissions instead use the
      // existing X-Asx-Dev-Role header, so show that explicitly selected role.
      return { user: { ...userFromApi(user), role: devRoleToUserRole(role) }, accessToken: null };
    }
    const response = await anonymousAuthRequest<TeamSession>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email: input.email.trim(), password: input.password }),
    });
    return sessionFromApi(response);
  },

  async currentUser(): Promise<DemoUser> {
    const role = getDevRole();
    const user = userFromApi(await requestTeamApi<TeamUser>("/api/v1/auth/me"));
    return isTeamDevAuth ? { ...user, role: devRoleToUserRole(role) } : user;
  },

  async register(input: RegisterInput): Promise<RegistrationResult> {
    if (!["Scenario Engineer", "Test Engineer", "Test Reviewer"].includes(input.role)) throw new Error("Administrator cannot be selected during registration.");
    const response = await anonymousAuthRequest<{ message: string; requiresEmailConfirmation: boolean; session: TeamSession | null }>("/api/v1/auth/register", {
      method: "POST", body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password,
        displayName: input.name.trim(), role: roleToApi(input.role) }),
    });
    return { ...response, session: response.session ? sessionFromApi(response.session) : null };
  },

  async requestPasswordReset(email: string): Promise<string> {
    const response = await requestTeamApi<{ message: string }>("/api/v1/auth/forgot-password", {
      method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }, false);
    return response.message;
  },

  async resetPassword(input: ResetPasswordInput): Promise<string> {
    const response = await requestTeamApi<{ message: string }>("/api/v1/auth/reset-password", {
      method: "POST", body: JSON.stringify(input),
    }, false);
    return response.message;
  },

  async updateProfile(displayName: string): Promise<DemoUser> {
    return userFromApi(await requestTeamApi<TeamUser>("/api/v1/auth/profile", {
      method: "PATCH", body: JSON.stringify({ displayName: displayName.trim() }),
    }));
  },

  async changePassword(input: ChangePasswordInput): Promise<string> {
    const response = await requestTeamApi<{ message: string }>("/api/v1/auth/change-password", {
      method: "POST", body: JSON.stringify(input),
    });
    return response.message;
  },

  async listUsers(): Promise<AdminUser[]> {
    const users: AdminUser[] = [];
    for (let page = 1; ; page++) {
      const result = await requestTeamApi<{ items: TeamUser[]; totalCount: number }>(`/api/v1/admin/users?page=${page}&pageSize=100`);
      users.push(...result.items.map(adminUserFromApi));
      if (users.length >= result.totalCount || !result.items.length) return users;
    }
  },

  async setUserRole(id: string, role: UserRole): Promise<AdminUser> {
    if (!Object.values(roleNames).includes(role)) throw new Error("Unsupported role.");
    return adminUserFromApi(await requestTeamApi<TeamUser>(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ role: roleToApi(role) }),
    }));
  },

  async setUserActive(id: string, isActive: boolean): Promise<AdminUser> {
    return adminUserFromApi(await requestTeamApi<TeamUser>(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ isActive }),
    }));
  },
};
