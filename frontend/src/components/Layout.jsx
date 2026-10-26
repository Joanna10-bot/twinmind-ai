import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const linkClass = ({ isActive }) =>
  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
  (isActive ? "bg-azure text-white" : "text-slate-400 hover:text-white");

export default function Layout({ user, warehouse, children }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-night text-slate-200">
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="flex items-center justify-end gap-3 pt-4 text-xs text-slate-400">
          <span className="hidden sm:inline">{user?.displayName || user?.email}</span>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-edge px-3 py-1 text-slate-300 hover:bg-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-light"
          >
            Sign out
          </button>
        </div>

        <header className="pt-2 text-center">
          <h1 className="text-4xl font-light tracking-tight text-white">
            TwinMind <span className="text-azure-light">AI</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">AI-Driven Warehouse Digital Twin</p>
          <nav className="mt-5 flex items-center justify-center gap-2">
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/suppliers" className={linkClass}>Suppliers</NavLink>
            <NavLink to="/demand" className={linkClass}>Demand</NavLink>
            <NavLink to="/warehouse" className={linkClass}>Warehouse</NavLink>
          </nav>
        </header>

        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}
