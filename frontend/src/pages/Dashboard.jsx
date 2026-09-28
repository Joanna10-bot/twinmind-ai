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
      <h1 className="text-3xl font-semibold">Welcome{first ? `, ${first}` : ""}</h1>
      <p className="mt-2 text-steel">
        You are managing <span className="font-medium text-ink">{warehouse?.name}</span>. Choose a module to get started.
      </p>

      <ul className="mt-8 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        {MODULES.map((m) => (
          <li key={m.name} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-steel">{m.desc}</p>
            </div>
            {m.ready ? (
              <Link to={m.to} className="shrink-0 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-steel">
                Open
              </Link>
            ) : (
              <span className="shrink-0 rounded-md bg-mist px-3 py-1.5 text-sm text-steel">In progress</span>
            )}
          </li>
        ))}
      </ul>
    </Layout>
  );
}
