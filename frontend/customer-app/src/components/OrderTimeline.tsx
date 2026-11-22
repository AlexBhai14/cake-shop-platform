import { formatDateTime } from '../lib/dates';
import { PROGRESS_STEPS, progressIndex, STATUS_LABEL } from '../lib/orders';
import { HistoryEntry, OrderStatus } from '../lib/types';

// Progress bar for a healthy order
export function ProgressBar({ status }: { status: OrderStatus }) {
  const current = progressIndex(status);
  if (current < 0) return null; // pending, cancelled or failed orders have no progress bar
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Order progress">
      {PROGRESS_STEPS.map((step, i) => (
        <li
          key={step}
          className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold ${
            i <= current ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {STATUS_LABEL[step]}
        </li>
      ))}
    </ol>
  );
}

// Every status change of the order, newest last
export function History({ entries }: { entries: HistoryEntry[] }) {
  return (
    <ul className="space-y-3">
      {entries.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          <div>
            <p className="font-medium text-gray-800">{STATUS_LABEL[h.toStatus as OrderStatus] ?? h.toStatus}</p>
            <p className="text-xs text-gray-500">{formatDateTime(h.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
