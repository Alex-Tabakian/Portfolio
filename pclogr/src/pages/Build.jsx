// src/pages/Build.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const PART_ORDER = [
  "CPU",
  "COOLER",
  "MOTHERBOARD",
  "RAM",
  "STORAGE",
  "GRAPHICS CARD",
  "GPU",
  "CASE",
  "PSU",
  "POWER SUPPLY",
];

function sortPartsByType(parts) {
  return [...parts].sort((a, b) => {
    const typeA = (a.type || "OTHER").toUpperCase();
    const typeB = (b.type || "OTHER").toUpperCase();

    const indexA = PART_ORDER.indexOf(typeA);
    const indexB = PART_ORDER.indexOf(typeB);

    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;

    return orderA - orderB;
  });
}

function makeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Build() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [parts, setParts] = useState([]); // all parts for the user
  const [loadingParts, setLoadingParts] = useState(true);

  const [builds, setBuilds] = useState([]);
  const [loadingBuilds, setLoadingBuilds] = useState(true);

  const [form, setForm] = useState({
    name: '',
    notes: '',
    parts: [] // array of { id, name, type, price, qty }
  });
  const [editing, setEditing] = useState(null); // { id, ...data }
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // part collection ref memoized
  useEffect(() => {
    if (!user) {
      setParts([]); setLoadingParts(false);
      setBuilds([]); setLoadingBuilds(false);
      return;
    }

    setLoadingParts(true);
    const partsQ = query(collection(db, 'users', user.uid, 'parts'), orderBy('createdAt', 'desc'));
    const unsubParts = onSnapshot(partsQ, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setParts(arr);
      setLoadingParts(false);
    }, err => {
      console.error('parts onSnapshot error', err);
      setLoadingParts(false);
    });

    setLoadingBuilds(true);
    const buildsQ = query(collection(db, 'users', user.uid, 'builds'), orderBy('createdAt', 'desc'));
    const unsubBuilds = onSnapshot(buildsQ, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setBuilds(arr);
      setLoadingBuilds(false);
    }, err => {
      console.error('builds onSnapshot error', err);
      setLoadingBuilds(false);
    });

    return () => {
      unsubParts(); unsubBuilds();
    };
  }, [user]);

  // derived grouped parts by type for selection UI
  const partsByType = useMemo(() => {
    const map = {};
    parts.forEach(p => {
      const t = p.type || 'Other';
      if (!map[t]) map[t] = [];
      map[t].push(p);
    });
    return map;
  }, [parts]);

  // total price for selected parts
  const buildTotal = useMemo(() => {
    return (form.parts || []).reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.qty) || 1)), 0);
  }, [form.parts]);

  function getInventoryQty(partId) {
    const p = parts.find(x => x.id === partId);
    return Number(p?.qty || 0);
  }

  function getUsedInForm(partId) {
    return (form.parts || []).reduce((s, p) => p.id === partId ? s + (Number(p.qty || 0)) : s, 0);
  }

  function addPartToForm(part) {
    setError(''); setStatus('');
    setForm(state => {
      const used = (state.parts || []).reduce((s, p) => p.id === part.id ? s + (Number(p.qty || 0)) : s, 0);
      const available = Number(part.qty || 0) - used;

      if (available <= 0) {
        setError(`No more "${part.name}" available (only ${part.qty || 0} in inventory).`);
        return state; // don't change form
      }

      const exists = (state.parts || []).find(p => p.id === part.id);
      if (exists) {
        return {
          ...state,
          parts: state.parts.map(p => p.id === part.id ? { ...p, qty: (Number(p.qty) || 1) + 1 } : p)
        };
      } else {
        return { ...state, parts: [...(state.parts || []), { id: part.id, name: part.name, type: part.type, price: part.price || 0, qty: 1 }] };
      }
    });
  }


  function removePartFromForm(partId) {
    setForm(state => ({ ...state, parts: (state.parts || []).filter(p => p.id !== partId) }));
  }

  function setPartQty(partId, qty) {
    setError('');
    const parsed = Number(qty) || 0;
    // compute available in inventory (including all uses in form except this item's current qty)
    const inventoryQty = getInventoryQty(partId);
    const usedElsewhere = (form.parts || []).reduce((s, p) => {
      if (p.id !== partId) return s + (Number(p.qty || 0));
      return s;
    }, 0);
    // available for this line = inventoryQty - usedElsewhere
    const maxForThis = Math.max(0, inventoryQty - usedElsewhere);

    if (parsed > maxForThis) {
      setError(`Requested ${parsed} exceeds available stock (${maxForThis}).`);
    }

    setForm(state => ({ ...state, parts: (state.parts || []).map(p => p.id === partId ? { ...p, qty: Math.max(0, Math.min(parsed, maxForThis)) } : p) }));
  }


  // helper: addDoc with a timeout to avoid hanging forever
  function addDocWithTimeout(collectionRef, payload, ms = 10000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`addDoc timed out after ${ms}ms`));
      }, ms);

      addDoc(collectionRef, payload)
        .then(res => {
          if (settled) return; // already timed out
          settled = true;
          clearTimeout(timer);
          resolve(res);
        })
        .catch(err => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });


    });


  }

  async function handleCreateBuild(e) {
    e?.preventDefault?.();

    // clear previous UI state
    setError('');
    setStatus('');

    console.log('handleCreateBuild START', { user: user ? user.uid : null, form });

    if (!user) {
      setError('You must be signed in to save builds.');
      console.warn('No user - aborting save');
      return;
    }
    if (!form.name) {
      setError('Enter a build name.');
      return;
    }
    if (!form.parts || form.parts.length === 0) {
      setError('Add at least one part.');
      return;
    }

    // FINAL validation: ensure requested quantities still available in inventory
    for (const p of form.parts) {
      const inv = parts.find(x => x.id === p.id);
      const invQty = Number(inv?.qty || 0);
      if (Number(p.qty || 0) > invQty) {
        setError(`Cannot create build: requested ${p.qty} x "${p.name}" but only ${invQty} available.`);
        setStatus('');
        return;
      }
    }

    setStatus('Saving build...');
    const payload = {
      name: form.name,
      notes: form.notes || '',
      parts: sortPartsByType(form.parts).map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        price: Number(p.price) || 0,
        qty: Number(p.qty) || 1
      })),
      total: buildTotal,
      uuid: makeUUID(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      console.log('Attempting addDoc to', `users/${user.uid}/builds`, payload);

      const ref = await addDocWithTimeout(collection(db, 'users', user.uid, 'builds'), payload, 10000);
      console.log('addDoc succeeded, id:', ref.id);

      // for each selected part in the build
      for (const part of form.parts) {
        const originalRef = doc(db, "users", user.uid, "parts", part.id);
        const original = parts.find(p => p.id === part.id);

        if (!original) continue;

        const originalQty = Number(original.qty || 0);
        const qtyWanted = Number(part.qty || 0);
        const remaining = originalQty - qtyWanted;

        // 1. Update or delete the original inventory part
        if (remaining > 0) {
          await updateDoc(originalRef, { qty: remaining });
        } else {
          await deleteDoc(originalRef);
        }

        // 2. Create a new "in_build" part item
        await addDoc(collection(db, "users", user.uid, "parts"), {
          name: original.name,
          type: original.type,
          price: original.price,
          qty: qtyWanted,
          status: "in_build",
          linkedBuildId: ref.id,
          sourcePartId: part.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Reset the form (we rely on onSnapshot for list update)
      setForm({ name: '', notes: '', parts: [] });

      // Show success (and clear after a short delay)
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1200);

    } catch (err) {
      console.error('handleCreateBuild error:', err);

      // Friendly error message
      if (err && err.code === 'permission-denied') {
        setError('Permission denied: check Firestore rules for this user/path.');
      } else {
        setError(err.message || 'Save failed');
      }
    } finally {
      // GUARANTEE that "Saving build..." is not left forever:
      // If the visible status is the "Saving..." string, clear it after a short delay.
      // Use functional update to avoid stale-closure issues.
      setTimeout(() => {
        setStatus(prev => (prev === 'Saving build...' ? '' : prev));
      }, 600);

      console.log('handleCreateBuild END');
    }
  }


  // start editing build: populate form with build data
  function startEdit(build) {
    setEditing(build);
    setForm({
      name: build.name || '',
      notes: build.notes || '',
      parts: (build.parts || []).map(p => ({ ...p })) // shallow copy
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveEdit(e) {
    e?.preventDefault?.();
    if (!editing || !editing.id) return;
    setError(''); setStatus('Updating...');
    try {
      const ref = doc(db, 'users', user.uid, 'builds', editing.id);

      // after successful updateDoc(...)
      await updateDoc(ref, {
        name: form.name,
        notes: form.notes || '',
        parts: sortPartsByType(form.parts).map(p => ({ id: p.id, name: p.name, type: p.type, price: Number(p.price) || 0, qty: Number(p.qty) || 1 })),
        total: buildTotal,
        updatedAt: serverTimestamp()
      });

      // optimistic local update
      setBuilds(prev => prev.map(b => {
        if (b.id !== editing.id) return b;
        return {
          ...b,
          name: form.name,
          notes: form.notes || '',
          parts: sortPartsByType(form.parts).map(p => ({ id: p.id, name: p.name, type: p.type, price: Number(p.price) || 0, qty: Number(p.qty) || 1 })),
          total: buildTotal,
          updatedAt: new Date().toISOString()
        };
      }));

      setEditing(null);
      setForm({ name: '', notes: '', parts: [] });
      setStatus('Updated.');
      setTimeout(() => setStatus(''), 1000);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Update failed');
    } finally {
      setStatus('');
    }
  }

  async function handleDeleteBuild(id) {
    if (!window.confirm('Delete this build?')) return;

    // Ask whether to return parts to inventory
    const shouldReturn = window.confirm('Return parts to inventory? Click OK to return parts, Cancel to permanently remove them.');

    setError('');
    setStatus('Deleting...');

    try {
      // find the build object in local state (no extra read required)
      const build = builds.find(b => b.id === id);
      if (!build) {
        throw new Error('Build not found in client state.');
      }

      // fetch all parts for this user once (we'll search client-side)
      const allPartsSnap = await getDocs(collection(db, 'users', user.uid, 'parts'));
      const allParts = allPartsSnap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));

      if (shouldReturn && Array.isArray(build.parts) && build.parts.length > 0) {
        // ---- existing return-to-inventory logic (unchanged) ----
        for (const bp of build.parts) {
          const wantQty = Number(bp.qty || 0);
          if (wantQty <= 0) continue;

          // Find in-build docs that were created for this build and reference this original part.
          const inBuildDocs = allParts.filter(p =>
            p.data && p.data.linkedBuildId === id && (p.data.sourcePartId === bp.id || p.data.sourcePartId === String(bp.id))
          );

          // fallback - match by linkedBuildId + name/type
          if (inBuildDocs.length === 0) {
            const fallback = allParts.filter(p =>
              p.data && p.data.linkedBuildId === id &&
              ((p.data.name && p.data.name === bp.name) || (p.data.type && p.data.type === bp.type))
            );
            inBuildDocs.push(...fallback);
          }

          // if still none, try updating original by id or create a new inventory doc
          if (inBuildDocs.length === 0) {
            const originalById = allParts.find(p => p.id === bp.id);
            if (originalById) {
              const newQty = (Number(originalById.data.qty || 0) + wantQty);
              await updateDoc(originalById.ref, { qty: newQty, updatedAt: serverTimestamp(), status: 'in_inventory' });
            } else {
              await addDoc(collection(db, 'users', user.uid, 'parts'), {
                name: bp.name || 'Unknown',
                type: bp.type || 'Other',
                price: bp.price || 0,
                qty: wantQty,
                status: 'in_inventory',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                restoredFromBuildId: id,
                sourcePartId: bp.id
              });
            }
            continue;
          }

          // consume in-build docs until we've returned wantQty
          let remainingToReturn = wantQty;

          for (const inDoc of inBuildDocs) {
            if (remainingToReturn <= 0) break;

            const inData = inDoc.data || {};
            const inQty = Number(inData.qty || 0);
            const take = Math.min(inQty, remainingToReturn);

            // find inventory doc to merge into (by sourcePartId, name/type fallback)
            let inventoryDoc = allParts.find(p => p.id === inData.sourcePartId);
            if (!inventoryDoc) {
              inventoryDoc = allParts.find(p => p.data && p.data.sourcePartId === inData.sourcePartId && p.data.status !== 'in_build');
            }
            if (!inventoryDoc) {
              inventoryDoc = allParts.find(p =>
                p.data && p.data.name === inData.name && p.data.type === inData.type && p.data.status !== 'in_build'
              );
            }

            if (inventoryDoc) {
              const updatedQty = (Number(inventoryDoc.data.qty || 0) + take);
              await updateDoc(inventoryDoc.ref, { qty: updatedQty, updatedAt: serverTimestamp(), status: 'in_inventory' });
              inventoryDoc.data.qty = updatedQty;
            } else {
              const createdRef = await addDoc(collection(db, 'users', user.uid, 'parts'), {
                name: inData.name || bp.name || 'Unknown',
                type: inData.type || bp.type || 'Other',
                price: inData.price || bp.price || 0,
                qty: take,
                status: 'in_inventory',
                sourcePartId: inData.sourcePartId || bp.id,
                restoredFromBuildId: id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              allParts.push({ id: createdRef.id, ref: createdRef, data: { name: inData.name, type: inData.type, qty: take, status: 'in_inventory', sourcePartId: inData.sourcePartId } });
            }

            // decrement or delete the in-build doc
            if (inQty > take) {
              const newInQty = inQty - take;
              await updateDoc(inDoc.ref, { qty: newInQty, updatedAt: serverTimestamp() });
              inDoc.data.qty = newInQty;
            } else {
              await deleteDoc(inDoc.ref);
              const idx = allParts.findIndex(x => x.id === inDoc.id);
              if (idx !== -1) allParts.splice(idx, 1);
            }

            remainingToReturn -= take;
          }

          // if anything still remaining, create an inventory doc for remainder
          if (remainingToReturn > 0) {
            await addDoc(collection(db, 'users', user.uid, 'parts'), {
              name: bp.name || 'Unknown',
              type: bp.type || 'Other',
              price: bp.price || 0,
              qty: remainingToReturn,
              status: 'in_inventory',
              sourcePartId: bp.id,
              restoredFromBuildId: id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } // end loop over build.parts

      } else {
        // ---- NEW: user chose NOT to return parts -> delete any in_build parts for this build ----
        // Remove any parts that belong to this build (status: 'in_build' and linkedBuildId === id)
        const inBuildParts = allParts.filter(p => p.data && String(p.data.linkedBuildId) === String(id));
        if (inBuildParts.length > 0) {
          const deletes = inBuildParts.map(p => deleteDoc(p.ref));
          await Promise.all(deletes);
        }
        // Note: original inventory docs (those not marked in_build) are left untouched.
      }

      // Finally delete the build doc itself
      await deleteDoc(doc(db, 'users', user.uid, 'builds', id));

      setStatus('Deleted.');
      setTimeout(() => setStatus(''), 1200);

    } catch (err) {
      console.error('handleDeleteBuild error', err);
      setError(err.message || 'Delete failed');
      setStatus('');
    }
  }



  // quick helper: when selecting a part from list, push into form.parts
  function handleSelectPart(partId) {
    const p = parts.find(x => x.id === partId);
    if (p) addPartToForm(p);
  }

  // UI
  if (!user) {
    return (
      <div style={{ maxWidth: 900, margin: '40px auto', padding: 20 }}>
        <h2>Builds</h2>
        <div className="muted">Sign in to create and manage builds.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Builds</h2>
      </div>

      <form onSubmit={editing ? handleSaveEdit : handleCreateBuild} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Build name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gaming rig #1" />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Notes</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          </div>

          <div style={{ flex: '0 0 160px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button className="btn" type="submit">{editing ? 'Save build' : 'Create build'}</button>
            {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm({ name: '', notes: '', parts: [] }); }}>Cancel</button>}
            <div style={{ marginLeft: 'auto' }} className="muted">{status || ''}</div>
          </div>
        </div>

        {/* Parts selector */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 360px', minWidth: 280 }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Select part to add</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <select onChange={e => handleSelectPart(e.target.value)} style={{ flex: 1 }}>
                <option value="">— choose a part —</option>
                {Object.keys(partsByType).map(type => (
                  <optgroup key={type} label={type}>
                    {partsByType[type].filter(p => p.status === "in_inventory").map(p => <option key={p.id} value={p.id}>{p.name} — ${Number(p.price || 0).toFixed(2)}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10, color: '#64748b', fontSize: 13 }}>Tip: choosing a part adds it to the build (qty increments if already present).</div>
          </div>

          {/* Selected parts */}
          <div style={{ flex: '1 1 360px', minWidth: 280 }}>
            <label style={{ fontSize: 12, color: '#64748b' }}>Selected parts</label>
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {(!form.parts || form.parts.length === 0) ? (
                <div className="muted">No parts added yet.</div>
              ) : sortPartsByType(form.parts).map(p => (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: 8, border: '1px solid #eef5fb', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name} <small style={{ color: '#64748b', marginLeft: 8 }}>{p.type}</small></div>
                    <div className="muted" style={{ fontSize: 13 }}>Unit: ${Number(p.price || 0).toFixed(2)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" value={p.qty} min="1" style={{ width: 72 }} onChange={e => setPartQty(p.id, e.target.value)} />
                    <button type="button" className="btn ghost" onClick={() => removePartFromForm(p.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, fontWeight: 700 }}>Total: ${buildTotal.toFixed(2)}</div>
          </div>
        </div>
      </form>

      <hr style={{ margin: '18px 0' }} />

      <div>
        <h3 style={{ marginTop: 0 }}>Your builds</h3>
        {loadingBuilds ? <div className="muted">Loading…</div> : (
          builds.length === 0 ? <div className="muted">No builds yet.</div> : (
            <div style={{ display: 'grid', gap: 10 }}>
              {builds.map(b => {
                // extract CPU + GPU from the build's parts
                const cpu = (b.parts || []).find(p => p.type?.toUpperCase() === "CPU");
                const gpu = (b.parts || []).find(
                  p => ["GPU", "GRAPHICS CARD"].includes(p.type?.toUpperCase())
                );

                return (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      padding: 12,
                      border: '1px solid #eef5fb',
                      borderRadius: 8
                    }}
                  >
                    <div>
                      {/* Build Name (no UUID) */}
                      <div style={{ fontWeight: 700 }}>{b.name}</div>

                      {/* CPU and GPU summary */}
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {cpu ? `CPU: ${cpu.name}` : "CPU: —"}
                        {" • "}
                        {gpu ? `GPU: ${gpu.name}` : "GPU: —"}
                      </div>

                      {/* Part count + total */}
                      <div className="muted" style={{ fontSize: 13 }}>
                        {(b.parts || []).length} parts • ${Number(b.total || 0).toFixed(2)}
                      </div>

                      {/* Optional Notes */}
                      {b.notes && (
                        <div style={{ marginTop: 6 }} className="muted">
                          {b.notes}
                        </div>
                      )}
                    </div>

                    {/* Edit / Delete buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn ghost" onClick={() => startEdit(b)}>
                        Edit
                      </button>
                      <button className="btn danger" onClick={() => handleDeleteBuild(b.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}

            </div>
          )
        )}
      </div>
    </div>
  );
}
