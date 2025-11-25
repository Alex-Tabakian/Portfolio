// src/pages/Inventory.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../firebase';
import {
    collection, query, orderBy, onSnapshot,
    addDoc, doc, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Inventory() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [sortBy, setSortBy] = useState('createdAt');
    const [error, setError] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [form, setForm] = useState({
        name: '',
        type: 'Other',
        price: '',
        qty: 1,
        vendor: '',
        purchaseDate: '',
        status: 'in_inventory' // new field: 'in_inventory' | 'in_build' | 'not_in_inventory'
    });
    const [editing, setEditing] = useState(null);

    const TYPES = ['all', 'GPU', 'CPU', 'RAM', 'Storage', 'PSU', 'Motherboard', 'Case', 'Cooler', 'Other'];
    const PLACEHOLDERS_BY_TYPE = {
        CPU: 'e.g. Ryzen 5 3600',
        GPU: 'e.g. RTX 3060',
        RAM: 'e.g. Corsair Vengeance 16GB DDR4',
        Storage: 'e.g. Samsung 970 EVO 1TB SSD',
        PSU: 'e.g. Corsair RM750x 750W',
        Motherboard: 'e.g. ASUS TUF B550-PLUS',
        Case: 'e.g. NZXT H510',
        Cooler: 'e.g. Noctua NH-D15',
        Other: 'e.g. Wifi Adapter'
    };
    // human-friendly labels for status
    const STATUS_LABELS = {
        in_inventory: 'In inventory',
        in_build: 'In a build',
        not_in_inventory: 'Not in inventory'
    };

    const partCollection = useMemo(
        () => (user ? collection(db, 'users', user.uid, 'parts') : null),
        [user]
    );

    useEffect(() => {
        if (!user) {
            setParts([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(partCollection, orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const items = [];
            snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
            setParts(items);
            setLoading(false);
        }, (err) => {
            console.error(err);
            setError('Failed to load parts.');
            setLoading(false);
        });
        return () => unsub();
    }, [user, partCollection]);

    const visibleParts = useMemo(() => {
        let arr = parts.slice();
        if (filterType !== 'all')
            arr = arr.filter(p => (p.type || 'Other').toLowerCase() === filterType.toLowerCase());
        if (sortBy === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        else if (sortBy === 'price') arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        else if (sortBy === 'purchaseDate') arr.sort((a, b) => {
            const ta = getTimestampMs(a.purchaseDate), tb = getTimestampMs(b.purchaseDate);
            return (tb || 0) - (ta || 0);
        });
        else if (sortBy === 'createdAt') arr.sort((a, b) => {
            const ta = getTimestampMs(a.createdAt), tb = getTimestampMs(b.createdAt);
            return (tb || 0) - (ta || 0);
        });
        return arr;
    }, [parts, filterType, sortBy]);

    function getTimestampMs(ts) {
        if (!ts) return null;
        if (ts.seconds) return ts.seconds * 1000;
        const d = new Date(ts);
        return isNaN(d) ? null : d.getTime();
    }

    function makeUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    function prettyDate(ts) {
        const ms = getTimestampMs(ts);
        if (!ms) return '—';
        return new Date(ms).toLocaleDateString();
    }

    async function handleAddPart(e) {
        e?.preventDefault?.();
        setError(''); setStatusMsg('');
        if (!user) return setError('You must be signed in to save parts.');
        if (!form.name) return setError('Enter a name.');
        setStatusMsg('Saving...');
        try {
            const payload = {
                name: form.name,
                type: form.type || 'Other',
                price: Number(form.price) || 0,
                qty: Number(form.qty) || 1,
                vendor: form.vendor || '',
                uuid: makeUUID(),
                status: form.status || 'in_inventory',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                purchaseDate: form.purchaseDate ? Timestamp.fromDate(new Date(form.purchaseDate)) : null
            };
            await addDoc(partCollection, payload);
            setForm({ name: '', type: 'Other', price: '', qty: 1, vendor: '', purchaseDate: '', status: 'in_inventory' });
            setStatusMsg('Saved.');
            setTimeout(() => setStatusMsg(''), 1500);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Save failed');
        } finally {
            setStatusMsg('');
        }
    }

    async function handleUpdatePart(e) {
        e?.preventDefault?.();
        if (!editing || !editing.id) return;
        setError(''); setStatusMsg('Updating...');
        try {
            const docRef = doc(db, 'users', user.uid, 'parts', editing.id);
            const payload = {
                name: editing.name,
                type: editing.type || 'Other',
                price: Number(editing.price) || 0,
                qty: Number(editing.qty) || 1,
                vendor: editing.vendor || '',
                status: editing.status || 'in_inventory',
                updatedAt: serverTimestamp(),
                purchaseDate: editing.purchaseDate
                    ? (editing.purchaseDate.seconds
                        ? editing.purchaseDate
                        : Timestamp.fromDate(new Date(editing.purchaseDate)))
                    : null
            };
            await updateDoc(docRef, payload);
            setEditing(null);
            setStatusMsg('Updated.');
            setTimeout(() => setStatusMsg(''), 1200);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Update failed');
        } finally {
            setStatusMsg('');
        }
    }

    function startEdit(part) {
        const pd = getTimestampMs(part.purchaseDate);
        setEditing({
            ...part,
            // convert purchaseDate to yyyy-mm-dd for date input if present
            purchaseDate: pd ? new Date(pd).toISOString().slice(0, 10) : '',
            // ensure status exists
            status: part.status || 'in_inventory'
        });
    }

    return (
        <div style={{ maxWidth: 980, margin: '24px auto', padding: 20, background: '#fff', borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Inventory</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                        <option value="createdAt">Newest</option>
                        <option value="name">Name</option>
                        <option value="price">Price</option>
                        <option value="purchaseDate">Purchase date</option>
                    </select>
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <form onSubmit={handleAddPart} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 140px 160px 140px 160px', gap: 8, alignItems: 'end' }}>
                    <input
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder={PLACEHOLDERS_BY_TYPE[form.type] || 'Enter part name'}
                    />


                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Type</label>
                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            {TYPES.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Qty</label>
                        <input type="number" value={form.qty} min="1" onChange={e => setForm({ ...form, qty: Number(e.target.value) })} style={{ width: '75px'}}/>
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Price (USD)</label>
                        <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ width: '135px' }} placeholder="350.00" />
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Vendor</label>
                        <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} style={{ width: '155px' }} placeholder="Newegg" />
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Status</label>
                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ width: '135px' }}>
                            <option value="in_inventory">In inventory</option>
                            <option value="in_build">In a build</option>
                            <option value="not_in_inventory">Not in inventory</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: 12, color: '#64748b' }}>Purchase date</label>
                        <input
                            type="date"
                            value={form.purchaseDate}
                            onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
                            style={{ width: '100%', maxWidth: '160px', boxSizing: 'border-box' }}
                        />
                    </div>


                    <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, marginTop: 6 }}>
                        <button className="btn" type="submit">Add part</button>
                        <div style={{ marginLeft: 'auto' }} className="muted">{statusMsg || (loading ? 'Loading…' : '')}</div>
                        {error && <div style={{ color: '#ef4444' }}>{error}</div>}
                    </div>
                </form>
            </div>

            <hr style={{ margin: '12px 0' }} />

            <div>
                {visibleParts.length === 0 ? (
                    <div className="muted">No parts found.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {visibleParts.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, border: '1px solid #eef5fb' }}>
                                <div>
                                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>{p.name}</span>
                                        <small style={{ color: '#64748b', fontWeight: 600 }}>{p.type || 'Other'}</small>
                                        {/* status badge */}
                                        <span style={{
                                            marginLeft: 8,
                                            fontSize: 12,
                                            padding: '3px 8px',
                                            borderRadius: 999,
                                            background: p.status === 'in_inventory' ? '#e6fffa' : p.status === 'in_build' ? '#fff7ed' : '#fff1f2',
                                            color: p.status === 'in_inventory' ? '#065f46' : p.status === 'in_build' ? '#92400e' : '#9f1239',
                                            border: '1px solid rgba(0,0,0,0.04)'
                                        }}>
                                            {STATUS_LABELS[p.status] || 'Unknown'}
                                        </span>
                                    </div>

                                    <div className="muted" style={{ fontSize: 13 }}>
                                        Qty: {p.qty || 1} • ${Number(p.price || 0).toFixed(2)} • Vendor: {p.vendor || '—'} • Purchased: {prettyDate(p.purchaseDate)}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                                        UUID: <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 6 }}>{p.uuid || p.id}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn ghost" onClick={() => startEdit(p)}>Edit</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Back to Home button at the bottom */}
            <div style={{ marginTop: 30, textAlign: 'center' }}>
                <button
                    onClick={() => navigate('/Home')}
                    style={{
                        background: '#0ea5e9',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    ← Back to Home
                </button>
            </div>

            {editing && (
                <div style={{
                    position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ width: 720, background: '#fff', padding: 20, borderRadius: 10 }}>
                        <h3>Edit part</h3>
                        <form onSubmit={handleUpdatePart} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 140px 160px 140px 160px', gap: 8, alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Name</label>
                                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                            </div>

                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Type</label>
                                <select value={editing.type || 'Other'} onChange={e => setEditing({ ...editing, type: e.target.value })}>
                                    {TYPES.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Qty</label>
                                <input type="number" value={editing.qty || 1} onChange={e => setEditing({ ...editing, qty: Number(e.target.value) })} />
                            </div>

                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Price</label>
                                <input value={editing.price || 0} onChange={e => setEditing({ ...editing, price: e.target.value })} />
                            </div>

                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Vendor</label>
                                <input value={editing.vendor || ''} onChange={e => setEditing({ ...editing, vendor: e.target.value })} />
                            </div>

                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Purchase date</label>
                                <input type="date" value={editing.purchaseDate || ''} onChange={e => setEditing({ ...editing, purchaseDate: e.target.value })} style={{ width: '160px' }} />
                            </div>

                            {/* Status select in edit modal */}
                            <div>
                                <label style={{ fontSize: 12, color: '#64748b' }}>Status</label>
                                <select value={editing.status || 'in_inventory'} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                                    <option value="in_inventory">In inventory</option>
                                    <option value="in_build">In a build</option>
                                    <option value="not_in_inventory">Not in inventory</option>
                                </select>
                            </div>

                            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, marginTop: 6 }}>
                                <button className="btn" type="submit">Save changes</button>
                                <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
