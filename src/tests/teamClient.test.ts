import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestTeamApi, TeamApiError } from "../services/teamClient";
import { getTokenSession, setAccessToken, storeTokenSession } from "../services/authToken";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const token = (expiresAt = Date.now() + 3600_000) => ({ accessToken: "original", refreshToken: "refresh", expiresAt });
beforeEach(() => { setAccessToken(null); });

describe("HTTP authentication transport", () => {
  it("FE-UT-010 parallel calls share one refresh and send its token", async () => {
    storeTokenSession(token(1)); let complete!: (response: Response) => void;
    const refreshed = new Promise<Response>(resolve => { complete = resolve; });
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => String(url).endsWith("/refresh") ? refreshed : Promise.resolve(json({ authorization: new Headers(init?.headers).get("Authorization") })));
    vi.stubGlobal("fetch", fetcher);
    const a = requestTeamApi<{ authorization: string }>("/first"); const b = requestTeamApi<{ authorization: string }>("/second");
    expect(fetcher).toHaveBeenCalledTimes(1);
    complete(json({ accessToken: "new", refreshToken: "rotated", expiresIn: 3600 }));
    expect((await a).authorization).toBe("Bearer new"); expect((await b).authorization).toBe("Bearer new");
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/refresh"))).toHaveLength(1);
  });

  it("FE-UT-011 a late refresh never restores a logged-out session", async () => {
    storeTokenSession(token(1)); let complete!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn((url: string | URL | Request) => String(url).endsWith("/refresh") ? new Promise<Response>(resolve => { complete = resolve; }) : Promise.resolve(json({ ok: true }))));
    const pending = requestTeamApi("/late"); setAccessToken(null);
    complete(json({ accessToken: "late", refreshToken: "late-refresh", expiresIn: 3600 }));
    await pending; expect(getTokenSession()).toBeNull();
  });

  it("FE-UT-012 only retries once after 401, then expires the session", async () => {
    storeTokenSession(token());
    const fetcher = vi.fn().mockResolvedValueOnce(json({ title: "expired" }, 401)).mockResolvedValueOnce(json({ accessToken: "new", refreshToken: "refresh2", expiresIn: 3600 })).mockResolvedValueOnce(json({ title: "still denied" }, 401));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestTeamApi("/protected")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(3); expect(getTokenSession()).toBeNull();
  });

  it("FE-UT-013 preserves abort errors and reports network errors separately", async () => {
    const abort = new DOMException("cancelled", "AbortError"); const fetcher = vi.fn().mockRejectedValueOnce(abort).mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestTeamApi("/cancel")).rejects.toBe(abort);
    await expect(requestTeamApi("/offline")).rejects.toMatchObject({ status: 0, code: "HTTP_0" });
  });

  it("FE-UT-014 keeps validation paths, fields, code and trace id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ title: "Invalid scenario", code: "VALIDATION_FAILED", traceId: "trace-7", errors: { map: ["Unknown map"] }, report: { errors: [{ path: "actors[0].spawn", message: "overlap" }] } }, 400)));
    const error = await requestTeamApi("/validate").catch(cause => cause as TeamApiError);
    expect(error).toBeInstanceOf(TeamApiError); expect(error).toMatchObject({ code: "VALIDATION_FAILED", traceId: "trace-7", fields: { map: ["Unknown map"] } });
    expect((error as TeamApiError).message).toContain("actors[0].spawn"); expect((error as TeamApiError).message).toContain("overlap");
  });
});
