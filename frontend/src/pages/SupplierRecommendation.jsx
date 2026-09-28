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
  { key: "unitCost", weightKey: "cost", label: "Cost", benefit: false, color: "#0f1b2d" },
  { key: "leadTimeDays", weightKey: "leadTime", label: "Lead time", benefit: false, color: "#f2a900" },
  { key: "reliability", weightKey: "reliability", label: "Reliability", benefit: true, color: "#0e8f7e" },
  { key: "defectRate", weightKey: "defect", label: "Defect rate", benefit: false, color: "#7b8da6" },
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
      <h1 className="text-3xl font-semibold">Supplier Recommendation</h1>
      <p className="mt-2 text-steel">
        Set how much each factor matters to you. Suppliers are re-ranked as you move the sliders.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-lg border border-line bg-white p-5">
          <label className="block text-sm font-medium">
            Product
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-ink focus:ring-2 focus:ring-signal/60"
            >
              <option value="all">All products</option>
              {products.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <h2 className="mt-6 text-sm font-medium">What matters most</h2>
          <div className="mt-3 space-y-4">
            {CRITERIA.map((c) => (
              <div key={c.weightKey}>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="text-steel">
                    {weightTotal ? Math.round((weights[c.weightKey] / weightTotal) * 100) : 0}%
                  </span>
                </div>
                <input
                  type="range" min="0" max="100" value={weights[c.weightKey]}
                  onChange={(e) => setWeights({ ...weights, [c.weightKey]: Number(e.target.value) })}
                  aria-label={c.label + " importance"}
                  className="mt-1 w-full accent-ink"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setWeights(DEFAULT_WEIGHTS)}
            className="mt-5 text-sm text-steel underline underline-offset-2 hover:text-ink"
          >
            Reset weights
          </button>
        </section>

        <section>
          {best ? (
            <div className="rounded-lg border-2 border-signal bg-white p-5">
              <p className="text-sm text-steel">Recommended supplier</p>
              <p className="mt-1 text-2xl font-semibold">{best.name}</p>
              <p className="mt-1 text-steel">
                Scores {Math.round(best.score * 100)} out of 100 on your priorities: ₹{best.unitCost} per unit,
                {" "}{best.leadTimeDays}-day lead time, {Math.round(best.reliability * 100)}% reliable.
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-white p-5 text-steel">
              No suppliers found for this product. Choose "All products" or add suppliers.
            </p>
          )}

          {ranked.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-steel">
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
                <tbody>
                  {ranked.map((s) => (
                    <tr key={s.id || s.name} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold">{s.rank}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">₹{s.unitCost}</td>
                      <td className="px-4 py-3">{s.leadTimeDays} days</td>
                      <td className="px-4 py-3">{Math.round(s.reliability * 100)}%</td>
                      <td className="px-4 py-3">{(s.defectRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="flex h-3 w-full overflow-hidden rounded-sm bg-mist" title={"Score " + Math.round(s.score * 100)}>
                          {CRITERIA.map((c) => (
                            <div key={c.weightKey}
                              style={{ width: s.breakdown[c.weightKey] * 100 + "%", background: c.color }}
                              title={c.label + ": " + Math.round(s.breakdown[c.weightKey] * 100) + " points"} />
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-steel">{Math.round(s.score * 100)} / 100</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-steel">
            <span>
              {source === "firebase" ? "Using suppliers from Firebase." : "Using built-in sample suppliers."}
            </span>
            {source === "sample" && (
              <button onClick={seedSuppliers} className="rounded-md border border-line bg-white px-3 py-1.5 text-ink hover:bg-mist">
                Save sample suppliers to Firebase
              </button>
            )}
            {message && <span>{message}</span>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
