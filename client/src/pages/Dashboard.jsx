import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import Layout from '../components/Layout.jsx';
import AuthImage from '../components/AuthImage.jsx';

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadItems = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/items', { params: { search: query || undefined } });
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadItems(search);
  };

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {loading ? (
        <p className="text-slate-400">Loading collection...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-400">No items yet.</p>
          <Link to="/items/new" className="mt-3 inline-block text-amber-400 hover:text-amber-300">
            Add your first item
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const isSet = item.itemType === 'set';
            const setLabel =
              {
                proof: 'Proof set',
                mint: 'Mint set',
                prestige: 'Prestige set',
                custom: 'Set',
              }[item.setKind] || (isSet ? 'Set' : null);

            return (
              <Link
                key={item._id}
                to={`/items/${item._id}`}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-amber-500/50"
              >
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
                  <p className="text-sm text-slate-400">
                    {isSet
                      ? [
                          item.year,
                          item.country,
                          item.memberCount != null
                            ? `${item.memberCount} coin${item.memberCount === 1 ? '' : 's'}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : [item.year, item.country, item.denomination]
                          .filter(Boolean)
                          .join(' · ')}
                  </p>
                  <p className="mt-2 text-sm text-amber-400">
                    Melt: ${Number(item.metalValueUsd || 0).toFixed(2)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
