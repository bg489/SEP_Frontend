import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { runSaga, stdChannel } from "redux-saga";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { beginApiActivity, subscribeToApiActivity } from "../services/apiActivity";
import { requestWorkflowApi, setWorkflowApiDispatcher, settleWorkflowApiRequest, workflowApiRequested } from "../services/workflowApiBridge";
import { workflowSaga } from "../features/workflow/workflowSaga";
import type { UnknownAction } from "redux";

const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe("Redux workflow bridge", () => {
  it("FE-UT-019 settles the matching request only once, independently of response order", async () => {
    const actions: UnknownAction[] = [];
    setWorkflowApiDispatcher(action => { actions.push(action); return action; });
    const first = requestWorkflowApi<number>("backendRequest", ["/first"]);
    const second = requestWorkflowApi<number>("backendRequest", ["/second"]);
    const ids = actions.map(action => (action as ReturnType<typeof workflowApiRequested>).payload.requestId);
    settleWorkflowApiRequest(ids[1], 2);
    settleWorkflowApiRequest(ids[0], 1);
    settleWorkflowApiRequest(ids[0], 999);
    expect(await first).toBe(1); expect(await second).toBe(2);
  });

  it("FE-UT-020 unknown API methods reject the caller through Saga", async () => {
    const channel = stdChannel();
    const task = runSaga({ channel }, workflowSaga);
    setWorkflowApiDispatcher(action => { channel.put(action); return action; });
    const request = requestWorkflowApi("missingMethod" as "backendRequest", []);
    await expect(request).rejects.toThrow("not available");
    task.cancel(); await task.toPromise(); channel.close();
  });
});

describe("API pending actions", () => {
  it("FE-UT-021 closes the double-click gap before the next render", async () => {
    const { result } = renderHook(useAsyncAction); const pending = deferred<number>();
    const action = vi.fn(() => pending.promise); let first!: Promise<number | undefined>;
    await act(async () => {
      first = result.current.run("save", action);
      expect(await result.current.run("save", action)).toBeUndefined();
    });
    expect(action).toHaveBeenCalledTimes(1); expect(result.current.isPending("save")).toBe(true);
    await act(async () => { pending.resolve(7); expect(await first).toBe(7); });
    expect(result.current.pending).toBe(false);
  });

  it("FE-UT-022 independent action keys remain pending independently", async () => {
    const { result } = renderHook(useAsyncAction); const a = deferred<void>(); const b = deferred<void>();
    let pa!: Promise<void | undefined>; let pb!: Promise<void | undefined>;
    act(() => { pa = result.current.run("a", () => a.promise); pb = result.current.run("b", () => b.promise); });
    expect(result.current.isPending("a")).toBe(true); expect(result.current.isPending("b")).toBe(true);
    await act(async () => { a.resolve(); await pa; });
    expect(result.current.isPending("a")).toBe(false); expect(result.current.isPending("b")).toBe(true);
    await act(async () => { b.resolve(); await pb; }); expect(result.current.pending).toBe(false);
  });

  it("FE-UT-023 rejected actions clear loading and permit retry", async () => {
    const { result } = renderHook(useAsyncAction);
    await act(async () => { await expect(result.current.run("save", async () => { throw new Error("offline"); })).rejects.toThrow("offline"); });
    expect(result.current.pending).toBe(false);
    await act(async () => { expect(await result.current.run("save", async () => "saved")).toBe("saved"); });
  });

  it("FE-UT-024 settled work after unmount does not update an unmounted hook", async () => {
    const spy = vi.spyOn(console, "error"); const { result, unmount } = renderHook(useAsyncAction);
    const a = deferred<number>(); let promise!: Promise<number | undefined>;
    act(() => { promise = result.current.run("load", () => a.promise); }); unmount();
    a.resolve(5); expect(await promise).toBe(5); expect(spy).not.toHaveBeenCalled();
  });

  it("FE-UT-025 counts overlapping activity and repeated finish is harmless", async () => {
    const counts: number[] = []; const stop = subscribeToApiActivity(value => counts.push(value));
    const a = beginApiActivity(); const b = beginApiActivity(); a(); a(); b();
    await waitFor(() => expect(counts.at(-1)).toBe(0));
    expect(counts.slice(-4)).toEqual([1, 2, 1, 0]); stop();
  });
});
