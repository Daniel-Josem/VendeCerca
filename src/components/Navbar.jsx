import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import { useToast } from '../context/ToastContext';

export default function Navbar() {
  const { currentUser, userRole, userName } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isMobile  = useIsMobile();
  const toast = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const [orderBadge,   setOrderBadge]   = useState(0);
  const [scrolled, setScrolled]         = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const seenStatusRef    = useRef({});
  const isFirstOrderLoad = useRef(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!currentUser || userRole !== 'vendor') { setPendingCount(0); return; }
    const q = query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      setPendingCount(snap.docs.filter(d => d.data().status === 'pendiente').length);
    });
  }, [currentUser, userRole]);

  // Listener de pedidos del comprador — badge + toast al cambio de estado
  useEffect(() => {
    if (!currentUser || userRole === 'vendor') { setOrderBadge(0); return; }
    isFirstOrderLoad.current = true;
    const q = query(collection(db, 'orders'), where('buyerId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      if (!isFirstOrderLoad.current) {
        snap.docs.forEach(d => {
          const { status, vendorName } = d.data();
          const prev = seenStatusRef.current[d.id];
          if (prev && prev !== status) {
            if      (status === 'en_camino')  toast.info(`📦 Pedido de ${vendorName} está en camino 🛵`);
            else if (status === 'listo')      toast.success(`✅ Tu pedido de ${vendorName} está listo para recoger`);
            else if (status === 'completado') toast.success(`🎉 Pedido de ${vendorName} completado`);
            else if (status === 'cancelado')  toast.error(`❌ Pedido de ${vendorName} fue cancelado`);
          }
        });
      }
      isFirstOrderLoad.current = false;
      snap.docs.forEach(d => { seenStatusRef.current[d.id] = d.data().status; });

      // Badge: pedidos con estado notable no vistos desde la última visita a /mis-pedidos
      const lastVisit = parseInt(localStorage.getItem(`orders_visited_${currentUser.uid}`) || '0');
      const notable = snap.docs.filter(d => {
        const { status, updatedAt } = d.data();
        return ['en_camino','listo','completado'].includes(status) && (updatedAt?.seconds || 0) > lastVisit;
      });
      setOrderBadge(notable.length);
    });
  }, [currentUser, userRole]);

  // Limpiar badge al visitar /mis-pedidos
  useEffect(() => {
    if (location.pathname === '/mis-pedidos' && currentUser && userRole !== 'vendor') {
      localStorage.setItem(`orders_visited_${currentUser.uid}`, Math.floor(Date.now() / 1000).toString());
      setOrderBadge(0);
    }
  }, [location.pathname, currentUser, userRole]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/login');
    setMenuOpen(false);
  }

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav style={{ ...styles.nav, boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.18)' : '0 1px 0 rgba(255,255,255,0.08)' }}>
        <div style={styles.inner}>
          <Link to="/" style={styles.logo}>
            <span style={styles.logoIcon}>📍</span>
            VendeCerca
          </Link>

          {isMobile ? (
            <button
              style={styles.hamburger}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menú"
            >
              {menuOpen ? '✕' : '☰'}
              {pendingCount > 0 && !menuOpen && <span style={styles.hamburgerBadge}>{pendingCount}</span>}
            </button>
          ) : (
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
                      {orderBadge > 0 && <span style={styles.badge}>{orderBadge}</span>}
                    </Link>
                  )}
                  <Link to="/perfil" style={{ ...styles.navLink, ...(isActive('/perfil') ? styles.navLinkActive : {}) }}>
                    Mi Perfil
                  </Link>
                  {userRole === 'admin' && (
                    <Link to="/admin" style={{ ...styles.navLink, ...(isActive('/admin') ? styles.navLinkActive : {}), background:'rgba(255,255,255,0.15)' }}>
                      🛡️ Admin
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
          )}
        </div>
      </nav>

      {/* Menú mobile desplegable */}
      {isMobile && menuOpen && (
        <div style={styles.mobileMenu}>
          {currentUser ? (
            <>
              <div style={styles.mobileGreeting}>
                <span style={styles.mobileGreetingIcon}>👋</span>
                <span>Hola, {userName?.split(' ')[0] || 'usuario'}</span>
              </div>
              <div style={styles.mobileDivider} />
              {userRole === 'vendor' ? (
                <Link to="/dashboard" style={styles.mobileLink}>
                  <span>🏪 Mi Panel</span>
                  {pendingCount > 0 && <span style={styles.mobileBadge}>{pendingCount} pendientes</span>}
                </Link>
              ) : (
                <Link to="/mis-pedidos" style={styles.mobileLink}>
                  📦 Mis Pedidos
                  {orderBadge > 0 && <span style={styles.mobileBadge}>{orderBadge} nuevo{orderBadge!==1?'s':''}</span>}
                </Link>
              )}
              <Link to="/" style={styles.mobileLink}>🗺️ Mapa</Link>
              <Link to="/perfil" style={styles.mobileLink}>👤 Mi Perfil</Link>
              {userRole === 'admin' && (
                <Link to="/admin" style={{ ...styles.mobileLink, color:'#1d4ed8', fontWeight:700 }}>🛡️ Admin</Link>
              )}
              <div style={styles.mobileDivider} />
              <button onClick={handleLogout} style={styles.mobileLogout}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <Link to="/login"    style={styles.mobileLink}>Iniciar sesión</Link>
              <Link to="/register" style={{ ...styles.mobileLink, ...styles.mobileLinkHighlight }}>Registrarse gratis</Link>
            </>
          )}
        </div>
      )}
    </>
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
    padding: '0 1.25rem', height: '60px',
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

  /* Hamburger */
  hamburger: {
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
    color: '#fff', borderRadius: '8px', width: '40px', height: '40px',
    fontSize: '1.1rem', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    fontFamily: 'inherit',
  },
  hamburgerBadge: {
    position: 'absolute', top: '-6px', right: '-6px',
    background: '#ef4444', color: '#fff', fontSize: '0.65rem',
    fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '20px',
    minWidth: '16px', textAlign: 'center', lineHeight: 1.5,
  },

  /* Mobile menu */
  mobileMenu: {
    position: 'fixed', top: '60px', left: 0, right: 0, zIndex: 999,
    background: '#fff', borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    display: 'flex', flexDirection: 'column', padding: '0.75rem 0',
  },
  mobileGreeting: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 1.25rem 0.75rem',
    fontSize: '0.95rem', fontWeight: 600, color: '#111827',
  },
  mobileGreetingIcon: { fontSize: '1.2rem' },
  mobileDivider: { height: '1px', background: '#f3f4f6', margin: '0.25rem 0' },
  mobileLink: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.85rem 1.25rem', textDecoration: 'none',
    color: '#111827', fontSize: '0.95rem', fontWeight: 500,
    transition: 'background 0.12s',
  },
  mobileLinkHighlight: { color: '#2d7a2d', fontWeight: 700 },
  mobileBadge: {
    background: '#fef3c7', color: '#92400e', fontSize: '0.72rem',
    fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '20px',
  },
  mobileLogout: {
    margin: '0.25rem 1.25rem 0',
    padding: '0.75rem', background: '#fee2e2', color: '#dc2626',
    border: 'none', borderRadius: '10px', fontWeight: 600,
    fontSize: '0.9rem', cursor: 'pointer', textAlign: 'center',
    fontFamily: 'inherit',
  },
};
