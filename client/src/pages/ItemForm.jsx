import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import CompositionEditor from '../components/CompositionEditor.jsx';

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
  weightGrams: '',
  diameterMm: '',
  purchasePrice: '',
  purchaseDate: '',
  notes: '',
  composition: [{ metal: 'silver', percent: 90, purity: 0.9 }],
};

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
          weightGrams: item.weightGrams ?? '',
          diameterMm: item.diameterMm ?? '',
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
    weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
    diameterMm: form.diameterMm ? Number(form.diameterMm) : undefined,
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
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Denomination</span>
            <input
              value={form.denomination}
              onChange={(e) => updateField('denomination', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Mint</span>
            <input
              value={form.mint}
              onChange={(e) => updateField('mint', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Grade</span>
            <input
              value={form.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Condition</span>
            <input
              value={form.condition}
              onChange={(e) => updateField('condition', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Weight (grams)</span>
            <input
              type="number"
              step="0.01"
              value={form.weightGrams}
              onChange={(e) => updateField('weightGrams', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-400">Diameter (mm)</span>
            <input
              type="number"
              step="0.01"
              value={form.diameterMm}
              onChange={(e) => updateField('diameterMm', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </label>
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
