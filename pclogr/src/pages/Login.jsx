// src/pages/Login.jsx
import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setStatus('Signing in…');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/'); // go to protected home
    } catch (err) {
      setError(err.message || 'Auth error');
    } finally {
      setStatus('');
    }
  };

  return (
    <div className="auth-card">
      <h1>Sign in</h1>
      <form onSubmit={handleLogin}>
        <label>Email</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <div style={{marginTop:12}}>
          <button className="btn">Sign in</button>
          <Link to="/signup" style={{marginLeft:8}}>Create account</Link>
          <Link to="/reset" style={{marginLeft:8}}>Forgot?</Link>
        </div>
      </form>

      {status && <div className="muted">{status}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
