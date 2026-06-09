import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import GalleryModal from './GalleryModal';

const PLATFORM_WOMPI_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY;

const PAYMENT_METHODS = [
  { key:'efectivo', label:'💵 Efectivo',               desc:'Pagas al recibir' },
  { key:'nequi',    label:'📱 Nequi/Daviplata',        desc:'Transferencia digital' },
  { key:'tarjeta',  label:'💳 Tarjeta / PSE en línea', desc:'Pago seguro — tarjeta o PSE' },
];

export default function OrderModal({ vendor, type, locationId, onClose }) {
  const { currentUser, userName } = useAuth();
  const [quantities,      setQuantities]      = useState({});
  const [notes,           setNotes]           = useState('');
  const [address,         setAddress]         = useState('');
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [couponCode,      setCouponCode]      = useState('');
  const [couponMsg,       setCouponMsg]       = useState(null); // {ok, text, discount, type}
  const [appliedCoupon,   setAppliedCoupon]   = useState(null);
  const [paymentMethod,   setPaymentMethod]   = useState('efectivo');
  const [galleryProduct,  setGalleryProduct]  = useState(null); // {images, name}

  const onlineLocs  = vendor.locations?.filter(l => l.isOnline) || [];
  const [selectedLocId, setSelectedLocId] = useState(locationId || onlineLocs[0]?.id || null);
  const selectedLoc = onlineLocs.find(l => l.id === selectedLocId);
  const products = selectedLoc?.products?.length
    ? selectedLoc.products
    : (vendor.products || []);
  const showLocSelector = !locationId && onlineLocs.length > 1;

  const typeColor = type === 'domicilio' ? '#f59e0b' : '#2d7a2d';
  const typeLabel = type === 'domicilio' ? '🛵 A domicilio' : '🛒 Ir a comprar';

  // Payment options available for this vendor
  const availablePayments = PAYMENT_METHODS.filter(m => {
    if (m.key === 'nequi')   return !!vendor.nequiNumber;
    if (m.key === 'tarjeta') return !!PLATFORM_WOMPI_KEY;
    return true;
  });

  function maxStock(p) {
    const s = parseInt(p.stock);
    return isNaN(s) || s <= 0 ? Infinity : s;
  }
  function changeQty(p, delta) {
    setQuantities(prev => {
      const next = Math.min(Math.max(0, (prev[p.id] || 0) + delta), maxStock(p));
      return { ...prev, [p.id]: next };
    });
  }

  const selectedProducts = products
    .filter(p => (quantities[p.id] || 0) > 0)
    .map(p => ({ ...p, qty: quantities[p.id] }));

  const subtotal = selectedProducts.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * p.qty, 0);
  const discountAmount = appliedCoupon
    ? (appliedCoupon.type === 'percent'
        ? Math.round(subtotal * appliedCoupon.discount / 100)
        : Math.min(appliedCoupon.discount, subtotal))
    : 0;
  const total = subtotal - discountAmount;

  function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const coupons = vendor.coupons || [];
    const coupon  = coupons.find(c =>
      c.code.toUpperCase() === code &&
      c.active &&
      (c.maxUses ? c.usedCount < c.maxUses : true)
    );
    if (!coupon) {
      setCouponMsg({ ok:false, text:'Cupón no válido o expirado.' });
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(coupon);
    const label = coupon.type === 'percent' ? `${coupon.discount}%` : `$${coupon.discount.toLocaleString()}`;
    setCouponMsg({ ok:true, text:`✅ Cupón aplicado — ${label} de descuento` });
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedProducts.length === 0) return;
    setLoading(true);

    await addDoc(collection(db, 'orders'), {
      vendorId:       vendor.id,
      vendorName:     vendor.name,
      buyerId:        currentUser.uid,
      buyerName:      userName || currentUser.email,
      buyerEmail:     currentUser.email,
      locationId:     selectedLocId || null,
      locationName:   selectedLoc?.name || null,
      type,
      products:       selectedProducts,
      notes,
      address:        type === 'domicilio' ? address : '',
      status:         'pendiente',
      paymentMethod,
      couponCode:     appliedCoupon?.code || null,
      discountAmount: discountAmount || null,
      total,
      createdAt:      serverTimestamp(),
    });

    fetch('/api/notify-vendor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId:  vendor.id,
        buyerName: userName || currentUser.email,
        type,
        products:  selectedProducts,
      }),
    }).catch(() => {});

    setLoading(false);
    setDone(true);
  }

  function getProductImages(p) {
    if (p.images?.length) return p.images;
    if (p.imageURL) return [p.imageURL];
    return null;
  }

  function openWompi() {
    const ref = `vc-${vendor.id.slice(0,6)}-${Date.now()}`;
    const amountCents = total * 100;
    const url = `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(PLATFORM_WOMPI_KEY)}&currency=COP&amount-in-cents=${amountCents}&reference=${ref}`;
    window.open(url, '_blank', 'width=600,height=700');
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
            <p style={{ color:'#555', marginBottom:'0.8rem' }}>Debes iniciar sesión para hacer un pedido.</p>
            <Link to="/login" style={styles.loginBtn} onClick={onClose}>Iniciar sesión</Link>
          </div>
        ) : done ? (
          <DoneScreen type={type} typeColor={typeColor} paymentMethod={paymentMethod} vendor={vendor} total={total} onClose={onClose} />
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
              <p style={{ color:'#aaa', fontSize:'0.9rem', marginBottom:'1rem' }}>Esta sede no tiene productos registrados.</p>
            )}

            <div style={styles.productList}>
              {products.map(p => {
                const stock   = parseInt(p.stock);
                const hasStock = isNaN(stock) || stock > 0;
                const qty      = quantities[p.id] || 0;
                const atMax    = !isNaN(stock) && stock > 0 && qty >= stock;
                const imgs     = getProductImages(p);

                return (
                  <div key={p.id} style={{ ...styles.productRow, opacity: hasStock ? 1 : 0.5 }}>
                    <div style={styles.productInfo}>
                      {imgs ? (
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <img src={imgs[0]} alt={p.name} style={styles.productImg}
                            onClick={() => imgs.length > 1 && setGalleryProduct({ images:imgs, name:p.name })}
                            title={imgs.length > 1 ? 'Ver galería' : undefined}
                          />
                          {imgs.length > 1 && (
                            <span style={styles.imgCount} onClick={() => setGalleryProduct({ images:imgs, name:p.name })}>
                              +{imgs.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={styles.productEmoji}>{p.emoji}</span>
                      )}
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
                <input style={styles.input} placeholder="Ej: Calle 45 #12-30, apto 201"
                  value={address} onChange={e => setAddress(e.target.value)} required />
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.fieldLabel}>📝 Notas (opcional)</label>
              <textarea style={{ ...styles.input, minHeight:'55px', resize:'vertical' }}
                placeholder="Ej: Sin cebolla, maduro por favor..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            {/* ── Cupón ── */}
            {(vendor.coupons || []).some(c => c.active) && (
              <div style={styles.field}>
                <label style={styles.fieldLabel}>🎟️ Cupón de descuento</label>
                {appliedCoupon ? (
                  <div style={styles.couponApplied}>
                    <span>{couponMsg?.text}</span>
                    <button type="button" style={styles.couponRemove} onClick={removeCoupon}>✕ Quitar</button>
                  </div>
                ) : (
                  <div style={styles.couponRow}>
                    <input style={{ ...styles.input, flex:1 }}
                      placeholder="Código (ej: PROMO10)"
                      value={couponCode}
                      onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg(null); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                    />
                    <button type="button" style={styles.couponApplyBtn} onClick={applyCoupon}>Aplicar</button>
                  </div>
                )}
                {couponMsg && !couponMsg.ok && (
                  <p style={{ fontSize:'0.78rem', color:'#dc2626', margin:'0.25rem 0 0' }}>{couponMsg.text}</p>
                )}
              </div>
            )}

            {/* ── Total ── */}
            {subtotal > 0 && (
              <div style={styles.totalSection}>
                {appliedCoupon && (
                  <div style={styles.totalRow}>
                    <span style={{ color:'#555' }}>Subtotal</span>
                    <span>${subtotal.toLocaleString()}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div style={styles.totalRow}>
                    <span style={{ color:'#16a34a' }}>Descuento 🎟️</span>
                    <span style={{ color:'#16a34a' }}>−${discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ ...styles.totalRow, borderTop: appliedCoupon ? '1px solid #e5e7eb' : 'none', paddingTop: appliedCoupon ? '0.4rem' : 0, marginTop: appliedCoupon ? '0.3rem' : 0 }}>
                  <span style={{ color:'#555', fontWeight:600 }}>Total estimado</span>
                  <strong style={{ color:'#2d7a2d', fontSize:'1.1rem' }}>${total.toLocaleString()}</strong>
                </div>
              </div>
            )}

            {/* ── Método de pago ── */}
            {availablePayments.length > 1 && (
              <div style={styles.field}>
                <label style={styles.fieldLabel}>💳 Método de pago</label>
                <div style={styles.paymentGrid}>
                  {availablePayments.map(m => (
                    <button key={m.key} type="button"
                      onClick={() => setPaymentMethod(m.key)}
                      style={{ ...styles.paymentBtn, ...(paymentMethod === m.key ? styles.paymentBtnActive : {}) }}>
                      <span style={styles.paymentLabel}>{m.label}</span>
                      <span style={styles.paymentDesc}>{m.desc}</span>
                    </button>
                  ))}
                </div>
                {paymentMethod === 'nequi' && vendor.nequiNumber && (
                  <div style={styles.paymentInfo}>
                    <p style={{ margin:0 }}>Envía el pago al número:</p>
                    <strong style={{ fontSize:'1rem' }}>{vendor.nequiNumber}</strong>
                    <p style={{ margin:'0.2rem 0 0', fontSize:'0.78rem', color:'#555' }}>
                      Adjunta el comprobante en las notas del pedido.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botón Wompi (tarjeta) antes de confirmar */}
            {paymentMethod === 'tarjeta' && PLATFORM_WOMPI_KEY && total > 0 && (
              <button type="button" style={styles.wompiBtn} onClick={() => {
                const ref = `vc-${vendor.id.slice(0,6)}-${Date.now()}`;
                window.open(`https://checkout.wompi.co/p/?public-key=${encodeURIComponent(PLATFORM_WOMPI_KEY)}&currency=COP&amount-in-cents=${total * 100}&reference=${ref}`, '_blank', 'width=600,height=700');
              }}>
                💳 Pagar ${total.toLocaleString()} con tarjeta (Wompi)
              </button>
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

      {galleryProduct && (
        <GalleryModal
          images={galleryProduct.images}
          productName={galleryProduct.name}
          onClose={() => setGalleryProduct(null)}
        />
      )}
    </div>
  );
}

function DoneScreen({ type, typeColor, paymentMethod, vendor, total, onClose }) {
  return (
    <div style={styles.centered}>
      <div style={{ fontSize:'3rem', marginBottom:'0.5rem' }}>✅</div>
      <h4 style={{ color:'#2d7a2d', marginBottom:'0.4rem' }}>¡Pedido enviado!</h4>
      <p style={{ color:'#555', fontSize:'0.9rem', lineHeight:1.5, marginBottom:'0.8rem' }}>
        {type === 'domicilio'
          ? 'El vendedor recibió tu pedido y pronto te confirmará.'
          : 'El vendedor sabe que vas a pasar a recoger.'}
      </p>
      {paymentMethod === 'nequi' && vendor.nequiNumber && (
        <div style={styles.donePaymentInfo}>
          <p style={{ margin:'0 0 0.3rem', fontWeight:600, fontSize:'0.9rem' }}>📱 Envía tu pago por Nequi/Daviplata</p>
          <div style={styles.doneNequiNum}>{vendor.nequiNumber}</div>
          <p style={{ margin:'0.4rem 0 0', fontSize:'0.78rem', color:'#555' }}>Total: <strong>${total.toLocaleString()}</strong></p>
        </div>
      )}
      {paymentMethod === 'tarjeta' && PLATFORM_WOMPI_KEY && total > 0 && (
        <button style={styles.wompiBtn} onClick={() => {
          const ref = `vc-${vendor.id.slice(0,6)}-${Date.now()}`;
          window.open(`https://checkout.wompi.co/p/?public-key=${encodeURIComponent(PLATFORM_WOMPI_KEY)}&currency=COP&amount-in-cents=${total * 100}&reference=${ref}`, '_blank', 'width=600,height=700');
        }}>
          💳 Pagar ${total.toLocaleString()} ahora
        </button>
      )}
      <button style={{ ...styles.submitBtn, background: typeColor, marginTop:'0.8rem' }} onClick={onClose}>Cerrar</button>
    </div>
  );
}

const styles = {
  overlay:       { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  modal:         { background:'#fff', borderRadius:'16px', padding:'1.5rem', width:'100%', maxWidth:'420px', maxHeight:'90vh', overflowY:'auto', position:'relative' },
  closeBtn:      { position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'#999' },
  header:        { marginBottom:'1.2rem' },
  typeBadge:     { color:'#fff', fontSize:'0.82rem', fontWeight:600, padding:'0.25rem 0.7rem', borderRadius:'20px' },
  vendorName:    { margin:'0.4rem 0 0', fontSize:'1.2rem', color:'#1a1a1a' },
  centered:      { textAlign:'center', padding:'1.5rem 0' },
  loginBtn:      { display:'inline-block', background:'#2d7a2d', color:'#fff', textDecoration:'none', padding:'0.6rem 1.5rem', borderRadius:'8px', fontWeight:600 },
  sectionLabel:  { fontWeight:600, color:'#333', marginBottom:'0.6rem', fontSize:'0.9rem' },
  productList:   { display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'1rem' },
  productRow:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.6rem', background:'#f9fafb', borderRadius:'10px', border:'1px solid #e5e7eb' },
  productInfo:   { display:'flex', alignItems:'center', gap:'0.6rem' },
  productEmoji:  { fontSize:'1.5rem', width:'40px', textAlign:'center', flexShrink:0 },
  productImg:    { width:'40px', height:'40px', borderRadius:'8px', objectFit:'cover', flexShrink:0, cursor:'pointer' },
  imgCount:      { position:'absolute', bottom:'-2px', right:'-4px', background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:'0.6rem', fontWeight:700, borderRadius:'20px', padding:'0 3px', cursor:'pointer', lineHeight:'16px' },
  productName:   { fontWeight:500, fontSize:'0.9rem' },
  productPrice:  { fontSize:'0.78rem', color:'#555' },
  stockTag:      { fontWeight:600 },
  qtyControl:    { display:'flex', alignItems:'center', gap:'0.5rem' },
  qtyBtn:        { width:'28px', height:'28px', borderRadius:'50%', border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' },
  qtyNum:        { minWidth:'20px', textAlign:'center', fontWeight:600 },
  field:         { marginBottom:'0.8rem' },
  fieldLabel:    { display:'block', fontSize:'0.85rem', color:'#555', fontWeight:500, marginBottom:'0.3rem' },
  input:         { width:'100%', padding:'0.6rem 0.8rem', borderRadius:'8px', border:'1px solid #ddd', fontSize:'0.9rem', fontFamily:'inherit', boxSizing:'border-box' },
  couponRow:     { display:'flex', gap:'0.4rem' },
  couponApplyBtn:{ padding:'0.6rem 1rem', background:'#f0f7f0', color:'#2d7a2d', border:'1.5px solid #86efac', borderRadius:'8px', cursor:'pointer', fontWeight:600, fontSize:'0.85rem', whiteSpace:'nowrap', fontFamily:'inherit' },
  couponApplied: { display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'0.5rem 0.7rem', fontSize:'0.85rem', color:'#166534', fontWeight:600 },
  couponRemove:  { background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'0.8rem', fontFamily:'inherit' },
  totalSection:  { padding:'0.5rem 0', borderTop:'1px solid #e5e7eb', marginBottom:'0.8rem' },
  totalRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.2rem 0', fontSize:'0.9rem' },
  paymentGrid:   { display:'flex', flexDirection:'column', gap:'0.4rem' },
  paymentBtn:    { display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'0.5rem 0.8rem', border:'1.5px solid #e5e7eb', borderRadius:'10px', background:'#fff', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', textAlign:'left' },
  paymentBtnActive: { borderColor:'#2d7a2d', background:'#f0f7f0' },
  paymentLabel:  { fontSize:'0.88rem', fontWeight:600, color:'#1a1a1a' },
  paymentDesc:   { fontSize:'0.73rem', color:'#888' },
  paymentInfo:   { background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:'8px', padding:'0.6rem 0.8rem', marginTop:'0.4rem', fontSize:'0.85rem', color:'#1e40af', textAlign:'center' },
  submitBtn:     { width:'100%', color:'#fff', border:'none', padding:'0.9rem', borderRadius:'10px', fontSize:'1rem', cursor:'pointer', fontWeight:700, fontFamily:'inherit' },
  wompiBtn:      { width:'100%', background:'#5b21b6', color:'#fff', border:'none', padding:'0.75rem', borderRadius:'10px', fontSize:'0.9rem', cursor:'pointer', fontWeight:600, fontFamily:'inherit', marginBottom:'0.5rem' },
  donePaymentInfo:{ background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:'12px', padding:'0.8rem', marginBottom:'0.8rem' },
  doneNequiNum:  { fontSize:'1.3rem', fontWeight:800, color:'#1e40af', letterSpacing:'0.05em' },
};
