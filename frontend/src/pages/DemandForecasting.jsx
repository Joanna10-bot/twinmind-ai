import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import { Panel, Stat, Chip, Notice, inputCls, useWarehouse } from "../components/ui";
import { predictWeek, dayAfter, addDays } from "../lib/forecastCore";
import model from "../data/demandModel.json";
import sales from "../data/salesHistory.json";

const SHOW_PAST = 28;
const fmtDay = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function LineChart({ past, future, startDate }) {
  const W = 720, H = 280, L = 40, R = 12, T = 14, B = 34;
  const all = [...past, ...future];
  const max = Math.max(4, Math.ceil(Math.max(...all) * 1.15));
  const n = all.length;
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const pastPts = past.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const futPts = [past.length - 1, ...future.map((_, i) => past.length + i)]
    .map((idx, k) => `${x(idx)},${y(k === 0 ? past[past.length - 1] : future[k - 1])}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * max));
  const labelIdx = [0, 7, 14, 21, 28, 34].filter((i) => i < n);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Actual daily demand for the last 28 days and predicted demand for the next 7 days">
      <rect x={x(past.length - 1)} y={T} width={x(n - 1) - x(past.length - 1)} height={H - T - B} fill="#2b5cd6" fillOpacity="0.12" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#1f2a44" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{t}</text>
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor={x(i) > W - 30 ? "end" : "middle"} fontSize="11" fill="#94a3b8">{fmtDay(addDays(startDate, i))}</text>
      ))}
      <polyline points={pastPts} fill="none" stroke="#4a90e2" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={futPts} fill="none" stroke="#f2a900" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" />
      {future.map((v, i) => <circle key={i} cx={x(past.length + i)} cy={y(v)} r="3.5" fill="#f2a900" />)}
    </svg>
  );
}

export default function DemandForecasting({ user, warehouse }) {
  const { view, error, loading } = useWarehouse(warehouse.id);
  const [picked, setPicked] = useState(null);

  const nextDay = useMemo(() => dayAfter(sales.end), []);

  const rows = useMemo(() => {
    if (!view) return [];
    return view.products.map((p) => {
      const hist = sales.products[p.id];
      if (!hist || hist.length < 28) return { ...p, hasHistory: false };
      const daily = predictWeek(model, hist, nextDay, { category: p.category, price: p.unitPrice, stock: p.stock, reorder: p.reorderLevel });
      const total = daily.reduce((s, v) => s + v, 0);
      const left = p.stock - total;
      const status = left < 0 ? "risk" : left < p.reorderLevel ? "reorder" : "ok";
      const order = status === "ok" ? 0 : Math.ceil(p.reorderLevel + total - p.stock);
      return { ...p, hasHistory: true, daily, total, left, status, order, hist, coverDays: total > 0 ? (p.stock / total) * 7 : Infinity };
    });
  }, [view, nextDay]);

  const withHist = rows.filter((r) => r.hasHistory);
  const defaultId = (withHist.find((r) => r.status !== "ok") || withHist[0])?.id;
  const sel = rows.find((r) => r.id === (picked || defaultId));

  const alerts = withHist.filter((r) => r.status !== "ok").length;
  const m = model.metrics.models;
  const tone = { ok: "ok", reorder: "watch", risk: "low" };
  const label = { ok: "On track", reorder: "Reorder", risk: "Stock-out risk" };

  return (
    <Layout user={user} warehouse={warehouse}>
      <Panel
        title="Demand Forecasting"
        subtitle={`${view?.info.name || warehouse.name} · next 7 days from ${fmtDay(nextDay)}`}
        right={
          <select value={sel?.id || ""} onChange={(e) => setPicked(e.target.value)} aria-label="Product"
            className="rounded-md border border-edge bg-night px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-azure-light">
            {withHist.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        }
      >
        {error && <Notice>{error}</Notice>}
        {loading && !error && <p className="text-sm text-slate-400">Loading warehouse…</p>}

        {sel && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Predicted, next 7 days" value={Math.round(sel.total) + " " + sel.unit} hint={`about ${(sel.total / 7).toFixed(1)} per day`} />
              <Stat label="Stock on hand" value={sel.stock + " " + sel.unit} hint={`reorder level ${sel.reorderLevel}`} />
              <Stat label="Stock after 7 days" value={Math.round(sel.left)} hint={sel.left < 0 ? "demand exceeds stock" : "if nothing is ordered"} />
              <Stat label="Suggested order" value={sel.order > 0 ? sel.order + " " + sel.unit : "None"} hint={<Chip tone={tone[sel.status]}>{label[sel.status]}</Chip>} />
            </div>

            <div className="mt-6 rounded-xl border border-edge bg-night/60 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-5 text-xs text-slate-400">
                <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 bg-azure-light" />Actual (last 28 days)</span>
                <span className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-signal" />Predicted (next 7 days)</span>
              </div>
              <LineChart
                past={sel.hist.slice(-SHOW_PAST)}
                future={sel.daily.map((v) => Math.round(v * 10) / 10)}
                startDate={addDays(nextDay, -SHOW_PAST)}
              />
            </div>
          </>
        )}
      </Panel>

      {view && (
        <Panel title="All products" subtitle={`${alerts} of ${withHist.length} need attention`} className="mt-6">
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Predicted (7d)</th>
                  <th className="px-4 py-3 font-medium">Days of cover</th>
                  <th className="px-4 py-3 font-medium">Suggested order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => r.hasHistory && setPicked(r.id)}
                    className={"border-b border-edge last:border-0 " + (r.hasHistory ? "cursor-pointer hover:bg-tile/40 " : "") + (sel?.id === r.id ? "bg-azure/10" : "")}>
                    <td className="px-4 py-3 font-medium text-white">{r.name}</td>
                    <td className="px-4 py-3">{r.stock}</td>
                    {r.hasHistory ? (
                      <>
                        <td className="px-4 py-3">{Math.round(r.total)}</td>
                        <td className="px-4 py-3">{Number.isFinite(r.coverDays) ? r.coverDays.toFixed(1) + " d" : "—"}</td>
                        <td className="px-4 py-3">{r.order > 0 ? r.order : "—"}</td>
                        <td className="px-4 py-3"><Chip tone={tone[r.status]}>{label[r.status]}</Chip></td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-slate-400" colSpan={4}>No sales history for this product yet</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="About this forecast" className="mt-6">
        <p className="text-sm text-slate-300">
          A small neural network (two hidden layers, 64 and 32 units) reads the last 28 days of sales, the weekday and month, the product
          category and price, and the stock level, and predicts demand for each of the next 7 days.
        </p>
        <p className="mt-3 rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-signal">
          This warehouse has no recorded sales yet, so the model was trained on and is reading sample sales history. Treat these numbers as a
          demonstration until real sales records are added.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="7-day total, R²" value={m.MLP.weekly_total.R2.toFixed(2)} hint={`moving average: ${m["14-day moving average"].weekly_total.R2.toFixed(2)}`} />
          <Stat label="7-day total, MAE" value={m.MLP.weekly_total.MAE.toFixed(1) + " units"} hint={`moving average: ${m["14-day moving average"].weekly_total.MAE.toFixed(1)}`} />
          <Stat label="Stock-out alerts" value={`P ${model.metrics.alerts.MLP.precision.toFixed(2)} · R ${model.metrics.alerts.MLP.recall.toFixed(2)}`} hint="precision and recall on held-out sample days" />
        </div>
      </Panel>
    </Layout>
  );
}
