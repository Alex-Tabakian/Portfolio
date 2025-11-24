// src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function Home() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [parts, setParts] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'parts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setParts(items);
    }, (err) => {
      console.error(err);
    });
    return unsub;
  }, [user]);

  const handleSave = async () => {
    if (!name) return alert('Enter a name');
    setStatus('Saving…');
    try {
      await addDoc(collection(db, 'users', user.uid, 'parts'), {
        name, price: parseFloat(price) || 0, qty: 1, createdAt: serverTimestamp()
      });
      setName(''); setPrice('');
      setStatus('Saved.');
      setTimeout(()=>setStatus(''), 1500);
    } catch (err) {
      setStatus('Save failed');
    }
  };

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h1>Welcome, {user?.email}</h1>
          <div className="muted">UID: <small className="code">{user?.uid}</small></div>
        </div>
        <div>
          <button className="btn ghost" onClick={()=>signOut(auth)}>Sign out</button>
        </div>
      </div>

      <section style={{marginTop:16}}>
        <h3>Inventory (demo)</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          <input placeholder="Part name" value={name} onChange={e=>setName(e.target.value)} />
          <input placeholder="Price" value={price} onChange={e=>setPrice(e.target.value)} />
        </div>
        <div style={{marginTop:8}}>
          <button className="btn" onClick={handleSave}>Save part (demo)</button>
          <span style={{marginLeft:12}} className="muted">{status}</span>
        </div>

        <div style={{marginTop:12}}>
          {parts.length === 0 ? <div className="muted">No parts saved yet.</div> :
            parts.map(p => (
              <div key={p.id} style={{borderBottom:'1px solid #eef5fb', padding:'8px 0'}}>
                <strong>{p.name}</strong>
                <div className="muted">Qty: {p.qty || 1} • ${Number(p.price||0).toFixed(2)}</div>
              </div>
            ))
          }
        </div>
      </section>
    </div>
  );
}
