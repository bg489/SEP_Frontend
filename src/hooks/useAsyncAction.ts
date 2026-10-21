import { useCallback, useEffect, useRef, useState } from "react";

/** Keeps each action pending until its whole request chain settles. */
export function useAsyncAction() {
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = useCallback(async <T,>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
    // The ref closes the gap before React renders the disabled control.
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    if (mounted.current) setPendingKeys(new Set(inFlight.current));
    try {
      return await action();
    } finally {
      inFlight.current.delete(key);
      if (mounted.current) setPendingKeys(new Set(inFlight.current));
    }
  }, []);

  return {
    pending: pendingKeys.size > 0,
    isPending: (key: string) => pendingKeys.has(key),
    run,
  };
}
