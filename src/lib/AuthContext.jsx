import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Leggi/crea profilo utente su Firestore
        const uid     = firebaseUser.uid;
        const userRef = doc(db, 'users', uid);
        const snap    = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid,
            name:      firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email:     firebaseUser.email,
            avatar:    firebaseUser.photoURL || null,
            role:      'user',           // 'user' | 'admin'
            tokens:    0,
            createdAt: Date.now(),
          });
        }

        const profile = snap.exists() ? snap.data() : { role: 'user', tokens: 0 };
        setUser({
          uid,
          name:   firebaseUser.displayName || profile.name,
          email:  firebaseUser.email,
          avatar: firebaseUser.photoURL || null,
          role:   profile.role  || 'user',
          tokens: profile.tokens || 0,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
