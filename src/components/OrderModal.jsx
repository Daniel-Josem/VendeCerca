import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function OrderModal({ vendor, type, locationId, onClose }) {
  const { currentUser, userName } = useAuth();
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Determinar productos: usa locationId si viene de multi-sede, si no el selector
  const onlineLocs  = vendor.locations?.filter(l => l.isOnline) || [];
  const [selectedLocId, setSelectedLocId] = useState(locationId || onlineLocs[0]?.id || null);
  const selectedLoc = onlineLocs.find(l => l.id === selectedLocId);
  const products = selectedLoc?.products?.length
    ? selectedLoc.products
    : (vendor.products || []);
  // Si locationId ya fue pasado, no mostrar el selector de sede
  const showLocSelector = !locationId && onlineLocs.length > 1;

  const typeColor = type === 'domicilio' ? '#f59e0b' : '#2d7a2d';
  const typeLabel = type === 'domicilio' ? '🛵 A domicilio' : '🛒 Ir a comprar';

  function maxStock(p) {
    const s = parseInt(p.stock);
    return isNaN(s) || s <= 0 ? Infinity : s;
  }

  function changeQty(p, delta) {
    setQuantities(prev => {
      const current = prev[p.id] || 0;
      const next = Math.min(Math.max(0, current + delta), maxStock(p));
      return { ...prev, [p.id]: next };
    });
  }

  const selectedProducts = products
    .filter(p => (quantities[p.id] || 0) > 0)
    .map(p => ({ ...p, qty: quantities[p.id] }));

  const total = selectedProducts.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * p.qty, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedProducts.length === 0) return;
    setLoading(true);
    await addDoc(collection(db, 'orders'), {
      vendorId:     vendor.id,
      vendorName:   vendor.name,
      buyerId:      currentUser.uid,
      buyerName:    userName || currentUser.email,
      buyerEmail:   currentUser.email,
      locationId:   selectedLocId || null,
      locationName: selectedLoc?.name || null,
      type,
      products:     selectedProducts,
      notes,
      address:      type === 'domicilio' ? address : '',
      status:       'pendiente',
      createdAt:    serverTimestamp(),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>

        <div style={styles.header}>
          <span style={{ ...styles.typeBadge, background: typeColor }}>{typeLabel}</span>
          <h3 style={styles.vendorName}>{vendor.name}</h3>
        </div>

        {!currentUser ? (
          <div style={styles.centered}>
            <p style={{ color: '#555', marginBottom: '0.8rem' }}>Debes iniciar sesión para hacer un pedido.</p>
            <Link to="/login" style={styles.loginBtn} onClick={onClose}>Iniciar sesión</Link>
          </div>
        ) : done ? (
          <div style={styles.centered}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
            <h4 style={{ color: '#2d7a2d', marginBottom: '0.4rem' }}>¡Pedido enviado!</h4>
            <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.2rem' }}>
              {type === 'domicilio'
                ? 'El vendedor recibió tu pedido y pronto te confirmará.'
                : 'El vendedor sabe que vas a pasar a recoger.'}
            </p>
            <button style={{ ...styles.submitBtn, background: typeColor }} onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {showLocSelector && (
              <div style={{ marginBottom:'1rem' }}>
                <p style={styles.sectionLabel}>Selecciona la sede:</p>
                <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                  {onlineLocs.map(loc => (
                    <button key={loc.id} type="button"
                      onClick={() => { setSelectedLocId(loc.id); setQuantities({}); }}
                      style={{ padding:'0.35rem 0.8rem', border:'1.5px solid', borderColor: selectedLocId===loc.id ? typeColor : '#e5e7eb', borderRadius:'20px', background: selectedLocId===loc.id ? typeColor : '#fff', color: selectedLocId===loc.id ? '#fff' : '#333', fontSize:'0.83rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      📍 {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p style={styles.sectionLabel}>Selecciona productos{selectedLoc ? ` — ${selectedLoc.name}` : ''}:</p>

            {!products.length && (
              <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '1rem' }}>Esta sede no tiene productos registrados.</p>
            )}

            <div style={styles.productList}>
              {products.map(p => {
                const stock = parseInt(p.stock);
                const hasStock = isNaN(stock) || stock > 0;
                const qty = quantities[p.id] || 0;
                const atMax = !isNaN(stock) && stock > 0 && qty >= stock;

                return (
                  <div key={p.id} style={{ ...styles.productRow, opacity: hasStock ? 1 : 0.5 }}>
                    <div style={styles.productInfo}>
                      <span style={styles.productEmoji}>{p.emoji}</span>
                      <div>
                        <div style={styles.productName}>{p.name}</div>
                        <div style={styles.productPrice}>
                          ${p.price}/{p.unit}
                          {!isNaN(stock) && stock >= 0 && (
                            <span style={{ ...styles.stockTag, color: stock === 0 ? '#dc2626' : stock <= 3 ? '#f59e0b' : '#2d7a2d' }}>
                              {stock === 0 ? ' · Agotado' : ` · ${stock} disponibles`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={styles.qtyControl}>
                      <button type="button" style={styles.qtyBtn} onClick={() => changeQty(p, -1)} disabled={qty === 0}>−</button>
                      <span style={styles.qtyNum}>{qty}</span>
                      <button type="button" style={{ ...styles.qtyBtn, opacity: (!hasStock || atMax) ? 0.3 : 1 }} onClick={() => changeQty(p, 1)} disabled={!hasStock || atMax}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {type === 'domicilio' && (
              <div style={styles.field}>
                <label style={styles.fieldLabel}>📍 Dirección de entrega</label>
                <input
                  style={styles.input}
                  placeholder="Ej: Calle 45 #12-30, apto 201"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.fieldLabel}>📝 Notas (opcional)</label>
              <textarea
                style={{ ...styles.input, minHeight: '55px', resize: 'vertical' }}
                placeholder="Ej: Sin cebolla, maduro por favor..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {total > 0 && (
              <div style={styles.totalRow}>
                <span style={{ color: '#555' }}>Total estimado</span>
                <strong style={{ color: '#2d7a2d', fontSize: '1.1rem' }}>${total.toLocaleString()}</strong>
              </div>
            )}

            <button
              type="submit"
              disabled={selectedProducts.length === 0 || loading}
              style={{ ...styles.submitBtn, background: typeColor, opacity: selectedProducts.length === 0 || loading ? 0.5 : 1 }}
            >
              {loading ? 'Enviando...' : type === 'domicilio' ? '🛵 Pedir a domicilio' : '🛒 Confirmar que voy a ir'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modal: { background: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  closeBtn: { position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#999' },
  header: { marginBottom: '1.2rem' },
  typeBadge: { color: '#fff', fontSize: '0.82rem', fontWeight: 600, padding: '0.25rem 0.7rem', borderRadius: '20px' },
  vendorName: { margin: '0.4rem 0 0', fontSize: '1.2rem', color: '#1a1a1a' },
  centered: { textAlign: 'center', padding: '1.5rem 0' },
  loginBtn: { display: 'inline-block', background: '#2d7a2d', color: '#fff', textDecoration: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: 600 },
  sectionLabel: { fontWeight: 600, color: '#333', marginBottom: '0.6rem', fontSize: '0.9rem' },
  productList: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  productRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' },
  productInfo: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  productEmoji: { fontSize: '1.5rem' },
  productName: { fontWeight: 500, fontSize: '0.9rem' },
  productPrice: { fontSize: '0.78rem', color: '#555' },
  stockTag: { fontWeight: 600 },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  qtyBtn: { width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  qtyNum: { minWidth: '20px', textAlign: 'center', fontWeight: 600 },
  field: { marginBottom: '0.8rem' },
  fieldLabel: { display: 'block', fontSize: '0.85rem', color: '#555', fontWeight: 500, marginBottom: '0.3rem' },
  input: { width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderTop: '1px solid #e5e7eb', marginBottom: '0.8rem' },
  submitBtn: { width: '100%', color: '#fff', border: 'none', padding: '0.9rem', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
};
