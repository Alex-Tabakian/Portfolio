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
  serverTimestamp
} from 'firebase/firestore';

import { useNavigate } from 'react-router-dom';

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

  // helpers to add/remove part to build.form.parts
  function addPartToForm(part) {
    setError(''); setStatus('');
    // if already added, increase qty
    setForm(state => {
      const exists = (state.parts || []).find(p => p.id === part.id);
      if (exists) {
        return {
          ...state,
          parts: state.parts.map(p => p.id === part.id ? { ...p, qty: (Number(p.qty)||1) + 1 } : p)
        };
      } else {
        return { ...state, parts: [...(state.parts||[]), { id: part.id, name: part.name, type: part.type, price: part.price || 0, qty: 1 }] };
      }
    });
  }

  function removePartFromForm(partId) {
    setForm(state => ({ ...state, parts: (state.parts || []).filter(p => p.id !== partId) }));
  }

  function setPartQty(partId, qty) {
    setForm(state => ({ ...state, parts: (state.parts || []).map(p => p.id === partId ? { ...p, qty: Number(qty)||0 } : p) }));
  }

  // create build in firestore
  async function handleCreateBuild(e) {
    e?.preventDefault?.();
    setError(''); setStatus('');
    if (!user) return setError('You must be signed in to save builds.');
    if (!form.name) return setError('Enter a build name.');
    if (!form.parts || form.parts.length === 0) return setError('Add at least one part.');

    setStatus('Saving build...');
    try {
      const payload = {
        name: form.name,
        notes: form.notes || '',
        parts: form.parts.map(p => ({ id: p.id, name: p.name, type: p.type, price: Number(p.price)||0, qty: Number(p.qty)||1 })),
        total: buildTotal,
        uuid: makeUUID(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'users', user.uid, 'builds'), payload);
      setForm({ name:'', notes:'', parts:[] });
      setStatus('Saved.');
      setTimeout(()=>setStatus(''), 1200);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Save failed');
    } finally {
      setStatus('');
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
      await updateDoc(ref, {
        name: form.name,
        notes: form.notes || '',
        parts: form.parts.map(p => ({ id: p.id, name: p.name, type: p.type, price: Number(p.price)||0, qty: Number(p.qty)||1 })),
        total: buildTotal,
        updatedAt: serverTimestamp()
      });
      setEditing(null);
      setForm({ name:'', notes:'', parts:[] });
      setStatus('Updated.');
      setTimeout(()=>setStatus(''), 1000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Update failed');
    } finally {
      setStatus('');
    }
  }

  async function handleDeleteBuild(id) {
  if (!window.confirm('Delete this build?')) return;
    setError(''); setStatus('Deleting...');
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'builds', id));
      setStatus('Deleted.');
      setTimeout(()=>setStatus(''), 1000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Delete failed');
    } finally {
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
      <div style={{maxWidth:900, margin:'40px auto', padding:20}}>
        <h2>Builds</h2>
        <div className="muted">Sign in to create and manage builds.</div>
      </div>
    );
  }

  return (
    <div style={{maxWidth:980, margin:'24px auto', padding:20, background:'#fff', borderRadius:10, boxShadow:'0 6px 18px rgba(2,6,23,0.06)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2 style={{margin:0}}>Builds</h2>
        <div style={{display:'flex', gap:8}}>
          <button className="btn ghost" onClick={()=>navigate('/inventory')}>Open Inventory</button>
        </div>
      </div>

      <form onSubmit={editing ? handleSaveEdit : handleCreateBuild} style={{marginTop:16, display:'grid', gap:12}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <div style={{flex: '1 1 320px'}}>
            <label style={{fontSize:12, color:'#64748b'}}>Build name</label>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. Gaming rig #1" />
          </div>

          <div style={{flex: '1 1 200px'}}>
            <label style={{fontSize:12, color:'#64748b'}}>Notes</label>
            <input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Optional notes" />
          </div>

          <div style={{flex: '0 0 160px', display:'flex', alignItems:'flex-end', gap:8}}>
            <button className="btn" type="submit">{editing ? 'Save build' : 'Create build'}</button>
            {editing && <button type="button" className="btn ghost" onClick={()=>{ setEditing(null); setForm({ name:'', notes:'', parts:[] }); }}>Cancel</button>}
            <div style={{marginLeft:'auto'}} className="muted">{status || ''}</div>
          </div>
        </div>

        {/* Parts selector */}
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-start'}}>
          <div style={{flex:'1 1 360px', minWidth:280}}>
            <label style={{fontSize:12, color:'#64748b'}}>Select part to add</label>
            <div style={{display:'flex', gap:8, marginTop:6}}>
              <select onChange={e=>handleSelectPart(e.target.value)} style={{flex:1}}>
                <option value="">— choose a part —</option>
                {Object.keys(partsByType).map(type => (
                  <optgroup key={type} label={type}>
                    {partsByType[type].map(p => <option key={p.id} value={p.id}>{p.name} — ${Number(p.price||0).toFixed(2)}</option>)}
                  </optgroup>
                ))}
              </select>
              <button type="button" className="btn ghost" onClick={()=>{ /* show add-part page */ navigate('/inventory'); }}>Add part</button>
            </div>

            <div style={{marginTop:10, color:'#64748b', fontSize:13}}>Tip: choosing a part adds it to the build (qty increments if already present).</div>
          </div>

          {/* Selected parts */}
          <div style={{flex:'1 1 360px', minWidth:280}}>
            <label style={{fontSize:12, color:'#64748b'}}>Selected parts</label>
            <div style={{marginTop:8, display:'grid', gap:8}}>
              {(!form.parts || form.parts.length === 0) ? (
                <div className="muted">No parts added yet.</div>
              ) : form.parts.map(p => (
                <div key={p.id} style={{display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', padding:8, border:'1px solid #eef5fb', borderRadius:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>{p.name} <small style={{color:'#64748b', marginLeft:8}}>{p.type}</small></div>
                    <div className="muted" style={{fontSize:13}}>Unit: ${Number(p.price||0).toFixed(2)}</div>
                  </div>

                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input type="number" value={p.qty} min="1" style={{width:72}} onChange={e=>setPartQty(p.id, e.target.value)} />
                    <button type="button" className="btn ghost" onClick={()=>removePartFromForm(p.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:12, fontWeight:700}}>Total: ${buildTotal.toFixed(2)}</div>
          </div>
        </div>
      </form>

      <hr style={{margin:'18px 0'}} />

      <div>
        <h3 style={{marginTop:0}}>Your builds</h3>
        {loadingBuilds ? <div className="muted">Loading…</div> : (
          builds.length === 0 ? <div className="muted">No builds yet.</div> : (
            <div style={{display:'grid', gap:10}}>
              {builds.map(b => (
                <div key={b.id} style={{display:'flex', justifyContent:'space-between', gap:12, alignItems:'center', padding:12, border:'1px solid #eef5fb', borderRadius:8}}>
                  <div>
                    <div style={{fontWeight:700}}>{b.name} <small style={{color:'#64748b', marginLeft:8}}>{b.uuid || b.id}</small></div>
                    <div className="muted" style={{fontSize:13}}>{(b.parts || []).length} parts • ${Number(b.total||0).toFixed(2)}</div>
                    {b.notes && <div style={{marginTop:6}} className="muted">{b.notes}</div>}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button className="btn ghost" onClick={()=>startEdit(b)}>Edit</button>
                    <button className="btn danger" onClick={()=>handleDeleteBuild(b.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
