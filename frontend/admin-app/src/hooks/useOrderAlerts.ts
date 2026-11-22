import { useCallback, useRef, useState } from 'react';
import { ordersApi } from '../api/endpoints';
import { detectNewOrders } from '../lib/alerts';
import { AdminOrder } from '../lib/types';
import { usePolling } from './usePolling';

const POLL_MS = 15000;

// Looks for new paid orders every 15 seconds while the admin is logged in (simple polling, no extra backend needed).
export function useOrderAlerts() {
  const seen = useRef<Set<string> | null>(null);
  const [alerts, setAlerts] = useState<AdminOrder[]>([]);

  usePolling(async () => {
    const page = await ordersApi.list({ limit: 20 });
    const r = detectNewOrders(seen.current, page.items);
    seen.current = r.seen;
    if (r.fresh.length > 0) setAlerts((a) => [...r.fresh, ...a].slice(0, 5));
  }, POLL_MS);

  const dismiss = useCallback((id: string) => setAlerts((a) => a.filter((o) => o.id !== id)), []);
  const dismissAll = useCallback(() => setAlerts([]), []);
  return { alerts, dismiss, dismissAll };
}
