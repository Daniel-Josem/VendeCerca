import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getTier } from '../config/plans';
import usePageMeta from '../hooks/usePageMeta';
import ShareModal from '../components/ShareModal';
import GalleryModal from '../components/GalleryModal';
import OrderModal from '../components/OrderModal';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

export default function VendorProfile() {
  const { id }  = useParams();
  const [vendor,       setVendor]       = useState(null);
  const [reviews,      setReviews]      = useState([]);
  const [showShare,    setShowShare]    = useState(false);
  const [gallery,      setGallery]      = useState(null); // {images, name}
  const [orderType,    setOrderType]    = useState(null); // 'domicilio' | 'recoger'

  useEffect(() => {
    getDoc(doc(db, 'vendors', id)).then(snap => {
      if (snap.exists()) {
        setVendor({ id: snap.id, ...snap.data() });
        updateDoc(doc(db, 'vendors', id), { views: increment(1) }).catch(() => {});
      }
    });
    getDocs(query(collection(db, 'reviews'), where('vendorId', '==', id))).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setReviews(list);
    });
  }, [id]);

  usePageMeta(vendor ? {
    title: vendor.name,
    description: vendor.description
      ? `${vendor.name} — ${vendor.description}. Pide a domicilio o retira en el local.`
      : `${vendor.name} — Vendedor local en VendeCerca. Frutas, verduras y más.`,
    image: vendor.photoURL || undefined,
  } : {});

  if (!vendor) return <div style={s.loading}>Cargando...</div>;

  const allProducts = vendor.locations?.length
    ? vendor.locations.flatMap(l => l.products || [])
        .filter((p,i,arr) => arr.findIndex(x => x.name===p.name)===i)
    : (vendor.products || []);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : vendor.rating || 0;

  return (
  <>
    <div style={s.container}>
      <div style={s.card} className="anim-scale-in">

        {/* Header */}
        <div style={s.header}>
          {vendor.photoURL
            ? <img src={vendor.photoURL} alt={vendor.name} style={s.avatarImg} />
            : <div style={s.avatar}>{vendor.name?.[0]?.toUpperCase()}</div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.3rem' }}>
              <h2 style={{ ...s.name, margin:0 }}>{vendor.name}</h2>
              {vendor.isVerified && (
                <span title="Vendedor verificado" style={{ background:'#dbeafe', color:'#1d4ed8', fontSize:'0.75rem', fontWeight:700, padding:'0.15rem 0.5rem', borderRadius:'20px' }}>✅ Verificado</span>
              )}
            </div>
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' }}>
              <span style={s.badge(vendor.isOnline)}>
                {vendor.isOnline ? '🟢 En línea' : '⚫ Offline'}
              </span>
              {(() => { const t = getTier(vendor.completedSales || 0); return t.id !== 'bronze' ? (
                <span style={{ fontSize:'0.75rem', background:'#fef3c7', color:'#92400e', padding:'0.15rem 0.5rem', borderRadius:'20px', fontWeight:700 }}>{t.icon} {t.name}</span>
              ) : null; })()}
              {vendor.views > 0 && (
                <span style={{ fontSize:'0.72rem', color:'var(--text-3)' }}>👁 {vendor.views} visitas</span>
              )}
            </div>
          </div>
          <button style={s.shareBtn} onClick={() => setShowShare(true)} title="Compartir perfil">
            📤
          </button>
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
            <p style={{ color:'var(--text-3)', fontSize:'0.9rem' }}>Sin productos registrados</p>
          )}
          {allProducts.map((p,i) => {
            const imgs = p.images?.filter(Boolean).length ? p.images.filter(Boolean) : (p.imageURL ? [p.imageURL] : []);
            const hasGallery = imgs.length > 1;
            return (
              <div key={i} style={s.product}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  {imgs.length > 0 ? (
                    <img src={imgs[0]} alt={p.name} style={{ ...s.productImg, cursor: hasGallery ? 'pointer' : 'default' }}
                      onClick={() => hasGallery && setGallery({ images:imgs, name:p.name })} />
                  ) : (
                    <span style={s.productEmoji}>{p.emoji}</span>
                  )}
                  {hasGallery && (
                    <span style={s.galBadge} onClick={() => setGallery({ images:imgs, name:p.name })}>
                      {imgs.length}📷
                    </span>
                  )}
                </div>
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
                    {hasGallery && <span style={{ marginLeft:'0.5rem', color:'var(--text-3)', fontSize:'0.72rem' }}>· ver fotos</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botones de pedido */}
        {vendor.isOnline && allProducts.length > 0 && (
          <div style={s.orderSection}>
            <p style={s.orderTitle}>¿Listo para pedir?</p>
            <div style={s.orderBtns}>
              <button style={s.btnDomicilio} onClick={() => setOrderType('domicilio')}>
                🛵 A domicilio
              </button>
              <button style={s.btnRecoger} onClick={() => setOrderType('recoger')}>
                🛒 Ir a comprar
              </button>
            </div>
          </div>
        )}

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

    {showShare && vendor && (
      <ShareModal vendorId={id} vendorName={vendor.name} onClose={() => setShowShare(false)} />
    )}
    {gallery && (
      <GalleryModal images={gallery.images} productName={gallery.name} onClose={() => setGallery(null)} />
    )}
    {orderType && vendor && (
      <OrderModal vendor={vendor} type={orderType} locationId={null} onClose={() => setOrderType(null)} />
    )}
  </>
  );
}

const s = {
  loading:      { padding:'2rem', textAlign:'center', color:'var(--text-3)' },
  container:    { minHeight:'calc(100vh - 60px)', background:'var(--bg)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'2rem 1rem' },
  card:         { background:'var(--card)', borderRadius:'20px', padding:'2rem', maxWidth:'480px', width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', border:'1px solid var(--border)' },
  header:       { display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.2rem' },
  avatar:       { width:'64px', height:'64px', borderRadius:'50%', background:'linear-gradient(135deg,#2d7a2d,#3d9e3d)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', fontWeight:800, flexShrink:0 },
  avatarImg:    { width:'64px', height:'64px', borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'3px solid var(--border)', boxShadow:'0 3px 12px rgba(0,0,0,0.15)' },
  name:         { margin:'0 0 0.3rem', fontSize:'1.4rem', color:'var(--text)', fontWeight:700 },
  badge:        (online) => ({ fontSize:'0.82rem', background: online?'var(--green-light)':'var(--bg)', color: online?'#166534':'var(--text-2)', padding:'0.2rem 0.6rem', borderRadius:'20px', border:`1px solid ${online?'#86efac':'var(--border)'}` }),
  description:  { color:'var(--text-2)', fontSize:'0.92rem', marginBottom:'1.2rem', lineHeight:1.6 },
  whatsapp:     { display:'inline-flex', alignItems:'center', gap:'0.4rem', background:'#25d366', color:'#fff', textDecoration:'none', padding:'0.65rem 1.2rem', borderRadius:'10px', fontWeight:600, marginBottom:'1.2rem', fontSize:'0.92rem' },
  sedesBox:     { background:'var(--green-light)', border:'1px solid var(--green-border)', borderRadius:'10px', padding:'0.7rem 0.9rem', marginBottom:'1.2rem' },
  sedesTitle:   { fontSize:'0.82rem', fontWeight:600, color:'var(--green)', margin:'0 0 0.4rem' },
  sedePill:     { display:'inline-block', background:'var(--card)', border:'1px solid var(--green-border)', fontSize:'0.78rem', padding:'0.15rem 0.5rem', borderRadius:'20px', marginRight:'0.3rem', color:'var(--green)', fontWeight:500 },

  ratingBanner: { display:'flex', alignItems:'center', gap:'1rem', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:'12px', padding:'0.9rem 1rem', marginBottom:'1.5rem' },
  ratingBig:    { fontSize:'2.2rem', fontWeight:800, color:'#92400e', lineHeight:1 },
  ratingStars:  { display:'flex', gap:'0.1rem', marginBottom:'0.1rem' },
  ratingCount:  { fontSize:'0.78rem', color:'#92400e', fontWeight:600 },

  productsTitle:{ fontWeight:700, color:'var(--text)', marginBottom:'0.8rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  productCount: { background:'var(--green-light)', color:'var(--green)', fontSize:'0.75rem', fontWeight:700, padding:'0.1rem 0.5rem', borderRadius:'20px' },
  products:     { display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1.5rem' },
  product:      { display:'flex', alignItems:'center', gap:'0.8rem', padding:'0.75rem', background:'var(--bg)', borderRadius:'10px', border:'1px solid var(--border)' },
  productEmoji: { fontSize:'1.8rem', flexShrink:0 },
  productImg:   { width:'48px', height:'48px', borderRadius:'10px', objectFit:'cover', flexShrink:0 },
  productMeta:  { fontSize:'0.8rem', color:'var(--text-2)', marginTop:'0.15rem' },

  orderSection:  { background:'var(--green-light)', border:'1px solid var(--green-border)', borderRadius:'14px', padding:'1rem 1.1rem', marginBottom:'1.5rem' },
  orderTitle:    { fontWeight:700, color:'var(--green)', fontSize:'0.9rem', margin:'0 0 0.7rem' },
  orderBtns:     { display:'flex', gap:'0.6rem' },
  btnDomicilio:  { flex:1, background:'#f59e0b', color:'#fff', border:'none', borderRadius:'10px', padding:'0.7rem 0.5rem', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' },
  btnRecoger:    { flex:1, background:'var(--green)', color:'#fff', border:'none', borderRadius:'10px', padding:'0.7rem 0.5rem', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' },
  reviewsSection:{ borderTop:'1px solid var(--border)', paddingTop:'1.2rem' },
  reviewsTitle:  { fontWeight:700, color:'var(--text)', marginBottom:'0.9rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  noReviews:     { color:'var(--text-3)', fontSize:'0.88rem' },
  reviewsList:   { display:'flex', flexDirection:'column', gap:'0.7rem' },
  reviewCard:    { background:'var(--bg)', borderRadius:'12px', padding:'0.9rem', border:'1px solid var(--border)' },
  reviewHead:    { display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.4rem' },
  reviewAvatar:  { width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.85rem', flexShrink:0 },
  reviewName:    { fontWeight:600, fontSize:'0.88rem', color:'var(--text)' },
  reviewDate:    { fontSize:'0.72rem', color:'var(--text-3)' },
  reviewStars:   { display:'flex', gap:'0.05rem', marginLeft:'auto' },
  reviewComment: { fontSize:'0.85rem', color:'var(--text-2)', margin:'0.2rem 0 0', lineHeight:1.5, fontStyle:'italic' },
  shareBtn:      { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'10px', padding:'0.5rem 0.7rem', cursor:'pointer', fontSize:'1rem', flexShrink:0 },
  galBadge:      { position:'absolute', bottom:'-2px', right:'-2px', background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:'0.58rem', fontWeight:700, borderRadius:'20px', padding:'1px 4px', cursor:'pointer' },
};
