import { describe, expect, it, vi } from "vitest";
const key = "autoscenariox.team-api.session";
describe("Stored authentication", () => {
  it.each(["not JSON", '{"accessToken":"  "}', '{"accessToken":123}'])("FE-UT-008 restores %s as an anonymous session", async raw => {
    sessionStorage.setItem(key, raw); vi.resetModules(); const tokens = await import("../services/authToken"); expect(tokens.getTokenSession()).toBeNull();
  });
  it("FE-UT-009 stores and returns copies and clears the obsolete token key", async () => {
    vi.resetModules(); const tokens = await import("../services/authToken"); const input = { accessToken: "fixture", refreshToken: "refresh", expiresAt: 1234 };
    sessionStorage.setItem("autoscenariox.access-token", "obsolete"); tokens.storeTokenSession(input); input.accessToken = "mutated";
    const first = tokens.getTokenSession()!; first.refreshToken = "mutated";
    expect(tokens.getTokenSession()).toEqual({ accessToken: "fixture", refreshToken: "refresh", expiresAt: 1234 });
    expect(sessionStorage.getItem("autoscenariox.access-token")).toBeNull(); tokens.setAccessToken(null); expect(sessionStorage.getItem(key)).toBeNull();
  });
});
