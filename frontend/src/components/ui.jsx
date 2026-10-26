import { useEffect, useState } from "react";
import { loadWarehouseData, friendlyError } from "../lib/warehouseApi";
import { normalize } from "../lib/warehouseLogic";

export function Panel({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={"rounded-2xl border border-edge bg-panel p-6 " + className}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-xl font-medium text-white">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, children }) {
  return (
    <div className="rounded-xl border border-edge bg-night/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

export function Bar({ pct, className = "bg-azure" }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tile">
      <div className={"h-full rounded-full " + className} style={{ width: Math.min(100, Math.max(0, pct)) + "%" }} />
    </div>
  );
}

export function Chip({ tone = "ok", children }) {
  const tones = {
    ok: "bg-live/15 text-live",
    watch: "bg-signal/15 text-signal",
    low: "bg-red-500/15 text-red-300",
    muted: "bg-tile text-slate-300",
  };
  return <span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-medium " + tones[tone]}>{children}</span>;
}

export function Notice({ kind = "error", children }) {
  const cls = kind === "error" ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-live/40 bg-live/10 text-live";
  return <p role={kind === "error" ? "alert" : "status"} className={"rounded-md border px-3 py-2 text-sm " + cls}>{children}</p>;
}

// Grid of storage boxes. Fill height = how full the box is. Pass onSelect to make tiles clickable.
export function BoxGrid({ boxes, productsById, selectedId, onSelect }) {
  const cols = Math.max(1, ...boxes.map((b) => b.col));
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {boxes.map((b) => {
        const pct = b.capacity ? Math.round((b.qty / b.capacity) * 100) : 0;
        const name = b.productId ? productsById[b.productId]?.name || b.productId : "Empty";
        const selected = selectedId === b.id;
        const Tag = onSelect ? "button" : "div";
        return (
          <div key={b.id} className="group relative">
            <Tag
              type={onSelect ? "button" : undefined}
              onClick={onSelect ? () => onSelect(b.id) : undefined}
              aria-label={`${b.id}: ${name}, ${b.qty} of ${b.capacity}`}
              className={
                "relative flex h-14 w-full flex-col items-center justify-center overflow-hidden rounded-md border bg-tile text-center " +
                (selected ? "border-azure-light ring-2 ring-azure-light " : "border-edge ") +
                (onSelect ? "cursor-pointer hover:border-azure-light" : "")
              }
            >
              <div className="absolute inset-x-0 bottom-0 bg-azure" style={{ height: pct + "%" }} />
              <span className="relative text-[10px] font-semibold leading-none text-white">{b.id.replace("box_", "#")}</span>
              <span className="relative mt-1 text-[10px] leading-none text-white/80">{b.qty}/{b.capacity}</span>
            </Tag>
            <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-edge bg-black p-3 text-center shadow-xl group-hover:block">
              <p className="text-sm font-medium text-azure-light">{b.id}</p>
              <p className="mt-1 text-[11px] text-white">{name}</p>
              <p className="text-[11px] text-slate-400">{b.qty} of {b.capacity} units · row {b.row}, col {b.col}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Loads warehouses/{id} and returns { raw, view, error, loading, reload }.
export function useWarehouse(id) {
  const [state, setState] = useState({ raw: null, view: null, error: "", loading: true });
  async function reload() {
    try {
      const raw = await loadWarehouseData(id);
      setState({ raw, view: normalize(raw), error: "", loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: friendlyError(e), loading: false }));
    }
  }
  useEffect(() => { reload(); }, [id]);
  return { ...state, reload };
}

export const inputCls =
  "mt-1 w-full rounded-md border border-edge bg-night px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-azure-light focus:ring-2 focus:ring-azure-light/40";
export const primaryBtn =
  "rounded-md bg-azure px-4 py-2 text-sm font-medium text-white hover:bg-azure-light disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-light";
export const ghostBtn =
  "rounded-md border border-edge px-4 py-2 text-sm text-slate-200 hover:bg-tile focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-light";
