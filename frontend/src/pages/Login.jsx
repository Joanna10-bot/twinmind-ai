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

// A small grid of storage boxes: the "twin" the product is named after.
function FloorPlan() {
  const fills = [1, 0.4, 0, 1, 0.75, 1, 0, 0.25, 1, 0, 1, 0.6, 1, 0, 0.9, 0, 1, 0.5, 0, 1];
  return (
    <svg viewBox="0 0 300 160" className="w-full max-w-md" role="img" aria-label="Warehouse boxes shaded by how full they are">
      {fills.map((f, i) => {
        const x = 8 + (i % 5) * 58;
        const y = 8 + Math.floor(i / 5) * 38;
        return (
          <g key={i}>
            <rect x={x} y={y} width="50" height="30" rx="4" fill="#252d42" stroke="#1f2a44" />
            {f > 0 && <rect x={x} y={y + 30 - 30 * f} width="50" height={30 * f} rx="4" fill="#2b5cd6" />}
          </g>
        );
      })}
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
    "mt-1 w-full rounded-md border border-edge bg-night px-3 py-2.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-azure-light focus:ring-2 focus:ring-azure-light/40";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-edge bg-panel p-12 text-white lg:flex">
        <span className="text-lg font-semibold tracking-tight">
          TwinMind <span className="text-azure-light">AI</span>
        </span>
        <div>
          <FloorPlan />
          <h1 className="mt-10 max-w-md text-4xl font-light leading-tight">
            Run your warehouse from its digital twin.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Forecast demand, choose the right supplier, and test what-if scenarios before they cost you stock.
          </p>
        </div>
        <p className="text-sm text-slate-500">G. Narayanamma Institute of Technology &amp; Science</p>
      </section>

      <section className="flex items-center justify-center bg-night p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl font-medium text-white">{isRegister ? "Create your account" : "Sign in"}</h2>
          <p className="mt-1 text-slate-400">
            {isRegister ? "Register to manage your warehouse." : "Welcome back. Enter your details to continue."}
          </p>

          <label className="mt-6 block text-sm font-medium text-slate-300">
            Warehouse
            <input required className={inputClass} value={warehouseInput} placeholder="Warehouse ID or name, e.g. W001"
              onChange={(e) => setWarehouseInput(e.target.value)} />
          </label>

          {isRegister && (
            <label className="mt-4 block text-sm font-medium text-slate-300">
              Full name
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Email (your username)
            <input type="email" required className={inputClass} value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Password
            <input type="password" required minLength={6} className={inputClass} value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"} />
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-md bg-azure py-2.5 font-medium text-white hover:bg-azure-light disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-light focus-visible:ring-offset-2 focus-visible:ring-offset-night"
          >
            {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-400">
            {isRegister ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="font-medium text-azure-light underline underline-offset-2"
              onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}>
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
      </section>
    </div>
  );
}
