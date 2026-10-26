import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { Panel, Chip, Notice, BoxGrid, useWarehouse, inputCls, primaryBtn, ghostBtn } from "../components/ui";
import { saveUpdates, saveStockChange, friendlyError } from "../lib/warehouseApi";
import { planWarehouseSave, planProductSave } from "../lib/warehouseLogic";

const EMPTY_PRODUCT = { name: "", category: "Electronics", unitPrice: "", reorderLevel: "", supplierId: "", unit: "pcs" };

function Label({ text, children }) {
  return <label className="block text-sm font-medium text-slate-300">{text}{children}</label>;
}

export default function WarehouseDetails({ user, warehouse }) {
  const { raw, view, error, loading, reload } = useWarehouse(warehouse.id);
  const [msg, setMsg] = useState(null); // { kind, text }
  const [busy, setBusy] = useState(false);

  const [info, setInfo] = useState({ name: "", location: "", status: "active", totalCapacityUnits: "" });
  const [pForm, setPForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [boxId, setBoxId] = useState(null);
  const [boxProduct, setBoxProduct] = useState("");
  const [boxQty, setBoxQty] = useState("");

  useEffect(() => {
    if (view) setInfo({ name: view.info.name, location: view.info.location, status: view.info.status, totalCapacityUnits: String(view.info.totalCapacityUnits) });
  }, [view]);

  function selectBox(id) {
    setBoxId(id);
    const b = view.boxes.find((x) => x.id === id);
    setBoxProduct(b?.productId || "");
    setBoxQty(b?.productId ? String(b.qty) : "");
    setMsg(null);
  }

  async function run(action, okText) {
    setMsg(null);
    setBusy(true);
    try {
      await action();
      await reload();
      setMsg({ kind: "ok", text: okText });
      return true;
    } catch (e) {
      setMsg({ kind: "error", text: friendlyError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveInfo = (e) => {
    e.preventDefault();
    return run(async () => saveUpdates(warehouse.id, planWarehouseSave(info)), "Warehouse details saved.");
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const { updates } = planProductSave(raw, editingId, pForm);
      await saveUpdates(warehouse.id, updates);
    }, editingId ? "Product updated." : "Product added.");
    if (ok) { setPForm(EMPTY_PRODUCT); setEditingId(null); }
  };

  function editProduct(p) {
    setEditingId(p.id);
    setPForm({ name: p.name, category: p.category, unitPrice: String(p.unitPrice), reorderLevel: String(p.reorderLevel), supplierId: p.supplierId, unit: p.unit });
    setMsg(null);
    document.getElementById("product-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const saveBox = (e) => {
    e.preventDefault();
    return run(async () => saveStockChange(warehouse.id, raw, boxId, boxProduct || null, boxQty === "" ? 0 : boxQty), "Stock updated.");
  };

  const productsById = Object.fromEntries((view?.products || []).map((p) => [p.id, p]));
  const selectedBox = view?.boxes.find((b) => b.id === boxId);

  return (
    <Layout user={user} warehouse={warehouse}>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {loading && !error && <p className="text-sm text-slate-400">Loading warehouse…</p>}
      {msg && <div className="mb-4 sticky top-2 z-30"><Notice kind={msg.kind}>{msg.text}</Notice></div>}

      {view && (
        <>
          <Panel title="Warehouse details" subtitle={`Document ${warehouse.id}`}>
            <form onSubmit={saveInfo} className="grid gap-4 sm:grid-cols-2">
              <Label text="Name">
                <input className={inputCls} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required />
              </Label>
              <Label text="Location">
                <input className={inputCls} value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} required />
              </Label>
              <Label text="Status">
                <select className={inputCls} value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Label>
              <Label text="Total capacity (units)">
                <input type="number" min="1" className={inputCls} value={info.totalCapacityUnits} onChange={(e) => setInfo({ ...info, totalCapacityUnits: e.target.value })} required />
              </Label>
              <div className="sm:col-span-2">
                <button className={primaryBtn} disabled={busy}>Save details</button>
              </div>
            </form>
          </Panel>

          <Panel title="Stock in boxes" subtitle="Click a box, then choose what it holds and how many units" className="mt-6">
            <div className="rounded-xl border border-edge bg-night/60 p-5">
              <BoxGrid boxes={view.boxes} productsById={productsById} selectedId={boxId} onSelect={selectBox} />
            </div>

            {selectedBox ? (
              <form onSubmit={saveBox} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Label text={`Product in ${selectedBox.id}`}>
                  <select className={inputCls} value={boxProduct} onChange={(e) => { setBoxProduct(e.target.value); if (!e.target.value) setBoxQty(""); }}>
                    <option value="">Empty (no product)</option>
                    {view.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Label>
                <Label text={`Units (max ${selectedBox.capacity})`}>
                  <input type="number" min="0" max={selectedBox.capacity} className={inputCls} value={boxQty} disabled={!boxProduct}
                    onChange={(e) => setBoxQty(e.target.value)} placeholder={boxProduct ? "0" : "—"} />
                </Label>
                <button className={primaryBtn} disabled={busy}>Save box</button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No box selected.</p>
            )}
          </Panel>

          <Panel title="Products" subtitle={`${view.products.length} products`} className="mt-6">
            <div className="overflow-x-auto rounded-xl border border-edge">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-edge text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Reorder at</th>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {view.products.map((p) => (
                    <tr key={p.id} className="border-b border-edge last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-3">{p.category}</td>
                      <td className="px-4 py-3">₹{p.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {p.stock} <Chip tone={p.level === "low" ? "low" : p.level === "watch" ? "watch" : "ok"}>{p.level === "ok" ? "OK" : p.level === "watch" ? "Watch" : "Low"}</Chip>
                      </td>
                      <td className="px-4 py-3">{p.reorderLevel}</td>
                      <td className="px-4 py-3">{p.supplierId}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => editProduct(p)} className="text-azure-light underline underline-offset-2 hover:text-white">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form id="product-form" onSubmit={saveProduct} className="mt-6 rounded-xl border border-edge bg-night/60 p-5">
              <h3 className="text-base font-medium text-white">{editingId ? `Edit ${productsById[editingId]?.name || editingId}` : "Add a product"}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Label text="Name">
                  <input className={inputCls} value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required />
                </Label>
                <Label text="Category">
                  <input list="categories" className={inputCls} value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} />
                  <datalist id="categories">
                    {["Electronics", "Accessories", "Furniture", "Networking"].map((c) => <option key={c} value={c} />)}
                  </datalist>
                </Label>
                <Label text="Unit">
                  <input className={inputCls} value={pForm.unit} onChange={(e) => setPForm({ ...pForm, unit: e.target.value })} />
                </Label>
                <Label text="Unit price (₹)">
                  <input type="number" min="0" className={inputCls} value={pForm.unitPrice} onChange={(e) => setPForm({ ...pForm, unitPrice: e.target.value })} required />
                </Label>
                <Label text="Reorder level">
                  <input type="number" min="0" className={inputCls} value={pForm.reorderLevel} onChange={(e) => setPForm({ ...pForm, reorderLevel: e.target.value })} required />
                </Label>
                <Label text="Supplier ID">
                  <input className={inputCls} value={pForm.supplierId} placeholder="supplier_01" onChange={(e) => setPForm({ ...pForm, supplierId: e.target.value })} />
                </Label>
              </div>
              <div className="mt-4 flex gap-3">
                <button className={primaryBtn} disabled={busy}>{editingId ? "Save changes" : "Add product"}</button>
                {editingId && (
                  <button type="button" className={ghostBtn} onClick={() => { setEditingId(null); setPForm(EMPTY_PRODUCT); }}>Cancel</button>
                )}
              </div>
            </form>
          </Panel>
        </>
      )}
    </Layout>
  );
}
