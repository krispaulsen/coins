import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import AuthImage from '../components/AuthImage.jsx';
import ImageSlotUpload from '../components/ImageSlotUpload.jsx';
import MetalValueCard from '../components/MetalValueCard.jsx';
import { TagChip } from '../components/TagInput.jsx';

const SET_KIND_LABELS = {
  proof: 'Proof set',
  mint: 'Mint set',
  prestige: 'Prestige set',
  custom: 'Custom set',
};

function setKindLabel(kind) {
  return SET_KIND_LABELS[kind] || 'Set';
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
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
    const isSet = item?.itemType === 'set';
    const memberCount = item?.memberCount ?? item?.members?.length ?? 0;

    let cascade = false;
    if (isSet && memberCount > 0) {
      const choice = window.confirm(
        `Delete this set?\n\nOK = keep the ${memberCount} item(s) as loose items\nCancel = abort\n\n` +
          'To also delete all items in the set, click OK then confirm the next prompt.'
      );
      if (!choice) return;

      cascade = window.confirm(
        'Also permanently delete all items in this set?\n\nOK = delete set + items\nCancel = delete set only (items become loose items)'
      );
    } else if (!window.confirm('Delete this item permanently?')) {
      return;
    }

    try {
      await api.delete(`/items/${id}`, {
        params: cascade ? { cascade: 'true' } : undefined,
      });
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

  const handleToggleFavorite = async () => {
    if (!item || togglingFavorite) return;
    setTogglingFavorite(true);
    setError('');
    try {
      const res = await api.put(`/items/${id}`, {
        isFavorite: !item.isFavorite,
      });
      setItem((prev) =>
        prev
          ? {
              ...prev,
              isFavorite: res.data.isFavorite,
              // Preserve members / parentSet from detail GET if PUT omits them
              members: res.data.members ?? prev.members,
              memberCount: res.data.memberCount ?? prev.memberCount,
              parentSet: res.data.parentSet ?? prev.parentSet,
              metalBreakdown: res.data.metalBreakdown ?? prev.metalBreakdown,
            }
          : res.data
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update favorite');
    } finally {
      setTogglingFavorite(false);
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

  const isSet = item.itemType === 'set';
  const members = item.members || [];
  const parentSet = item.parentSet;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {parentSet ? (
            <Link
              to={`/items/${parentSet._id}`}
              className="text-sm text-slate-400 hover:text-white"
            >
              ← {parentSet.title}
            </Link>
          ) : (
            <Link to="/" className="text-sm text-slate-400 hover:text-white">
              ← Back to collection
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-semibold">{item.title}</h1>
          <p className="text-slate-400 capitalize">
            {isSet ? setKindLabel(item.setKind) : item.itemType}
            {item.year ? ` · ${item.year}` : ''}
            {item.country ? ` · ${item.country}` : ''}
            {isSet ? ` · ${members.length} ${members.length === 1 ? 'item' : 'items'}` : ''}
          </p>
          {item.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <TagChip key={tag} name={tag} to={`/?tag=${encodeURIComponent(tag)}`} />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isSet && (
            <Link
              to={`/items/new?setId=${item._id}`}
              className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
            >
              Add item to set
            </Link>
          )}
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
            aria-pressed={!!item.isFavorite}
            aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${
              item.isFavorite
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'border-slate-700 hover:border-amber-500'
            }`}
          >
            {item.isFavorite ? '★ Favorited' : '☆ Favorite'}
          </button>
          <Link
            to={`/items/new?copyFrom=${id}`}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500"
          >
            Copy
          </Link>
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
              <p className="mb-2 text-sm text-slate-400">
                {isSet ? 'Packaging / front' : 'Obverse'}
              </p>
              <AuthImage
                src={item.imageUrls?.obverse}
                alt={isSet ? 'Packaging' : 'Obverse'}
                zoomable
                className="aspect-square w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <p className="mb-2 text-sm text-slate-400">
                {isSet ? 'Packaging / back' : 'Reverse'}
              </p>
              <AuthImage
                src={item.imageUrls?.reverse}
                alt={isSet ? 'Packaging reverse' : 'Reverse'}
                zoomable
                className="aspect-square w-full rounded-xl object-cover"
              />
            </div>
          </div>

          {isSet && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Items in this set</h2>
                <Link
                  to={`/items/new?setId=${item._id}`}
                  className="text-sm text-amber-400 hover:text-amber-300"
                >
                  + Add item
                </Link>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No items yet. Add each denomination with weight and composition so melt value can
                  be calculated.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {members.map((member) => (
                    <li key={member._id} className="flex items-center gap-2">
                      <Link
                        to={`/items/${member._id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 transition hover:bg-slate-950/50"
                      >
                        <AuthImage
                          src={member.imageUrls?.obverse || member.imageUrls?.reverse}
                          alt={member.title}
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-100">{member.title}</p>
                          <p className="text-sm text-slate-400 capitalize">
                            {[member.denomination, member.grade, member.condition]
                              .filter(Boolean)
                              .join(' · ') || member.itemType || 'Item'}
                          </p>
                          {member.tags?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {member.tags.map((tag) => (
                                <TagChip key={tag} name={tag} />
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="shrink-0 text-sm text-amber-400">
                          ${Number(member.metalValueUsd || 0).toFixed(2)}
                        </p>
                      </Link>
                      <Link
                        to={`/items/new?copyFrom=${member._id}`}
                        className="shrink-0 px-2 py-1 text-sm text-amber-400 hover:text-amber-300"
                      >
                        Copy
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 font-semibold">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                !isSet && ['Denomination', item.denomination],
                ['Mint', item.mint],
                ['Mint mark', item.mintMark],
                !isSet && ['Grade', item.grade],
                ['Condition', item.condition],
                isSet && ['Set kind', setKindLabel(item.setKind)],
                !isSet && [
                  'Weight',
                  item.weightGrams != null
                    ? item.weightUnit === 'oz t'
                      ? `${Number((item.weightGrams / 31.1034768).toFixed(6))} oz t (${item.weightGrams} g)`
                      : `${item.weightGrams} g`
                    : '',
                ],
                !isSet && [
                  'Diameter',
                  item.diameterMm != null
                    ? item.diameterUnit === 'in'
                      ? `${Number((item.diameterMm / 25.4).toFixed(6))} in (${item.diameterMm} mm)`
                      : `${item.diameterMm} mm`
                    : '',
                ],
                !isSet && [
                  'Thickness',
                  item.thicknessMm != null
                    ? item.thicknessUnit === 'in'
                      ? `${Number((item.thicknessMm / 25.4).toFixed(6))} in (${item.thicknessMm} mm)`
                      : `${item.thicknessMm} mm`
                    : '',
                ],
                ['Purchase price', item.purchasePrice ? `$${item.purchasePrice}` : ''],
                ['Catalog refs', item.catalogRefs?.join(', ')],
              ]
                .filter((row) => row && row[1])
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
            <h2 className="mb-4 font-semibold">
              {isSet ? 'Manage Packaging Images' : 'Manage Images'}
            </h2>
            <ImageSlotUpload
              itemId={item._id}
              imageUrls={item.imageUrls}
              onUpdated={(updated) =>
                setItem((prev) => ({
                  ...updated,
                  // Preserve set members when image upload response is a plain item
                  members: prev?.members,
                  memberCount: prev?.memberCount,
                  parentSet: prev?.parentSet,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-6">
          <MetalValueCard
            metalValueUsd={item.metalValueUsd}
            metalValueUpdatedAt={item.metalValueUpdatedAt}
            breakdown={isSet ? null : item.metalBreakdown}
            onRecalculate={handleRecalculate}
            loading={recalculating}
            emptyMessage={
              isSet
                ? members.length
                  ? 'Total melt of all items in this set.'
                  : 'Add items with weight and composition to calculate set melt value.'
                : undefined
            }
          />

          {!isSet && item.composition?.length > 0 && (
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
