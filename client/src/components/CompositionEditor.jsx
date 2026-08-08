const METALS = ['gold', 'silver', 'copper', 'platinum', 'palladium', 'nickel'];

const emptyRow = () => ({ metal: 'silver', percent: 90, purity: 0.9 });

export default function CompositionEditor({ value = [], onChange }) {
  const rows = value.length ? value : [emptyRow()];

  const updateRow = (index, field, fieldValue) => {
    const next = rows.map((row, i) =>
      i === index ? { ...row, [field]: fieldValue } : row
    );
    onChange(next);
  };

  const addRow = () => onChange([...rows, emptyRow()]);

  const removeRow = (index) => {
    if (rows.length === 1) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  const totalPercent = rows.reduce((sum, row) => sum + Number(row.percent || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-200">Composition</h3>
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          + Add metal
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 p-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Metal</span>
            <select
              value={row.metal}
              onChange={(e) => updateRow(index, 'metal', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            >
              {METALS.map((metal) => (
                <option key={metal} value={metal}>
                  {metal}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Percent</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={row.percent}
              onChange={(e) => updateRow(index, 'percent', Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Purity (0–1)</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={row.purity}
              onChange={(e) => updateRow(index, 'purity', Number(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <p className={`text-sm ${Math.abs(totalPercent - 100) > 0.5 ? 'text-amber-400' : 'text-slate-500'}`}>
        Total: {totalPercent.toFixed(1)}% {Math.abs(totalPercent - 100) > 0.5 && '(should be ~100%)'}
      </p>
    </div>
  );
}
