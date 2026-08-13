import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import CompositionEditor from '../components/CompositionEditor.jsx';
import TagInput from '../components/TagInput.jsx';

const GRAMS_PER_TROY_OZ = 31.1034768;
const MM_PER_INCH = 25.4;

const emptyForm = {
  title: '',
  itemType: 'coin',
  setKind: '',
  country: '',
  year: '',
  denomination: '',
  mint: '',
  mintMark: '',
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
  tags: [],
  composition: [{ metal: 'silver', percent: 90, purity: 0.999 }],
};

const ITEM_TYPE_OPTIONS = ['coin', 'token', 'medal', 'banknote', 'set', 'other'];

const SET_KIND_OPTIONS = [
  { value: 'proof', label: 'Proof set' },
  { value: 'mint', label: 'Mint set' },
  { value: 'prestige', label: 'Prestige set' },
  { value: 'custom', label: 'Custom group' },
];

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

const MINT_MARK_OPTIONS = ['P', 'D', 'S', 'W'];

/** Known US mint marks → facility name for auto-fill. */
const MINT_MARK_TO_MINT = {
  P: 'Philadelphia',
  D: 'Denver',
  S: 'San Francisco',
  W: 'West Point',
};

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
  const [searchParams] = useSearchParams();
  const parentSetIdParam = searchParams.get('setId') || '';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [parentSet, setParentSet] = useState(null);
  const [parentSetId, setParentSetId] = useState(parentSetIdParam);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isSet = form.itemType === 'set';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        if (isEdit) {
          const res = await api.get(`/items/${id}`);
          if (cancelled) return;
          const item = res.data;
          const weightUnit = item.weightUnit === 'oz t' ? 'oz t' : 'g';
          const diameterUnit = item.diameterUnit === 'in' ? 'in' : 'mm';
          const thicknessUnit = item.thicknessUnit === 'in' ? 'in' : 'mm';
          setForm({
            title: item.title || '',
            itemType: item.itemType || 'coin',
            setKind: item.setKind || '',
            country: item.country || '',
            year: item.year || '',
            denomination: item.denomination || '',
            mint: item.mint || '',
            mintMark: item.mintMark || '',
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
            tags: Array.isArray(item.tags) ? item.tags : [],
            composition: item.composition?.length
              ? item.composition
              : [{ metal: 'silver', percent: 90, purity: 0.999 }],
          });
          setParentSetId(item.setId || '');
          setParentSet(item.parentSet || null);
        } else if (parentSetIdParam) {
          const res = await api.get(`/items/${parentSetIdParam}`);
          if (cancelled) return;
          const set = res.data;
          if (set.itemType !== 'set') {
            setError('Parent item is not a set');
            setParentSetId('');
          } else {
            setParentSet({
              _id: set._id,
              title: set.title,
              year: set.year,
              setKind: set.setKind,
            });
            setParentSetId(set._id);
            setForm((prev) => ({
              ...prev,
              itemType: 'coin',
              country: set.country || '',
              year: set.year || '',
              mint: set.mint || '',
              condition:
                set.setKind === 'proof'
                  ? 'Proof'
                  : set.condition || prev.condition,
              setKind: '',
            }));
          }
        } else {
          setForm(emptyForm);
          setParentSet(null);
          setParentSetId('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load form data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, parentSetIdParam]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** Unit change only switches the label; the typed number is left as-is. */
  const changeWeightUnit = (nextUnit) => {
    setForm((prev) =>
      prev.weightUnit === nextUnit ? prev : { ...prev, weightUnit: nextUnit }
    );
  };

  /** Unit change only switches the label; the typed number is left as-is. */
  const changeDiameterUnit = (nextUnit) => {
    setForm((prev) =>
      prev.diameterUnit === nextUnit ? prev : { ...prev, diameterUnit: nextUnit }
    );
  };

  /** Unit change only switches the label; the typed number is left as-is. */
  const changeThicknessUnit = (nextUnit) => {
    setForm((prev) =>
      prev.thicknessUnit === nextUnit ? prev : { ...prev, thicknessUnit: nextUnit }
    );
  };

  const buildPayload = () => {
    const isSetType = form.itemType === 'set';
    const payload = {
      title: form.title,
      itemType: form.itemType,
      setKind: isSetType ? form.setKind || 'custom' : '',
      country: form.country,
      year: form.year ? Number(form.year) : undefined,
      denomination: isSetType ? '' : form.denomination,
      mint: form.mint,
      mintMark: form.mintMark,
      grade: isSetType ? '' : form.grade,
      condition: form.condition,
      catalogRefs: form.catalogRefs
        ? form.catalogRefs.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      purchaseDate: form.purchaseDate || undefined,
      notes: form.notes,
      tags: form.tags || [],
      setId: isSetType ? null : parentSetId || null,
    };

    if (!isSetType) {
      payload.weightGrams = displayWeightToGrams(form.weight, form.weightUnit);
      payload.weightUnit = form.weightUnit === 'oz t' ? 'oz t' : 'g';
      payload.diameterMm = displayLengthToMm(form.diameter, form.diameterUnit);
      payload.diameterUnit = form.diameterUnit === 'in' ? 'in' : 'mm';
      payload.thicknessMm = displayLengthToMm(form.thickness, form.thicknessUnit);
      payload.thicknessUnit = form.thicknessUnit === 'in' ? 'in' : 'mm';
      payload.composition = (form.composition || [])
        .map((row) => ({
          metal: String(row.metal || '').trim().slice(0, 64),
          percent: row.percent === '' || row.percent == null ? 0 : Number(row.percent),
          purity: row.purity === '' || row.purity == null ? 0 : Number(row.purity),
        }))
        .filter((row) => row.metal);
    } else {
      payload.weightGrams = undefined;
      payload.composition = [];
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = buildPayload();
      const res = isEdit
        ? await api.put(`/items/${id}`, payload)
        : await api.post('/items', payload);
      // After adding a member, return to the set; otherwise open the item
      if (!isEdit && parentSetId && form.itemType !== 'set') {
        navigate(`/items/${parentSetId}`);
      } else {
        navigate(`/items/${res.data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancelTo = isEdit
    ? `/items/${id}`
    : parentSetId
      ? `/items/${parentSetId}`
      : '/';

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
        <Link to={cancelTo} className="text-sm text-slate-400 hover:text-white">
          ← Cancel
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {isEdit
            ? isSet
              ? 'Edit Set'
              : 'Edit Item'
            : isSet
              ? 'Add Set'
              : parentSet
                ? 'Add Coin to Set'
                : 'Add Item'}
        </h1>
        {parentSet && !isSet && (
          <p className="mt-1 text-sm text-slate-400">
            Part of{' '}
            <Link to={`/items/${parentSet._id}`} className="text-amber-400 hover:text-amber-300">
              {parentSet.title}
            </Link>
          </p>
        )}
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
              placeholder={
                isSet
                  ? 'e.g. 2024 United States Proof Set'
                  : 'e.g. 2024 Kennedy Half Dollar'
              }
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Type</span>
            <select
              value={form.itemType}
              onChange={(e) => {
                const next = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  itemType: next,
                  setKind:
                    next === 'set'
                      ? prev.setKind || 'proof'
                      : '',
                }));
              }}
              disabled={Boolean(parentSetId) && !isEdit}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 disabled:opacity-60"
            >
              {ITEM_TYPE_OPTIONS.filter((type) => {
                // Don't offer "set" when adding a member under a set
                if (parentSetId && !isEdit && type === 'set') return false;
                return true;
              }).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {isSet ? (
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">Set kind</span>
              <select
                value={form.setKind || 'proof'}
                onChange={(e) => updateField('setKind', e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              >
                {SET_KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">Year</span>
              <input
                type="number"
                value={form.year}
                onChange={(e) => updateField('year', e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
          )}
          {isSet && (
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">Year</span>
              <input
                type="number"
                value={form.year}
                onChange={(e) => updateField('year', e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
          )}
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
          {!isSet && (
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
          )}
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Mint mark</span>
            <input
              list="mint-mark-options"
              value={form.mintMark}
              onChange={(e) => {
                const mark = e.target.value;
                const knownMint = MINT_MARK_TO_MINT[mark.trim().toUpperCase()];
                setForm((prev) => ({
                  ...prev,
                  mintMark: mark,
                  ...(knownMint ? { mint: knownMint } : {}),
                }));
              }}
              placeholder="e.g. P, D, S, W"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
            <datalist id="mint-mark-options">
              {MINT_MARK_OPTIONS.map((option) => (
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
          {!isSet && (
            <>
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
            </>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">
              Purchase price (USD){isSet ? ' — whole set' : ''}
            </span>
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
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Catalog references (comma-separated)</span>
            <input
              value={form.catalogRefs}
              onChange={(e) => updateField('catalogRefs', e.target.value)}
              placeholder="KM# 123, PCGS# 456"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          {!isSet && (
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">Grade</span>
              <input
                list="grade-options"
                value={form.grade}
                onChange={(e) => updateField('grade', e.target.value)}
                placeholder="e.g. MS-65, PR-69 (optional)"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <datalist id="grade-options">
                {GRADE_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
          )}
          <label className="sm:col-span-2 text-sm">
            <span className="mb-1 block text-slate-400">Tags</span>
            <TagInput
              value={form.tags}
              onChange={(tags) => updateField('tags', tags)}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Invent any labels you like — silver, inherited, to-sell. Enter or comma to add.
            </span>
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

        {!isSet && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <CompositionEditor
              value={form.composition}
              onChange={(composition) => updateField('composition', composition)}
            />
          </div>
        )}

        {isSet && (
          <p className="text-sm text-slate-400">
            After creating the set, add each coin (denomination, weight, composition) from the set
            detail page. Melt value is the sum of the coins in the set.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-5 py-2 font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving
            ? 'Saving...'
            : isEdit
              ? 'Save changes'
              : isSet
                ? 'Create set'
                : parentSet
                  ? 'Add coin to set'
                  : 'Create item'}
        </button>
      </form>
    </Layout>
  );
}
