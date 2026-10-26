import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { Panel, Stat, Bar, Chip, Notice, BoxGrid, useWarehouse } from "../components/ui";

const MODULES = [
  { name: "Supplier Recommendation", desc: "Rank suppliers by cost, lead time, reliability and defect rate.", to: "/suppliers" },
  { name: "Demand Forecasting", desc: "Predict the next 7 days of demand and see what to reorder.", to: "/demand" },
  { name: "Warehouse details", desc: "Edit the warehouse, add products and update stock in boxes.", to: "/warehouse" },
];

export default function Dashboard({ user, warehouse }) {
  const { view, error, loading } = useWarehouse(warehouse.id);
  const first = (user?.displayName || user?.email || "").split(/[ @]/)[0];

  const t = view?.totals;
  const usedPct = t && t.capacityUnits ? Math.round((t.stockUnits / t.capacityUnits) * 100) : 0;
  const boxPct = t && t.totalBoxes ? Math.round((t.occupied / t.totalBoxes) * 100) : 0;
  const productsById = Object.fromEntries((view?.products || []).map((p) => [p.id, p]));
  const attention = (view?.products || []).filter((p) => p.level !== "ok");

  return (
    <Layout user={user} warehouse={warehouse}>
      <Panel
        title={view?.info.name || warehouse.name}
        subtitle={(view?.info.location ? view.info.location + " · " : "") + `Welcome${first ? ", " + first : ""}`}
        right={
          view && (
            <span className={"text-sm font-semibold " + (view.info.status === "active" ? "text-live" : "text-slate-400")}>
              ● {view.info.status}
            </span>
          )
        }
      >
        {error && <Notice>{error}</Notice>}
        {loading && !error && <p className="text-sm text-slate-400">Loading warehouse…</p>}

        {t && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Stock units" value={t.stockUnits.toLocaleString()} hint={`of ${t.capacityUnits.toLocaleString()} capacity (${usedPct}%)`}>
                <Bar pct={usedPct} />
              </Stat>
              <Stat label="Boxes in use" value={`${t.occupied} / ${t.totalBoxes}`} hint={`${t.empty} empty`}>
                <Bar pct={boxPct} />
              </Stat>
              <Stat label="Products" value={view.products.length} hint="in this warehouse" />
              <Stat label="Low stock" value={t.lowStock} hint={t.watch ? `${t.watch} more close to reorder level` : "at or below reorder level"}>
                <Bar pct={view.products.length ? (t.lowStock / view.products.length) * 100 : 0} className="bg-red-400" />
              </Stat>
            </div>

            <div className="mt-6 rounded-xl border border-edge bg-night/60 p-5">
              <BoxGrid boxes={view.boxes} productsById={productsById} />
              <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-400">
                <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm border border-edge bg-tile" />Empty</span>
                <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm bg-azure" />Filled (height = how full)</span>
                <span>Hover a box for details</span>
              </div>
            </div>
          </>
        )}
      </Panel>

      {view && (
        <Panel title="Needs attention" subtitle="Products at or close to their reorder level" className="mt-6">
          {attention.length === 0 ? (
            <p className="text-sm text-slate-400">Every product is comfortably above its reorder level.</p>
          ) : (
            <ul className="space-y-2">
              {attention.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-tile/50 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.stock} {p.unit} in stock · reorder level {p.reorderLevel}</p>
                  </div>
                  <Chip tone={p.level === "low" ? "low" : "watch"}>{p.level === "low" ? "Reorder now" : "Close to reorder"}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Modules" className="mt-6">
        <ul className="space-y-3">
          {MODULES.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-4 rounded-xl border border-edge bg-tile/60 px-5 py-4">
              <div>
                <p className="font-medium text-white">{m.name}</p>
                <p className="text-sm text-slate-400">{m.desc}</p>
              </div>
              <Link to={m.to} className="shrink-0 rounded-md bg-azure px-4 py-2 text-sm font-medium text-white hover:bg-azure-light">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Layout>
  );
}
