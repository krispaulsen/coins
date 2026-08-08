import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import CompositionEditor from '../components/CompositionEditor.jsx';

const GRAMS_PER_TROY_OZ = 31.1034768;
const MM_PER_INCH = 25.4;

const emptyForm = {
  title: '',
  itemType: 'coin',
  country: '',
  year: '',
  denomination: '',
  mint: '',
  grade: '',
  condition: '',
  catalogRefs: '',
  weight: '',
  weightUnit: 'g',
  diameter: '',
  diameterUnit: 'mm',
  thickness: '',
  thicknessUnit: 'mm',
  purchasePrice: '',
  purchaseDate: '',
  notes: '',
  composition: [{ metal: 'silver', percent: 90, purity: 0.9 }],
};

/** Convert stored grams into the unit used when the item was entered. */
function gramsToDisplayWeight(weightGrams, weightUnit) {
  if (weightGrams == null || weightGrams === '') return '';
  const grams = Number(weightGrams);
  if (Number.isNaN(grams)) return '';
  if (weightUnit === 'oz t') {
    return Number((grams / GRAMS_PER_TROY_OZ).toFixed(6));
  }
  return grams;
}

/** Convert form weight + unit into grams for the API / melt calc. */
function displayWeightToGrams(weight, weightUnit) {
  if (weight === '' || weight == null) return undefined;
  const value = Number(weight);
  if (Number.isNaN(value)) return undefined;
  if (weightUnit === 'oz t') {
    return Number((value * GRAMS_PER_TROY_OZ).toFixed(6));
  }
  return value;
}

/** Convert stored mm into mm or inches for display. */
function mmToDisplayLength(valueMm, unit) {
  if (valueMm == null || valueMm === '') return '';
  const mm = Number(valueMm);
  if (Number.isNaN(mm)) return '';
  if (unit === 'in') {
    return Number((mm / MM_PER_INCH).toFixed(6));
  }
  return mm;
}

/** Convert form length + unit into millimeters for storage. */
function displayLengthToMm(value, unit) {
  if (value === '' || value == null) return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  if (unit === 'in') {
    return Number((num * MM_PER_INCH).toFixed(6));
  }
  return num;
}

const COUNTRY_OPTIONS = ['United States', 'Canada', 'Mexico'];

const DENOMINATION_OPTIONS = ['$1', '50¢', '25¢', '10¢', '5¢', '1¢'];

const MINT_OPTIONS = ['Philadelphia', 'Denver', 'San Francisco', 'West Point'];

/** Formal Sheldon-scale grades (and common proof grades) */
const GRADE_OPTIONS = [
  'P-1',
  'FR-2',
  'AG-3',
  'G-4',
  'G-6',
  'VG-8',
  'VG-10',
  'F-12',
  'F-15',
  'VF-20',
  'VF-25',
  'VF-30',
  'VF-35',
  'EF-40',
  'EF-45',
  'AU-50',
  'AU-53',
  'AU-55',
  'AU-58',
  'MS-60',
  'MS-61',
  'MS-62',
  'MS-63',
  'MS-64',
  'MS-65',
  'MS-66',
  'MS-67',
  'MS-68',
  'MS-69',
  'MS-70',
  'PR-60',
  'PR-61',
  'PR-62',
  'PR-63',
  'PR-64',
  'PR-65',
  'PR-66',
  'PR-67',
  'PR-68',
  'PR-69',
  'PR-70',
  'PF-60',
  'PF-65',
  'PF-70',
];

/** Strike type / circulation state (not the numerical grade) */
const CONDITION_OPTIONS = [
  'Business strike',
  'Proof',
  'Proof-like',
  'Deep proof-like',
  'Cameo',
  'Deep cameo',
  'Ultra cameo',
  'Uncirculated',
  'Circulated',
  'Mint state',
  'Specimen',
  'Special mint set',
  'Satin finish',
  'Matte proof',
  'Reverse proof',
  'Enhanced uncirculated',
  'Burnished',
];

export default function ItemForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;

    api
      .get(`/items/${id}`)
      .then((res) => {
        const item = res.data;
        const weightUnit = item.weightUnit === 'oz t' ? 'oz t' : 'g';
        const diameterUnit = item.diameterUnit === 'in' ? 'in' : 'mm';
        const thicknessUnit = item.thicknessUnit === 'in' ? 'in' : 'mm';
        setForm({
          title: item.title || '',
          itemType: item.itemType || 'coin',
          country: item.country || '',
          year: item.year || '',
          denomination: item.denomination || '',
          mint: item.mint || '',
          grade: item.grade || '',
          condition: item.condition || '',
          catalogRefs: (item.catalogRefs || []).join(', '),
          weight: gramsToDisplayWeight(item.weightGrams, weightUnit),
          weightUnit,
          diameter: mmToDisplayLength(item.diameterMm, diameterUnit),
          diameterUnit,
          thickness: mmToDisplayLength(item.thicknessMm, thicknessUnit),
          thicknessUnit,
          purchasePrice: item.purchasePrice ?? '',
          purchaseDate: item.purchaseDate
            ? new Date(item.purchaseDate).toISOString().slice(0, 10)
            : '',
          notes: item.notes || '',
          composition: item.composition?.length
            ? item.composition
            : [{ metal: 'silver', percent: 90, purity: 0.9 }],
        });
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load item'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Switching unit keeps the same physical weight by converting the number. */
  const changeWeightUnit = (nextUnit) => {
    setForm((prev) => {
      if (prev.weightUnit === nextUnit) return prev;
      const grams = displayWeightToGrams(prev.weight, prev.weightUnit);
      return {
        ...prev,
        weightUnit: nextUnit,
        weight: grams == null ? '' : gramsToDisplayWeight(grams, nextUnit),
      };
    });
  };

  /** Switching unit keeps the same physical diameter by converting the number. */
  const changeDiameterUnit = (nextUnit) => {
    setForm((prev) => {
      if (prev.diameterUnit === nextUnit) return prev;
      const mm = displayLengthToMm(prev.diameter, prev.diameterUnit);
      return {
        ...prev,
        diameterUnit: nextUnit,
        diameter: mm == null ? '' : mmToDisplayLength(mm, nextUnit),
      };
    });
  };

  /** Switching unit keeps the same physical thickness by converting the number. */
  const changeThicknessUnit = (nextUnit) => {
    setForm((prev) => {
      if (prev.thicknessUnit === nextUnit) return prev;
      const mm = displayLengthToMm(prev.thickness, prev.thicknessUnit);
      return {
        ...prev,
        thicknessUnit: nextUnit,
        thickness: mm == null ? '' : mmToDisplayLength(mm, nextUnit),
      };
    });
  };

  const buildPayload = () => ({
    title: form.title,
    itemType: form.itemType,
    country: form.country,
    year: form.year ? Number(form.year) : undefined,
    denomination: form.denomination,
    mint: form.mint,
    grade: form.grade,
    condition: form.condition,
    catalogRefs: form.catalogRefs
      ? form.catalogRefs.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    weightGrams: displayWeightToGrams(form.weight, form.weightUnit),
    weightUnit: form.weightUnit === 'oz t' ? 'oz t' : 'g',
    diameterMm: displayLengthToMm(form.diameter, form.diameterUnit),
    diameterUnit: form.diameterUnit === 'in' ? 'in' : 'mm',
    thicknessMm: displayLengthToMm(form.thickness, form.thicknessUnit),
    thicknessUnit: form.thicknessUnit === 'in' ? 'in' : 'mm',
    purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
    purchaseDate: form.purchaseDate || undefined,
    notes: form.notes,
    composition: form.composition,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = buildPayload();
      const res = isEdit
        ? await api.put(`/items/${id}`, payload)
        : await api.post('/items', payload);
      navigate(`/items/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <p className="text-slate-400">Loading...</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link to={isEdit ? `/items/${id}` : '/'} className="text-sm text-slate-400 hover:text-white">
          ← Cancel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {isEdit ? 'Edit Item' : 'Add Item'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <p className="text-red-400">{error}</p>}

        <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-slate-400">Title *</span>
            <input
              required
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Type</span>
            <select
              value={form.itemType}
              onChange={(e) => updateField('itemType', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            >
              {['coin', 'token', 'medal', 'banknote', 'other'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Year</span>
            <input
              type="number"
              value={form.year}
              onChange={(e) => updateField('year', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Country</span>
            <input
              list="country-options"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="country-options">
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Denomination</span>
            <input
              list="denomination-options"
              value={form.denomination}
              onChange={(e) => updateField('denomination', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="denomination-options">
              {DENOMINATION_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Mint</span>
            <input
              list="mint-options"
              value={form.mint}
              onChange={(e) => updateField('mint', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="mint-options">
              {MINT_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Grade</span>
            <input
              list="grade-options"
              value={form.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="e.g. MS-65, VF-20"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="grade-options">
              {GRADE_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Condition</span>
            <input
              list="condition-options"
              value={form.condition}
              onChange={(e) => updateField('condition', e.target.value)}
              placeholder="e.g. Business strike, Proof"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="condition-options">
              {CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-slate-400">Weight</span>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={form.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                placeholder={form.weightUnit === 'oz t' ? 'e.g. 1' : 'e.g. 31.103'}
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <select
                value={form.weightUnit}
                onChange={(e) => changeWeightUnit(e.target.value)}
                className="w-28 shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-2"
                aria-label="Weight unit"
              >
                <option value="g">grams</option>
                <option value="oz t">oz t</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {form.weightUnit === 'oz t'
                ? 'Troy ounces (oz t). Melt value converts to grams automatically.'
                : 'Grams (g). Choose oz t for weights listed in troy ounces.'}
            </p>
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-slate-400">Diameter</span>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={form.diameter}
                onChange={(e) => updateField('diameter', e.target.value)}
                placeholder={form.diameterUnit === 'in' ? 'e.g. 1.5' : 'e.g. 38.1'}
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <select
                value={form.diameterUnit}
                onChange={(e) => changeDiameterUnit(e.target.value)}
                className="w-28 shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-2"
                aria-label="Diameter unit"
              >
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-slate-400">Thickness</span>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={form.thickness}
                onChange={(e) => updateField('thickness', e.target.value)}
                placeholder={form.thicknessUnit === 'in' ? 'e.g. 0.1' : 'e.g. 2.5'}
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <select
                value={form.thicknessUnit}
                onChange={(e) => changeThicknessUnit(e.target.value)}
                className="w-28 shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-2"
                aria-label="Thickness unit"
              >
                <option value="mm">mm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Purchase price (USD)</span>
            <input
              type="number"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => updateField('purchasePrice', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Purchase date</span>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => updateField('purchaseDate', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-slate-400">Catalog references (comma-separated)</span>
            <input
              value={form.catalogRefs}
              onChange={(e) => updateField('catalogRefs', e.target.value)}
              placeholder="KM# 123, PCGS# 456"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-slate-400">Notes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <CompositionEditor
            value={form.composition}
            onChange={(composition) => updateField('composition', composition)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-5 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create item'}
        </button>
      </form>
    </Layout>
  );
}
