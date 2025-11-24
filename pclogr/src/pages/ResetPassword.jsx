import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');   // progress / success messages
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setStatus('Sending reset email…');

    if (!email) {
      setStatus('');
      return setError('Enter the email for the account.');
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus('Password reset email sent. Check your inbox (and spam).');
      // optional: navigate('/login') after a pause
      // setTimeout(()=>navigate('/login'), 2500);
    } catch (err) {
      // show a friendly message instead of raw API text if you prefer
      setError(err.message || 'Failed to send reset email.');
    } finally {
      // leave the success text visible; clear the "sending" only
      if (!error) {
        // keep status (success) shown
      } else {
        setStatus('');
      }
    }
  };

  return (
    <div className="auth-card" style={{maxWidth:720, margin:'40px auto', padding:20}}>
      <h1>Reset password</h1>
      <p className="muted">Enter the email for your account and we'll send a reset link.</p>

      <form onSubmit={handleSubmit} style={{marginTop:12}}>
        <label style={{display:'block', marginTop:8}}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #e6eef5', marginTop:6}}
        />

        <div style={{marginTop:12, display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn" type="submit">Send reset</button>
          <Link to="/login" style={{marginLeft:8}}>Back to sign in</Link>
        </div>
      </form>

      {status && <div className="success" style={{marginTop:12}}>{status}</div>}
      {error && <div className="error" style={{marginTop:12}}>{error}</div>}
    </div>
  );
}
