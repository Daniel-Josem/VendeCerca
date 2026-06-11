import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, addDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import BackButton from '../components/BackButton';

const STATUS_COLOR = { pendiente:'#f59e0b', en_camino:'#3b82f6', listo:'#8b5cf6', completado:'#16a34a', cancelado:'#dc2626' };
const STATUS_LABEL = { pendiente:'Pendiente', en_camino:'En camino', listo:'Listo', completado:'Completado', cancelado:'Cancelado' };

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
}
function calcTotal(products) {
  return (products||[]).reduce((sum,p)=>sum+(parseFloat(p.price)||0)*(p.qty||1),0);
}

export default function AdminPanel() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  const [tab,      setTab]     = useState('metrics');
  const [vendors,  setVendors] = useState([]);
  const [orders,   setOrders]  = useState([]);
  const [loading,  setLoading] = useState(true);
  const [payingId, setPayingId]= useState(null);

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    if (userRole && userRole !== 'admin') { navigate('/'); return; }
  }, [currentUser, userRole, navigate]);

  useEffect(() => {
    if (!currentUser || userRole === null) return; // aún cargando rol
    if (userRole !== 'admin') { setLoading(false); return; }
    Promise.all([
      getDocs(collection(db, 'vendors')),
      getDocs(collection(db, 'orders')),
    ]).then(([vSnap, oSnap]) => {
      const allOrders = oSnap.docs
        .map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
        .slice(0, 60);
      setVendors(vSnap.docs.map(d => ({ id:d.id, ...d.data() })));
      setOrders(allOrders);
      setLoading(false);
    }).catch(err => {
      console.error('AdminPanel error:', err);
      toast.error('Error cargando datos. Verifica que el rol esté configurado.');
      setLoading(false);
    });
  }, [currentUser, userRole]);

  async function markPaid(vendor) {
    const pending = (vendor.balance || 0) - (vendor.paidOut || 0);
    if (pending <= 0 || payingId) return;
    if (!window.confirm(`¿Registrar pago de $${pending.toLocaleString()} a ${vendor.name}?\n\nAsegúrate de haber realizado la transferencia antes de confirmar.`)) return;
    setPayingId(vendor.id);
    await Promise.all([
      updateDoc(doc(db, 'vendors', vendor.id), { paidOut: increment(pending) }),
      addDoc(collection(db, 'payouts'), {
        vendorId:   vendor.id,
        vendorName: vendor.name,
        amount:     pending,
        paidAt:     serverTimestamp(),
        adminId:    currentUser.uid,
      }),
    ]);
    setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, paidOut: (v.paidOut||0) + pending } : v));
    setPayingId(null);
    toast.success(`Pago de $${pending.toLocaleString()} registrado para ${vendor.name}`);
  }

  async function toggleOnline(vendorId, current) {
    await updateDoc(doc(db, 'vendors', vendorId), { isOnline: !current });
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isOnline: !current } : v));
    toast.success(!current ? 'Vendedor puesto en línea' : 'Vendedor desconectado');
  }

  async function approveVerification(vendorId) {
    await updateDoc(doc(db, 'vendors', vendorId), {
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: serverTimestamp(),
    });
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, isVerified: true, verificationStatus: 'approved' } : v));
    toast.success('Vendedor verificado ✅');
  }

  async function rejectVerification(vendorId) {
    await updateDoc(doc(db, 'vendors', vendorId), { verificationStatus: 'rejected' });
    setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, verificationStatus: 'rejected' } : v));
    toast.info('Verificación rechazada');
  }

  // ── Métricas globales ────────────────────────────
  const completed     = orders.filter(o => o.status === 'completado');
  const pending       = orders.filter(o => o.status === 'pendiente');
  const active        = orders.filter(o => ['en_camino','listo'].includes(o.status));
  const totalRevenue  = completed.reduce((sum,o) => sum + calcTotal(o.products), 0);
  const todayStart    = new Date(new Date().setHours(0,0,0,0)).getTime() / 1000;
  const todayOrders   = orders.filter(o => (o.createdAt?.seconds||0) >= todayStart);
  const todayRevenue  = completed.filter(o => (o.createdAt?.seconds||0) >= todayStart)
                                 .reduce((sum,o) => sum + calcTotal(o.products), 0);
  const onlineVendors = vendors.filter(v => v.isOnline);
  const avgRating     = vendors.filter(v=>v.rating>0).reduce((s,v,_,a)=>s+v.rating/a.length,0);

  if (!currentUser) return null;
  if (userRole && userRole !== 'admin') return <div style={s.loading}>⛔ Sin acceso. Esta página es solo para administradores.</div>;
  if (loading) return <div style={s.loading}>⏳ Cargando datos del sistema...</div>;

  const vendorsWithPending = vendors.filter(v => (v.balance||0) - (v.paidOut||0) > 0);

  const pendingVerifs = vendors.filter(v => v.verificationStatus === 'pending');

  const TABS = [
    { key:'metrics',       label:'📊 Métricas'                              },
    { key:'vendors',       label:`🏪 Vendedores (${vendors.length})`         },
    { key:'orders',        label:`📦 Pedidos (${orders.length})`            },
    { key:'payouts',       label:`💰 Pagos${vendorsWithPending.length > 0 ? ` (${vendorsWithPending.length})` : ''}` },
    { key:'verifications', label:`✅ Verificaciones${pendingVerifs.length > 0 ? ` (${pendingVerifs.length})` : ''}` },
  ];

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <BackButton to="/" label="Volver al mapa" />
          <div>
            <h2 style={s.title}>🛡️ Panel de Admin</h2>
            <p style={s.subtitle}>Vista global del sistema VendeCerca</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {TABS.map(t => (
            <button key={t.key} style={{ ...s.tab, ...(tab===t.key?s.tabActive:{}) }} onClick={()=>setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── MÉTRICAS ── */}
        {tab === 'metrics' && (
          <div style={s.section}>
            <div style={s.statsGrid}>
              <StatCard icon="🏪" val={onlineVendors.length} label="Vendedores en línea" />
              <StatCard icon="📋" val={vendors.length}        label="Vendedores totales" />
              <StatCard icon="📦" val={todayOrders.length}    label="Pedidos hoy" />
              <StatCard icon="💰" val={`$${todayRevenue.toLocaleString()}`}   label="Ingresos hoy" small={todayRevenue>99999} />
              <StatCard icon="✅" val={completed.length}      label="Completados" />
              <StatCard icon="🔴" val={pending.length}        label="Pendientes ahora" highlight={pending.length>0} />
              <StatCard icon="🛵" val={active.length}         label="En proceso" />
              <StatCard icon="💳" val={`$${totalRevenue.toLocaleString()}`}   label="Ingresos totales" small={totalRevenue>99999} />
              {avgRating > 0 && <StatCard icon="⭐" val={avgRating.toFixed(1)} label="Calificación media" />}
            </div>

            {/* Top vendedores por ingresos */}
            <h3 style={s.subTitle}>🏆 Top vendedores</h3>
            <div style={s.topList}>
              {[...vendors]
                .map(v => ({
                  ...v,
                  revenue: completed.filter(o=>o.vendorId===v.id).reduce((s,o)=>s+calcTotal(o.products),0),
                  count:   completed.filter(o=>o.vendorId===v.id).length,
                }))
                .filter(v => v.count > 0)
                .sort((a,b) => b.revenue - a.revenue)
                .slice(0, 5)
                .map((v, i) => (
                  <div key={v.id} style={s.topRow}>
                    <span style={s.topRank}>#{i+1}</span>
                    {v.photoURL
                      ? <img src={v.photoURL} alt={v.name} style={s.topAvatar} />
                      : <div style={s.topAvatarFallback}>{v.name?.[0]?.toUpperCase()}</div>
                    }
                    <div style={{ flex:1 }}>
                      <div style={s.topName}>{v.name}</div>
                      <div style={s.topMeta}>{v.count} pedido{v.count!==1?'s':''} completado{v.count!==1?'s':''}</div>
                    </div>
                    <span style={s.topRevenue}>${v.revenue.toLocaleString()}</span>
                    <span style={{ ...s.onlinePill, background:v.isOnline?'#dcfce7':'#f3f4f6', color:v.isOnline?'#166534':'#6b7280' }}>
                      {v.isOnline?'🟢':'⚫'}
                    </span>
                  </div>
                ))
              }
              {completed.length === 0 && <p style={s.empty}>Aún no hay pedidos completados</p>}
            </div>
          </div>
        )}

        {/* ── VENDEDORES ── */}
        {tab === 'vendors' && (
          <div style={s.section}>
            <p style={s.hint}>Puedes forzar el estado de cualquier vendedor desde aquí.</p>
            <div style={s.vendorList}>
              {vendors.map(v => {
                const vOrders  = completed.filter(o=>o.vendorId===v.id);
                const vRevenue = vOrders.reduce((s,o)=>s+calcTotal(o.products),0);
                const allProds = v.locations?.flatMap(l=>l.products||[])||v.products||[];
                return (
                  <div key={v.id} style={s.vendorCard}>
                    <div style={s.vendorLeft}>
                      {v.photoURL
                        ? <img src={v.photoURL} alt={v.name} style={s.vendorAvatar} />
                        : <div style={s.vendorAvatarFallback}>{v.name?.[0]?.toUpperCase()}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={s.vendorName}>{v.name}</div>
                        <div style={s.vendorMeta}>
                          {v.rating > 0 && <span>⭐ {v.rating.toFixed(1)}</span>}
                          <span>· {allProds.length} prod.</span>
                          {v.locations?.length > 1 && <span>· {v.locations.length} sedes</span>}
                          {vRevenue > 0 && <span style={{color:'var(--green)',fontWeight:600}}>· ${vRevenue.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexShrink:0 }}>
                      <Link to={`/vendor/${v.id}`} style={s.viewBtn}>Ver →</Link>
                      <button
                        style={{ ...s.toggleBtn, ...(v.isOnline ? s.toggleOn : s.toggleOff) }}
                        onClick={() => toggleOnline(v.id, v.isOnline)}
                      >
                        {v.isOnline ? '🟢 En línea' : '⚫ Offline'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PAGOS ── */}
        {tab === 'payouts' && (
          <div style={s.section}>
            <p style={s.hint}>
              Aquí ves lo que debes pagarle a cada vendedor. Cuando hagas la transferencia, marca el pago como registrado.
            </p>
            {vendors.length === 0 && <p style={s.empty}>No hay vendedores aún.</p>}
            <div style={s.vendorList}>
              {[...vendors]
                .map(v => ({ ...v, pending: (v.balance||0) - (v.paidOut||0) }))
                .sort((a,b) => b.pending - a.pending)
                .map(v => (
                  <div key={v.id} style={{ ...s.vendorCard, flexWrap:'wrap', gap:'0.6rem' }}>
                    <div style={s.vendorLeft}>
                      {v.photoURL
                        ? <img src={v.photoURL} alt={v.name} style={s.vendorAvatar} />
                        : <div style={s.vendorAvatarFallback}>{v.name?.[0]?.toUpperCase()}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={s.vendorName}>{v.name}</div>
                        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.2rem', fontSize:'0.75rem', color:'var(--text-3)' }}>
                          <span>Total ganado: <strong style={{ color:'var(--text)' }}>${(v.balance||0).toLocaleString()}</strong></span>
                          <span>·</span>
                          <span>Ya pagado: <strong style={{ color:'var(--text)' }}>${(v.paidOut||0).toLocaleString()}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.7rem', marginLeft:'auto' }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:800, fontSize:'1rem', color: v.pending>0 ? '#dc2626' : 'var(--text-3)' }}>
                          ${v.pending.toLocaleString()}
                        </div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-3)' }}>por pagar</div>
                      </div>
                      {v.pending > 0 && (
                        <button
                          style={{ ...s.toggleBtn, ...s.toggleOn, background:'#dcfce7', color:'#166534', borderColor:'#86efac', opacity: payingId===v.id ? 0.6 : 1 }}
                          disabled={payingId === v.id}
                          onClick={() => markPaid(v)}
                        >
                          {payingId === v.id ? '⏳' : '✓ Marcar pagado'}
                        </button>
                      )}
                      {v.pending <= 0 && v.balance > 0 && (
                        <span style={{ fontSize:'0.8rem', color:'#16a34a', fontWeight:600 }}>✅ Al día</span>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
            <div style={{ marginTop:'1rem', padding:'0.8rem', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.88rem', fontWeight:700, color:'var(--text)' }}>
                <span>Total pendiente por pagar</span>
                <span style={{ color:'#dc2626' }}>
                  ${vendors.reduce((s,v) => s + Math.max(0,(v.balance||0)-(v.paidOut||0)), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── VERIFICACIONES ── */}
        {tab === 'verifications' && (
          <div style={s.section}>
            <p style={s.hint}>Solicitudes de verificación de vendedores. Verifica la identidad antes de aprobar.</p>
            {pendingVerifs.length === 0 && (
              <p style={s.empty}>No hay solicitudes pendientes.</p>
            )}
            <div style={s.vendorList}>
              {vendors
                .filter(v => v.verificationStatus === 'pending' || v.isVerified || v.verificationStatus === 'rejected')
                .sort((a,b) => (a.verificationStatus === 'pending' ? -1 : 1))
                .map(v => (
                  <div key={v.id} style={{ ...s.vendorCard, flexWrap:'wrap', gap:'0.6rem' }}>
                    <div style={s.vendorLeft}>
                      {v.photoURL
                        ? <img src={v.photoURL} alt={v.name} style={s.vendorAvatar} />
                        : <div style={s.vendorAvatarFallback}>{v.name?.[0]?.toUpperCase()}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={s.vendorName}>{v.name}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:'0.2rem' }}>
                          {v.email || ''} · {(v.completedSales||0)} ventas
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginLeft:'auto' }}>
                      {v.isVerified ? (
                        <span style={{ fontSize:'0.82rem', background:'#dbeafe', color:'#1d4ed8', padding:'0.25rem 0.7rem', borderRadius:'20px', fontWeight:700 }}>✅ Verificado</span>
                      ) : v.verificationStatus === 'pending' ? (
                        <>
                          <button
                            style={{ ...s.toggleBtn, ...s.toggleOn, background:'#dcfce7', color:'#166534', borderColor:'#86efac' }}
                            onClick={() => approveVerification(v.id)}>
                            ✅ Aprobar
                          </button>
                          <button
                            style={{ ...s.toggleBtn, background:'#fee2e2', color:'#dc2626', borderColor:'#fca5a5' }}
                            onClick={() => rejectVerification(v.id)}>
                            ❌ Rechazar
                          </button>
                        </>
                      ) : v.verificationStatus === 'rejected' ? (
                        <span style={{ fontSize:'0.82rem', background:'#fee2e2', color:'#dc2626', padding:'0.25rem 0.7rem', borderRadius:'20px', fontWeight:600 }}>Rechazada</span>
                      ) : null}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── PEDIDOS ── */}
        {tab === 'orders' && (
          <div style={s.section}>
            <p style={s.hint}>Últimos {orders.length} pedidos del sistema.</p>
            <div style={s.orderList}>
              {orders.map(o => {
                const total = calcTotal(o.products);
                const sc    = STATUS_COLOR[o.status] || '#999';
                return (
                  <div key={o.id} style={s.orderRow}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flex:1, minWidth:0 }}>
                      <span style={{ ...s.statusDot, background:sc }} />
                      <div style={{ minWidth:0 }}>
                        <div style={s.orderVendor}>{o.vendorName}</div>
                        <div style={s.orderBuyer}>
                          👤 {o.buyerName}
                          {o.type==='domicilio' ? ' · 🛵' : ' · 🛒'}
                          {o.locationName ? ` · 📍${o.locationName}` : ''}
                        </div>
                        <div style={s.orderDate}>{formatDate(o.createdAt)}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.25rem', flexShrink:0 }}>
                      {total > 0 && <span style={s.orderTotal}>${total.toLocaleString()}</span>}
                      <span style={{ ...s.statusPill, background:sc }}>{STATUS_LABEL[o.status]||o.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ icon, val, label, small, highlight }) {
  return (
    <div style={{ ...s.statCard, ...(highlight ? { borderColor:'#fca5a5', background:'#fff5f5' } : {}) }}>
      <div style={s.statIcon}>{icon}</div>
      <div style={{ ...s.statVal, fontSize: small ? '1rem' : '1.3rem' }}>{val}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s = {
  page:      { background:'var(--bg)', minHeight:'calc(100vh - 60px)', padding:'1.5rem 1rem' },
  container: { maxWidth:'720px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'1.2rem' },
  loading:   { padding:'3rem', textAlign:'center', color:'var(--text-3)' },

  header:   { display:'flex', flexDirection:'column', gap:'0.5rem' },
  title:    { fontSize:'1.5rem', fontWeight:800, color:'var(--text)', margin:'0.2rem 0 0' },
  subtitle: { fontSize:'0.85rem', color:'var(--text-2)', margin:0 },

  tabs:    { display:'flex', gap:'0.4rem', flexWrap:'wrap' },
  tab:     { padding:'0.45rem 1rem', border:'1.5px solid var(--border)', borderRadius:'20px', background:'#fff', cursor:'pointer', fontSize:'0.85rem', fontWeight:500, fontFamily:'inherit', transition:'all 0.15s' },
  tabActive:{ background:'var(--green)', color:'#fff', borderColor:'var(--green)', fontWeight:700 },

  section: { background:'#fff', borderRadius:'var(--radius-lg)', padding:'1.3rem', boxShadow:'var(--shadow-sm)', border:'1px solid var(--border)' },
  hint:    { fontSize:'0.82rem', color:'var(--text-3)', margin:'0 0 0.8rem', fontStyle:'italic' },
  empty:   { color:'var(--text-3)', fontSize:'0.85rem', textAlign:'center', padding:'0.5rem 0' },

  statsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:'0.65rem', marginBottom:'1.2rem' },
  statCard:  { background:'var(--bg)', borderRadius:'var(--radius)', padding:'0.9rem 0.6rem', border:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem', textAlign:'center' },
  statIcon:  { fontSize:'1.3rem', lineHeight:1 },
  statVal:   { fontSize:'1.3rem', fontWeight:800, color:'var(--text)', lineHeight:1 },
  statLabel: { fontSize:'0.72rem', color:'var(--text-3)', fontWeight:500 },

  subTitle: { fontSize:'0.95rem', fontWeight:700, color:'var(--text)', margin:'0 0 0.7rem' },
  topList:  { display:'flex', flexDirection:'column', gap:'0.5rem' },
  topRow:   { display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.6rem 0.7rem', background:'var(--bg)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' },
  topRank:  { fontSize:'0.82rem', fontWeight:700, color:'var(--text-3)', width:'22px', flexShrink:0 },
  topAvatar:       { width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover', flexShrink:0 },
  topAvatarFallback:{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,var(--green),var(--green-mid))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.85rem', flexShrink:0 },
  topName:    { fontWeight:600, fontSize:'0.88rem', color:'var(--text)' },
  topMeta:    { fontSize:'0.72rem', color:'var(--text-3)' },
  topRevenue: { fontWeight:800, color:'var(--green)', fontSize:'0.9rem', flexShrink:0 },
  onlinePill: { fontSize:'0.85rem', padding:'0.1rem 0.4rem', borderRadius:'20px', flexShrink:0 },

  vendorList: { display:'flex', flexDirection:'column', gap:'0.55rem' },
  vendorCard: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.7rem', padding:'0.75rem', background:'var(--bg)', borderRadius:'var(--radius)', border:'1px solid var(--border)', flexWrap:'wrap' },
  vendorLeft: { display:'flex', alignItems:'center', gap:'0.6rem', flex:1, minWidth:0 },
  vendorAvatar:       { width:'38px', height:'38px', borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid var(--border)' },
  vendorAvatarFallback:{ width:'38px', height:'38px', borderRadius:'50%', background:'linear-gradient(135deg,var(--green),var(--green-mid))', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.95rem', flexShrink:0 },
  vendorName: { fontWeight:700, fontSize:'0.9rem', color:'var(--text)' },
  vendorMeta: { fontSize:'0.75rem', color:'var(--text-3)', display:'flex', gap:'0.3rem', flexWrap:'wrap', marginTop:'0.1rem' },
  viewBtn:    { padding:'0.28rem 0.65rem', background:'var(--green-light)', color:'var(--green)', border:'1px solid var(--green-border)', borderRadius:'20px', fontSize:'0.78rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' },
  toggleBtn:  { padding:'0.3rem 0.7rem', border:'1.5px solid', borderRadius:'20px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', transition:'all 0.15s' },
  toggleOn:   { background:'#dcfce7', color:'#166534', borderColor:'#86efac' },
  toggleOff:  { background:'#f3f4f6', color:'#6b7280', borderColor:'#e5e7eb' },

  orderList:  { display:'flex', flexDirection:'column', gap:'0.5rem' },
  orderRow:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem', padding:'0.7rem', background:'var(--bg)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' },
  statusDot:  { width:'10px', height:'10px', borderRadius:'50%', flexShrink:0, marginTop:'3px' },
  orderVendor:{ fontWeight:600, fontSize:'0.88rem', color:'var(--text)' },
  orderBuyer: { fontSize:'0.78rem', color:'var(--text-2)', marginTop:'0.1rem' },
  orderDate:  { fontSize:'0.72rem', color:'var(--text-3)', marginTop:'0.1rem' },
  orderTotal: { fontWeight:800, color:'var(--green)', fontSize:'0.9rem' },
  statusPill: { color:'#fff', fontSize:'0.68rem', fontWeight:700, padding:'0.15rem 0.5rem', borderRadius:'20px', whiteSpace:'nowrap' },
};
