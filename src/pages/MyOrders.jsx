import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import RatingModal from '../components/RatingModal';
import OrderModal from '../components/OrderModal';
import { useToast } from '../context/ToastContext';

const STATUS_COLOR = {
  pendiente:  '#f59e0b',
  en_camino:  '#3b82f6',
  listo:      '#8b5cf6',
  completado: '#2d7a2d',
  cancelado:  '#dc2626',
};
const STATUS_LABEL = {
  pendiente:  'Pendiente',
  en_camino:  'En camino 🛵',
  listo:      'Listo para recoger',
  completado: 'Completado ✅',
  cancelado:  'Cancelado',
};

const ORDER_GROUPS = [
  { key:'pending',   label:'Pendientes',  icon:'🕐', statuses:['pendiente'],         color:'#f59e0b', defaultOpen:true  },
  { key:'active',    label:'En proceso',  icon:'🔵', statuses:['en_camino','listo'], color:'#3b82f6', defaultOpen:true  },
  { key:'completed', label:'Completados', icon:'✅', statuses:['completado'],        color:'#2d7a2d', defaultOpen:true  },
  { key:'cancelled', label:'Cancelados',  icon:'✕',  statuses:['cancelado'],         color:'#dc2626', defaultOpen:false },
];

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}
function calcTotal(products) {
  return (products || []).reduce((sum, p) => sum + (parseFloat(p.price)||0) * (p.qty||1), 0);
}

function OrderSection({ group, orders, ratedOrderIds, onRate, onRepeat }) {
  const [open, setOpen] = useState(group.defaultOpen);
  const filtered = orders.filter(o => group.statuses.includes(o.status));
  if (filtered.length === 0) return null;

  return (
    <div style={s.section} className="anim-fade-up">
      <button style={{ ...s.sectionHead, borderLeft:`4px solid ${group.color}` }} onClick={() => setOpen(o => !o)}>
        <div style={s.sectionHeadLeft}>
          <span style={{ ...s.dot, background: group.color }} />
          <span style={s.sectionLabel}>{group.icon} {group.label}</span>
          <span style={{ ...s.countBadge, background: group.color }}>{filtered.length}</span>
        </div>
        <span style={s.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={s.cardList}>
          {filtered.map(order => {
            const total   = calcTotal(order.products);
            const isRated = ratedOrderIds.has(order.id);

            return (
              <div key={order.id} style={{ ...s.card, borderLeft:`4px solid ${STATUS_COLOR[order.status]||'#ccc'}` }}>
                <div style={s.cardHead}>
                  <div style={s.cardHeadLeft}>
                    <span style={{ ...s.typePill, background: order.type==='domicilio'?'#fef3c7':'#f0f7f0', color: order.type==='domicilio'?'#92400e':'#166534' }}>
                      {order.type==='domicilio' ? '🛵 Domicilio' : '🛒 Retiro'}
                    </span>
                    <strong style={s.vendorName}>{order.vendorName}</strong>
                    {order.locationName && <span style={s.locPill}>📍 {order.locationName}</span>}
                  </div>
                  <span style={{ ...s.statusPill, background: STATUS_COLOR[order.status]||'#999' }}>
                    {STATUS_LABEL[order.status]||order.status}
                  </span>
                </div>

                <div style={s.prodGrid}>
                  {order.products?.map((p, i) => (
                    <div key={i} style={s.prodItem}>
                      {p.imageURL
                        ? <img src={p.imageURL} alt={p.name} style={s.prodImg} />
                        : <span style={s.prodEmoji}>{p.emoji}</span>
                      }
                      <div>
                        <div style={s.prodName}>{p.name} <span style={s.prodQty}>×{p.qty}</span></div>
                        <div style={s.prodPrice}>${((parseFloat(p.price)||0)*p.qty).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {order.address && <p style={s.meta}>📍 {order.address}</p>}
                {order.notes   && <p style={s.meta}>📝 {order.notes}</p>}

                <div style={s.cardFoot}>
                  <div style={s.dateRow}>
                    <span>📅 {formatDate(order.createdAt)}</span>
                    <span>🕐 {formatTime(order.createdAt)}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                    {total > 0 && (
                      <div style={s.totalBox}>
                        Total <strong style={s.totalAmt}>${total.toLocaleString()}</strong>
                      </div>
                    )}
                    {(order.status === 'completado' || order.status === 'cancelado') && (
                      <button style={s.repeatBtn} onClick={() => onRepeat(order)}>🔁 Repetir</button>
                    )}
                    {order.status === 'completado' && (
                      isRated
                        ? <span style={s.ratedBadge}>⭐ Reseña enviada</span>
                        : <button style={s.rateBtn} onClick={() => onRate(order)}>⭐ Calificar</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyOrders() {
  const { currentUser }   = useAuth();
  const navigate          = useNavigate();
  const toast             = useToast();
  const [orders,  setOrders]        = useState([]);
  const [loading, setLoading]       = useState(true);
  const [ratingOrder,  setRatingOrder]  = useState(null);
  const [repeatModal,  setRepeatModal]  = useState(null);
  const [ratedOrderIds, setRatedOrderIds] = useState(new Set());

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    const q = query(collection(db, 'orders'), where('buyerId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      setOrders(list);
      setLoading(false);
    });
  }, [currentUser, navigate]);

  // Cargar IDs de pedidos ya calificados por este usuario
  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(collection(db, 'reviews'), where('buyerId', '==', currentUser.uid)))
      .then(snap => setRatedOrderIds(new Set(snap.docs.map(d => d.data().orderId))));
  }, [currentUser]);

  function handleRateDone() {
    setRatedOrderIds(prev => new Set([...prev, ratingOrder.id]));
    setRatingOrder(null);
  }

  async function handleRepeat(order) {
    const snap = await getDoc(doc(db, 'vendors', order.vendorId));
    if (!snap.exists() || !snap.data().isOnline) {
      toast.warning('Este vendedor no está en línea en este momento');
      return;
    }
    setRepeatModal({ vendor: { id: snap.id, ...snap.data() }, type: order.type, locationId: order.locationId || null });
  }

  const total = orders.reduce((sum, o) => o.status === 'completado' ? sum + calcTotal(o.products) : sum, 0);

  if (loading) return <div style={s.loading}>Cargando tus pedidos...</div>;

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <BackButton to="/" label="Volver al mapa" />
          <div style={s.headerInfo}>
            <h2 style={s.title}>Mis pedidos</h2>
            <p style={s.subtitle}>
              {orders.length} pedido{orders.length!==1?'s':''} en total
              {total > 0 && <> · <span style={{ color:'var(--green)', fontWeight:700 }}>${total.toLocaleString()} gastados</span></>}
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div style={s.empty} className="anim-scale-in">
            <div style={s.emptyIcon}>🛒</div>
            <h3 style={s.emptyTitle}>Sin pedidos aún</h3>
            <p style={s.emptySub}>Encuentra vendedores en el mapa y haz tu primer pedido</p>
            <BackButton to="/" label="Buscar vendedores" />
          </div>
        ) : (
          <div style={s.groups}>
            {ORDER_GROUPS.map(group => (
              <OrderSection
                key={group.key}
                group={group}
                orders={orders}
                ratedOrderIds={ratedOrderIds}
                onRate={setRatingOrder}
                onRepeat={handleRepeat}
              />
            ))}
          </div>
        )}
      </div>

      {ratingOrder && (
        <RatingModal
          order={ratingOrder}
          vendor={null}
          onClose={() => setRatingOrder(null)}
          onDone={handleRateDone}
        />
      )}
      {repeatModal && (
        <OrderModal
          vendor={repeatModal.vendor}
          type={repeatModal.type}
          locationId={repeatModal.locationId}
          onClose={() => setRepeatModal(null)}
        />
      )}
    </div>
  );
}

const s = {
  page:       { background:'var(--bg)', minHeight:'calc(100vh - 60px)', padding:'1.5rem 1rem' },
  container:  { maxWidth:'620px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'1.2rem' },
  loading:    { padding:'3rem', textAlign:'center', color:'var(--text-3)' },

  header:     { display:'flex', flexDirection:'column', gap:'0.6rem' },
  headerInfo: {},
  title:      { fontSize:'1.5rem', fontWeight:800, color:'var(--text)', margin:'0.2rem 0 0' },
  subtitle:   { fontSize:'0.88rem', color:'var(--text-2)', margin:0 },
  groups:     { display:'flex', flexDirection:'column', gap:'0.7rem' },

  section:    { background:'#fff', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)' },
  sectionHead:{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.85rem 1rem', background:'var(--bg)', border:'none', cursor:'pointer', fontFamily:'inherit' },
  sectionHeadLeft:{ display:'flex', alignItems:'center', gap:'0.5rem' },
  dot:        { width:'10px', height:'10px', borderRadius:'50%', flexShrink:0 },
  sectionLabel:{ fontWeight:700, fontSize:'0.92rem', color:'var(--text)' },
  countBadge: { color:'#fff', fontSize:'0.72rem', fontWeight:700, padding:'0.1rem 0.45rem', borderRadius:'20px', minWidth:'20px', textAlign:'center' },
  chevron:    { fontSize:'0.7rem', color:'var(--text-3)' },
  cardList:   { padding:'0.6rem', display:'flex', flexDirection:'column', gap:'0.6rem' },

  card:       { background:'var(--bg)', borderRadius:'var(--radius)', padding:'0.9rem', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'0.5rem' },
  cardHead:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'0.35rem' },
  cardHeadLeft:{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap' },
  typePill:   { fontSize:'0.75rem', fontWeight:600, padding:'0.18rem 0.55rem', borderRadius:'20px', flexShrink:0 },
  vendorName: { fontSize:'0.95rem', color:'var(--text)' },
  locPill:    { fontSize:'0.72rem', color:'#888', background:'#f3f4f6', padding:'0.1rem 0.4rem', borderRadius:'20px' },
  statusPill: { color:'#fff', fontSize:'0.72rem', fontWeight:700, padding:'0.18rem 0.55rem', borderRadius:'20px', flexShrink:0 },

  prodGrid:   { display:'flex', flexDirection:'column', gap:'0.3rem', background:'#fff', borderRadius:'var(--radius-sm)', padding:'0.5rem 0.6rem', border:'1px solid var(--border)' },
  prodItem:   { display:'flex', alignItems:'center', gap:'0.6rem' },
  prodEmoji:  { fontSize:'1.3rem', flexShrink:0 },
  prodImg:    { width:'36px', height:'36px', borderRadius:'6px', objectFit:'cover', flexShrink:0 },
  prodName:   { fontSize:'0.88rem', fontWeight:500, color:'var(--text)' },
  prodQty:    { color:'var(--text-3)', fontWeight:400 },
  prodPrice:  { fontSize:'0.78rem', color:'var(--green)', fontWeight:700 },

  meta:       { fontSize:'0.8rem', color:'var(--text-2)', margin:0 },

  cardFoot:   { display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'0.5rem', borderTop:'1px solid var(--border)', flexWrap:'wrap', gap:'0.4rem' },
  dateRow:    { display:'flex', gap:'0.7rem', fontSize:'0.78rem', color:'var(--text-3)' },
  totalBox:   { fontSize:'0.85rem', color:'var(--text-2)' },
  totalAmt:   { color:'var(--green)', fontSize:'0.95rem' },

  repeatBtn:  { background:'#eff6ff', color:'#1d4ed8', border:'1px solid #93c5fd', padding:'0.3rem 0.8rem', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  rateBtn:    { background:'#fef3c7', color:'#92400e', border:'1px solid #fcd34d', padding:'0.3rem 0.8rem', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  ratedBadge: { background:'#f0fdf4', color:'#166534', border:'1px solid #86efac', padding:'0.3rem 0.8rem', borderRadius:'20px', fontSize:'0.78rem', fontWeight:600 },

  empty:      { background:'#fff', borderRadius:'var(--radius-lg)', padding:'3rem 2rem', textAlign:'center', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem' },
  emptyIcon:  { fontSize:'3.5rem' },
  emptyTitle: { fontSize:'1.2rem', fontWeight:700, color:'var(--text)', margin:0 },
  emptySub:   { fontSize:'0.9rem', color:'var(--text-2)', margin:0 },
};
