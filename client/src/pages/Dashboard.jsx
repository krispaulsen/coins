import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import AuthImage from '../components/AuthImage.jsx';
import { TagChip } from '../components/TagInput.jsx';

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

function SelectAllCheckbox({ checked, indeterminate, onChange, disabled, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      className="table-checkbox"
    />
  );
}

function TableTagList({ tags }) {
  if (!tags?.length) return <span className="text-slate-600">—</span>;
  const shown = tags.slice(0, 2);
  const extra = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((tag) => (
        <TagChip key={tag} name={tag} to={`/?tag=${encodeURIComponent(tag)}`} />
      ))}
      {extra > 0 && (
        <span className="self-center text-xs text-slate-500" title={tags.slice(2).join(', ')}>
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag') || '';
  const [favorites, setFavorites] = useState([]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: TABLE_PAGE_SIZE,
    total: 0,
    pages: 0,
  });
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkTag, setBulkTag] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/items/stats');
      setStats(res.data);
    } catch (err) {
      // Non-fatal: dashboard still works without the summary card
      console.warn('Failed to load collection stats', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      let items = [];
      try {
        const res = await api.get('/items/favorites', {
          params: { limit: FAVORITES_LIMIT },
        });
        items = res.data.items || [];
      } catch {
        // Older API builds have no /favorites route; it matches /:id and 500s.
        const res = await api.get('/items', {
          params: {
            favorite: 'true',
            isFavorite: 'true',
            limit: FAVORITES_LIMIT,
          },
        });
        items = res.data.items || [];
      }
      setFavorites(items.filter((item) => item.isFavorite));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load favorites');
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await api.get('/items/tags');
      setTagCatalog(res.data.tags || []);
    } catch (err) {
      console.warn('Failed to load tags', err);
      setTagCatalog([]);
    }
  }, []);

  const loadTable = useCallback(async (query = '', pageNum = 1, tag = '') => {
    setTableLoading(true);
    setError('');
    try {
      const res = await api.get('/items', {
        params: {
          search: query || undefined,
          tag: tag || undefined,
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
    loadStats();
    loadFavorites();
    loadTags();
  }, [loadStats, loadFavorites, loadTags]);

  useEffect(() => {
    loadTable(search, page, tagFilter);
  }, [loadTable, search, page, tagFilter]);

  useEffect(() => {
    setPage(1);
    setRenaming(false);
    setRenameValue(tagFilter);
    setSelectedIds(new Set());
  }, [tagFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSelectedIds(new Set());
    setSearch(searchInput.trim());
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        if (checked) next.add(item._id);
        else next.delete(item._id);
      }
      return next;
    });
  };

  const handleBulkApply = async (e) => {
    e.preventDefault();
    const tag = bulkTag.trim();
    if (!tag || selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/items/tags/apply', {
        itemIds: [...selectedIds],
        tag,
      });
      const name = res.data.name || tag;
      const parts = [`Tagged ${res.data.updated} item${res.data.updated === 1 ? '' : 's'} with “${name}”.`];
      if (res.data.alreadyTagged) {
        parts.push(
          `${res.data.alreadyTagged} already had it.`
        );
      }
      if (res.data.skippedLimit) {
        parts.push(
          `${res.data.skippedLimit} already have 20 tags.`
        );
      }
      setNotice(parts.join(' '));
      setBulkTag('');
      setSelectedIds(new Set());
      await Promise.all([loadTags(), loadTable(search, page, tagFilter)]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply tag');
    } finally {
      setBulkBusy(false);
    }
  };

  const selectTag = (name) => {
    const next = new URLSearchParams(searchParams);
    if (name) {
      next.set('tag', name);
    } else {
      next.delete('tag');
    }
    setSearchParams(next);
  };

  const handleRenameTag = async (e) => {
    e.preventDefault();
    const to = renameValue.trim();
    if (!tagFilter || !to || tagBusy) return;
    setTagBusy(true);
    setError('');
    try {
      const res = await api.patch('/items/tags', { from: tagFilter, to });
      setRenaming(false);
      await loadTags();
      const nextName = res.data.name || to;
      if (nextName !== tagFilter) {
        selectTag(nextName);
      } else {
        await loadTable(search, page, nextName);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename tag');
    } finally {
      setTagBusy(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!tagFilter || tagBusy) return;
    const confirmed = window.confirm(
      `Remove the tag “${tagFilter}” from every item in your collection?`
    );
    if (!confirmed) return;
    setTagBusy(true);
    setError('');
    try {
      await api.delete(`/items/tags/${encodeURIComponent(tagFilter)}`);
      await loadTags();
      selectTag('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete tag');
    } finally {
      setTagBusy(false);
    }
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
  const selectedCount = selectedIds.size;
  const selectedOnPage = items.filter((item) => selectedIds.has(item._id)).length;
  const allOnPage = items.length > 0 && selectedOnPage === items.length;
  const someOnPage = selectedOnPage > 0 && !allOnPage;
  const emptyCollection =
    !tableLoading &&
    !favoritesLoading &&
    pagination.total === 0 &&
    favorites.length === 0 &&
    !search &&
    !tagFilter;
  // Whole-collection total from /items/stats (not limited to the current table page)
  const showMeltSummary =
    (stats != null && (stats.topLevelCount > 0 || stats.coinCount > 0)) ||
    (statsLoading && (favorites.length > 0 || pagination.total > 0));

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
      {notice && <p className="mb-4 text-sm text-amber-300">{notice}</p>}

      {(tagCatalog.length > 0 || tagFilter) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <TagChip
            name="All items"
            active={!tagFilter}
            onClick={() => selectTag('')}
          />
          {tagCatalog.map((entry) => (
            <TagChip
              key={entry.name}
              name={`${entry.name} (${entry.count})`}
              title={entry.name}
              active={tagFilter.toLowerCase() === entry.name.toLowerCase()}
              onClick={() => selectTag(entry.name)}
            />
          ))}
        </div>
      )}

      {/* Collection melt summary — whole collection, not just the current page */}
      {showMeltSummary && (
        <section className="mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wide text-amber-400/90">
                  Collection melt value
                </h2>
                {statsLoading && !stats ? (
                  <p className="mt-1 text-3xl font-bold text-slate-500">…</p>
                ) : (
                  <p className="mt-1 text-3xl font-bold text-slate-50 sm:text-4xl">
                    ${Number(stats?.metalValueUsd || 0).toFixed(2)}
                  </p>
                )}
                <p className="mt-2 max-w-xl text-sm text-slate-400">
                  Total melt across every coin and token in your collection. Set members are
                  included once (not double-counted with the parent set).
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Coins</p>
                  <p className="text-lg font-semibold text-slate-200">
                    {statsLoading && !stats ? '…' : (stats?.coinCount ?? '—')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Items &amp; sets</p>
                  <p className="text-lg font-semibold text-slate-200">
                    {statsLoading && !stats ? '…' : (stats?.topLevelCount ?? '—')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
                <h2 className="text-lg font-semibold">
                  {tagFilter ? `Tagged “${tagFilter}”` : 'All items'}
                </h2>
                <p className="text-sm text-slate-400">
                  {tableLoading
                    ? 'Loading…'
                    : `${pagination.total} item${pagination.total === 1 ? '' : 's'}${
                        search ? ` matching “${search}”` : ''
                      }`}
                </p>
                {tagFilter && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {renaming ? (
                      <form onSubmit={handleRenameTag} className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          maxLength={32}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                          aria-label="New tag name"
                        />
                        <button
                          type="submit"
                          disabled={tagBusy || !renameValue.trim()}
                          className="rounded-md border border-slate-700 px-2 py-1 text-sm hover:border-amber-500 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenaming(false);
                            setRenameValue(tagFilter);
                          }}
                          className="rounded-md px-2 py-1 text-sm text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={tagBusy}
                          onClick={() => {
                            setRenameValue(tagFilter);
                            setRenaming(true);
                          }}
                          className="text-sm text-slate-400 hover:text-amber-400 disabled:opacity-40"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          disabled={tagBusy}
                          onClick={handleDeleteTag}
                          className="text-sm text-slate-400 hover:text-red-400 disabled:opacity-40"
                        >
                          Delete tag
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {totalPages > 0 && (
                <p className="text-sm text-slate-400">
                  Page {currentPage} of {totalPages}
                </p>
              )}
            </div>

            {selectedCount > 0 && (
              <div className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-200">
                  {selectedCount} selected
                  {selectedOnPage !== selectedCount
                    ? ` (${selectedOnPage} on this page)`
                    : ''}
                </p>
                <form
                  onSubmit={handleBulkApply}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="text"
                    list="bulk-tag-options"
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    maxLength={32}
                    placeholder="Tag to apply"
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm"
                    aria-label="Tag to apply to selected items"
                  />
                  <datalist id="bulk-tag-options">
                    {tagCatalog.map((entry) => (
                      <option key={entry.name} value={entry.name} />
                    ))}
                  </datalist>
                  <button
                    type="submit"
                    disabled={bulkBusy || !bulkTag.trim()}
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    {bulkBusy ? 'Applying…' : 'Apply tag'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                </form>
              </div>
            )}

            {tableLoading && items.length === 0 ? (
              <p className="text-slate-400">Loading collection...</p>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                {tagFilter
                  ? 'No items with this tag.'
                  : search
                    ? 'No items match your search.'
                    : 'No items to show.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-3 font-medium">
                        <SelectAllCheckbox
                          checked={allOnPage}
                          indeterminate={someOnPage}
                          disabled={tableLoading || items.length === 0}
                          onChange={(e) => toggleSelectPage(e.target.checked)}
                          label="Select all items on this page"
                        />
                      </th>
                      <th className="px-3 py-3 font-medium"> </th>
                      <th className="px-3 py-3 font-medium">Title</th>
                      <th className="px-3 py-3 font-medium">Year</th>
                      <th className="px-3 py-3 font-medium">Country</th>
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Detail</th>
                      <th className="px-3 py-3 font-medium">Tags</th>
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
                      const parentSet = item.parentSet;
                      const isSelected = selectedIds.has(item._id);

                      return (
                        <tr
                          key={item._id}
                          className={`transition hover:bg-slate-900/60 ${
                            isSelected ? 'bg-amber-500/5' : 'bg-slate-950/40'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelected(item._id)}
                              aria-label={`Select ${item.title}`}
                              className="table-checkbox"
                            />
                          </td>
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
                            {parentSet && (
                              <Link
                                to={`/items/${parentSet._id}`}
                                className="mt-0.5 block text-xs text-slate-500 hover:text-amber-400"
                              >
                                In {parentSet.title}
                              </Link>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{item.year || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{item.country || '—'}</td>
                          <td className="px-3 py-2 capitalize text-slate-400">
                            {typeLabel(item)}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{detail}</td>
                          <td className="px-3 py-2">
                            <TableTagList tags={item.tags} />
                          </td>
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
