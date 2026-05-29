import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { currentUser, userRole, userName } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [scrolled, setScrolled]         = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!currentUser || userRole !== 'vendor') { setPendingCount(0); return; }
    const q = query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      setPendingCount(snap.docs.filter(d => d.data().status === 'pendiente').length);
    });
  }, [currentUser, userRole]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{ ...styles.nav, boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.18)' : '0 1px 0 rgba(255,255,255,0.08)' }}>
      <div style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>📍</span>
          VendeCerca
        </Link>

        <div style={styles.right}>
          {currentUser ? (
            <>
              <span style={styles.greeting}>Hola, {userName?.split(' ')[0] || '👋'}</span>

              {userRole === 'vendor' ? (
                <Link to="/dashboard" style={{ ...styles.navLink, ...(isActive('/dashboard') ? styles.navLinkActive : {}) }}>
                  Mi Panel
                  {pendingCount > 0 && <span style={styles.badge}>{pendingCount}</span>}
                </Link>
              ) : (
                <Link to="/mis-pedidos" style={{ ...styles.navLink, ...(isActive('/mis-pedidos') ? styles.navLinkActive : {}) }}>
                  Mis Pedidos
                </Link>
              )}

              <button onClick={handleLogout} style={styles.logoutBtn}>Salir</button>
            </>
          ) : (
            <>
              <Link to="/login"    style={styles.navLink}>Iniciar sesión</Link>
              <Link to="/register" style={styles.registerBtn}>Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: 'linear-gradient(135deg, #1a5c1a 0%, #2d7a2d 60%, #3d9e3d 100%)',
    position: 'sticky', top: 0, zIndex: 1000,
    transition: 'box-shadow 0.3s ease',
  },
  inner: {
    maxWidth: '1200px', margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.5rem', height: '60px',
  },
  logo: {
    color: '#fff', textDecoration: 'none', fontWeight: 800,
    fontSize: '1.25rem', letterSpacing: '-0.3px',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  logoIcon: { fontSize: '1.1rem' },
  right: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginRight: '0.4rem' },
  navLink: {
    color: 'rgba(255,255,255,0.9)', textDecoration: 'none',
    fontSize: '0.9rem', fontWeight: 500,
    padding: '0.4rem 0.8rem', borderRadius: '8px',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    transition: 'background 0.15s',
    background: 'rgba(255,255,255,0)',
  },
  navLinkActive: { background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600 },
  badge: {
    background: '#ef4444', color: '#fff', fontSize: '0.7rem',
    fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '20px',
    minWidth: '18px', textAlign: 'center', lineHeight: 1.5,
    animation: 'ping 1.5s ease-in-out infinite',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)',
    padding: '0.4rem 0.9rem', borderRadius: '20px',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
    transition: 'background 0.15s',
  },
  registerBtn: {
    background: '#fff', color: '#1a5c1a', textDecoration: 'none',
    padding: '0.45rem 1rem', borderRadius: '20px',
    fontWeight: 700, fontSize: '0.88rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
};
