import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import AuthImage from '../components/AuthImage.jsx';
import ImageSlotUpload from '../components/ImageSlotUpload.jsx';
import MetalValueCard from '../components/MetalValueCard.jsx';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/items/${id}`);
      setItem(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this item permanently?')) return;
    try {
      await api.delete(`/items/${id}`);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await api.post(`/items/${id}/recalculate-value`);
      setItem(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <p className="text-slate-400">Loading item...</p>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <p className="text-red-400">{error || 'Item not found'}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-white">
            ← Back to collection
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
          <p className="text-slate-400 capitalize">
            {item.itemType}
            {item.year ? ` · ${item.year}` : ''}
            {item.country ? ` · ${item.country}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/items/${id}/edit`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-slate-400">Obverse</p>
              <AuthImage
                src={item.imageUrls?.obverse}
                alt="Obverse"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-400">Reverse</p>
              <AuthImage
                src={item.imageUrls?.reverse}
                alt="Reverse"
                className="aspect-square w-full rounded-xl object-cover"
              />
            </div>
          </div>

          {(item.imageUrls?.additional || []).length > 0 && (
            <div>
              <p className="mb-2 text-sm text-slate-400">Additional images</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {item.imageUrls.additional.map((url) => (
                  <AuthImage
                    key={url}
                    src={url}
                    alt="Additional"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 font-semibold">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Denomination', item.denomination],
                ['Mint', item.mint],
                ['Grade', item.grade],
                ['Condition', item.condition],
                ['Weight', item.weightGrams ? `${item.weightGrams} g` : ''],
                ['Diameter', item.diameterMm ? `${item.diameterMm} mm` : ''],
                ['Purchase price', item.purchasePrice ? `$${item.purchasePrice}` : ''],
                ['Catalog refs', item.catalogRefs?.join(', ')],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="text-slate-200">{value}</dd>
                  </div>
                ))}
            </dl>
            {item.notes && (
              <div className="mt-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-300">{item.notes}</dd>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 font-semibold">Manage Images</h2>
            <ImageSlotUpload
              itemId={item._id}
              imageUrls={item.imageUrls}
              onUpdated={setItem}
            />
          </div>
        </div>

        <div className="space-y-6">
          <MetalValueCard
            metalValueUsd={item.metalValueUsd}
            metalValueUpdatedAt={item.metalValueUpdatedAt}
            breakdown={item.metalBreakdown}
            onRecalculate={handleRecalculate}
            loading={recalculating}
          />

          {item.composition?.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="mb-3 font-semibold">Composition</h3>
              <div className="space-y-2">
                {item.composition.map((row) => (
                  <div key={`${row.metal}-${row.percent}`} className="text-sm text-slate-300">
                    <span className="capitalize">{row.metal}</span>: {row.percent}% at{' '}
                    {(row.purity * 100).toFixed(1)}% fine
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
