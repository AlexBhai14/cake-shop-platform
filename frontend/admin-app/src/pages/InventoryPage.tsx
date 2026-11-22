import { Fragment, useState } from 'react';
import { catalogApi, inventoryApi } from '../api/endpoints';
import { ErrorBox, Loading, Notice, PageTitle } from '../components/ui';
import { Tabs } from '../components/Tabs';
import { useAsync } from '../hooks/useAsync';
import { buildStockRows, fetchAll, StockRow } from '../lib/admin';
import { getErrorMessage } from '../lib/api';
import { earliestDeliveryDate, formatDateTime } from '../lib/dates';
import { StockMovement } from '../lib/types';

type Panel = { variantId: string; mode: 'set' | 'adjust' | 'history' } | null;

function StockPanel({ row, mode, onDone }: { row: StockRow; mode: 'set' | 'adjust' | 'history'; onDone: () => void }) {
  const [value, setValue] = useState(String(row.onHand ?? 0));
  const [delta, setDelta] = useState('0');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const history = useAsync(() => (mode === 'history' ? inventoryApi.history(row.variantId) : Promise.resolve([] as StockMovement[])), [mode, row.variantId]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      {error && <ErrorBox message={error} />}
      {mode === 'set' && (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => inventoryApi.setStock(row.variantId, Number(value))); }}>
          <div><label className="label" htmlFor="s-val">Units on hand</label><input id="s-val" className="input w-32" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} required /></div>
          <button className="btn-primary">{row.tracked ? 'Set stock' : 'Start tracking stock'}</button>
          {!row.tracked && <p className="text-xs text-slate-500">Today this cake is made to order. Setting a number turns on stock limits for it.</p>}
        </form>
      )}
      {mode === 'adjust' && (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void run(() => inventoryApi.adjust(row.variantId, Number(delta), reason.trim())); }}>
          <div><label className="label" htmlFor="s-delta">Change (+ received, - removed)</label><input id="s-delta" className="input w-40" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} required /></div>
          <div className="min-w-48 flex-1"><label className="label" htmlFor="s-reason">Reason</label><input id="s-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={100} placeholder="Spoiled, restocked..." /></div>
          <button className="btn-primary">Apply</button>
        </form>
      )}
      {mode === 'history' && (
        <>
          {history.loading && <Loading />}
          {history.error && <ErrorBox message={history.error} />}
          <ul className="space-y-1 text-xs">
            {history.data?.map((m) => (
              <li key={m.id}>{formatDateTime(m.createdAt)} · {m.reason} · on hand {m.onHandDelta >= 0 ? '+' : ''}{m.onHandDelta} · reserved {m.reservedDelta >= 0 ? '+' : ''}{m.reservedDelta}</li>
            ))}
            {history.data && history.data.length === 0 && <li className="text-slate-500">No movements yet.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function StockTab() {
  const data = useAsync(async () => {
    const [cakes, items] = await Promise.all([fetchAll((p) => catalogApi.cakes(p)), fetchAll((p) => inventoryApi.items(p))]);
    return buildStockRows(cakes, items);
  }, []);
  const [panel, setPanel] = useState<Panel>(null);
  const [filter, setFilter] = useState('');

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <ErrorBox message={data.error ?? 'No data'} onRetry={data.reload} />;
  const rows = data.data.filter((r) => r.cakeName.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <Notice tone="blue">Cakes without a stock number are <strong>made to order</strong>: only the delivery-slot capacity limits them. Set a number to track ready-made stock.</Notice>
      <input className="input max-w-xs" placeholder="Filter by cake name" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by cake name" />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Cake</th><th>Option</th><th>On hand</th><th>Reserved</th><th>Available</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const open = panel?.variantId === r.variantId ? panel.mode : null;
              return (
                <Fragment key={r.variantId}>
                  <tr>
                    <td className="font-semibold">{r.cakeName}{!r.cakeActive && <span className="ml-2 text-xs text-red-600">inactive</span>}</td>
                    <td>{r.flavour}, {r.weightGrams} g, {r.eggless ? 'eggless' : 'regular'}</td>
                    <td>{r.tracked ? r.onHand : <span className="text-slate-400">Made to order</span>}</td>
                    <td>{r.tracked ? r.reserved : '-'}</td>
                    <td className={r.tracked && (r.available ?? 0) <= 0 ? 'font-bold text-red-600' : ''}>{r.tracked ? r.available : '-'}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      <button className="btn-outline" onClick={() => setPanel({ variantId: r.variantId, mode: 'set' })}>Set</button>
                      {r.tracked && <button className="btn-outline" onClick={() => setPanel({ variantId: r.variantId, mode: 'adjust' })}>Adjust</button>}
                      {r.tracked && <button className="btn-outline" onClick={() => setPanel({ variantId: r.variantId, mode: 'history' })}>History</button>}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6}><StockPanel row={r} mode={open} onDone={() => { setPanel(null); data.reload(); }} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500">No cake options found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlotsTab() {
  const [date, setDate] = useState(earliestDeliveryDate());
  const slots = useAsync(() => inventoryApi.slots(date), [date]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (slot: string, capacity: number) => {
    setMsg(null);
    try {
      await inventoryApi.setSlot(date, slot, capacity);
      setEdits({});
      setMsg({ ok: true, text: `Capacity of ${slot} saved.` });
      slots.reload();
    } catch (e) {
      setMsg({ ok: false, text: getErrorMessage(e) });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Capacity = how many cakes the bakery can produce and deliver in a time slot. A new date uses the default capacity until you change it.</p>
      <div className="max-w-xs"><label className="label" htmlFor="slot-date">Date</label><input id="slot-date" type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setEdits({}); }} /></div>
      {msg && (msg.ok ? <Notice tone="green">{msg.text}</Notice> : <ErrorBox message={msg.text} />)}
      {slots.loading && !slots.data && <Loading />}
      {slots.error && <ErrorBox message={slots.error} onRetry={slots.reload} />}
      {slots.data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Slot</th><th>Booked</th><th>Free</th><th>Capacity</th><th /></tr></thead>
            <tbody>
              {slots.data.map((s) => {
                const value = edits[s.slot] ?? String(s.capacity);
                return (
                  <tr key={s.slot}>
                    <td className="font-semibold">{s.slot}</td>
                    <td>{s.booked}</td>
                    <td>{s.available}</td>
                    <td className="w-36"><input className="input" type="number" min={0} max={1000} value={value} onChange={(e) => setEdits({ ...edits, [s.slot]: e.target.value })} aria-label={`Capacity of ${s.slot}`} /></td>
                    <td className="text-right"><button className="btn-primary" onClick={() => void save(s.slot, Number(value))}>Save</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function InventoryPage() {
  const [tab, setTab] = useState('Stock');
  return (
    <div>
      <PageTitle>Inventory &amp; delivery slots</PageTitle>
      <Tabs tabs={['Stock', 'Delivery slots']} active={tab} onChange={setTab} />
      {tab === 'Stock' ? <StockTab /> : <SlotsTab />}
    </div>
  );
}
