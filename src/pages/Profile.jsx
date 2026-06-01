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

  const [name,          setName]          = useState('');
  const [photoURL,      setPhotoURL]      = useState('');
  const [saving,        setSaving]        = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [avatarHover,   setAvatarHover]   = useState(false);
  const [stats,          setStats]          = useState({ total: 0, completados: 0, gastado: 0 });
  const [favVendors,     setFavVendors]     = useState([]);
  const photoRef = useRef(null);
  const { favorites, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || '');
        setPhotoURL(d.photoURL || '');
      }
    });
    // Cargar estadísticas de pedidos
    getDocs(query(collection(db, 'orders'), where('buyerId', '==', currentUser.uid))).then(snap => {
      const orders = snap.docs.map(d => d.data());
      const completados = orders.filter(o => o.status === 'completado');
      const gastado = completados.reduce((sum, o) =>
        sum + (o.products || []).reduce((s, p) => s + (parseFloat(p.price)||0) * (p.qty||1), 0), 0
      );
      setStats({ total: orders.length, completados: completados.length, gastado });
    });
  }, [currentUser, navigate]);

  useEffect(() => {
    if (favorites.size === 0) { setFavVendors([]); return; }
    Promise.all([...favorites].map(id => getDoc(doc(db, 'vendors', id))))
      .then(snaps => setFavVendors(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }))));
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
      const res  = await fetch('https://api.cloudinary.com/v1_1/dhjkhvfmf/image/upload', { method:'POST', body:fd });
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
    await updateDoc(doc(db, 'users', currentUser.uid), { name: name.trim() });
    toast.success('Perfil actualizado');
    setSaving(false);
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.backRow}>
          <BackButton to="/" label="Volver al mapa" />
        </div>

        {/* Avatar */}
        <div style={s.avatarSection}>
          <div
            style={s.avatarWrap}
            onClick={() => photoRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
          >
            {uploading ? (
              <div style={s.avatarPlaceholder}><span style={{ fontSize:'1.5rem' }}>⏳</span></div>
            ) : photoURL ? (
              <img src={photoURL} alt="foto" style={s.avatarImg} />
            ) : (
              <div style={s.avatarPlaceholder}>{name?.[0]?.toUpperCase() || '?'}</div>
            )}
            <div style={{ ...s.avatarOverlay, opacity: avatarHover ? 1 : 0 }}>📷</div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
          </div>
          <p style={s.avatarHint}>Toca para cambiar foto</p>
        </div>

        {/* Estadísticas */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statNum}>{stats.total}</div>
            <div style={s.statLabel}>Pedidos</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statNum}>{stats.completados}</div>
            <div style={s.statLabel}>Completados</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statNum, fontSize: stats.gastado > 99999 ? '1.1rem' : '1.4rem' }}>
              ${stats.gastado.toLocaleString()}
            </div>
            <div style={s.statLabel}>Gastado</div>
          </div>
        </div>

        {/* Favoritos */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>
            ❤️ Mis favoritos
            {favorites.size > 0 && <span style={s.favCount}>{favorites.size}</span>}
          </h3>
          {favorites.size === 0 ? (
            <p style={s.favEmpty}>Aún no tienes favoritos. Guarda vendedores con el corazón ❤️ desde el mapa.</p>
          ) : (
            <div style={s.favList}>
              {favVendors.map(v => (
                <div key={v.id} style={s.favCard}>
                  {v.photoURL
                    ? <img src={v.photoURL} alt={v.name} style={s.favAvatar} />
                    : <div style={s.favAvatarPlaceholder}>{v.name?.[0]?.toUpperCase()}</div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={s.favName}>{v.name}</div>
                    <div style={s.favStatus}>{v.isOnline ? '🟢 En línea' : '⚫ Offline'}</div>
                  </div>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    <Link to={`/vendor/${v.id}`} style={s.favViewBtn}>Ver →</Link>
                    <button style={s.favRemoveBtn} onClick={() => toggleFavorite(v.id)} title="Quitar de favoritos">❤️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario */}
        <div style={s.card}>
          <h3 style={s.cardTitle}>Mis datos</h3>
          <form onSubmit={handleSave} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Nombre completo</label>
              <input
                className="app-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input
                className="app-input"
                value={currentUser?.email || ''}
                disabled
                style={{ background:'#f9fafb', color:'#9ca3af', cursor:'not-allowed' }}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Tipo de cuenta</label>
              <input
                className="app-input"
                value={userRole === 'vendor' ? '🏪 Vendedor' : '🛒 Comprador'}
                disabled
                style={{ background:'#f9fafb', color:'#9ca3af', cursor:'not-allowed' }}
              />
            </div>
            <button style={{ ...s.btn, opacity: saving ? 0.7 : 1 }} type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

const s = {
  page:      { background:'var(--bg)', minHeight:'calc(100vh - 60px)', padding:'1.5rem 1rem' },
  container: { maxWidth:'480px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'1.2rem' },
  backRow:   {},

  avatarSection: { display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem' },
  avatarWrap: {
    position:'relative', width:'90px', height:'90px',
    borderRadius:'50%', cursor:'pointer',
    boxShadow:'0 4px 16px rgba(0,0,0,0.15)',
  },
  avatarImg:     { width:'90px', height:'90px', borderRadius:'50%', objectFit:'cover', border:'3px solid #fff' },
  avatarPlaceholder: {
    width:'90px', height:'90px', borderRadius:'50%',
    background:'linear-gradient(135deg,var(--green),var(--green-mid))',
    color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'2.2rem', fontWeight:800, border:'3px solid #fff',
  },
  avatarOverlay: {
    position:'absolute', inset:0, borderRadius:'50%',
    background:'rgba(0,0,0,0.4)', display:'flex',
    alignItems:'center', justifyContent:'center',
    fontSize:'1.4rem', transition:'opacity 0.2s',
  },
  avatarHint: { fontSize:'0.78rem', color:'var(--text-3)' },

  statsRow: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.7rem' },
  statCard: {
    background:'#fff', borderRadius:'var(--radius)', padding:'1rem 0.5rem',
    textAlign:'center', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)',
  },
  statNum:   { fontSize:'1.4rem', fontWeight:800, color:'var(--green)' },
  statLabel: { fontSize:'0.75rem', color:'var(--text-3)', fontWeight:500, marginTop:'0.1rem' },

  card:      { background:'#fff', borderRadius:'var(--radius-lg)', padding:'1.5rem', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)' },
  cardTitle: { fontSize:'1rem', fontWeight:700, color:'var(--text)', margin:'0 0 1.2rem' },
  form:      { display:'flex', flexDirection:'column', gap:'1rem' },
  field:     { display:'flex', flexDirection:'column', gap:'0.35rem' },
  label:     { fontSize:'0.82rem', fontWeight:600, color:'var(--text-2)' },
  btn:       { padding:'0.85rem', background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', fontFamily:'inherit' },

  favCount:           { marginLeft:'0.5rem', background:'#fee2e2', color:'#dc2626', fontSize:'0.75rem', fontWeight:700, padding:'0.1rem 0.5rem', borderRadius:'20px' },
  favEmpty:           { color:'var(--text-3)', fontSize:'0.88rem', margin:0 },
  favList:            { display:'flex', flexDirection:'column', gap:'0.5rem' },
  favCard:            { display:'flex', alignItems:'center', gap:'0.7rem', padding:'0.6rem 0.7rem', background:'var(--bg)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' },
  favAvatar:          { width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid var(--border)' },
  favAvatarPlaceholder:{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,var(--green),var(--green-mid))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.9rem', flexShrink:0 },
  favName:            { fontWeight:600, fontSize:'0.9rem', color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  favStatus:          { fontSize:'0.75rem', color:'var(--text-3)', marginTop:'0.05rem' },
  favViewBtn:         { padding:'0.28rem 0.65rem', background:'var(--green-light)', color:'var(--green)', border:'1px solid var(--green-border)', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' },
  favRemoveBtn:       { width:'28px', height:'28px', border:'1.5px solid #fca5a5', borderRadius:'50%', background:'#fff0f0', cursor:'pointer', fontSize:'0.85rem', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', padding:0 },
};
