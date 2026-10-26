// Keep team-backend credentials separate from tokens issued by the previous API.
const sessionKey = "autoscenariox.team-api.session";
export const sessionExpiredEvent = "autoscenariox:team-session-expired";

export interface TokenSession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

function restore(): TokenSession | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(sessionKey) ?? "null");
    if (!value || typeof value !== "object" || !("accessToken" in value) || typeof value.accessToken !== "string") return null;
    const stored = value as Partial<TokenSession>;
    return { accessToken: value.accessToken, refreshToken: typeof stored.refreshToken === "string" ? stored.refreshToken : null,
      expiresAt: typeof stored.expiresAt === "number" ? stored.expiresAt : null };
  } catch { return null; }
}

let session = restore();
let generation = 0;
export function getAccessToken(): string | null { return session?.accessToken ?? null; }
export function getTokenSession(): TokenSession | null { return session ? { ...session } : null; }
export function getSessionGeneration(): number { return generation; }

export function storeTokenSession(value: TokenSession | null): void {
  session = value;
  generation += 1;
  try {
    if (value) window.sessionStorage.setItem(sessionKey, JSON.stringify(value));
    else window.sessionStorage.removeItem(sessionKey);
    window.sessionStorage.removeItem("autoscenariox.access-token");
  } catch { /* In-memory credentials still work when browser storage is unavailable. */ }
}

export function setAccessToken(token: string | null): void {
  if (!token) storeTokenSession(null);
  else if (token !== session?.accessToken) storeTokenSession({ accessToken: token, refreshToken: null, expiresAt: null });
}

export function expireTokenSession(): void {
  storeTokenSession(null);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(sessionExpiredEvent));
}
