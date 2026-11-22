import { useEffect, useRef } from 'react';

// Calls fn now and then every `ms` milliseconds until the component closes or `enabled` becomes false.
// Used to follow an order while the saga (stock, payment, email) works in the background.
export function usePolling(fn: () => Promise<void> | void, ms: number, enabled = true) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        await saved.current();
      } catch {
        /* the next round tries again */
      }
      if (!stopped) timer = setTimeout(run, ms);
    };
    void run();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [ms, enabled]);
}
