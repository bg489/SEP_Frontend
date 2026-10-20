const tokenKey = "autoscenariox.access-token";
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    accessToken = window.sessionStorage.getItem(tokenKey);
  } catch {
    accessToken = null;
  }
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) window.sessionStorage.setItem(tokenKey, token);
    else window.sessionStorage.removeItem(tokenKey);
  } catch {
    // Keep the in-memory session usable if browser storage is unavailable.
  }
}
