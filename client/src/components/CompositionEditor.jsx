/** Spot-priced metals used for melt-value calculation. */
const SPOT_METALS = ['gold', 'silver', 'copper', 'platinum', 'palladium', 'nickel'];

/**
 * Suggested materials for the composition dropdown/datalist.
 * Users can also type any other material freely.
 */
const METAL_SUGGESTIONS = [
  ...SPOT_METALS,
  'brass',
  'bronze',
  'cupronickel',
  'zinc',
  'tin',
  'steel',
  'aluminum',
  'alloy',
  'other',
];

/** Default first row: primary precious metal. */
const defaultFirstRow = () => ({ metal: 'silver', percent: 90, purity: 0.999 });

/**
 * Secondary metals are usually copper (e.g. 90% silver / 10% copper).
 * Percent defaults to whatever is left to reach 100%.
 */
function additionalMetalRow(existingRows) {
  const used = existingRows.reduce((sum, row) => sum + Number(row.percent || 0), 0);
  const remaining = Math.max(0, Number((100 - used).toFixed(2)));
  return { metal: 'copper', percent: remaining, purity: 1 };
}

/** Keep the field empty while typing; do not coerce '' → 0 mid-edit. */
function parseOptionalNumber(raw) {
  if (raw === '' || raw == null) return '';
  const n = Number(raw);
  return Number.isNaN(n) ? '' : n;
}

function displayNumber(value) {
  return value === '' || value == null ? '' : value;
}

function normalizeMetal(value) {
  return String(value || '').trim().slice(0, 64);
}

export default function CompositionEditor({ value = [], onChange }) {
  const rows = value.length ? value : [defaultFirstRow()];

  const updateRow = (index, field, fieldValue) => {
    const next = rows.map((row, i) =>
      i === index ? { ...row, [field]: fieldValue } : row
    );
    onChange(next);
  };

  const addRow = () => onChange([...rows, additionalMetalRow(rows)]);

  const removeRow = (index) => {
    if (rows.length === 1) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  const totalPercent = rows.reduce((sum, row) => sum + Number(row.percent || 0), 0);
  const hasNonSpotMetal = rows.some(
    (row) => row.metal && !SPOT_METALS.includes(String(row.metal).toLowerCase())
  );

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
            <span className="mb-1 block text-slate-400">Metal / material</span>
            <input
              list={`metal-suggestions-${index}`}
              value={row.metal ?? ''}
              onChange={(e) => updateRow(index, 'metal', normalizeMetal(e.target.value))}
              placeholder="Select or type…"
              maxLength={64}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
            <datalist id={`metal-suggestions-${index}`}>
              {METAL_SUGGESTIONS.map((metal) => (
                <option key={metal} value={metal} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Percent</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={displayNumber(row.percent)}
              onChange={(e) => updateRow(index, 'percent', parseOptionalNumber(e.target.value))}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Purity (0–1)</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.0001"
              value={displayNumber(row.purity)}
              onChange={(e) => updateRow(index, 'purity', parseOptionalNumber(e.target.value))}
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
      {hasNonSpotMetal && (
        <p className="text-xs text-slate-500">
          Melt value is calculated only for gold, silver, copper, platinum, palladium, and nickel.
          Other materials are stored for catalog purposes.
        </p>
      )}
    </div>
  );
}
