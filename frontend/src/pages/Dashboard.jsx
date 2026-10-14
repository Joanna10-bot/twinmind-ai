import { Link } from "react-router-dom";
import Layout from "../components/Layout";

const MODULES = [
  { name: "Supplier Recommendation", desc: "Rank suppliers by cost, lead time, reliability and defect rate.", to: "/suppliers", ready: true },
  { name: "Demand Forecasting", desc: "Predict how much of each product you will sell next.", ready: false },
  { name: "Scenario Simulation", desc: "Test what happens if demand or lead times change.", ready: false },
  { name: "Digital Twin", desc: "See the warehouse floor plan and live stock by zone.", ready: false },
];

export default function Dashboard({ user, warehouse }) {
  const first = (user?.displayName || user?.email || "").split(/[ @]/)[0];

  return (
    <Layout user={user} warehouse={warehouse}>
      <section className="rounded-2xl border border-edge bg-panel p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-medium text-white">Welcome{first ? `, ${first}` : ""}</h2>
            <p className="text-sm text-slate-400">{warehouse?.name} · choose a module to get started</p>
          </div>
          <span className="text-sm font-semibold text-live">● active</span>
        </div>

        <ul className="mt-6 space-y-3">
          {MODULES.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-4 rounded-xl border border-edge bg-tile/60 px-5 py-4">
              <div>
                <p className="font-medium text-white">{m.name}</p>
                <p className="text-sm text-slate-400">{m.desc}</p>
              </div>
              {m.ready ? (
                <Link to={m.to} className="shrink-0 rounded-md bg-azure px-4 py-2 text-sm font-medium text-white hover:bg-azure-light">
                  Open
                </Link>
              ) : (
                <span className="shrink-0 rounded-md bg-night px-3 py-1.5 text-sm text-slate-500">In progress</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
