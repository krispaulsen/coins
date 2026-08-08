export default function MetalValueCard({
  metalValueUsd,
  metalValueUpdatedAt,
  breakdown,
  onRecalculate,
  loading,
  emptyMessage = 'Add weight and composition to calculate melt value.',
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-amber-400">Melt Value</h3>
          <p className="text-3xl font-bold">${Number(metalValueUsd || 0).toFixed(2)}</p>
          {metalValueUpdatedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Updated {new Date(metalValueUpdatedAt).toLocaleString()}
            </p>
          )}
        </div>
        {onRecalculate && (
          <button
            type="button"
            onClick={onRecalculate}
            disabled={loading}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-amber-500 disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Refresh'}
          </button>
        )}
      </div>

      {breakdown?.length > 0 ? (
        <div className="space-y-2">
          {breakdown.map((row) => (
            <div
              key={`${row.metal}-${row.percent}`}
              className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
            >
              <span className="capitalize text-slate-300">
                {row.metal} ({row.percent}% @ {(row.purity * 100).toFixed(1)}% fine)
              </span>
              <span className="text-slate-400">
                {row.weightOz} oz × ${row.spotPerOz?.toFixed(2)} = ${row.valueUsd?.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}
