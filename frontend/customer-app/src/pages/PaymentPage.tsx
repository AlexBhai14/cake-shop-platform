import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ordersApi, paymentsApi, walletApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { usePolling } from '../hooks/usePolling';
import { getErrorMessage, statusOf } from '../lib/api';
import { formatINR } from '../lib/money';
import { Payment, Scenario, Wallet } from '../lib/types';

// The MOCK payment page. The three buttons tell the simulated bank what to do.
export function PaymentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Scenario | 'WALLET' | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // Follow the order: stock reservation and payment creation happen in the background (RabbitMQ events)
  const load = useCallback(async () => {
    try {
      const order = await ordersApi.get(id);
      if (order.status !== 'PENDING_PAYMENT') {
        navigate(`/orders/${id}`, { replace: true }); // confirmed, failed or cancelled: show the result
        return;
      }
      try {
        setPayment(await paymentsApi.get(id));
      } catch (e) {
        if (statusOf(e) !== 404) throw e; // 404 = the payment is not created yet
      }
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }, [id, navigate]);

  usePolling(load, 2000);

  // The wallet balance is only shown to help the customer; the server checks the balance again when paying.
  const loadWallet = useCallback(async () => {
    try {
      setWallet(await walletApi.get());
    } catch {
      setWallet(null); // the wallet is optional: the bank buttons still work
    }
  }, []);
  useEffect(() => void loadWallet(), [loadWallet]);

  const pay = async (scenario: Scenario) => {
    setPaying(scenario);
    setError(null);
    try {
      setPayment(await paymentsApi.pay(id, scenario));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPaying(null);
    }
  };

  const payWithWallet = async () => {
    setPaying('WALLET');
    setError(null);
    try {
      setPayment(await paymentsApi.payWithWallet(id));
      void loadWallet();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPaying(null);
    }
  };

  const walletEnough = !!(wallet && payment && Number(wallet.balance) >= Number(payment.amount));

  const waitingForResult = payment && (payment.status === 'PROCESSING' || payment.status === 'UNKNOWN');

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>Payment</PageTitle>
      <div className="mb-4">
        <Notice>
          <strong>SIMULATED PAYMENT.</strong> This is a student project. No real money, card or bank is involved.
        </Notice>
      </div>
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {!payment && <Loading text="Reserving your cake and delivery slot..." />}

      {payment && payment.status === 'PENDING' && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-500">Amount to pay</p>
          <p className="text-4xl font-extrabold text-rose-700">{formatINR(payment.amount)}</p>
          {wallet && Number(wallet.balance) > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm">
                Wallet balance: <strong>{formatINR(wallet.balance)}</strong>
              </p>
              <button className="btn-primary mt-2 w-full py-3" disabled={!!paying || !walletEnough} onClick={() => void payWithWallet()}>
                {paying === 'WALLET' ? 'Processing...' : `Pay ${formatINR(payment.amount)} with wallet`}
              </button>
              {!walletEnough && (
                <p className="mt-2 text-xs text-gray-600">Your wallet balance is less than the order amount. Use the simulated bank below.</p>
              )}
            </div>
          )}
          <p className="text-sm text-gray-600">Choose what the simulated bank should do:</p>
          <div className="grid gap-3">
            <button className="btn-primary py-3" disabled={!!paying} onClick={() => void pay('SUCCESS')}>
              {paying === 'SUCCESS' ? 'Processing...' : 'Pay now (simulate success)'}
            </button>
            <button className="btn-outline py-3" disabled={!!paying} onClick={() => void pay('FAILURE')}>
              Simulate a declined payment
            </button>
            <button className="btn-outline py-3" disabled={!!paying} onClick={() => void pay('TIMEOUT')}>
              Simulate a bank timeout (result unknown)
            </button>
          </div>
        </div>
      )}

      {waitingForResult && (
        <div className="card space-y-3 text-center">
          <Loading text="The bank has not answered yet. We are checking again..." />
          <p className="text-sm text-gray-500">You can leave this page. Your order updates automatically.</p>
          <Link to={`/orders/${id}`} className="btn-outline">Go to my order</Link>
        </div>
      )}

      {payment && payment.status === 'CANCELLED' && (
        <Notice>This order was cancelled. <Link className="font-semibold underline" to={`/orders/${id}`}>See details</Link></Notice>
      )}
    </div>
  );
}
