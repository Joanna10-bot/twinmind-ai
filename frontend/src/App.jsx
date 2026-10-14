import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { loadStoredWarehouse, clearStoredWarehouse } from "./warehouse";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SupplierRecommendation from "./pages/SupplierRecommendation";

function ProtectedRoute({ user, warehouse, children }) {
  if (user === undefined) {
    return <div className="p-10 text-slate-400">Loading…</div>;
  }
  return user && warehouse ? children : <Navigate to="/login" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">Page not found</h1>
        <p className="mt-2 text-slate-400">Check the address, or go back to the dashboard.</p>
        <Link to="/dashboard" className="mt-4 inline-block rounded-md bg-azure px-4 py-2 text-white">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  // undefined = still checking, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const [stored, setStored] = useState(loadStoredWarehouse);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // Forget the chosen warehouse once the user signs out.
  useEffect(() => {
    if (user === null) {
      clearStoredWarehouse();
      setStored(null);
    }
  }, [user]);

  // Only trust the saved warehouse if it belongs to the signed-in user.
  const warehouse = user && stored && stored.uid === user.uid ? stored : null;
  const signedIn = Boolean(user && warehouse);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/login"
          element={signedIn ? <Navigate to="/dashboard" replace /> : <Login onWarehouseChosen={setStored} />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user} warehouse={warehouse}>
              <Dashboard user={user} warehouse={warehouse} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute user={user} warehouse={warehouse}>
              <SupplierRecommendation user={user} warehouse={warehouse} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
