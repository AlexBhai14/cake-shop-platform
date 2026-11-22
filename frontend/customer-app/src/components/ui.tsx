import { formatINR } from '../lib/money';
import { ReactNode } from 'react';
import { OrderStatus } from '../lib/types';
import { STATUS_LABEL, statusTone, Tone } from '../lib/orders';

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-gray-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
      {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      {message}
      {onRetry && (
        <button className="ml-3 font-semibold underline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'green' | 'blue' }) {
  const colors = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-green-200 bg-green-50 text-green-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return <div className={`rounded-lg border p-3 text-sm ${colors[tone]}`}>{children}</div>;
}

const TONES: Record<Tone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
  gray: 'bg-gray-100 text-gray-700',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONES[statusTone(status)]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-2xl font-bold text-gray-900">{children}</h1>;
}

// Crossed-out price + "X% OFF" + the real price. Shows only the real price when there is no discount.
export function PriceTag({ price, mrp, discountPercent, size = 'md' }: { price: string; mrp?: string | null; discountPercent?: number; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {mrp && (
        <span className={`${big ? 'text-lg' : 'text-sm'} text-gray-400 line-through`} aria-label="Original price">
          {formatINR(mrp)}
        </span>
      )}
      <span className={`${big ? 'text-3xl font-extrabold' : 'text-sm font-bold'} text-rose-700`}>{formatINR(price)}</span>
      {mrp && !!discountPercent && (
        <span className={`${big ? 'text-sm' : 'text-xs'} rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-700`}>
          {discountPercent}% OFF
        </span>
      )}
    </span>
  );
}
