import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";

// Used when the "suppliers" collection is empty or can't be read yet.
const SAMPLE_SUPPLIERS = [
  { name: "TechSource Distributors", unitCost: 380, leadTimeDays: 5, reliability: 0.95, defectRate: 0.01 },
  { name: "QuickSupply Logistics", unitCost: 360, leadTimeDays: 3, reliability: 0.87, defectRate: 0.025 },
  { name: "National Wholesale Co.", unitCost: 410, leadTimeDays: 10, reliability: 0.9, defectRate: 0.015 },
  { name: "BudgetGoods Traders", unitCost: 340, leadTimeDays: 12, reliability: 0.78, defectRate: 0.045 },
  { name: "Premium Import Partners", unitCost: 400, leadTimeDays: 7, reliability: 0.93, defectRate: 0.008 },
];

// benefit = true means higher is better
const CRITERIA = [
  { key: "unitCost", weightKey: "cost", label: "Cost", benefit: false, color: "#4a90e2" },
  { key: "leadTimeDays", weightKey: "leadTime", label: "Lead time", benefit: false, color: "#f2a900" },
  { key: "reliability", weightKey: "reliability", label: "Reliability", benefit: true, color: "#22c55e" },
  { key: "defectRate", weightKey: "defect", label: "Defect rate", benefit: false, color: "#a78bfa" },
];

const DEFAULT_WEIGHTS = { cost: 30, leadTime: 25, reliability: 30, defect: 15 };

// Weighted-sum ranking: normalise each criterion to 0..1, then apply the weights.
export function rankSuppliers(suppliers, weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  return suppliers
    .map((s) => {
      const breakdown = {};
      let score = 0;
      for (const c of CRITERIA) {
        const vals = suppliers.map((x) => Number(x[c.key]));
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const v = Number(s[c.key]);
        const n = max === min ? 1 : c.benefit ? (v - min) / (max - min) : (max - v) / (max - min);
        const part = n * (weights[c.weightKey] / total);
        breakdown[c.weightKey] = part;
        score += part;
      }
      return { ...s, score, breakdown };
    })
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export default function SupplierRecommendation({ user, warehouse }) {
  const [suppliers, setSuppliers] = useState(SAMPLE_SUPPLIERS);
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState("all");
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [source, setSource] = useState("sample"); // "sample" | "firebase"
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const sSnap = await getDocs(collection(db, "suppliers"));
      const list = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        setSuppliers(list);
        setSource("firebase");
      }
    } catch (e) {
      console.warn("Could not read suppliers, using sample data:", e.code || e.message);
    }
    try {
      // Products may sit under the warehouse (warehouses/W001/products) or at the top level.
      const names = (snap) =>
        snap.docs.map((d) => {
          const x = d.data();
          return x.name || x.productName || x.product_name || x.title || d.id;
        });
      let list = names(await getDocs(collection(db, "warehouses", warehouse.id, "products")));
      if (list.length === 0) list = names(await getDocs(collection(db, "products")));
      setProducts([...new Set(list)]);
    } catch (e) {
      console.warn("Could not read products:", e.code || e.message);
    }
  }

  useEffect(() => { load(); }, [warehouse.id]);

  async function seedSuppliers() {
    setMessage("");
    try {
      for (const s of SAMPLE_SUPPLIERS) await addDoc(collection(db, "suppliers"), s);
      setMessage("Sample suppliers saved to Firebase.");
      await load();
    } catch (e) {
      setMessage("Could not save to Firebase (" + (e.code || e.message) + "). Check your Firestore rules.");
    }
  }

  const ranked = useMemo(() => {
    const pool = suppliers.filter(
      (s) => product === "all" || !Array.isArray(s.products) || s.products.length === 0 || s.products.includes(product)
    );
    return pool.length ? rankSuppliers(pool, weights) : [];
  }, [suppliers, product, weights]);

  const best = ranked[0];
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);


  return (
    <Layout user={user} warehouse={warehouse}>
      <section className="rounded-2xl border border-edge bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium text-white">Supplier Recommendation</h2>
            <p className="text-sm text-slate-400">{warehouse?.name} · ranked by your priorities</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              aria-label="Product"
              className="rounded-md border border-edge bg-night px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-azure-light"
            >
              <option value="all">All products</option>
              {products.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-sm font-semibold text-live">● {ranked.length} suppliers</span>
          </div>
        </div>

        {ranked.length > 0 ? (
          <div className="mt-6 rounded-xl border border-edge bg-night/60 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ranked.map((s) => {
                const pct = Math.round(s.score * 100);
                const top = s.rank === 1;
                return (
                  <div key={s.id || s.name} className="group relative">
                    <div
                      className={
                        "relative flex h-28 flex-col items-center justify-center overflow-hidden rounded-lg border bg-tile text-center transition-transform group-hover:-translate-y-0.5 " +
                        (top ? "border-azure-light ring-1 ring-azure-light" : "border-edge")
                      }
                    >
                      <div className="absolute inset-x-0 bottom-0 bg-azure" style={{ height: pct + "%" }} />
                      <div className="relative px-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                          {top ? "Rank 1 · best" : "Rank " + s.rank}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs font-medium leading-tight text-white">{s.name}</p>
                        <p className="mt-1 text-[11px] text-white/80">{pct}/100</p>
                      </div>
                    </div>

                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-lg border border-edge bg-black p-4 text-center shadow-xl group-hover:block"
                    >
                      <p className="text-lg font-medium text-azure-light">{s.name}</p>
                      <dl className="mt-2 space-y-2 text-[11px]">
                        {[
                          ["Cost", "₹" + s.unitCost + " per unit"],
                          ["Lead time", s.leadTimeDays + " days"],
                          ["Reliability", Math.round(s.reliability * 100) + "%"],
                          ["Defect rate", (s.defectRate * 100).toFixed(1) + "%"],
                          ["Score", pct + " / 100"],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <dt className="font-semibold text-white">{k}:</dt>
                            <dd className="text-slate-400">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-slate-400">
              <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm border border-edge bg-tile" />Lower score</span>
              <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm bg-azure" />Higher score</span>
              <span>Fill height = score out of 100 · hover a tile for details</span>
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-edge bg-night/60 p-5 text-slate-400">
            No suppliers found for this product. Choose "All products" or add suppliers.
          </p>
        )}

        {best && (
          <div className="mt-5 rounded-xl border border-azure-light/60 bg-azure/10 p-5">
            <p className="text-xs uppercase tracking-wide text-azure-light">Recommended supplier</p>
            <p className="mt-1 text-2xl font-semibold text-white">{best.name}</p>
            <p className="mt-1 text-sm text-slate-300">
              Scores {Math.round(best.score * 100)} out of 100 on your priorities: ₹{best.unitCost} per unit,
              {" "}{best.leadTimeDays}-day lead time, {Math.round(best.reliability * 100)}% reliable.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-edge bg-panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">What matters most</h2>
          <button
            onClick={() => setWeights(DEFAULT_WEIGHTS)}
            className="text-sm text-slate-400 underline underline-offset-2 hover:text-white"
          >
            Reset weights
          </button>
        </div>
        <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {CRITERIA.map((c) => (
            <div key={c.weightKey}>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-200">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                  {c.label}
                </span>
                <span className="text-slate-400">
                  {weightTotal ? Math.round((weights[c.weightKey] / weightTotal) * 100) : 0}%
                </span>
              </div>
              <input
                type="range" min="0" max="100" value={weights[c.weightKey]}
                onChange={(e) => setWeights({ ...weights, [c.weightKey]: Number(e.target.value) })}
                aria-label={c.label + " importance"}
                className="mt-1 w-full accent-azure-light"
              />
            </div>
          ))}
        </div>
      </section>

      {ranked.length > 0 && (
        <section className="mt-6 overflow-x-auto rounded-2xl border border-edge bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-edge text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Lead time</th>
                <th className="px-4 py-3 font-medium">Reliability</th>
                <th className="px-4 py-3 font-medium">Defects</th>
                <th className="min-w-44 px-4 py-3 font-medium">Score and why</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {ranked.map((s) => (
                <tr key={s.id || s.name} className="border-b border-edge last:border-0">
                  <td className="px-4 py-3 font-semibold text-white">{s.rank}</td>
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3">₹{s.unitCost}</td>
                  <td className="px-4 py-3">{s.leadTimeDays} days</td>
                  <td className="px-4 py-3">{Math.round(s.reliability * 100)}%</td>
                  <td className="px-4 py-3">{(s.defectRate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex h-3 w-full overflow-hidden rounded-sm bg-tile" title={"Score " + Math.round(s.score * 100)}>
                      {CRITERIA.map((c) => (
                        <div key={c.weightKey}
                          style={{ width: s.breakdown[c.weightKey] * 100 + "%", background: c.color }}
                          title={c.label + ": " + Math.round(s.breakdown[c.weightKey] * 100) + " points"} />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{Math.round(s.score * 100)} / 100</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>{source === "firebase" ? "Using suppliers from Firebase." : "Using built-in sample suppliers."}</span>
        {source === "sample" && (
          <button onClick={seedSuppliers} className="rounded-md border border-edge bg-panel px-3 py-1.5 text-slate-200 hover:bg-tile">
            Save sample suppliers to Firebase
          </button>
        )}
        {message && <span>{message}</span>}
      </div>
    </Layout>
  );
}
