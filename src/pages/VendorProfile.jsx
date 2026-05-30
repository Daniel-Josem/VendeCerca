import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function VendorProfile() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [vendor,      setVendor]      = useState(null);
  const [userRating,  setUserRating]  = useState(0);
  const [rated,       setRated]       = useState(false);
  const [canRate,     setCanRate]     = useState(null); // null=cargando, true/false
  const [rateStatus,  setRateStatus]  = useState(''); // mensaje de estado

  useEffect(() => {
    getDoc(doc(db, 'vendors', id)).then(snap => {
      if (snap.exists()) setVendor({ id: snap.id, ...snap.data() });
    });
  }, [id]);

  // Verificar si el comprador tiene un pedido completado con este vendedor
  useEffect(() => {
    if (!currentUser || currentUser.uid === id) { setCanRate(false); return; }

    const q = query(
      collection(db, 'orders'),
      where('vendorId', '==', id),
      where('buyerId',  '==', currentUser.uid),
      where('status',   '==', 'completado')
    );
    getDocs(q).then(snap => setCanRate(snap.size > 0));
  }, [currentUser, id]);

  async function handleRate(stars) {
    if (rated || !canRate) return;
    setUserRating(stars);
    setRated(true);
    const newCount  = (vendor.ratingsCount || 0) + 1;
    const newRating = ((vendor.rating || 0) * (vendor.ratingsCount || 0) + stars) / newCount;
    await updateDoc(doc(db, 'vendors', id), { rating: newRating, ratingsCount: newCount });
    setVendor(v => ({ ...v, rating: newRating, ratingsCount: newCount }));
    setRateStatus('¡Gracias por tu calificación! 🙌');
  }

  if (!vendor) return <div style={s.loading}>Cargando...</div>;

  const isOwn = currentUser?.uid === id;

  // Mensaje según estado de calificación
  let rateMsg = null;
  if (!currentUser)       rateMsg = { text:'Inicia sesión para calificar', color:'#888' };
  else if (isOwn)         rateMsg = null;
  else if (canRate===null)rateMsg = { text:'Verificando...', color:'#aaa' };
  else if (!canRate)      rateMsg = { text:'Solo puedes calificar después de completar un pedido con este vendedor', color:'#f59e0b' };
  else if (rated)         rateMsg = { text: rateStatus, color:'#2d7a2d' };

  // Productos de todas las sedes (sin duplicados)
  const allProducts = vendor.locations?.length
    ? vendor.locations.flatMap(l => l.products || [])
        .filter((p,i,arr) => arr.findIndex(x => x.name===p.name)===i)
    : (vendor.products || []);

  return (
    <div style={s.container}>
      <div style={s.card} className="anim-scale-in">

        {/* Header */}
        <div style={s.header}>
          {vendor.photoURL
            ? <img src={vendor.photoURL} alt={vendor.name} style={s.avatarImg} />
            : <div style={s.avatar}>{vendor.name?.[0]?.toUpperCase()}</div>
          }
          <div>
            <h2 style={s.name}>{vendor.name}</h2>
            <span style={s.badge(vendor.isOnline)}>
              {vendor.isOnline ? '🟢 En línea' : '⚫ Offline'}
            </span>
          </div>
        </div>

        {vendor.description && <p style={s.description}>{vendor.description}</p>}

        {vendor.phone && (
          <a href={`https://wa.me/${vendor.phone.replace(/\D/g,'')}`}
            target="_blank" rel="noreferrer" style={s.whatsapp}>
            📱 Contactar por WhatsApp
          </a>
        )}

        {/* Sedes activas */}
        {vendor.locations?.filter(l => l.isOnline).length > 1 && (
          <div style={s.sedesBox}>
            <p style={s.sedesTitle}>📍 Sedes activas</p>
            {vendor.locations.filter(l => l.isOnline).map(l => (
              <span key={l.id} style={s.sedePill}>{l.name}</span>
            ))}
          </div>
        )}

        {/* Calificación */}
        <div style={s.ratingSection}>
          <p style={s.ratingTitle}>
            Calificación
            {vendor.rating > 0 && (
              <span style={s.ratingNum}> {vendor.rating.toFixed(1)} ⭐ ({vendor.ratingsCount} reseñas)</span>
            )}
          </p>

          {/* Estrellas — solo si puede calificar */}
          {!isOwn && (
            <div style={s.stars}>
              {[1,2,3,4,5].map(star => (
                <button key={star}
                  onClick={() => handleRate(star)}
                  disabled={!canRate || rated}
                  style={{
                    ...s.star,
                    color: star <= (userRating || Math.round(vendor.rating||0)) ? '#f59e0b' : '#d1d5db',
                    cursor: canRate && !rated ? 'pointer' : 'default',
                    opacity: canRate === false ? 0.5 : 1,
                  }}>
                  ★
                </button>
              ))}
            </div>
          )}

          {rateMsg && (
            <p style={{ color: rateMsg.color, fontSize:'0.83rem', marginTop:'0.4rem', lineHeight:1.4 }}>
              {rateMsg.text}
            </p>
          )}

          {!vendor.rating && !rateMsg && (
            <p style={s.ratingMeta}>Sin calificaciones aún</p>
          )}
        </div>

        {/* Productos */}
        <h3 style={s.productsTitle}>
          Productos disponibles
          <span style={s.productCount}>{allProducts.length}</span>
        </h3>
        <div style={s.products}>
          {allProducts.length === 0 && (
            <p style={{ color:'#aaa', fontSize:'0.9rem' }}>Sin productos registrados</p>
          )}
          {allProducts.map((p,i) => (
            <div key={i} style={s.product}>
              <span style={s.productEmoji}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <strong style={{ fontSize:'0.95rem' }}>{p.name}</strong>
                <div style={s.productMeta}>
                  ${p.price}/{p.unit}
                  {p.stock && parseInt(p.stock) > 0 && (
                    <span style={{ marginLeft:'0.5rem', color: parseInt(p.stock)<=3?'#dc2626':'#2d7a2d', fontWeight:600 }}>
                      · {p.stock} disponibles
                    </span>
                  )}
                  {p.stock === '0' && <span style={{ marginLeft:'0.5rem', color:'#dc2626', fontWeight:600 }}>· Agotado</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  loading:      { padding:'2rem', textAlign:'center', color:'#888' },
  container:    { minHeight:'calc(100vh - 60px)', background:'linear-gradient(135deg,#f0f7f0,#e8f5e9)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'2rem 1rem' },
  card:         { background:'#fff', borderRadius:'20px', padding:'2rem', maxWidth:'480px', width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.1)' },
  header:       { display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.2rem' },
  avatar:       { width:'64px', height:'64px', borderRadius:'50%', background:'linear-gradient(135deg,#2d7a2d,#3d9e3d)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', fontWeight:800, flexShrink:0 },
  avatarImg:    { width:'64px', height:'64px', borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'3px solid #fff', boxShadow:'0 3px 12px rgba(0,0,0,0.15)' },
  name:         { margin:'0 0 0.3rem', fontSize:'1.4rem', color:'#1a1a1a', fontWeight:700 },
  badge:        (online) => ({ fontSize:'0.82rem', background: online?'#f0fdf4':'#f9fafb', color: online?'#166534':'#6b7280', padding:'0.2rem 0.6rem', borderRadius:'20px', border:`1px solid ${online?'#86efac':'#e5e7eb'}` }),
  description:  { color:'#555', fontSize:'0.92rem', marginBottom:'1.2rem', lineHeight:1.6 },
  whatsapp:     { display:'inline-flex', alignItems:'center', gap:'0.4rem', background:'#25d366', color:'#fff', textDecoration:'none', padding:'0.65rem 1.2rem', borderRadius:'10px', fontWeight:600, marginBottom:'1.2rem', fontSize:'0.92rem', boxShadow:'0 2px 8px rgba(37,211,102,0.3)' },
  sedesBox:     { background:'#f0f7f0', border:'1px solid #c6e0c6', borderRadius:'10px', padding:'0.7rem 0.9rem', marginBottom:'1.2rem' },
  sedesTitle:   { fontSize:'0.82rem', fontWeight:600, color:'#2d7a2d', margin:'0 0 0.4rem' },
  sedePill:     { display:'inline-block', background:'#fff', border:'1px solid #c6e0c6', fontSize:'0.78rem', padding:'0.15rem 0.5rem', borderRadius:'20px', marginRight:'0.3rem', color:'#2d7a2d', fontWeight:500 },
  ratingSection:{ borderTop:'1px solid #e5e7eb', paddingTop:'1.2rem', marginBottom:'1.5rem' },
  ratingTitle:  { margin:'0 0 0.6rem', fontWeight:700, color:'#1a1a1a', fontSize:'0.95rem' },
  ratingNum:    { color:'#f59e0b', fontWeight:600, fontSize:'0.9rem' },
  stars:        { display:'flex', gap:'0.2rem' },
  star:         { background:'none', border:'none', fontSize:'2rem', padding:0, transition:'transform 0.1s' },
  ratingMeta:   { color:'#aaa', fontSize:'0.83rem', marginTop:'0.4rem' },
  productsTitle:{ fontWeight:700, color:'#1a1a1a', marginBottom:'0.8rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  productCount: { background:'var(--green-light)', color:'var(--green)', fontSize:'0.75rem', fontWeight:700, padding:'0.1rem 0.5rem', borderRadius:'20px' },
  products:     { display:'flex', flexDirection:'column', gap:'0.5rem' },
  product:      { display:'flex', alignItems:'center', gap:'0.8rem', padding:'0.75rem', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' },
  productEmoji: { fontSize:'1.8rem', flexShrink:0 },
  productMeta:  { fontSize:'0.8rem', color:'#666', marginTop:'0.15rem' },
};
