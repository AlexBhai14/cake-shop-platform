export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="mb-6 flex gap-2 border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${active === t ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
