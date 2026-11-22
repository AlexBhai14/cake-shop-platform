import { Link } from 'react-router-dom';
import { formatINR } from '../lib/money';
import { AdminOrder } from '../lib/types';

// Pop-up cards in the top-right corner. They stay until the admin closes them.
export function OrderAlerts({ alerts, onDismiss, onDismissAll }: { alerts: AdminOrder[]; onDismiss: (id: string) => void; onDismissAll: () => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2" role="status" aria-live="polite">
      {alerts.map((o) => (
        <div key={o.id} className="rounded-xl border border-green-300 bg-white p-3 shadow-lg">
          <p className="text-sm font-bold text-green-700">New paid order</p>
          <p className="text-sm">
            <Link to={`/orders/${o.id}`} className="font-semibold text-rose-700" onClick={() => onDismiss(o.id)}>#{o.id.slice(0, 8).toUpperCase()}</Link>
            {' · '}{formatINR(o.totalAmount)}
          </p>
          <p className="truncate text-xs text-slate-500">{o.customerEmail ?? 'Customer'}</p>
          <button className="mt-1 text-xs font-semibold text-slate-500 underline" onClick={() => onDismiss(o.id)}>Dismiss</button>
        </div>
      ))}
      {alerts.length > 1 && (
        <button className="w-full rounded-lg bg-slate-800 py-1 text-xs font-semibold text-white" onClick={onDismissAll}>Dismiss all</button>
      )}
    </div>
  );
}
