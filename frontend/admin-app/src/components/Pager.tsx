export function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-4 text-sm">
      <button className="btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages} ({total} total)</span>
      <button className="btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
