import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { findWarehouse, storeWarehouse } from "../warehouse";

const ERRORS = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "No account uses this email. Register first.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed": "Can't reach Firebase. Check your internet connection.",
  "auth/requires-recent-login": "Please sign in again.",
  "permission-denied": "Firestore blocked this. Check the database rules.",
  "auth/invalid-api-key": "Firebase config is missing. Paste your config into src/firebase.js.",
};

// A small floor plan: the "twin" the product is named after.
function FloorPlan() {
  const zones = [
    { x: 20, y: 20, w: 90, h: 50, o: 0.35 },
    { x: 120, y: 20, w: 90, h: 50, o: 0.2 },
    { x: 220, y: 20, w: 60, h: 50, o: 0.5, hot: true },
    { x: 20, y: 80, w: 120, h: 60, o: 0.25 },
    { x: 150, y: 80, w: 130, h: 60, o: 0.4 },
    { x: 20, y: 150, w: 60, h: 40, o: 0.15 },
    { x: 90, y: 150, w: 190, h: 40, o: 0.3 },
  ];
  return (
    <svg viewBox="0 0 300 210" className="w-full max-w-md" role="img" aria-label="Warehouse floor plan with zones shaded by how full they are">
      <rect x="4" y="4" width="292" height="202" rx="6" fill="none" stroke="white" strokeOpacity="0.25" />
      {zones.map((z, i) => (
        <rect
          key={i}
          x={z.x} y={z.y} width={z.w} height={z.h} rx="3"
          fill={z.hot ? "#f2a900" : "white"}
          fillOpacity={z.hot ? 0.9 : z.o}
          stroke="white" strokeOpacity="0.3"
        />
      ))}
      <text x="250" y="49" textAnchor="middle" fontSize="9" fill="#0f1b2d" fontWeight="600">Low stock</text>
    </svg>
  );
}

export default function Login({ onWarehouseChosen }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [warehouseInput, setWarehouseInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    let cred = null;
    try {
      if (mode === "register") {
        cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        cred = await signInWithEmailAndPassword(auth, email, password);
      }

      // The warehouse can only be looked up once signed in, so check it now.
      const warehouse = await findWarehouse(warehouseInput);
      if (!warehouse) {
        if (mode === "register") await deleteUser(cred.user); // don't leave an account with no warehouse
        else await signOut(auth);
        setError("No warehouse matches \"" + warehouseInput.trim() + "\". Check the warehouse ID or name.");
        return;
      }

      const userRef = doc(db, "users", cred.user.uid);
      const snap = await getDoc(userRef);
      const allowed = snap.exists() ? snap.data().warehouseIds || [] : null;

      // Accounts that already have a warehouse list can only enter warehouses on it.
      // New accounts (and accounts from before this feature) get the warehouse added.
      if (mode === "login" && allowed && allowed.length > 0 && !allowed.includes(warehouse.id)) {
        await signOut(auth);
        setError("This account doesn't have access to " + warehouse.name + ".");
        return;
      }

      await setDoc(
        userRef,
        {
          name: cred.user.displayName || name.trim() || "",
          email: cred.user.email,
          warehouseIds: arrayUnion(warehouse.id),
        },
        { merge: true }
      );

      onWarehouseChosen(storeWarehouse(cred.user.uid, warehouse));
      navigate("/dashboard");
    } catch (err) {
      setError(ERRORS[err.code] || "Something went wrong (" + (err.code || err.message) + "). Try again.");
      if (cred && auth.currentUser) await signOut(auth).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  const inputClass =
    "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-ink focus:ring-2 focus:ring-signal/60";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <span className="text-lg font-semibold tracking-tight">
          TwinMind <span className="text-signal">AI</span>
        </span>
        <div>
          <FloorPlan />
          <h1 className="mt-10 max-w-md text-4xl font-semibold leading-tight">
            Run your warehouse from its digital twin.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Forecast demand, choose the right supplier, and test what-if scenarios before they cost you stock.
          </p>
        </div>
        <p className="text-sm text-white/50">G. Narayanamma Institute of Technology &amp; Science</p>
      </section>

      <section className="flex items-center justify-center bg-mist p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">{isRegister ? "Create your account" : "Sign in"}</h2>
          <p className="mt-1 text-steel">
            {isRegister ? "Register to manage your warehouse." : "Welcome back. Enter your details to continue."}
          </p>

          <label className="mt-6 block text-sm font-medium">
            Warehouse
            <input required className={inputClass} value={warehouseInput} placeholder="Warehouse ID or name, e.g. W001"
              onChange={(e) => setWarehouseInput(e.target.value)} />
          </label>

          {isRegister && (
            <label className="mt-4 block text-sm font-medium">
              Full name
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}

          <label className="mt-4 block text-sm font-medium">
            Email (your username)
            <input type="email" required className={inputClass} value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Password
            <input type="password" required minLength={6} className={inputClass} value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"} />
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-md bg-ink py-2.5 font-medium text-white hover:bg-steel disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2"
          >
            {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>

          <p className="mt-5 text-center text-sm text-steel">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="font-medium text-ink underline underline-offset-2"
              onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}>
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
