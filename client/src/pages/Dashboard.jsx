import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import AuthImage from '../components/AuthImage.jsx';

const FAVORITES_LIMIT = 12;
const TABLE_PAGE_SIZE = 20;

const SET_KIND_LABELS = {
  proof: 'Proof set',
  mint: 'Mint set',
  prestige: 'Prestige set',
  custom: 'Set',
};

function setKindLabel(kind) {
  return SET_KIND_LABELS[kind] || 'Set';
}

function itemSubtitle(item) {
  const isSet = item.itemType === 'set';
  if (isSet) {
    return [
      item.year,
      item.country,
      item.memberCount != null
        ? `${item.memberCount} coin${item.memberCount === 1 ? '' : 's'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [item.year, item.country, item.denomination].filter(Boolean).join(' · ');
}

function typeLabel(item) {
  if (item.itemType === 'set') return setKindLabel(item.setKind);
  return item.itemType || '—';
}

function FavoriteCard({ item, onToggleFavorite, togglingId }) {
  const isSet = item.itemType === 'set';
  const setLabel = isSet ? setKindLabel(item.setKind) : null;
  const busy = togglingId === item._id;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-amber-500/50">
      <Link to={`/items/${item._id}`} className="block">
        <div className="relative">
          <AuthImage
            src={item.imageUrls?.obverse || item.imageUrls?.reverse}
            alt={item.title}
            className="aspect-square w-full object-cover"
          />
          {isSet && (
            <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-slate-950">
              {setLabel}
            </span>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-medium">{item.title}</h2>
          <p className="text-sm text-slate-400">{itemSubtitle(item)}</p>
          <p className="mt-2 text-sm text-amber-400">
            Melt: ${Number(item.metalValueUsd || 0).toFixed(2)}
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggleFavorite(item);
        }}
        disabled={busy}
        aria-pressed={true}
        aria-label="Remove from favorites"
        className="absolute right-2 top-2 rounded-md border border-amber-500/60 bg-slate-950/80 px-2 py-1 text-sm text-amber-400 hover:bg-slate-900 disabled:opacity-50"
      >
        ★
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [favorites, setFavorites] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: TABLE_PAGE_SIZE,
    total: 0,
    pages: 0,
  });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const res = await api.get('/items', {
        params: { favorite: 'true', limit: FAVORITES_LIMIT },
      });
      setFavorites(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load favorites');
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const loadTable = useCallback(async (query = '', pageNum = 1) => {
    setTableLoading(true);
    setError('');
    try {
      const res = await api.get('/items', {
        params: {
          search: query || undefined,
          page: pageNum,
          limit: TABLE_PAGE_SIZE,
        },
      });
      setItems(res.data.items || []);
      setPagination(
        res.data.pagination || {
          page: pageNum,
          limit: TABLE_PAGE_SIZE,
          total: 0,
          pages: 0,
        }
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load collection');
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    loadTable(search, page);
  }, [loadTable, search, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleToggleFavorite = async (item) => {
    if (togglingId) return;
    const next = !item.isFavorite;
    setTogglingId(item._id);
    setError('');
    try {
      await api.put(`/items/${item._id}`, { isFavorite: next });
      // Keep table row in sync
      setItems((prev) =>
        prev.map((row) =>
          row._id === item._id ? { ...row, isFavorite: next } : row
        )
      );
      // Refetch favorites so the capped list stays correct
      await loadFavorites();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update favorite');
    } finally {
      setTogglingId(null);
    }
  };

  const totalPages = pagination.pages || 0;
  const currentPage = pagination.page || page;
  const emptyCollection =
    !tableLoading &&
    !favoritesLoading &&
    pagination.total === 0 &&
    favorites.length === 0 &&
    !search;

  return (
    <Layout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Collection</h1>
          <p className="text-slate-400">Catalog and track your numismatic items</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="search"
            placeholder="Search title, country..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500"
          >
            Search
          </button>
        </form>
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {emptyCollection ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-400">No items yet.</p>
          <Link to="/items/new" className="mt-3 inline-block text-amber-400 hover:text-amber-300">
            Add your first item
          </Link>
        </div>
      ) : (
        <>
          {/* Favorites strip */}
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Favorites</h2>
            {favoritesLoading ? (
              <p className="text-slate-400">Loading favorites...</p>
            ) : favorites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                Star items to pin them here. Open an item and choose Favorite.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.map((item) => (
                  <FavoriteCard
                    key={item._id}
                    item={item}
                    onToggleFavorite={handleToggleFavorite}
                    togglingId={togglingId}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Full collection table */}
          <section>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">All items</h2>
                <p className="text-sm text-slate-400">
                  {tableLoading
                    ? 'Loading…'
                    : `${pagination.total} item${pagination.total === 1 ? '' : 's'}${
                        search ? ` matching “${search}”` : ''
                      }`}
                </p>
              </div>
              {totalPages > 0 && (
                <p className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
              )}
            </div>

            {tableLoading && items.length === 0 ? (
              <p className="text-slate-400">Loading collection...</p>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                {search ? 'No items match your search.' : 'No items to show.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-3 font-medium"> </th>
                      <th className="px-3 py-3 font-medium">Title</th>
                      <th className="px-3 py-3 font-medium">Year</th>
                      <th className="px-3 py-3 font-medium">Country</th>
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Detail</th>
                      <th className="px-3 py-3 font-medium text-right">Melt</th>
                      <th className="px-3 py-3 font-medium text-center">★</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map((item) => {
                      const isSet = item.itemType === 'set';
                      const detail = isSet
                        ? item.memberCount != null
                          ? `${item.memberCount} coin${item.memberCount === 1 ? '' : 's'}`
                          : '—'
                        : item.denomination || '—';
                      const busy = togglingId === item._id;

                      return (
                        <tr
                          key={item._id}
                          className="bg-slate-950/40 transition hover:bg-slate-900/60"
                        >
                          <td className="px-3 py-2">
                            <Link to={`/items/${item._id}`}>
                              <AuthImage
                                src={item.imageUrls?.obverse || item.imageUrls?.reverse}
                                alt=""
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/items/${item._id}`}
                              className="font-medium text-slate-100 hover:text-amber-400"
                            >
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-slate-400">{item.year || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{item.country || '—'}</td>
                          <td className="px-3 py-2 capitalize text-slate-400">
                            {typeLabel(item)}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{detail}</td>
                          <td className="px-3 py-2 text-right text-amber-400">
                            ${Number(item.metalValueUsd || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(item)}
                              disabled={busy}
                              aria-pressed={!!item.isFavorite}
                              aria-label={
                                item.isFavorite
                                  ? `Remove ${item.title} from favorites`
                                  : `Add ${item.title} to favorites`
                              }
                              className={`rounded px-2 py-1 text-base disabled:opacity-50 ${
                                item.isFavorite
                                  ? 'text-amber-400'
                                  : 'text-slate-600 hover:text-amber-400'
                              }`}
                            >
                              {item.isFavorite ? '★' : '☆'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentPage <= 1 || tableLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || tableLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
