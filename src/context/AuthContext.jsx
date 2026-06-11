import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.2rem',
      zIndex: 9999,
    }}>
      <svg width="48" height="58" viewBox="0 0 20 24" fill="none" aria-hidden="true" style={{ animation: 'pinPulse 1.4s ease-in-out infinite' }}>
        <path d="M10 0C5.58 0 2 3.58 2 8c0 6.5 8 16 8 16s8-9.5 8-16c0-4.42-3.58-8-8-8z" fill="#1a5c1a"/>
        <circle cx="10" cy="8" r="3.2" fill="white"/>
      </svg>
      <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#1a5c1a', letterSpacing: '-0.3px' }}>
        Vende<span style={{ color: '#3d9e3d' }}>Cerca</span>
      </span>
      <style>{`
        @keyframes pinPulse {
          0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
          50%       { transform: translateY(-6px) scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole,    setUserRole]    = useState(null);
  const [userName,    setUserName]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            const name = userDoc.data().name;
            setUserRole(role);
            setUserName(name);
            localStorage.setItem(`vc_role_${user.uid}`, role);
            if (name) localStorage.setItem(`vc_name_${user.uid}`, name);
          }
        } catch {
          // Firestore falló (móvil sin señal) — usar caché local
          const cached = localStorage.getItem(`vc_role_${user.uid}`);
          const cachedName = localStorage.getItem(`vc_name_${user.uid}`);
          if (cached) setUserRole(cached);
          if (cachedName) setUserName(cachedName);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserName(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, userName, loading }}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}
