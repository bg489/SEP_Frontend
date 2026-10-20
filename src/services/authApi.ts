import type { DemoUser, UserRole } from "../types";
import { authApiBaseUrl } from "./authConfig";
import { getAccessToken } from "./authToken";

export interface AuthSession {
  user: DemoUser;
  accessToken: string | null;
  expiresAt?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: RegistrationRole;
}

export type RegistrationRole = Exclude<UserRole, "Administrator">;

export interface AdminUser extends DemoUser {
  id: string;
}

interface ApiUser {
  id?: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface ApiSession {
  accessToken: string;
  expiresAt: string;
  user: ApiUser;
}

function sessionFromApi(response: ApiSession): AuthSession {
  return {
    user: {
      name: response.user.fullName,
      email: response.user.email,
      role: response.user.role,
    },
    accessToken: response.accessToken,
    expiresAt: response.expiresAt,
  };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(authApiBaseUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to the authentication API at ${authApiBaseUrl}. Start the .NET backend and try again.`,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string; detail?: string; title?: string; errors?: Record<string, string[]> }
      | null;
    const validationMessage = body?.errors
      ? Object.values(body.errors).flat().join(" ")
      : undefined;
    throw new Error(
      body?.message ?? validationMessage ?? body?.detail ?? body?.title ??
        `Request failed with status ${response.status}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const response = await apiRequest<ApiSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: input.email, password: input.password }),
    });
    return sessionFromApi(response);
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    const response = await apiRequest<ApiSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
        role: input.role,
      }),
    });
    return sessionFromApi(response);
  },

  async currentUser(): Promise<DemoUser> {
    const response = await apiRequest<ApiUser>("/api/auth/me");
    return { name: response.fullName, email: response.email, role: response.role };
  },

  async listUsers(): Promise<AdminUser[]> {
    const users = await apiRequest<ApiUser[]>("/api/admin/users");
    return users.map((user) => ({
      id: user.id ?? user.email,
      name: user.fullName,
      email: user.email,
      role: user.role,
    }));
  },

  async setUserRole(id: string, role: UserRole): Promise<AdminUser> {
    const user = await apiRequest<ApiUser>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    return {
      id: user.id ?? id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    };
  },

  async requestPasswordReset(email: string): Promise<string> {
    const response = await apiRequest<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    return response.message;
  },
};
