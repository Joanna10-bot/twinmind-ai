import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase";
import { planStockChange } from "./warehouseLogic";

export async function loadWarehouseData(id) {
  const snap = await getDoc(doc(db, "warehouses", id));
  if (!snap.exists()) throw new Error("Warehouse " + id + " was not found.");
  return snap.data();
}

export async function saveUpdates(id, updates) {
  await updateDoc(doc(db, "warehouses", id), updates);
}

export async function saveStockChange(id, data, boxId, productId, quantity) {
  const updates = planStockChange(data, boxId, productId, quantity, deleteField());
  await updateDoc(doc(db, "warehouses", id), updates);
}

export function friendlyError(e) {
  if (e?.code === "permission-denied") return "Firestore blocked this change. Check the database rules.";
  return e?.message || "Something went wrong. Try again.";
}
