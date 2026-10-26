import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";

const KEY = "twinmind.warehouse";

// Warehouse name lives in a field called "name" (or a close variant); fall back to the document id.
function toWarehouse(snap) {
  const d = snap.data();
  const name = d.warehouse_details?.name || d.name || d.warehouseName || d.warehouse_name || snap.id;
  return { id: snap.id, name };
}

// Accepts either the document id (e.g. W001) or the warehouse name.
export async function findWarehouse(input) {
  const raw = input.trim();
  if (!raw) return null;

  for (const id of new Set([raw, raw.toUpperCase()])) {
    const snap = await getDoc(doc(db, "warehouses", id));
    if (snap.exists()) return toWarehouse(snap);
  }
  for (const field of ["warehouse_details.name", "name", "warehouseName"]) {
    const res = await getDocs(query(collection(db, "warehouses"), where(field, "==", raw), limit(1)));
    if (!res.empty) return toWarehouse(res.docs[0]);
  }
  return null;
}

export function loadStoredWarehouse() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function storeWarehouse(uid, warehouse) {
  const value = { uid, ...warehouse };
  localStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export function clearStoredWarehouse() {
  localStorage.removeItem(KEY);
}
