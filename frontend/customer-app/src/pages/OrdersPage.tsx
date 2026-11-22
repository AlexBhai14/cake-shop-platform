import { Link } from 'react-router-dom';
import { ordersApi } from '../api/endpoints';
import { ErrorBox, Loading, PageTitle, StatusBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { formatDate } from '../lib/dates';
import { formatINR } from '../lib/money';

export function OrdersPage() {
  const orders = useAsync(() => ordersApi.list(), []);

  return (
    <div>
      <PageTitle>My orders</PageTitle>
      {orders.loading && <Loading />}
      {orders.error && <ErrorBox message={orders.error} onRetry={orders.reload} />}
      {orders.data && orders.data.length === 0 && (
        <div className="py-12 text-center text-gray-600">
          You have not placed an order yet.
          <div><Link to="/cakes" className="btn-primary mt-4">Browse cakes</Link></div>
        </div>
      )}
      <ul className="space-y-3">
        {orders.data?.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:shadow-md">
              <div>
                <p className="font-semibold">Order #{o.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm text-gray-500">
                  {o.items.map((i) => `${i.quantity} x ${i.cakeName}`).join(', ')}
                </p>
                <p className="text-xs text-gray-400">Delivery: {formatDate(o.deliveryDate)}, {o.deliverySlot}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={o.status} />
                <p className="mt-1 font-bold">{formatINR(o.totalAmount)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
