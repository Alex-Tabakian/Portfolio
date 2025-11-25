// src/components/AuthProvider.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// partsService helpers
import {
  syncLocalToCloud,
  addPartToCloud,
  loadLocalParts,
  savePartsLocally
} from '../lib/partsService';

import { makeUUID } from '../lib/utils';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state once
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        // When the user signs in, try to push any local edits to their cloud collection.
        try {
          await syncLocalToCloud(u.uid);
        } catch (err) {
          console.warn('syncLocalToCloud failed:', err);
        }
      }
    });

    return () => unsub();
  }, []);

  // savePart exposed to the app: tries cloud when user present, otherwise saves locally.
  const savePart = useCallback(async (part) => {
    const item = { ...part, uuid: part.uuid || makeUUID() };

    if (user) {
      try {
        await addPartToCloud(user.uid, item);
        return { ok: true };
      } catch (err) {
        console.warn('addPartToCloud failed, falling back to local:', err);
        // fallback to local cache
        const local = loadLocalParts();
        local.unshift(item);
        savePartsLocally(local);
        return { ok: false, fallback: 'local', error: err };
      }
    } else {
      // not signed in -> save local
      const local = loadLocalParts();
      local.unshift(item);
      savePartsLocally(local);
      return { ok: false, fallback: 'local' };
    }
  }, [user]);

  const value = { user, loading, savePart };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div style={{ padding: 20 }}>Loading…</div> : children}
    </AuthContext.Provider>
  );
}
