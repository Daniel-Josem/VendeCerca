import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import BackButton from '../components/BackButton';
import useFavorites from '../hooks/useFavorites';

export default function Profile() {
  const { currentUser, userName, userRole } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  const [loading,      setLoading]      = useState(true);
  const [name,         setName]         = useState('');
  const [photoURL,     setPhotoURL]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [avatarHover,  setAvatarHover]  = useState(false);
  const [stats,        setStats]        = useState(null);
  const [favVendors,   setFavVendors]   = useState([]);
  const [favLoading,   setFavLoading]   = useState(false);
  // Campos de contacto (solo vendedores)
  const [countryCode,  setCountryCode]  = useState('+57');
  const [phoneNumber,  setPhoneNumber]  = useState('');
  const [description,  setDescription]  = useState('');
  const photoRef = useRef(null);
  const { favorites, toggleFavorite } = useFavorites();

  const COUNTRY_CODES = [
    { code:'+57', flag:'🇨🇴', name:'Colombia'  },
    { code:'+52', flag:'🇲🇽', name:'México'    },
    { code:'+1',  flag:'🇺🇸', name:'EE.UU.'   },
    { code:'+54', flag:'🇦🇷', name:'Argentina' },
    { code:'+55', flag:'🇧🇷', name:'Brasil'    },
    { code:'+56', flag:'🇨🇱', name:'Chile'     },
    { code:'+51', flag:'🇵🇪', name:'Perú'      },
    { code:'+58', flag:'🇻🇪', name:'Venezuela' },
    { code:'+593',flag:'🇪🇨', name:'Ecuador'   },
    { code:'+591',flag:'🇧🇴', name:'Bolivia'   },
  ];

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }

    Promise.all([
      getDoc(doc(db, 'users', currentUser.uid)),
      getDoc(doc(db, 'vendors', currentUser.uid)),
      getDocs(query(collection(db, 'orders'), where('buyerId', '==', currentUser.uid))),
    ]).then(([userSnap, vendorSnap, ordersSnap]) => {
      if (userSnap.exists()) {
        const d = userSnap.data();
        setName(d.name || userName || '');
        setPhotoURL(d.photoURL || vendorSnap.data()?.photoURL || '');
      }
      if (vendorSnap.exists()) {
        const v = vendorSnap.data();
        setCountryCode(v.phoneCode   || '+57');
        setPhoneNumber(v.phoneNumber || '');
        setDescription(v.description || '');
      }
      const orders      = ordersSnap.docs.map(d => d.data());
      const completados = orders.filter(o => o.status === 'completado');
      const cancelados  = orders.filter(o => o.status === 'cancelado');
      const gastado     = completados.reduce((sum, o) =>
        sum + (o.products || []).reduce((s, p) => s + (parseFloat(p.price) || 0) * (p.qty || 1), 0), 0
      );
      setStats({ total: orders.length, completados: completados.length, cancelados: cancelados.length, gastado });
      setLoading(false);
    });
  }, [currentUser, navigate, userName]);

  useEffect(() => {
    if (favorites.size === 0) { setFavVendors([]); return; }
    setFavLoading(true);
    Promise.all([...favorites].map(id => getDoc(doc(db, 'vendors', id))))
      .then(snaps => {
        setFavVendors(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })));
        setFavLoading(false);
      });
  }, [favorites]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La foto debe pesar menos de 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'vendecerca');
      fd.append('public_id', `user_${currentUser.uid}`);
      const res  = await fetch('https://api.cloudinary.com/v1_1/dhjkhvfmf/image/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const url = data.secure_url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto,q_auto/');
      setPhotoURL(url);
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
      toast.success('Foto actualizada');
    } catch {
      toast.error('Error subiendo la foto. Intenta de nuevo.');
    }
    setUploading(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { toast.warning('El nombre no puede estar vacío'); return; }
    setSaving(true);
    const saves = [
      updateDoc(doc(db, 'users', currentUser.uid), { name: name.trim() }),
    ];
    if (isVendor) {
      saves.push(updateDoc(doc(db, 'vendors', currentUser.uid), {
        phoneCode: countryCode,
        phoneNumber,
        phone: countryCode.replace('+', '') + phoneNumber,
        description,
      }));
    }
    await Promise.all(saves);
    toast.success('Perfil guardado');
    setSaving(false);
  }

  const isVendor = userRole === 'vendor';

  if (loading) return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.heroCard}>
          <div className="skeleton" style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto' }} />
          <div className="skeleton" style={{ height: 22, width: '50%', margin: '1rem auto 0' }} />
          <div className="skeleton" style={{ height: 14, width: '30%', margin: '0.5rem auto 0' }} />
        </div>
        <div style={s.statsGrid}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius)' }} />)}
        </div>
        <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.container}>

        <BackButton to="/" label="Volver al mapa" />

        {/* ── HERO ── */}
        <div style={s.heroCard}>
          <div
            style={s.avatarWrap}
            onClick={() => photoRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            title="Cambiar foto"
          >
            {uploading ? (
              <div style={s.avatarPlaceholder}><span style={{ fontSize: '1.6rem' }}>⏳</span></div>
            ) : photoURL ? (
              <img src={photoURL} alt="foto" style={s.avatarImg} />
            ) : (
              <div style={s.avatarPlaceholder}>{name?.[0]?.toUpperCase() || '?'}</div>
            )}
            <div style={{ ...s.avatarOverlay, opacity: avatarHover ? 1 : 0 }}>📷</div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>

          <h2 style={s.heroName}>{name || currentUser?.email}</h2>
          <p style={s.heroEmail}>{currentUser?.email}</p>
          <span style={{ ...s.roleBadge, ...(isVendor ? s.roleBadgeVendor : s.roleBadgeBuyer) }}>
            {isVendor ? '🏪 Vendedor' : '🛒 Comprador'}
          </span>
          {isVendor && (
            <Link to="/dashboard" style={s.dashLink}>Ir a mi panel →</Link>
          )}
        </div>

        {/* ── ESTADÍSTICAS ── */}
        {stats && (
          <div style={s.statsGrid}>
            <div style={s.statCard}>
              <div style={s.statIcon}>📦</div>
              <div style={s.statNum}>{stats.total}</div>
              <div style={s.statLabel}>Total pedidos</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statIcon}>✅</div>
              <div style={{ ...s.statNum, color: '#16a34a' }}>{stats.completados}</div>
              <div style={s.statLabel}>Completados</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statIcon}>❌</div>
              <div style={{ ...s.statNum, color: '#dc2626' }}>{stats.cancelados}</div>
              <div style={s.statLabel}>Cancelados</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statIcon}>💰</div>
              <div style={{ ...s.statNum, fontSize: stats.gastado > 99999 ? '1rem' : '1.25rem', color: 'var(--green)' }}>
                ${stats.gastado.toLocaleString()}
              </div>
              <div style={s.statLabel}>Total gastado</div>
            </div>
          </div>
        )}

        {/* ── FAVORITOS ── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <h3 style={s.cardTitle}>❤️ Mis favoritos</h3>
            {favorites.size > 0 && <span style={s.favCount}>{favorites.size}</span>}
          </div>

          {favLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-sm)' }} />)}
            </div>
          ) : favorites.size === 0 ? (
            <div style={s.emptyBox}>
              <span style={{ fontSize: '2rem' }}>🤍</span>
              <p style={s.emptyText}>Aún no tienes favoritos.</p>
              <p style={s.emptyHint}>Guarda vendedores con ❤️ desde el mapa.</p>
            </div>
          ) : (
            <div style={s.favList}>
              {favVendors.map(v => (
                <div key={v.id} style={s.favCard}>
                  {v.photoURL
                    ? <img src={v.photoURL} alt={v.name} style={s.favAvatar} />
                    : <div style={s.favAvatarPlaceholder}>{v.name?.[0]?.toUpperCase()}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.favName}>{v.name}</div>
                    <div style={s.favSub}>
                      <span style={{ ...s.favDot, background: v.isOnline ? '#22c55e' : '#9ca3af' }} />
                      {v.isOnline ? 'En línea ahora' : 'Offline'}
                      {v.rating > 0 && <span style={s.favRating}>⭐ {v.rating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <Link to={`/vendor/${v.id}`} style={s.favViewBtn}>Ver →</Link>
                  <button style={s.favRemoveBtn} onClick={() => toggleFavorite(v.id)} title="Quitar">❤️</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── MIS DATOS ── */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>✏️ Mis datos</h3>
          <form onSubmit={handleSave} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Nombre completo</label>
              <input className="app-input" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input className="app-input" value={currentUser?.email || ''} disabled style={s.disabledInput} />
            </div>
            {isVendor && (
              <>
                <div style={s.field}>
                  <label style={s.label}>📱 WhatsApp</label>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <select style={s.codeSelect} value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} {c.name}</option>)}
                    </select>
                    <input className="app-input" placeholder="3001234567" value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} style={{ flex:1 }} />
                  </div>
                  {phoneNumber && (
                    <p style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:'0.2rem' }}>
                      wa.me/{countryCode.replace('+', '')}{phoneNumber}
                    </p>
                  )}
                </div>
                <div style={s.field}>
                  <label style={s.label}>📝 Descripción del puesto</label>
                  <textarea className="app-input" style={{ minHeight:'70px', resize:'vertical' }}
                    placeholder="Frutas y verduras frescas del campo..."
                    value={description} onChange={e => setDescription(e.target.value)} />
                </div>
              </>
            )}
            <button style={{ ...s.btn, opacity: saving ? 0.7 : 1 }} type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

const s = {
  page:      { background: 'var(--bg)', minHeight: 'calc(100vh - 60px)', padding: '1.5rem 1rem' },
  container: { maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' },

  /* Hero */
  heroCard: {
    background: 'linear-gradient(135deg, #1a5c1a 0%, #2d7a2d 60%, #3d9e3d 100%)',
    borderRadius: 'var(--radius-lg)', padding: '2rem 1.5rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
    boxShadow: '0 8px 32px rgba(45,122,45,0.3)',
  },
  avatarWrap: {
    position: 'relative', width: 96, height: 96,
    borderRadius: '50%', cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  },
  avatarImg:         { width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.8)' },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.4rem', fontWeight: 800, border: '3px solid rgba(255,255,255,0.5)',
  },
  avatarOverlay: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'rgba(0,0,0,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem', transition: 'opacity 0.2s',
  },
  heroName:  { fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0, textAlign: 'center' },
  heroEmail: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', margin: 0 },
  roleBadge: { fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.9rem', borderRadius: '20px', marginTop: '0.2rem' },
  roleBadgeVendor: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' },
  roleBadgeBuyer:  { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' },
  dashLink: { marginTop: '0.5rem', fontSize: '0.82rem', color: '#86efac', fontWeight: 600, textDecoration: 'none' },

  /* Stats */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.6rem' },
  statCard:  {
    background: 'var(--card)', borderRadius: 'var(--radius)', padding: '0.85rem 0.5rem',
    textAlign: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
  },
  statIcon:  { fontSize: '1.2rem' },
  statNum:   { fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 },
  statLabel: { fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 500 },

  /* Cards */
  card:     { background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: '1.3rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  cardTitle:{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  form:     { display: 'flex', flexDirection: 'column', gap: '0.9rem' },
  field:    { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label:    { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' },
  disabledInput: { background: 'var(--bg)', color: 'var(--text-3)', cursor: 'not-allowed' },
  codeSelect: { padding:'0.6rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)', cursor:'pointer', fontFamily:'inherit', flexShrink:0 },
  btn:      { padding: '0.85rem', background: 'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' },

  /* Favoritos */
  favCount:  { background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '20px' },
  emptyBox:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', padding: '1rem 0' },
  emptyText: { fontWeight: 600, color: 'var(--text-2)', margin: 0 },
  emptyHint: { fontSize: '0.82rem', color: 'var(--text-3)', margin: 0 },
  favList:   { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  favCard:   { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.7rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  favAvatar: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' },
  favAvatarPlaceholder: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--green),var(--green-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0 },
  favName:   { fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  favSub:    { display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.1rem' },
  favDot:    { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  favRating: { marginLeft: '0.2rem', color: '#f59e0b', fontWeight: 600 },
  favViewBtn:{ padding: '0.28rem 0.65rem', background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-border)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  favRemoveBtn:{ width: 30, height: 30, border: '1.5px solid #fca5a5', borderRadius: '50%', background: '#fff0f0', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', padding: 0, flexShrink: 0 },
};
