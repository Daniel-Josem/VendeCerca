import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

export default function VendorProfile() {
  const { id }  = useParams();
  const [vendor,  setVendor]  = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    getDoc(doc(db, 'vendors', id)).then(snap => {
      if (snap.exists()) setVendor({ id: snap.id, ...snap.data() });
    });
    getDocs(query(collection(db, 'reviews'), where('vendorId', '==', id))).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setReviews(list);
    });
  }, [id]);

  if (!vendor) return <div style={s.loading}>Cargando...</div>;

  const allProducts = vendor.locations?.length
    ? vendor.locations.flatMap(l => l.products || [])
        .filter((p,i,arr) => arr.findIndex(x => x.name===p.name)===i)
    : (vendor.products || []);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : vendor.rating || 0;

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

        {vendor.locations?.filter(l => l.isOnline).length > 1 && (
          <div style={s.sedesBox}>
            <p style={s.sedesTitle}>📍 Sedes activas</p>
            {vendor.locations.filter(l => l.isOnline).map(l => (
              <span key={l.id} style={s.sedePill}>{l.name}</span>
            ))}
          </div>
        )}

        {/* Resumen calificación */}
        {reviews.length > 0 && (
          <div style={s.ratingBanner}>
            <div style={s.ratingBig}>{avgRating.toFixed(1)}</div>
            <div>
              <div style={s.ratingStars}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ color: n <= Math.round(avgRating) ? '#f59e0b' : '#d1d5db', fontSize:'1.2rem' }}>★</span>
                ))}
              </div>
              <div style={s.ratingCount}>{reviews.length} reseña{reviews.length!==1?'s':''}</div>
            </div>
          </div>
        )}

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
              {p.imageURL
                ? <img src={p.imageURL} alt={p.name} style={s.productImg} />
                : <span style={s.productEmoji}>{p.emoji}</span>
              }
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

        {/* Reseñas */}
        <div style={s.reviewsSection}>
          <h3 style={s.reviewsTitle}>
            Reseñas
            {reviews.length > 0 && <span style={s.productCount}>{reviews.length}</span>}
          </h3>
          {reviews.length === 0 ? (
            <p style={s.noReviews}>Sin reseñas aún. ¡Sé el primero en calificar desde Mis Pedidos!</p>
          ) : (
            <div style={s.reviewsList}>
              {reviews.map(r => (
                <div key={r.id} style={s.reviewCard}>
                  <div style={s.reviewHead}>
                    <div style={s.reviewAvatar}>{r.buyerName?.[0]?.toUpperCase() || '?'}</div>
                    <div style={{ flex:1 }}>
                      <div style={s.reviewName}>{r.buyerName}</div>
                      <div style={s.reviewDate}>{formatDate(r.createdAt)}</div>
                    </div>
                    <div style={s.reviewStars}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{ color: n <= r.rating ? '#f59e0b' : '#d1d5db', fontSize:'0.95rem' }}>★</span>
                      ))}
                    </div>
                  </div>
                  {r.comment && <p style={s.reviewComment}>"{r.comment}"</p>}
                </div>
              ))}
            </div>
          )}
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
  whatsapp:     { display:'inline-flex', alignItems:'center', gap:'0.4rem', background:'#25d366', color:'#fff', textDecoration:'none', padding:'0.65rem 1.2rem', borderRadius:'10px', fontWeight:600, marginBottom:'1.2rem', fontSize:'0.92rem' },
  sedesBox:     { background:'#f0f7f0', border:'1px solid #c6e0c6', borderRadius:'10px', padding:'0.7rem 0.9rem', marginBottom:'1.2rem' },
  sedesTitle:   { fontSize:'0.82rem', fontWeight:600, color:'#2d7a2d', margin:'0 0 0.4rem' },
  sedePill:     { display:'inline-block', background:'#fff', border:'1px solid #c6e0c6', fontSize:'0.78rem', padding:'0.15rem 0.5rem', borderRadius:'20px', marginRight:'0.3rem', color:'#2d7a2d', fontWeight:500 },

  ratingBanner: { display:'flex', alignItems:'center', gap:'1rem', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'12px', padding:'0.9rem 1rem', marginBottom:'1.5rem' },
  ratingBig:    { fontSize:'2.2rem', fontWeight:800, color:'#92400e', lineHeight:1 },
  ratingStars:  { display:'flex', gap:'0.1rem', marginBottom:'0.1rem' },
  ratingCount:  { fontSize:'0.78rem', color:'#92400e', fontWeight:600 },

  productsTitle:{ fontWeight:700, color:'#1a1a1a', marginBottom:'0.8rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  productCount: { background:'var(--green-light)', color:'var(--green)', fontSize:'0.75rem', fontWeight:700, padding:'0.1rem 0.5rem', borderRadius:'20px' },
  products:     { display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.5rem' },
  product:      { display:'flex', alignItems:'center', gap:'0.8rem', padding:'0.75rem', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' },
  productEmoji: { fontSize:'1.8rem', flexShrink:0 },
  productImg:   { width:'48px', height:'48px', borderRadius:'10px', objectFit:'cover', flexShrink:0 },
  productMeta:  { fontSize:'0.8rem', color:'#666', marginTop:'0.15rem' },

  reviewsSection:{ borderTop:'1px solid #e5e7eb', paddingTop:'1.2rem' },
  reviewsTitle:  { fontWeight:700, color:'#1a1a1a', marginBottom:'0.9rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  noReviews:     { color:'#aaa', fontSize:'0.88rem' },
  reviewsList:   { display:'flex', flexDirection:'column', gap:'0.7rem' },
  reviewCard:    { background:'#f9fafb', borderRadius:'12px', padding:'0.9rem', border:'1px solid #e5e7eb' },
  reviewHead:    { display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.4rem' },
  reviewAvatar:  { width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.85rem', flexShrink:0 },
  reviewName:    { fontWeight:600, fontSize:'0.88rem', color:'#111827' },
  reviewDate:    { fontSize:'0.72rem', color:'#9ca3af' },
  reviewStars:   { display:'flex', gap:'0.05rem', marginLeft:'auto' },
  reviewComment: { fontSize:'0.85rem', color:'#4b5563', margin:'0.2rem 0 0', lineHeight:1.5, fontStyle:'italic' },
};
