import {
  collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, Timestamp, getDocs, writeBatch
} from "firebase/firestore";
import { db } from "../firebase";

const LOCAL_KEY = "pclogr:parts:local";

export function partsColRef(uid) {
  return collection(db, "users", uid, "parts");
}

export async function addPartToCloud(uid, part) {
  const payload = {
    ...part,
    price: Number(part.price) || 0,
    qty: Number(part.qty) || 1,
    purchaseDate: part.purchaseDate ? (part.purchaseDate instanceof Date ? Timestamp.fromDate(part.purchaseDate) : (part.purchaseDate.seconds ? part.purchaseDate : Timestamp.fromDate(new Date(part.purchaseDate)))) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  return await addDoc(partsColRef(uid), payload);
}

export async function updatePartInCloud(uid, docId, fields) {
  const ref = doc(db, "users", uid, "parts", docId);
  await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() });
}

export function subscribeToParts(uid, onChange, onError) {
  const q = query(partsColRef(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    onChange(items);
  }, onError);
}

// local storage helpers
export function savePartsLocally(parts) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(parts || []));
}
export function loadLocalParts() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
}
export function clearLocalParts() { localStorage.removeItem(LOCAL_KEY); }

// naive batch sync with dedupe by uuid (improves speed using a batch)
export async function syncLocalToCloud(uid) {
  const local = loadLocalParts();
  if (!local || local.length === 0) return;
  // fetch cloud uuids to avoid duplicates
  const snap = await getDocs(partsColRef(uid));
  const cloud = [];
  snap.forEach(d => cloud.push({ id: d.id, ...d.data() }));
  const cloudUuids = new Set(cloud.map(c => c.uuid).filter(Boolean));

  const batch = writeBatch(db);
  let any = false;
  for (const p of local) {
    if (p.uuid && cloudUuids.has(p.uuid)) continue; // skip duplicate
    // create new doc with client-supplied fields; keep uuid if present
    const payload = {
      ...p,
      price: Number(p.price) || 0,
      qty: Number(p.qty) || 1,
      purchaseDate: p.purchaseDate ? (p.purchaseDate._seconds ? p.purchaseDate : Timestamp.fromDate(new Date(p.purchaseDate))) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    // use addDoc via generated ref in batch: create doc ref with random id and set
    const newRef = doc(partsColRef(uid));
    batch.set(newRef, payload);
    any = true;
  }
  if (any) await batch.commit();
  clearLocalParts();
}
