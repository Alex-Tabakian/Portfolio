// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from './AuthProvider';

// Default export (important)
export default function Navbar() {
  const { user } = useAuth() || {};
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed', err);
    } finally {
      navigate('/login');
    }
  };

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 18px',
      background: '#fff',
      borderBottom: '1px solid #eef2f7'
    }}>
      <div>
        <Link to="/" style={{ textDecoration: 'none', color: '#374151', fontWeight: 700, fontSize: 18 }}>
          PC Logger
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {!user ? (
            <>
                <Link to="/login" style={{ color: '#374151', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
                <Link to="/signup" style={{ color: '#374151', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
            </>
            ) : (
            <>
                <Link
                    to="/"
                    style={{ color: '#374151', textDecoration: 'none', fontWeight: 600 }}
                >
                    Inventory
                </Link>

                <Link
                    to="/build"
                    style={{ color: '#374151', textDecoration: 'none', fontWeight: 600 }}
                >
                    Builds
                </Link>

                <button
                    onClick={handleSignOut}
                    style={{
                    background: 'transparent',
                    border: '1px solid #e6eef5',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: '#374151',
                    fontWeight: 600
                    }}
                >
                    Sign out
                </button>
                </>

            )}

      </div>
    </nav>
  );
}
