import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Layout({ children }) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-amber-400">
            Numismatica
          </Link>
          {isAuthenticated && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">{user?.email}</span>
              <Link
                to="/items/new"
                className="rounded-md bg-amber-500 px-3 py-1.5 font-medium text-slate-950 hover:bg-amber-400"
              >
                Add Item
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-400 hover:text-white"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
