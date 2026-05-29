import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function VendorProfile() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [vendor, setVendor] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'vendors', id)).then(snap => {
      if (snap.exists()) setVendor({ id: snap.id, ...snap.data() });
    });
  }, [id]);

  async function handleRate(stars) {
    if (rated || !currentUser || currentUser.uid === id) return;
    setUserRating(stars);
    setRated(true);
    const newCount = (vendor.ratingsCount || 0) + 1;
    const newRating = ((vendor.rating || 0) * (vendor.ratingsCount || 0) + stars) / newCount;
    await updateDoc(doc(db, 'vendors', id), { rating: newRating, ratingsCount: newCount });
    setVendor(v => ({ ...v, rating: newRating, ratingsCount: newCount }));
  }

  if (!vendor) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.avatar}>{vendor.name?.[0]?.toUpperCase()}</div>
          <div>
            <h2 style={styles.name}>{vendor.name}</h2>
            <span style={styles.badge(vendor.isOnline)}>{vendor.isOnline ? '🟢 En línea' : '⚫ Offline'}</span>
          </div>
        </div>

        {vendor.description && <p style={styles.description}>{vendor.description}</p>}

        {vendor.phone && (
          <a
            href={`https://wa.me/${vendor.phone.replace(/\D/g, '')}`}
            target="_blank" rel="noreferrer"
            style={styles.whatsapp}
          >
            📱 Contactar por WhatsApp
          </a>
        )}

        <div style={styles.ratingSection}>
          <p style={styles.ratingTitle}>Calificación</p>
          <div style={styles.stars}>
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => handleRate(s)}
                style={{ ...styles.star, color: s <= (userRating || Math.round(vendor.rating)) ? '#f59e0b' : '#d1d5db' }}
                disabled={rated || !currentUser || currentUser?.uid === id}
                title={!currentUser ? 'Inicia sesión para calificar' : ''}>
                ★
              </button>
            ))}
          </div>
          <p style={styles.ratingMeta}>{vendor.rating > 0 ? `${vendor.rating.toFixed(1)} (${vendor.ratingsCount} reseñas)` : 'Sin calificaciones aún'}</p>
          {rated && <p style={{ color: '#2d7a2d', fontSize: '0.85rem' }}>¡Gracias por tu calificación!</p>}
          {!currentUser && <p style={{ color: '#888', fontSize: '0.8rem' }}>Inicia sesión para calificar</p>}
        </div>

        <h3 style={styles.productsTitle}>Productos disponibles</h3>
        <div style={styles.products}>
          {vendor.products?.length === 0 && <p style={{ color: '#aaa' }}>No hay productos registrados</p>}
          {vendor.products?.map(p => (
            <div key={p.id} style={styles.product}>
              <span style={styles.productEmoji}>{p.emoji}</span>
              <div>
                <strong>{p.name}</strong>
                <div style={styles.productMeta}>${p.price} / {p.unit} {p.stock ? `· Stock: ${p.stock}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: 'calc(100vh - 56px)', background: '#f0f7f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem' },
  card: { background: '#fff', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' },
  avatar: { width: '60px', height: '60px', borderRadius: '50%', background: '#2d7a2d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700, flexShrink: 0 },
  name: { margin: '0 0 0.3rem', fontSize: '1.4rem', color: '#1a1a1a' },
  badge: (online) => ({ fontSize: '0.85rem', background: online ? '#f0fdf4' : '#f9fafb', color: online ? '#166534' : '#6b7280', padding: '0.2rem 0.6rem', borderRadius: '20px', border: `1px solid ${online ? '#86efac' : '#e5e7eb'}` }),
  description: { color: '#555', fontSize: '0.95rem', marginBottom: '1.2rem', lineHeight: 1.5 },
  whatsapp: { display: 'inline-block', background: '#25d366', color: '#fff', textDecoration: 'none', padding: '0.7rem 1.2rem', borderRadius: '10px', fontWeight: 600, marginBottom: '1.5rem', fontSize: '0.95rem' },
  ratingSection: { borderTop: '1px solid #e5e7eb', paddingTop: '1.2rem', marginBottom: '1.5rem' },
  ratingTitle: { margin: '0 0 0.5rem', fontWeight: 600, color: '#333' },
  stars: { display: 'flex', gap: '0.3rem', marginBottom: '0.3rem' },
  star: { background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', padding: 0 },
  ratingMeta: { color: '#888', fontSize: '0.85rem', margin: '0.3rem 0 0' },
  productsTitle: { fontWeight: 600, color: '#1a1a1a', marginBottom: '0.8rem' },
  products: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  product: { display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' },
  productEmoji: { fontSize: '1.8rem' },
  productMeta: { fontSize: '0.8rem', color: '#666', marginTop: '0.1rem' },
};
