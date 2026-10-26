// Pure helpers for the warehouse document (no Firebase imports, so they can be tested alone).
//
// warehouses/{id} holds three maps:
//   Storage            box_001..box_050  { box_capacity, product_id|null, quantity_stored, shelf_row, shelf_col, status }
//   products           product_001..     { product_details{...}, storage{ box_x: {...} } }
//   warehouse_details  { name, location, status, total_capacity_units, current_stock_units, Dimensions{...} }

export function normalize(data) {
  const storage = data?.Storage || {};
  const prodMap = data?.products || {};
  const details = data?.warehouse_details || {};

  const boxes = Object.entries(storage)
    .map(([id, b]) => ({
      id,
      capacity: Number(b.box_capacity) || 0,
      productId: b.product_id || null,
      qty: Number(b.quantity_stored) || 0,
      row: Number(b.shelf_row) || 0,
      col: Number(b.shelf_col) || 0,
    }))
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const stockBy = {};
  const boxCountBy = {};
  for (const b of boxes) {
    if (b.productId && b.qty > 0) {
      stockBy[b.productId] = (stockBy[b.productId] || 0) + b.qty;
      boxCountBy[b.productId] = (boxCountBy[b.productId] || 0) + 1;
    }
  }

  const products = Object.entries(prodMap)
    .map(([id, p]) => {
      const d = p.product_details || {};
      const stock = stockBy[id] || 0;
      const reorderLevel = Number(d.reorder_level) || 0;
      const level = stock <= reorderLevel ? "low" : stock <= reorderLevel * 1.5 ? "watch" : "ok";
      return {
        id,
        name: d.name || id,
        category: d.category || "",
        unitPrice: Number(d.unit_price) || 0,
        reorderLevel,
        supplierId: d.supplier_id || "",
        unit: d.unit || "pcs",
        stock,
        boxCount: boxCountBy[id] || 0,
        level,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const stockUnits = boxes.reduce((s, b) => s + (b.productId ? b.qty : 0), 0);
  const capacitySum = boxes.reduce((s, b) => s + b.capacity, 0);
  const occupied = boxes.filter((b) => b.productId && b.qty > 0).length;

  return {
    info: {
      name: details.name || "",
      location: details.location || "",
      status: details.status || "active",
      totalCapacityUnits: Number(details.total_capacity_units) || capacitySum,
    },
    boxes,
    products,
    totals: {
      totalBoxes: boxes.length,
      occupied,
      empty: boxes.length - occupied,
      stockUnits,
      capacityUnits: Number(details.total_capacity_units) || capacitySum,
      lowStock: products.filter((p) => p.level === "low").length,
      watch: products.filter((p) => p.level === "watch").length,
    },
  };
}

const int = (v) => Number.parseInt(v, 10);

// Edit the warehouse's own details.
export function planWarehouseSave(f) {
  const name = String(f.name || "").trim();
  const location = String(f.location || "").trim();
  const cap = int(f.totalCapacityUnits);
  if (!name) throw new Error("Enter a warehouse name.");
  if (!location) throw new Error("Enter a location.");
  if (!Number.isFinite(cap) || cap <= 0) throw new Error("Capacity must be a number above 0.");
  return {
    "warehouse_details.name": name,
    "warehouse_details.location": location,
    "warehouse_details.status": f.status === "inactive" ? "inactive" : "active",
    "warehouse_details.total_capacity_units": cap,
  };
}

export function nextProductId(data) {
  const nums = Object.keys(data?.products || {})
    .map((k) => Number(k.replace("product_", "")))
    .filter(Number.isFinite);
  return "product_" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
}

// Add a product (id = null) or edit one.
export function planProductSave(data, id, f) {
  const name = String(f.name || "").trim();
  const price = Number(f.unitPrice);
  const reorder = int(f.reorderLevel);
  if (!name) throw new Error("Enter a product name.");
  if (!Number.isFinite(price) || price < 0) throw new Error("Unit price must be a number, 0 or more.");
  if (!Number.isFinite(reorder) || reorder < 0) throw new Error("Reorder level must be a whole number, 0 or more.");
  const details = {
    name,
    category: String(f.category || "").trim(),
    unit_price: price,
    reorder_level: reorder,
    supplier_id: String(f.supplierId || "").trim(),
    unit: String(f.unit || "pcs").trim() || "pcs",
  };
  if (id) {
    const updates = {};
    for (const [k, v] of Object.entries(details)) updates[`products.${id}.product_details.${k}`] = v;
    return { id, updates };
  }
  const newId = nextProductId(data);
  return { id: newId, updates: { [`products.${newId}`]: { product_details: { ...details, total_quantity: 0 }, storage: {} } } };
}

// Put `quantity` units of `productId` into a box (productId = null or quantity = 0 empties it).
// Keeps Storage, products.*.storage, total_quantity and the warehouse counters in step.
// `REMOVE` is Firestore's deleteField() sentinel (passed in so this file stays Firebase-free).
export function planStockChange(data, boxId, productId, quantity, REMOVE) {
  const box = data?.Storage?.[boxId];
  if (!box) throw new Error("That box doesn't exist.");
  const qty = int(quantity);
  const cap = Number(box.box_capacity) || 0;
  const pid = productId || null;
  if (pid && !data.products?.[pid]) throw new Error("Choose a product from the list.");
  if (pid) {
    if (!Number.isFinite(qty) || qty < 0) throw new Error("Quantity must be a whole number, 0 or more.");
    if (qty > cap) throw new Error(`This box holds at most ${cap} units.`);
  }
  const empty = !pid || qty === 0;
  const oldPid = box.product_id || null;

  const after = JSON.parse(JSON.stringify(data.Storage));
  after[boxId] = { ...after[boxId], product_id: empty ? null : pid, quantity_stored: empty ? 0 : qty, status: empty ? "empty" : "occupied" };

  const sumFor = (p) => Object.values(after).reduce((s, b) => s + (b.product_id === p ? Number(b.quantity_stored) || 0 : 0), 0);
  const updates = {
    [`Storage.${boxId}.product_id`]: after[boxId].product_id,
    [`Storage.${boxId}.quantity_stored`]: after[boxId].quantity_stored,
    [`Storage.${boxId}.status`]: after[boxId].status,
  };

  if (oldPid && (empty || oldPid !== pid) && data.products?.[oldPid]) {
    updates[`products.${oldPid}.storage.${boxId}`] = REMOVE;
    updates[`products.${oldPid}.product_details.total_quantity`] = sumFor(oldPid);
  }
  if (!empty) {
    updates[`products.${pid}.storage.${boxId}`] = {
      box_capacity: cap,
      quantity: qty,
      shelf_col: Number(box.shelf_col),
      shelf_row: Number(box.shelf_row),
    };
    updates[`products.${pid}.product_details.total_quantity`] = sumFor(pid);
  }

  const boxesAfter = Object.values(after);
  const occupied = boxesAfter.filter((b) => b.product_id && Number(b.quantity_stored) > 0).length;
  updates["warehouse_details.current_stock_units"] = boxesAfter.reduce((s, b) => s + (b.product_id ? Number(b.quantity_stored) || 0 : 0), 0);
  updates["warehouse_details.Dimensions.occupied_boxes"] = occupied;
  updates["warehouse_details.Dimensions.empty_boxes"] = boxesAfter.length - occupied;
  return updates;
}
