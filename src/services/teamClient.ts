import { beginApiActivity } from "./apiActivity";
import { authApiBaseUrl, isTeamDevAuth } from "./authConfig";
import { expireTokenSession, getSessionGeneration, getTokenSession, storeTokenSession } from "./authToken";

export interface TeamValidationIssue { tier?: string; path: string; message: string }
export interface TeamProblemDetails {
  title?: string; detail?: string; message?: string; code?: string; traceId?: string;
  errors?: Record<string, string[]>;
  report?: { errors?: TeamValidationIssue[]; warnings?: TeamValidationIssue[]; stoppedAt?: string | null };
}

export class TeamApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly report: TeamProblemDetails["report"];
  readonly traceId?: string;
  constructor(status: number, problem: TeamProblemDetails) {
    const fieldMessages = Object.entries(problem.errors ?? {}).flatMap(([field, errors]) => errors.map((message) => `${field}: ${message}`));
    const issueMessages = (problem.report?.errors ?? []).map((issue) => `${issue.path}: ${issue.message}`);
    const headline = problem.message ?? problem.title ?? problem.detail ?? `Request failed (HTTP ${status}).`;
    super([headline, ...fieldMessages, ...issueMessages].filter(Boolean).join("\n"));
    this.name = "TeamApiError";
    this.status = status;
    this.code = problem.code ?? `HTTP_${status}`;
    this.fields = problem.errors ?? {};
    this.report = problem.report;
    this.traceId = problem.traceId;
  }
}

interface RefreshedSession { accessToken: string; refreshToken: string; expiresIn: number }
let refreshRequest: Promise<void> | null = null;

async function problemFrom(response: Response): Promise<TeamApiError> {
  const body = await response.text();
  let problem: TeamProblemDetails;
  try { problem = JSON.parse(body) as TeamProblemDetails; }
  catch { problem = { title: response.status >= 500 ? "The backend could not complete the request. Check its console and database configuration." : body || response.statusText }; }
  return new TeamApiError(response.status, problem);
}

export async function refreshTeamSession(): Promise<void> {
  if (refreshRequest) return refreshRequest;
  const current = getTokenSession();
  const generation = getSessionGeneration();
  if (!current?.refreshToken) {
    expireTokenSession();
    throw new TeamApiError(401, { title: "Your session has expired. Sign in again." });
  }
  refreshRequest = (async () => {
    const finish = beginApiActivity();
    try {
      const response = await fetch(`${authApiBaseUrl}/api/v1/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && generation === getSessionGeneration()) expireTokenSession();
        throw await problemFrom(response);
      }
      const next = await response.json() as RefreshedSession;
      if (!next.accessToken || !next.refreshToken || !Number.isFinite(next.expiresIn)) throw new TeamApiError(502, { title: "The backend returned an invalid authentication session." });
      if (generation === getSessionGeneration()) storeTokenSession({ accessToken: next.accessToken, refreshToken: next.refreshToken, expiresAt: Date.now() + next.expiresIn * 1000 });
    } finally { finish(); }
  })().finally(() => { refreshRequest = null; });
  return refreshRequest;
}

/** Pass complete API paths, for example /api/v1/scenarios. Exposes ETag headers. */
export async function requestTeamResponse(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const finish = beginApiActivity();
  const send = () => {
    const headers = new Headers(init.headers);
    if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = getTokenSession()?.accessToken;
    if (authenticated && !isTeamDevAuth && token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(authApiBaseUrl + path, { ...init, headers });
  };
  try {
    const current = getTokenSession();
    if (authenticated && !isTeamDevAuth && current?.expiresAt && current.expiresAt <= Date.now() + 30_000) await refreshTeamSession();
    let response = await send();
    if (response.status === 401 && authenticated && !isTeamDevAuth && getTokenSession()?.refreshToken) {
      await refreshTeamSession();
      response = await send();
    }
    if (!response.ok) {
      if (response.status === 401 && authenticated && !isTeamDevAuth) expireTokenSession();
      throw await problemFrom(response);
    }
    return response;
  } catch (error) {
    if (error instanceof TeamApiError || error instanceof DOMException && error.name === "AbortError") throw error;
    throw new TeamApiError(0, { title: "Cannot connect to the team backend. Start AutoScenarioX.Api on port 5080 and check the API URL." });
  } finally { finish(); }
}

export async function requestTeamApi<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const response = await requestTeamResponse(path, init, authenticated);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function downloadTeamArtifact(path: string, fileName: string): Promise<void> {
  const finish = beginApiActivity();
  try {
    const response = await requestTeamResponse(path);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally { finish(); }
}

export const teamClient = { request: requestTeamApi, response: requestTeamResponse, download: downloadTeamArtifact };
