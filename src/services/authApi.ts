import type { DemoUser, UserRole } from "../types";
import { isTeamDevAuth } from "./authConfig";
import { storeTokenSession } from "./authToken";
import { requestTeamApi } from "./teamClient";

export interface AuthSession {
  user: DemoUser;
  accessToken: string | null;
  expiresAt?: string;
}
export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string; role: RegistrationRole }
export type RegistrationRole = Exclude<UserRole, "Administrator">;
export interface AdminUser extends DemoUser { id: string }

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

const mockUsersKey = "autoscenariox.team-api.mock-admin-users";
const initialMockUsers: AdminUser[] = [
  { id: "demo-engineer", name: "Demo Scenario Engineer", email: "scenario@example.invalid", role: "Scenario Engineer" },
  { id: "demo-tester", name: "Demo Test Engineer", email: "tester@example.invalid", role: "Test Engineer" },
  { id: "demo-reviewer", name: "Demo Test Reviewer", email: "reviewer@example.invalid", role: "Test Reviewer" },
];
function mockUsers(): AdminUser[] {
  try {
    const saved = JSON.parse(localStorage.getItem(mockUsersKey) ?? "null") as AdminUser[] | null;
    if (Array.isArray(saved)) return saved;
  } catch { /* Browser-only demo data can fall back to its initial records. */ }
  return initialMockUsers.map((user) => ({ ...user }));
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    if (isTeamDevAuth) {
      const user = await requestTeamApi<TeamUser>("/api/v1/auth/me");
      // Development authentication is explicit and never pretends to validate a password.
      return { user: userFromApi(user), accessToken: null };
    }
    const response = await requestTeamApi<TeamSession>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email: input.email.trim(), password: input.password }),
    }, false);
    const user = userFromApi(response.user);
    if (!response.accessToken || !response.refreshToken || !Number.isFinite(response.expiresIn)) throw new Error("The backend returned an invalid authentication session.");
    const expiresAt = Date.now() + response.expiresIn * 1000;
    storeTokenSession({ accessToken: response.accessToken, refreshToken: response.refreshToken, expiresAt });
    return { user, accessToken: response.accessToken, expiresAt: new Date(expiresAt).toISOString() };
  },

  async currentUser(): Promise<DemoUser> {
    return userFromApi(await requestTeamApi<TeamUser>("/api/v1/auth/me"));
  },

  async register(input: RegisterInput): Promise<string> {
    if (!["Scenario Engineer", "Test Engineer", "Test Reviewer"].includes(input.role)) throw new Error("Administrator cannot be selected during registration.");
    // No account, password or session is created for an API that does not exist.
    return "Demo only: the registration form was checked. The team backend does not provide registration yet; no account was created. Ask an administrator to provision a Supabase account.";
  },

  async requestPasswordReset(_email: string): Promise<string> {
    return "Demo only: the team backend does not provide password recovery yet. No reset email was sent. Contact your administrator.";
  },

  async listUsers(): Promise<AdminUser[]> { return mockUsers(); },

  async setUserRole(id: string, role: UserRole): Promise<AdminUser> {
    if (!Object.values(roleNames).includes(role)) throw new Error("Unsupported role.");
    const users = mockUsers();
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error("Demo user was not found.");
    const updated = { ...user, role };
    try { localStorage.setItem(mockUsersKey, JSON.stringify(users.map((item) => item.id === id ? updated : item))); }
    catch { throw new Error("Browser storage is unavailable. The demo role change was not saved."); }
    return updated;
  },
};
