import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const linkClass = ({ isActive }) =>
  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
  (isActive ? "bg-white/15 text-white" : "text-white/70 hover:text-white");

export default function Layout({ user, warehouse, children }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-lg font-semibold tracking-tight">
              TwinMind <span className="text-signal">AI</span>
            </span>
            <nav className="flex gap-1">
              <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
              <NavLink to="/suppliers" className={linkClass}>Suppliers</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {warehouse && (
              <span className="hidden rounded-md bg-white/10 px-2.5 py-1 text-white sm:inline">{warehouse.name}</span>
            )}
            <span className="hidden text-white/70 md:inline">{user?.displayName || user?.email}</span>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-white/25 px-3 py-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
