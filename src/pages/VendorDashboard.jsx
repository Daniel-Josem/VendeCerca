import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, serverTimestamp, deleteField, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import ChatDrawer from '../components/ChatDrawer';
import ShareModal from '../components/ShareModal';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '../context/ToastContext';
import { requestFCMToken } from '../firebase/messaging';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { QRCodeSVG } from 'qrcode.react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COUNTRY_CODES = [
  { code:'+57',  flag:'🇨🇴', name:'Colombia'   },
  { code:'+52',  flag:'🇲🇽', name:'México'     },
  { code:'+1',   flag:'🇺🇸', name:'EE.UU.'    },
  { code:'+54',  flag:'🇦🇷', name:'Argentina'  },
  { code:'+55',  flag:'🇧🇷', name:'Brasil'     },
  { code:'+56',  flag:'🇨🇱', name:'Chile'      },
  { code:'+51',  flag:'🇵🇪', name:'Perú'       },
  { code:'+58',  flag:'🇻🇪', name:'Venezuela'  },
  { code:'+593', flag:'🇪🇨', name:'Ecuador'    },
  { code:'+591', flag:'🇧🇴', name:'Bolivia'    },
];

const EMOJIS = ['🥑','🍋','🍊','🍌','🍅','🌽','🥕','🧅','🧄','🥦','🍓','🍇','🥭','🍍','🌶️','🫑','🫒','🥝','🍒','🍑','🥬','🌿','🫚','🧃','🥤','🍺','☕','🌮','🍕','🍔'];

const ORDER_GROUPS = [
  { key:'pending',   label:'Pendientes',  statuses:['pendiente'],         color:'#f59e0b', defaultOpen:true  },
  { key:'active',    label:'En proceso',  statuses:['en_camino','listo'], color:'#3b82f6', defaultOpen:true  },
  { key:'completed', label:'Completados', statuses:['completado'],        color:'#2d7a2d', defaultOpen:false },
  { key:'cancelled', label:'Cancelados',  statuses:['cancelado'],         color:'#dc2626', defaultOpen:false },
];

function orderColor(s) {
  return { pendiente:'#f59e0b', en_camino:'#3b82f6', listo:'#8b5cf6', completado:'#2d7a2d', cancelado:'#dc2626' }[s] || '#999';
}
function orderLabel(s) {
  return { pendiente:'Pendiente', en_camino:'En camino', listo:'Listo p/ recoger', completado:'Completado', cancelado:'Cancelado' }[s] || s;
}

function MapClickHandler({ activeLocId, onSet }) {
  const locRef = useRef(activeLocId);
  const setRef = useRef(onSet);
  useEffect(() => { locRef.current = activeLocId; });
  useEffect(() => { setRef.current = onSet; });
  useMapEvents({ click(e) { if (locRef.current) setRef.current(locRef.current, e.latlng.lat, e.latlng.lng); } });
  return null;
}
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 15); }, [lat, lng, map]);
  return null;
}

// ── Sección colapsable ──────────────────────────────
function OrderSection({ group, orders, onUpdateStatus, onChat }) {
  const [open, setOpen] = useState(group.defaultOpen);
  const filtered = orders.filter(o => group.statuses.includes(o.status));
  if (filtered.length === 0) return null;

  return (
    <div style={s.orderSection}>
      <button type="button" style={{ ...s.orderSectionHead, borderLeft: `4px solid ${group.color}`, borderRadius: open ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span style={{ ...s.groupDot, background: group.color }} />
          <span style={s.groupLabel}>{group.label}</span>
          <span style={{ ...s.groupCount, background: group.color }}>{filtered.length}</span>
        </div>
        <span style={s.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={s.orderList}>
          {filtered.map(order => (
            <div key={order.id} style={{ ...s.orderCard, borderLeft:`4px solid ${orderColor(order.status)}` }}>
              <div style={s.orderHead}>
                <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ ...s.typePill, background: order.type==='domicilio'?'#fef3c7':'#f0f7f0', color: order.type==='domicilio'?'#92400e':'#166534' }}>
                    {order.type==='domicilio' ? '🛵 Domicilio' : '🛒 Retiro'}
                  </span>
                  <strong style={{ fontSize:'0.9rem' }}>{order.buyerName}</strong>
                  {order.locationName && <span style={s.locPill}>📍 {order.locationName}</span>}
                </div>
                <span style={{ ...s.statusPill, background: orderColor(order.status) }}>{orderLabel(order.status)}</span>
              </div>
              <div style={s.orderProducts}>
                {order.products?.map((p,i) => <span key={i} style={s.orderProduct}>{p.emoji} {p.name} ×{p.qty}</span>)}
              </div>
              {order.address && <p style={s.orderMeta}>📍 {order.address}</p>}
              {order.notes   && <p style={s.orderMeta}>📝 {order.notes}</p>}
              {order.status === 'pendiente' && (
                <div style={s.orderActions}>
                  <button style={s.btnAccept} onClick={() => onUpdateStatus(order.id, order.type==='domicilio'?'en_camino':'listo')}>
                    {order.type==='domicilio' ? '🛵 Aceptar — salgo a entregar' : '✅ Listo — puede venir'}
                  </button>
                  <button style={s.btnReject} onClick={() => onUpdateStatus(order.id,'cancelado')}>✕</button>
                </div>
              )}
              {(order.status==='en_camino'||order.status==='listo') && (
                <button style={s.btnComplete} onClick={() => onUpdateStatus(order.id,'completado')}>
                  {order.status==='en_camino' ? '✅ Marcar como entregado' : '✅ Confirmar recogida'}
                </button>
              )}
              {order.status !== 'cancelado' && (
                <button style={s.btnChat} onClick={() => onChat(order)}>
                  💬 Chatear con {order.buyerName?.split(' ')[0] || 'cliente'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard principal ─────────────────────────────
export default function VendorDashboard() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  const [vendor,        setVendor]        = useState(null);
  const [photoURL,      setPhotoURL]      = useState(null);
  const [uploadingPhoto,setUploadingPhoto]= useState(false);
  const [avatarHover,   setAvatarHover]   = useState(false);
  const photoInputRef   = useRef(null);
  const [orders,        setOrders]        = useState([]);
  const [locations,     setLocations]     = useState([]);
  const [notifPerm,     setNotifPerm]     = useState(Notification?.permission || 'default');
  const seenOrderIds    = useRef(new Set());
  const isFirstLoad     = useRef(true);
  const [activeLocId,   setActiveLocId]   = useState(null); // sede en mapa
  const [prodLocId,     setProdLocId]     = useState(null); // sede en productos
  const [countryCode,   setCountryCode]   = useState('+57');
  const [phoneNumber,   setPhoneNumber]   = useState('');
  const [description,   setDescription]  = useState('');
  const [form,           setForm]           = useState({ name:'', emoji:'🥑', price:'', unit:'pieza', stock:'', imageURL:'', images:[] });
  const [editId,         setEditId]         = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [uploadingProd,  setUploadingProd]  = useState(false);
  const prodImgRef = useRef(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [chatOrder,     setChatOrder]     = useState(null);
  const [liveTracking,  setLiveTracking]  = useState(false);
  const [livePos,       setLivePos]       = useState(null);
  const watchIdRef    = useRef(null);
  const lastLiveWrite = useRef(0);
  const [gpsMsg,        setGpsMsg]        = useState('');
  const [savedZones,    setSavedZones]    = useState([]);
  const [newZoneName,   setNewZoneName]   = useState('');
  const [savingZone,    setSavingZone]    = useState(false);
  const [applyZoneId,   setApplyZoneId]   = useState(null);
  // Mejora 18 — historial de ubicaciones
  const [locationHistory, setLocationHistory] = useState([]);
  // Mejora 19 — cupones
  const [coupons,      setCoupons]      = useState([]);
  const [couponForm,   setCouponForm]   = useState({ code:'', discount:'', type:'percent', maxUses:'' });
  const [savingCoupon, setSavingCoupon] = useState(false);
  // Mejora 20 — pagos
  const [nequiNumber,  setNequiNumber]  = useState('');
  // Mejora 21 — compartir
  const [showShare,    setShowShare]    = useState(false);
  // Mejora 22 — galería multi-imagen
  const prodImgRefs = [useRef(null), useRef(null), useRef(null)];
  const [uploadingSlot, setUploadingSlot] = useState(null); // 0|1|2|null

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    if (userRole && userRole !== 'vendor') navigate('/');
  }, [currentUser, userRole, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'vendors', currentUser.uid)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setVendor(d);
      setPhotoURL(d.photoURL || null);
      setCountryCode(d.phoneCode || '+57');
      setPhoneNumber(d.phoneNumber || '');
      setDescription(d.description || '');

      let locs = [];
      if (d.locations?.length > 0) {
        // Migrar: si la sede no tiene products, copiar del nivel raíz
        locs = d.locations.map(l => ({
          ...l,
          products: l.products || (d.products || []),
        }));
      } else if (d.location?.lat) {
        locs = [{ id: uuidv4(), name:'Principal', lat:d.location.lat, lng:d.location.lng, isOnline:d.isOnline||false, products: d.products||[] }];
      } else {
        locs = [{ id: uuidv4(), name:'Principal', lat:null, lng:null, isOnline:false, products:[] }];
      }
      setLocations(locs);
      setProdLocId(locs[0]?.id || null);
      setActiveLocId(null);
      setSavedZones(d.savedZones || []);
      setLocationHistory(d.locationHistory || []);
      setCoupons(d.coupons || []);
      setNequiNumber(d.nequiNumber || '');
    });
  }, [currentUser]);

  // ── Pedir permiso de notificaciones al cargar ───
  useEffect(() => {
    if (!currentUser || userRole !== 'vendor') return;
    const setup = async () => {
      if (!('Notification' in window)) return;
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
        setNotifPerm(perm);
      }
      if (perm === 'granted') {
        const token = await requestFCMToken();
        if (token) updateDoc(doc(db, 'vendors', currentUser.uid), { fcmToken: token });
      }
    };
    setup();
  }, [currentUser, userRole]);

  // ── Sonido de alerta (Web Audio API) ────────────
  function playAlert() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [880, 1108, 1320]; // A5 - C#6 - E6 (acorde alegre)
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
    } catch (e) { /* navegador sin soporte */ }
  }

  // ── Notificación del navegador ──────────────────
  function showNotification(count) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('VendeCerca — Nuevo pedido 🛵', {
        body: `Tienes ${count} pedido${count > 1 ? 's' : ''} nuevo${count > 1 ? 's' : ''} esperando`,
        icon: '/favicon.svg',
        tag:  'new-order',
      });
    }
  }

  // ── Escuchar pedidos en tiempo real ─────────────
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

      if (!isFirstLoad.current) {
        // Detectar pedidos pendientes que no habíamos visto
        const newPending = list.filter(o =>
          o.status === 'pendiente' && !seenOrderIds.current.has(o.id)
        );
        if (newPending.length > 0) {
          playAlert();
          showNotification(newPending.length);
        }
      }

      isFirstLoad.current = false;
      seenOrderIds.current = new Set(list.map(o => o.id));
      setOrders(list);
    }, err => console.error(err));
  }, [currentUser]);

  // Limpiar watchPosition al desmontar (el liveLocation expira en el lado comprador)
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // ── Guardar locations ────────────────────────────
  async function saveLocs(updated) {
    setLocations(updated);
    const anyOnline = updated.some(l => l.isOnline);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { locations: updated, isOnline: anyOnline });
  }

  function addLocation() {
    const newLoc = { id:uuidv4(), name:`Sede ${locations.length+1}`, lat:null, lng:null, isOnline:false, products:[] };
    const updated = [...locations, newLoc];
    setLocations(updated);
    setActiveLocId(newLoc.id);
    setProdLocId(newLoc.id);
    updateDoc(doc(db, 'vendors', currentUser.uid), { locations: updated });
  }

  async function toggleLocation(locId) {
    const loc = locations.find(l => l.id === locId);
    const goingOnline = loc && !loc.isOnline && loc.lat && loc.lng;
    const updated = locations.map(l => l.id===locId ? {...l, isOnline:!l.isOnline} : l);
    if (goingOnline) {
      // Registrar en historial (mejora 18)
      const entry = { lat: loc.lat, lng: loc.lng, ts: Date.now(), locName: loc.name };
      const newHistory = [...locationHistory, entry].slice(-100);
      setLocationHistory(newHistory);
      await updateDoc(doc(db, 'vendors', currentUser.uid), { locationHistory: newHistory });
    }
    await saveLocs(updated);
  }

  function renameLocation(locId, name) {
    setLocations(prev => prev.map(l => l.id===locId ? {...l,name} : l));
  }
  async function saveLocName() {
    await updateDoc(doc(db, 'vendors', currentUser.uid), { locations });
  }

  async function setLocationPos(locId, lat, lng) {
    const updated = locations.map(l => l.id===locId ? {...l,lat,lng} : l);
    await saveLocs(updated);
    setGpsMsg('✅ Ubicación guardada');
    setTimeout(() => setGpsMsg(''), 2000);
  }

  function useGPSForLoc(locId) {
    setGpsMsg('');
    navigator.geolocation?.getCurrentPosition(
      pos => setLocationPos(locId, pos.coords.latitude, pos.coords.longitude),
      ()  => setGpsMsg('⚠️ GPS no disponible, haz clic en el mapa')
    );
  }

  async function deleteLocation(locId) {
    const updated = locations.filter(l => l.id!==locId);
    if (activeLocId===locId) setActiveLocId(updated[0]?.id||null);
    if (prodLocId===locId)   setProdLocId(updated[0]?.id||null);
    await saveLocs(updated);
  }

  // ── Rastreo GPS en tiempo real ──────────────────
  function startLiveTracking() {
    if (!navigator.geolocation) { toast.error('Tu dispositivo no soporta GPS'); return; }
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = coords;
        setLivePos({ lat, lng, accuracy });
        const now = Date.now();
        if (now - lastLiveWrite.current < 10_000) return;
        lastLiveWrite.current = now;
        updateDoc(doc(db, 'vendors', currentUser.uid), {
          liveLocation: { lat, lng, accuracy, heading: heading ?? null, speed: speed ?? null, updatedAt: now }
        });
      },
      () => { toast.error('No se pudo obtener ubicación GPS'); stopLiveTracking(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setLiveTracking(true);
    toast.success('📡 Compartiendo ubicación en vivo');
  }

  async function stopLiveTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLiveTracking(false);
    setLivePos(null);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { liveLocation: deleteField() });
  }

  // ── Zonas frecuentes ─────────────────────────────
  async function saveGPSAsZone() {
    if (!newZoneName.trim()) { toast.warning('Escribe un nombre para la zona'); return; }
    setSavingZone(true);
    navigator.geolocation?.getCurrentPosition(
      async ({ coords }) => {
        const zone = { id: uuidv4(), name: newZoneName.trim(), lat: coords.latitude, lng: coords.longitude, savedAt: Date.now() };
        const updated = [...savedZones, zone];
        setSavedZones(updated);
        await updateDoc(doc(db, 'vendors', currentUser.uid), { savedZones: updated });
        setNewZoneName('');
        setSavingZone(false);
        toast.success(`Zona "${zone.name}" guardada`);
      },
      () => { toast.error('GPS no disponible'); setSavingZone(false); }
    );
  }

  async function saveActiveLocAsZone() {
    const loc = locations.find(l => l.id === activeLocId);
    if (!loc?.lat) { toast.warning('La sede seleccionada no tiene ubicación'); return; }
    if (!newZoneName.trim()) { toast.warning('Escribe un nombre para la zona'); return; }
    const zone = { id: uuidv4(), name: newZoneName.trim(), lat: loc.lat, lng: loc.lng, savedAt: Date.now() };
    const updated = [...savedZones, zone];
    setSavedZones(updated);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { savedZones: updated });
    setNewZoneName('');
    toast.success(`Zona "${zone.name}" guardada`);
  }

  async function applyZoneToLoc(zone, locId) {
    const updated = locations.map(l => l.id === locId ? { ...l, lat: zone.lat, lng: zone.lng } : l);
    await saveLocs(updated);
    setApplyZoneId(null);
    toast.success(`Ubicación de "${locations.find(l => l.id === locId)?.name}" actualizada`);
  }

  async function deleteZone(zoneId) {
    const updated = savedZones.filter(z => z.id !== zoneId);
    setSavedZones(updated);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { savedZones: updated });
  }

  // ── Productos por sede ───────────────────────────
  const prodLoc = locations.find(l => l.id===prodLocId) || locations[0];
  const currentProducts = prodLoc?.products || [];

  async function saveProducts(newProducts) {
    const updated = locations.map(l => l.id===prodLoc.id ? {...l, products:newProducts} : l);
    await saveLocs(updated);
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    const images = (form.images || []).filter(Boolean);
    const productData = { ...form, images, imageURL: images[0] || form.imageURL || '' };
    const newProducts = editId
      ? currentProducts.map(p => p.id===editId ? {...productData,id:editId} : p)
      : [...currentProducts, {...productData, id:uuidv4()}];
    setEditId(null);
    await saveProducts(newProducts);
    setForm({ name:'', emoji:'🥑', price:'', unit:'pieza', stock:'', imageURL:'', images:[] });
    setSaving(false);
  }

  async function deleteProduct(id) { await saveProducts(currentProducts.filter(p => p.id!==id)); }
  function startEdit(p) { setForm({ name:p.name, emoji:p.emoji, price:p.price, unit:p.unit, stock:p.stock, imageURL:p.imageURL||'', images:p.images||[] }); setEditId(p.id); }

  async function handleProdImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5MB'); return; }
    setUploadingProd(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'vendecerca');
      const res  = await fetch('https://api.cloudinary.com/v1_1/dhjkhvfmf/image/upload', { method:'POST', body:fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const url = data.secure_url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
      setForm(prev => ({ ...prev, imageURL: url }));
    } catch {
      toast.error('Error subiendo la imagen. Intenta de nuevo.');
    }
    setUploadingProd(false);
  }

  // ── Pedidos ──────────────────────────────────────
  async function updateOrderStatus(orderId, newStatus) {
    await updateDoc(doc(db, 'orders', orderId), { status:newStatus, updatedAt:serverTimestamp() });
    if (newStatus === 'completado') {
      const order = orders.find(o => o.id === orderId);
      const amount = order?.total ?? (order?.products||[]).reduce((s,p)=>s+(parseFloat(p.price)||0)*(p.qty||1),0);
      if (amount > 0) {
        await updateDoc(doc(db, 'vendors', currentUser.uid), { balance: increment(amount) });
      }
    }
    if (newStatus==='en_camino'||newStatus==='listo') {
      const order = orders.find(o => o.id===orderId);
      if (order?.products?.length) {
        // Descontar stock de la sede correspondiente
        const locId = order.locationId;
        const updated = locations.map(l => {
          if (locId && l.id!==locId) return l;
          const newProds = (l.products||[]).map(p => {
            const ordered = order.products.find(op => op.id===p.id);
            const stock = parseInt(p.stock);
            if (ordered && !isNaN(stock)) return {...p, stock:String(Math.max(0,stock-ordered.qty))};
            return p;
          });
          return {...l, products:newProds};
        });
        await saveLocs(updated);
      }
    }
  }

  // ── Perfil ───────────────────────────────────────
  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La foto debe pesar menos de 5MB'); return; }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'vendecerca');
      formData.append('public_id', `vendor_${currentUser.uid}`);

      const res  = await fetch('https://api.cloudinary.com/v1_1/dhjkhvfmf/image/upload', {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      // URL optimizada: 300x300, circular, formato automático
      const optimized = data.secure_url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto,q_auto/');
      setPhotoURL(optimized);
      await Promise.all([
        updateDoc(doc(db, 'vendors', currentUser.uid), { photoURL: optimized }),
        updateDoc(doc(db, 'users',   currentUser.uid), { photoURL: optimized }),
      ]);
      toast.success('Foto de perfil actualizada');
    } catch (err) {
      toast.error('Error subiendo la foto. Intenta de nuevo.');
      console.error(err);
    }
    setUploadingPhoto(false);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    await updateDoc(doc(db, 'vendors', currentUser.uid), {
      phoneCode:countryCode, phoneNumber,
      phone: countryCode.replace('+','') + phoneNumber, description,
      nequiNumber,
    });
    setSavingProfile(false);
    toast.success('Perfil guardado correctamente');
  }

  // ── Historial de ubicaciones: clustering ─────────
  function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function clusterHistory(hist) {
    const clusters = [];
    for (const pt of hist) {
      let merged = false;
      for (const c of clusters) {
        if (haversineM(c.lat, c.lng, pt.lat, pt.lng) < 300) {
          c.lat = (c.lat * c.count + pt.lat) / (c.count + 1);
          c.lng = (c.lng * c.count + pt.lng) / (c.count + 1);
          c.count++;
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push({ lat: pt.lat, lng: pt.lng, count: 1 });
    }
    return clusters;
  }

  // ── Cupones (mejora 19) ──────────────────────────
  async function handleAddCoupon(e) {
    e.preventDefault();
    const code = couponForm.code.trim().toUpperCase();
    if (!code || !couponForm.discount) { toast.warning('Completa código y descuento'); return; }
    if (coupons.find(c => c.code === code)) { toast.warning('Ya existe un cupón con ese código'); return; }
    setSavingCoupon(true);
    const newCoupon = {
      id: uuidv4(), code,
      discount: parseFloat(couponForm.discount),
      type: couponForm.type,
      maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses) : null,
      usedCount: 0, active: true,
    };
    const updated = [...coupons, newCoupon];
    setCoupons(updated);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { coupons: updated });
    setCouponForm({ code:'', discount:'', type:'percent', maxUses:'' });
    setSavingCoupon(false);
    toast.success(`Cupón "${code}" creado`);
  }

  async function toggleCoupon(id) {
    const updated = coupons.map(c => c.id===id ? {...c, active:!c.active} : c);
    setCoupons(updated);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { coupons: updated });
  }

  async function deleteCoupon(id) {
    const updated = coupons.filter(c => c.id !== id);
    setCoupons(updated);
    await updateDoc(doc(db, 'vendors', currentUser.uid), { coupons: updated });
  }

  // ── Imagen de producto por slot (mejora 22) ──────
  async function handleProdImageSlot(e, slot) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen debe pesar menos de 5MB'); return; }
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', 'vendecerca');
      const res  = await fetch('https://api.cloudinary.com/v1_1/dhjkhvfmf/image/upload', { method:'POST', body:fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const url = data.secure_url.replace('/upload/', '/upload/w_400,h_400,c_fill,f_auto,q_auto/');
      setForm(prev => {
        const imgs = [...(prev.images || [])];
        imgs[slot] = url;
        return { ...prev, images: imgs, imageURL: imgs[0] || '' };
      });
    } catch {
      toast.error('Error subiendo imagen. Intenta de nuevo.');
    }
    setUploadingSlot(null);
    e.target.value = '';
  }

  function removeImageSlot(slot) {
    setForm(prev => {
      const imgs = [...(prev.images || [])];
      imgs.splice(slot, 1);
      return { ...prev, images: imgs, imageURL: imgs[0] || '' };
    });
  }

  if (!vendor) return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.5rem 0' }}>
          <div className="skeleton" style={{ width:64, height:64, borderRadius:'50%', flexShrink:0 }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            <div className="skeleton" style={{ height:20, width:'50%', borderRadius:8 }} />
            <div className="skeleton" style={{ height:14, width:'35%', borderRadius:8 }} />
          </div>
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height:90, borderRadius:'var(--radius-lg)' }} />
        ))}
      </div>
    </div>
  );

  const activeLoc   = locations.find(l => l.id===activeLocId);
  const mapCenter   = activeLoc?.lat ? [activeLoc.lat, activeLoc.lng] : [4.7109, -74.0721];
  const pendingCount = orders.filter(o => o.status==='pendiente').length;
  const onlineCount  = locations.filter(l => l.isOnline).length;

  // ── Cálculo de estadísticas ──────────────────────
  const todayStart = new Date(new Date().setHours(0,0,0,0)).getTime() / 1000;
  const weekStart  = new Date(Date.now() - 6 * 86400 * 1000).getTime() / 1000;
  function sumRevenue(list) {
    return list.reduce((sum, o) => sum + (o.products||[]).reduce((s,p)=>s+(parseFloat(p.price)||0)*(p.qty||1),0), 0);
  }
  const completed    = orders.filter(o => o.status === 'completado');
  const todayAll     = orders.filter(o => (o.createdAt?.seconds||0) >= todayStart);
  const weekAll      = orders.filter(o => (o.createdAt?.seconds||0) >= weekStart);
  const todayRevenue = sumRevenue(completed.filter(o => (o.createdAt?.seconds||0) >= todayStart));
  const weekRevenue  = sumRevenue(completed.filter(o => (o.createdAt?.seconds||0) >= weekStart));
  const totalRevenue = sumRevenue(completed);
  const prodMap = {};
  completed.forEach(o => (o.products||[]).forEach(p => {
    if (!prodMap[p.name]) prodMap[p.name] = { name:p.name, emoji:p.emoji||'🏆', count:0 };
    prodMap[p.name].count += (p.qty||1);
  }));
  const topProd = Object.values(prodMap).sort((a,b) => b.count - a.count)[0];

  return (
    <>
    <div style={s.page}>
      <div style={s.container}>

        {/* HERO */}
        <div style={s.heroCard}>
          <BackButton to="/" label="← Volver al mapa" />
          <div style={s.heroBody}>
            <div style={s.avatarWrap} onClick={() => photoInputRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)} onMouseLeave={() => setAvatarHover(false)}
              title="Cambiar foto de perfil">
              {uploadingPhoto ? (
                <div style={s.avatarPlaceholder}><span>⏳</span></div>
              ) : photoURL ? (
                <img src={photoURL} alt="foto" style={s.avatarImg} />
              ) : (
                <div style={s.avatarPlaceholder}>{vendor.name?.[0]?.toUpperCase()}</div>
              )}
              <div style={{ ...s.avatarOverlay, opacity: avatarHover ? 1 : 0 }}>📷</div>
              <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoChange} />
            </div>
            <div style={s.heroInfo}>
              <h2 style={s.heroName}>{vendor.name}</h2>
              <p style={s.heroSub}>
                <span style={{ ...s.heroDot, background: onlineCount > 0 ? '#4ade80' : 'rgba(255,255,255,0.4)' }} />
                {onlineCount > 0 ? `${onlineCount} sede${onlineCount!==1?'s':''} en línea` : 'Todas offline'}
              </p>
              <div style={s.heroBadges}>
                {pendingCount > 0 && (
                  <span style={s.heroPendingBadge}>🔔 {pendingCount} nuevo{pendingCount>1?'s':''}</span>
                )}
                {notifPerm === 'granted' ? (
                  <span style={s.heroNotifOn}>✓ Alertas activas</span>
                ) : notifPerm === 'denied' ? (
                  <span style={s.heroNotifOff}>🔕 Bloqueadas</span>
                ) : (
                  <button style={s.heroNotifBtn} onClick={async () => {
                    const p = await Notification.requestPermission();
                    setNotifPerm(p);
                    if (p === 'granted') {
                      const token = await requestFCMToken();
                      if (token) updateDoc(doc(db, 'vendors', currentUser.uid), { fcmToken: token });
                    }
                  }}>🔔 Activar alertas</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SALDO */}
        {(() => {
          const balance = vendor.balance || 0;
          const paidOut = vendor.paidOut || 0;
          const pending = balance - paidOut;
          if (balance === 0) return null;
          return (
            <div style={{ ...s.section, background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', border:'none' }}>
              <h3 style={{ ...s.sectionTitle, color:'#fff', marginBottom:'0.8rem' }}>💳 Mi saldo en VendeCerca</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.6rem' }}>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'10px', padding:'0.8rem', textAlign:'center' }}>
                  <div style={{ fontSize:'1.2rem', fontWeight:800 }}>${balance.toLocaleString()}</div>
                  <div style={{ fontSize:'0.72rem', opacity:0.8, marginTop:'0.2rem' }}>Total ganado</div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'10px', padding:'0.8rem', textAlign:'center' }}>
                  <div style={{ fontSize:'1.2rem', fontWeight:800 }}>${paidOut.toLocaleString()}</div>
                  <div style={{ fontSize:'0.72rem', opacity:0.8, marginTop:'0.2rem' }}>Ya cobrado</div>
                </div>
                <div style={{ background: pending>0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', borderRadius:'10px', padding:'0.8rem', textAlign:'center', border: pending>0 ? '1.5px solid rgba(255,255,255,0.5)' : 'none' }}>
                  <div style={{ fontSize:'1.2rem', fontWeight:800 }}>${pending.toLocaleString()}</div>
                  <div style={{ fontSize:'0.72rem', opacity:0.8, marginTop:'0.2rem' }}>Por cobrar</div>
                </div>
              </div>
              {pending > 0 && (
                <p style={{ fontSize:'0.75rem', opacity:0.75, margin:'0.6rem 0 0', textAlign:'center' }}>
                  El equipo de VendeCerca procesará tu pago pronto.
                </p>
              )}
            </div>
          );
        })()}

        {/* ESTADÍSTICAS */}
        <div style={s.section}>
          <div style={s.sectionHead}>
            <h3 style={s.sectionTitle}>📊 Estadísticas</h3>
            {totalRevenue > 0 && (
              <span style={s.totalRevPill}>
                💰 Total: <strong>${totalRevenue.toLocaleString()}</strong>
              </span>
            )}
          </div>
          <div style={s.statsGrid}>
            {[
              { icon:'📦', val: todayAll.length,    label:'Pedidos hoy',     accent:'#3b82f6' },
              { icon:'💰', val: `$${todayRevenue.toLocaleString()}`, label:'Ingresos hoy', accent:'#10b981', small: todayRevenue > 99999 },
              { icon:'📅', val: weekAll.length,     label:'Esta semana',     accent:'#8b5cf6' },
              { icon:'💳', val: `$${weekRevenue.toLocaleString()}`, label:'Ingresos semana', accent:'#f59e0b', small: weekRevenue > 99999 },
              { icon:'⭐', val: vendor.rating ? vendor.rating.toFixed(1) : '—', label:`${vendor.ratingsCount||0} reseña${(vendor.ratingsCount||0)!==1?'s':''}`, accent:'#eab308' },
              { icon: topProd?.emoji||'🏆', val: topProd?.name||'—', label:'Producto estrella', accent:'#f97316', small: true },
            ].map((st, i) => (
              <div key={i} style={{ ...s.statCard, borderTop:`3px solid ${st.accent}` }}>
                <div style={s.statIcon}>{st.icon}</div>
                <div style={{ ...s.statVal, fontSize: st.small ? '0.85rem' : '1.3rem', color: st.accent }}>{st.val}</div>
                <div style={s.statLabel}>{st.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PEDIDOS COLAPSABLES */}
        <div style={{ ...s.section, borderColor: pendingCount>0?'#f59e0b':'transparent' }}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.8rem' }}>📦 Pedidos recibidos</h3>
          {orders.length === 0 ? (
            <p style={s.empty}>Sin pedidos aún — aparecen aquí en tiempo real.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
              {ORDER_GROUPS.map(group => (
                <OrderSection key={group.key} group={group} orders={orders} onUpdateStatus={updateOrderStatus} onChat={setChatOrder} />
              ))}
            </div>
          )}
        </div>

        {/* SEDES */}
        <div style={s.section}>
          <div style={s.sectionHead}>
            <h3 style={s.sectionTitle}>📍 Mis sedes</h3>
            <button style={s.addLocBtn} onClick={addLocation}>+ Agregar sede</button>
          </div>
          {locations.length===0 && <p style={s.empty}>No tienes sedes. Agrega una para aparecer en el mapa.</p>}
          <div style={s.locList}>
            {locations.map(loc => (
              <div key={loc.id} style={{ ...s.locCard, ...(activeLocId===loc.id?s.locCardActive:{}) }}>
                <div style={s.locRow}>
                  <input style={s.locNameInput} value={loc.name}
                    onChange={e => renameLocation(loc.id, e.target.value)}
                    onBlur={saveLocName} />
                  <span style={s.locPos}>{loc.lat ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Sin ubicación'}</span>
                </div>
                <div style={s.locActions}>
                  <button
                    style={{ ...s.locBtn, background:activeLocId===loc.id?'#2d7a2d':'#f0f7f0', color:activeLocId===loc.id?'#fff':'#2d7a2d' }}
                    onClick={() => setActiveLocId(activeLocId===loc.id?null:loc.id)}>
                    {activeLocId===loc.id ? '✏️ Editando mapa' : '📍 Fijar en mapa'}
                  </button>
                  <button style={s.locBtn} onClick={() => useGPSForLoc(loc.id)}>🛰️ GPS</button>
                  <button
                    style={{ ...s.locToggleBtn, background:loc.isOnline?'#2d7a2d':'#e5e7eb', color:loc.isOnline?'#fff':'#555' }}
                    onClick={() => toggleLocation(loc.id)}>
                    {loc.isOnline ? '🟢 En línea' : '⚫ Offline'}
                  </button>
                  <button style={s.locDeleteBtn} onClick={() => deleteLocation(loc.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          {/* RASTREO EN TIEMPO REAL */}
          <div style={s.liveBox}>
            <div style={s.liveBoxRow}>
              <div>
                <span style={s.liveTitleTxt}>📡 Ubicación en tiempo real</span>
                {liveTracking && livePos && (
                  <span style={s.liveCoords}>
                    {livePos.lat.toFixed(5)}, {livePos.lng.toFixed(5)} · ±{Math.round(livePos.accuracy)}m
                  </span>
                )}
                {!liveTracking && (
                  <span style={s.liveHint}>Actívalo para que los compradores vean dónde estás en este momento</span>
                )}
              </div>
              <button
                style={liveTracking ? s.liveStopBtn : s.liveStartBtn}
                onClick={liveTracking ? stopLiveTracking : startLiveTracking}
              >
                {liveTracking ? '⏹ Detener' : '▶ Activar'}
              </button>
            </div>
            {liveTracking && (
              <div style={s.liveBanner}>
                <span style={s.livePulse} />
                Compartiendo tu posición en vivo con compradores cercanos
              </div>
            )}
          </div>

          {gpsMsg && <p style={{ fontSize:'0.82rem', color:gpsMsg.startsWith('✅')?'#2d7a2d':'#dc2626', margin:'0.3rem 0' }}>{gpsMsg}</p>}
          <p style={s.mapHint}>
            {activeLocId
              ? `👆 Haz clic en el mapa para fijar "${locations.find(l=>l.id===activeLocId)?.name}"`
              : 'Selecciona una sede → "📍 Fijar en mapa" → haz clic en el mapa'}
          </p>
          <div style={s.mapWrap}>
            <MapContainer center={mapCenter} zoom={14} style={{ height:'200px', width:'100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
              <MapClickHandler activeLocId={activeLocId} onSet={setLocationPos} />
              {activeLoc?.lat && <RecenterMap lat={activeLoc.lat} lng={activeLoc.lng} />}
              {locations.filter(l=>l.lat).map(l => <Marker key={l.id} position={[l.lat,l.lng]} />)}
              {livePos && (
                <Marker
                  key="live-dash"
                  position={[livePos.lat, livePos.lng]}
                  icon={L.divIcon({
                    className: '',
                    html: '<div style="width:16px;height:16px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(239,68,68,0.6)"></div>',
                    iconSize: [16,16], iconAnchor: [8,8],
                  })}
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* ZONAS FRECUENTES */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.9rem' }}>⭐ Zonas frecuentes</h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:'0.9rem', marginTop:'-0.4rem' }}>
            Guarda tus spots habituales y aplícalos a cualquier sede con un clic.
          </p>

          {/* Formulario para guardar zona nueva */}
          <div style={s.zoneForm}>
            <input
              className="app-input"
              style={{ flex:1, minWidth:0 }}
              placeholder="Nombre del lugar (ej: Parque Central)"
              value={newZoneName}
              onChange={e => setNewZoneName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGPSAsZone()}
            />
            <button style={s.zoneGpsBtn} onClick={saveGPSAsZone} disabled={savingZone}>
              {savingZone ? '...' : '🛰️ GPS'}
            </button>
            {activeLocId && locations.find(l => l.id === activeLocId)?.lat && (
              <button style={s.zoneMapBtn} onClick={saveActiveLocAsZone}>
                📍 Del mapa
              </button>
            )}
          </div>

          {/* Lista de zonas */}
          {savedZones.length === 0 ? (
            <p style={s.empty}>Sin zonas guardadas aún.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem', marginTop:'0.8rem' }}>
              {savedZones.map(zone => (
                <div key={zone.id} style={s.zoneCard}>
                  <div style={s.zoneCardLeft}>
                    <span style={s.zoneName}>⭐ {zone.name}</span>
                    <span style={s.zoneCoords}>{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</span>
                  </div>
                  <div style={s.zoneCardRight}>
                    {applyZoneId === zone.id ? (
                      <div style={s.zoneApplyPicker}>
                        <span style={{ fontSize:'0.75rem', color:'var(--text-2)', flexShrink:0 }}>Aplicar a:</span>
                        {locations.map(loc => (
                          <button key={loc.id} style={s.zoneLocBtn} onClick={() => applyZoneToLoc(zone, loc.id)}>
                            {loc.name}
                          </button>
                        ))}
                        <button style={s.zoneCancelBtn} onClick={() => setApplyZoneId(null)}>✕</button>
                      </div>
                    ) : (
                      <button style={s.zoneApplyBtn} onClick={() =>
                        locations.length === 1
                          ? applyZoneToLoc(zone, locations[0].id)
                          : setApplyZoneId(zone.id)
                      }>
                        📍 Aplicar
                      </button>
                    )}
                    <button style={s.locDeleteBtn} onClick={() => deleteZone(zone.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── HISTORIAL DE ZONAS (mejora 18) ── */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.5rem' }}>🗺️ Mapa de actividad</h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:'0.9rem', marginTop:0 }}>
            Las zonas donde más has vendido — círculo más grande significa más visitas.
          </p>
          {locationHistory.length === 0 ? (
            <p style={s.empty}>Sin historial aún. Aparece cuando activas una sede por primera vez.</p>
          ) : (() => {
            const clusters = clusterHistory(locationHistory);
            const maxCount = Math.max(...clusters.map(c => c.count));
            const center   = clusters.reduce((acc, c) => ({ lat: acc.lat + c.lat/clusters.length, lng: acc.lng + c.lng/clusters.length }), { lat:0, lng:0 });
            return (
              <div style={s.mapWrap}>
                <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height:'200px', width:'100%' }} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
                  {clusters.map((c, i) => (
                    <Circle key={i}
                      center={[c.lat, c.lng]}
                      radius={40 + (c.count / maxCount) * 120}
                      pathOptions={{ color:'#2d7a2d', fillColor:'#2d7a2d', fillOpacity: 0.3 + (c.count/maxCount)*0.4, weight:2 }}
                    />
                  ))}
                </MapContainer>
              </div>
            );
          })()}
          {locationHistory.length > 0 && (
            <p style={{ fontSize:'0.72rem', color:'var(--text-3)', marginTop:'0.4rem', textAlign:'right' }}>
              {locationHistory.length} registro{locationHistory.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── CUPONES (mejora 19) ── */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.9rem' }}>🎟️ Cupones de descuento</h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:'0.9rem', marginTop:'-0.4rem' }}>
            Crea cupones para que tus compradores obtengan descuentos en sus pedidos.
          </p>

          <form onSubmit={handleAddCoupon} style={s.couponForm}>
            <input className="app-input" placeholder="Código (ej: PROMO10)"
              value={couponForm.code}
              onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              style={{ flex:2, minWidth:'100px' }} required />
            <input className="app-input" placeholder="Descuento" type="number" min="1"
              value={couponForm.discount}
              onChange={e => setCouponForm(f => ({ ...f, discount: e.target.value }))}
              style={{ width:'90px' }} required />
            <select className="app-input" value={couponForm.type}
              onChange={e => setCouponForm(f => ({ ...f, type: e.target.value }))}
              style={{ width:'70px' }}>
              <option value="percent">%</option>
              <option value="fixed">$</option>
            </select>
            <input className="app-input" placeholder="Máx. usos" type="number" min="1"
              value={couponForm.maxUses}
              onChange={e => setCouponForm(f => ({ ...f, maxUses: e.target.value }))}
              style={{ width:'90px' }} title="Máximo de usos (vacío = ilimitado)" />
            <button style={s.saveBtn} type="submit" disabled={savingCoupon}>
              {savingCoupon ? '...' : '+ Crear'}
            </button>
          </form>

          {coupons.length === 0 ? (
            <p style={{ ...s.empty, marginTop:'0.8rem' }}>Sin cupones creados aún.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', marginTop:'0.8rem' }}>
              {coupons.map(c => (
                <div key={c.id} style={{ ...s.couponCard, opacity: c.active ? 1 : 0.55 }}>
                  <div style={s.couponLeft}>
                    <span style={s.couponCode}>{c.code}</span>
                    <span style={s.couponDetail}>
                      {c.type === 'percent' ? `${c.discount}% off` : `$${c.discount.toLocaleString()} off`}
                      {' · '}{c.usedCount} uso{c.usedCount !== 1 ? 's' : ''}
                      {c.maxUses ? ` / ${c.maxUses}` : ''}
                    </span>
                  </div>
                  <div style={s.couponRight}>
                    <button
                      style={{ ...s.couponToggle, background: c.active ? '#dcfce7' : '#f3f4f6', color: c.active ? '#166534' : '#666' }}
                      onClick={() => toggleCoupon(c.id)}>
                      {c.active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button style={s.locDeleteBtn} onClick={() => deleteCoupon(c.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PERFIL Y PAGOS (mejora 20 + perfil) ── */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.9rem' }}>👤 Perfil y pagos</h3>
          <form onSubmit={handleSaveProfile} style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
            <div>
              <label style={s.label}>Descripción del negocio</label>
              <textarea className="app-input" placeholder="Cuéntales a tus clientes qué vendes..."
                value={description} onChange={e => setDescription(e.target.value)}
                style={{ marginTop:'0.25rem', resize:'vertical', minHeight:'70px' }} />
            </div>
            <div>
              <label style={s.label}>Teléfono / WhatsApp</label>
              <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.25rem' }}>
                <select className="app-input" value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{ width:'110px', flexShrink:0 }}>
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <input className="app-input" placeholder="Número de teléfono" type="tel"
                  value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={{ flex:1 }} />
              </div>
            </div>
            <div>
              <label style={s.label}>📱 Número Nequi / Daviplata</label>
              <input className="app-input" placeholder="Ej: 3001234567"
                value={nequiNumber} onChange={e => setNequiNumber(e.target.value)} style={{ marginTop:'0.25rem' }} />
              <p style={{ fontSize:'0.73rem', color:'var(--text-3)', margin:'0.2rem 0 0' }}>
                Los compradores verán este número al pagar con Nequi.
              </p>
            </div>
            <button style={{ ...s.saveBtn, alignSelf:'flex-start' }} type="submit" disabled={savingProfile}>
              {savingProfile ? 'Guardando...' : '💾 Guardar perfil'}
            </button>
          </form>
        </div>

        {/* ── MI ENLACE Y QR (mejora 21) ── */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom:'0.5rem' }}>📲 Mi enlace y QR</h3>
          <p style={{ fontSize:'0.8rem', color:'var(--text-3)', marginBottom:'1rem', marginTop:0 }}>
            Comparte tu perfil con clientes para que te encuentren y hagan pedidos.
          </p>
          <div style={s.qrSection}>
            <div style={s.qrBox}>
              <QRCodeSVG value={`${window.location.origin}/vendor/${currentUser.uid}`} size={120} fgColor="#1a5c1a" bgColor="transparent" />
            </div>
            <div style={s.qrInfo}>
              <p style={s.qrUrl}>
                {`${window.location.origin}/vendor/${currentUser.uid}`.replace('https://', '')}
              </p>
              <button style={s.shareBtn} onClick={() => setShowShare(true)}>
                📤 Compartir perfil
              </button>
              <button style={s.copyLinkBtn} onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/vendor/${currentUser.uid}`).catch(() => {});
                toast.success('Enlace copiado al portapapeles');
              }}>
                📋 Copiar enlace
              </button>
            </div>
          </div>
        </div>

        {/* PRODUCTOS POR SEDE */}
        <div style={s.section}>
          <div style={s.sectionHead}>
            <h3 style={s.sectionTitle}>🛒 Productos</h3>
          </div>

          {/* Tabs de sedes */}
          <div style={s.locTabs}>
            {locations.map(loc => (
              <button key={loc.id}
                style={{ ...s.locTab, ...(prodLocId===loc.id ? s.locTabActive : {}) }}
                onClick={() => { setProdLocId(loc.id); setEditId(null); setForm({name:'',emoji:'🥑',price:'',unit:'pieza',stock:''}); }}>
                {loc.name}
                {loc.isOnline && <span style={s.onlineDot} />}
              </button>
            ))}
          </div>

          {prodLoc && (
            <>
              <form onSubmit={handleAddProduct} style={{ marginBottom:'1rem' }}>
                <div style={s.emojiRow}>
                  {EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => setForm({...form,emoji:e})}
                      style={{ ...s.emojiBtn, ...(form.emoji===e?s.emojiBtnActive:{}) }}>{e}</button>
                  ))}
                </div>

                {/* Fotos del producto — hasta 3 imágenes (mejora 22) */}
                <div style={s.prodImgRow}>
                  {[0, 1, 2].map(slot => {
                    const src = (form.images || [])[slot];
                    return (
                      <div key={slot} style={{ position:'relative', flexShrink:0 }}>
                        <div style={{ ...s.prodImgPreview, borderStyle: slot === 0 ? 'dashed' : 'dotted', borderColor: slot === 0 ? 'var(--green)' : 'var(--border)' }}
                          onClick={() => prodImgRefs[slot].current?.click()}>
                          {uploadingSlot === slot ? (
                            <span style={{ fontSize:'0.65rem', color:'var(--text-3)' }}>⏳</span>
                          ) : src ? (
                            <img src={src} alt="" style={s.prodImgThumb} />
                          ) : (
                            <span style={{ fontSize:'0.65rem', color:'var(--text-3)', textAlign:'center', lineHeight:1.3 }}>
                              {slot === 0 ? '📷\nFoto' : `+${slot+1}`}
                            </span>
                          )}
                          <input ref={prodImgRefs[slot]} type="file" accept="image/*" style={{ display:'none' }}
                            onChange={e => handleProdImageSlot(e, slot)} />
                        </div>
                        {src && (
                          <button type="button" style={s.imgSlotRemove} onClick={() => removeImageSlot(slot)}>✕</button>
                        )}
                      </div>
                    );
                  })}
                  <span style={{ fontSize:'0.72rem', color:'var(--text-3)', alignSelf:'center', marginLeft:'0.3rem' }}>
                    Foto principal + hasta 2 fotos extra
                  </span>
                </div>

                <div style={s.prodFormRow}>
                  <input className="app-input" placeholder="Nombre del producto" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required style={{ flex:2,minWidth:'120px' }} />
                  <input className="app-input" placeholder="Precio $" type="number" value={form.price} onChange={e => setForm({...form,price:e.target.value})} style={{ width:'90px' }} />
                  <select className="app-input" value={form.unit} onChange={e => setForm({...form,unit:e.target.value})} style={{ width:'100px' }}>
                    {['pieza','kg','bolsa','litro','docena','caja','manojo'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input className="app-input" placeholder="Stock" type="number" value={form.stock} onChange={e => setForm({...form,stock:e.target.value})} style={{ width:'75px' }} />
                  <button style={s.saveBtn} type="submit" disabled={saving || uploadingProd}>{editId?'Guardar':'+ Agregar'}</button>
                  {editId && <button type="button" style={s.cancelBtn} onClick={() => { setEditId(null); setForm({name:'',emoji:'🥑',price:'',unit:'pieza',stock:'',imageURL:''}); }}>✕</button>}
                </div>
              </form>

              <div style={s.prodList}>
                {currentProducts.length===0 && <p style={s.empty}>Sin productos en esta sede. ¡Agrega uno arriba!</p>}
                {currentProducts.map(p => {
                  const allImgs = p.images?.filter(Boolean).length ? p.images.filter(Boolean) : (p.imageURL ? [p.imageURL] : []);
                  return (
                    <div key={p.id} style={s.prodCard}>
                      <div style={{ position:'relative', flexShrink:0 }}>
                        {allImgs.length > 0
                          ? <img src={allImgs[0]} alt={p.name} style={s.prodCardImg} />
                          : <span style={{ fontSize:'1.7rem', width:'44px', textAlign:'center' }}>{p.emoji}</span>
                        }
                        {allImgs.length > 1 && (
                          <span style={s.prodImgBadge}>{allImgs.length}📷</span>
                        )}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'0.92rem' }}>{p.name}</div>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-2)' }}>
                          ${p.price}/{p.unit}
                          {p.stock && <span style={{ marginLeft:'0.5rem', color: parseInt(p.stock)<=3?'#dc2626':'#2d7a2d', fontWeight:600 }}>
                            · Stock: {p.stock}
                          </span>}
                        </div>
                      </div>
                      <button style={s.iconBtn} onClick={() => startEdit(p)}>✏️</button>
                      <button style={s.iconBtn} onClick={() => deleteProduct(p.id)}>🗑️</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>


      </div>
    </div>

    {chatOrder && (
      <ChatDrawer order={chatOrder} onClose={() => setChatOrder(null)} />
    )}
    {showShare && (
      <ShareModal vendorId={currentUser.uid} vendorName={vendor.name} onClose={() => setShowShare(false)} />
    )}
    </>
  );
}

const s = {
  page:       { background:'var(--bg)', minHeight:'calc(100vh - 60px)', padding:'1.5rem 1rem' },
  container:  { maxWidth:'720px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'1.2rem' },
  loading:    { padding:'3rem', textAlign:'center', color:'var(--text-3)' },

  /* Hero */
  heroCard:   { background:'linear-gradient(135deg,#1a5c1a 0%,#2d7a2d 60%,#3d9e3d 100%)', borderRadius:'var(--radius-lg)', padding:'1.4rem 1.5rem', boxShadow:'0 8px 32px rgba(45,122,45,0.3)', display:'flex', flexDirection:'column', gap:'1rem' },
  heroBody:   { display:'flex', alignItems:'center', gap:'1rem' },
  heroInfo:   { flex:1, minWidth:0 },
  heroName:   { fontSize:'1.35rem', fontWeight:800, color:'#fff', margin:'0 0 0.2rem', lineHeight:1.2 },
  heroSub:    { fontSize:'0.85rem', color:'rgba(255,255,255,0.75)', margin:'0 0 0.5rem', display:'flex', alignItems:'center', gap:'0.4rem' },
  heroDot:    { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  heroBadges: { display:'flex', flexWrap:'wrap', gap:'0.4rem', alignItems:'center' },
  heroPendingBadge: { background:'#fef3c7', color:'#92400e', fontSize:'0.75rem', fontWeight:700, padding:'0.25rem 0.65rem', borderRadius:'20px' },
  heroNotifOn:  { fontSize:'0.75rem', color:'#86efac', fontWeight:600 },
  heroNotifOff: { fontSize:'0.75rem', color:'#fca5a5', fontWeight:600 },
  heroNotifBtn: { background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.35)', padding:'0.28rem 0.7rem', borderRadius:'20px', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  avatarWrap:   { position:'relative', width:72, height:72, borderRadius:'50%', cursor:'pointer', flexShrink:0, boxShadow:'0 4px 16px rgba(0,0,0,0.25)' },
  avatarImg:    { width:72, height:72, borderRadius:'50%', objectFit:'cover', border:'3px solid rgba(255,255,255,0.8)' },
  avatarPlaceholder: { width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,0.2)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.8rem', fontWeight:800, border:'3px solid rgba(255,255,255,0.5)' },
  avatarOverlay: { position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', opacity:0, transition:'opacity 0.2s' },
  spinner:       { animation:'spin 1s linear infinite', display:'inline-block' },
  section:    { background:'var(--card)', borderRadius:'var(--radius-lg)', padding:'1.3rem', boxShadow:'var(--shadow-sm)', border:'2px solid transparent' },
  sectionHead:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.8rem' },
  sectionTitle:{ fontSize:'1rem', fontWeight:700, color:'var(--text)', margin:0 },
  empty:      { color:'var(--text-3)', fontSize:'0.85rem', textAlign:'center', padding:'0.6rem 0' },

  /* Pedidos colapsables */
  orderSection:     { border:'1px solid var(--border)', borderRadius:'var(--radius)' },
  orderSectionHead: { width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.75rem 1rem', background:'var(--card)', border:'none', cursor:'pointer', fontFamily:'inherit', borderLeft:'4px solid #ccc', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' },
  groupDot:    { width:'10px', height:'10px', borderRadius:'50%', flexShrink:0 },
  groupLabel:  { fontWeight:600, fontSize:'0.9rem', color:'var(--text)' },
  groupCount:  { color:'#fff', fontSize:'0.72rem', fontWeight:700, padding:'0.1rem 0.45rem', borderRadius:'20px' },
  chevron:     { fontSize:'0.7rem', color:'var(--text-3)' },
  orderList:   { padding:'0.7rem', display:'flex', flexDirection:'column', gap:'0.6rem', background:'var(--card)', borderRadius:'0 0 var(--radius) var(--radius)' },
  orderCard:   { background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'0.8rem', border:'1px solid var(--border)' },
  orderHead:   { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem', flexWrap:'wrap', gap:'0.3rem' },
  typePill:    { fontSize:'0.78rem', fontWeight:600, padding:'0.18rem 0.55rem', borderRadius:'20px' },
  locPill:     { fontSize:'0.75rem', color:'var(--text-3)', background:'var(--bg)', padding:'0.1rem 0.4rem', borderRadius:'20px' },
  statusPill:  { color:'#fff', fontSize:'0.72rem', fontWeight:700, padding:'0.18rem 0.55rem', borderRadius:'20px' },
  orderProducts:{ display:'flex', flexWrap:'wrap', gap:'0.25rem', margin:'0.35rem 0' },
  orderProduct: { background:'var(--card)', border:'1px solid var(--border)', fontSize:'0.78rem', padding:'0.15rem 0.45rem', borderRadius:'20px' },
  orderMeta:   { fontSize:'0.78rem', color:'var(--text-2)', margin:'0.2rem 0 0' },
  orderActions:{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' },
  btnAccept:   { flex:1, background:'var(--green)', color:'#fff', border:'none', padding:'0.5rem 0.7rem', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.83rem', fontFamily:'inherit' },
  btnReject:   { background:'#fee2e2', color:'var(--red)', border:'none', padding:'0.5rem 0.7rem', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:700, fontFamily:'inherit' },
  btnComplete: { marginTop:'0.4rem', width:'100%', background:'var(--green)', color:'#fff', border:'none', padding:'0.45rem', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontFamily:'inherit' },
  btnChat:     { marginTop:'0.4rem', width:'100%', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #93c5fd', padding:'0.4rem', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.83rem', fontFamily:'inherit' },

  /* Sedes */
  addLocBtn:  { background:'var(--green-light)', color:'var(--green)', border:'1.5px solid var(--green-border)', padding:'0.4rem 0.9rem', borderRadius:'20px', cursor:'pointer', fontWeight:600, fontSize:'0.83rem', fontFamily:'inherit' },
  locList:    { display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'0.7rem' },
  locCard:    { background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'0.75rem', transition:'border-color 0.15s' },
  locCardActive:{ borderColor:'var(--green)', background:'#f0f7f0' },
  locRow:     { display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.4rem', flexWrap:'wrap' },
  locNameInput:{ border:'none', background:'transparent', fontWeight:600, fontSize:'0.92rem', color:'var(--text)', outline:'none', flex:1, minWidth:'100px', fontFamily:'inherit' },
  locPos:     { fontSize:'0.72rem', color:'var(--text-3)', fontFamily:'monospace' },
  locActions: { display:'flex', gap:'0.35rem', flexWrap:'wrap' },
  locBtn:     { fontSize:'0.78rem', padding:'0.28rem 0.55rem', border:'1px solid var(--border)', borderRadius:'20px', cursor:'pointer', background:'var(--bg)', fontFamily:'inherit', fontWeight:500 },
  locToggleBtn:{ fontSize:'0.78rem', padding:'0.28rem 0.65rem', border:'none', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 },
  locDeleteBtn:{ fontSize:'0.88rem', padding:'0.28rem 0.4rem', border:'none', background:'none', cursor:'pointer' },
  mapHint:    { fontSize:'0.78rem', color:'var(--text-2)', margin:'0.3rem 0 0.4rem', fontStyle:'italic' },
  mapWrap:    { borderRadius:'var(--radius-sm)', overflow:'hidden', border:'1px solid var(--border)' },

  /* Tabs de sedes en productos */
  locTabs:    { display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'1rem' },
  locTab:     { padding:'0.35rem 0.8rem', border:'1.5px solid var(--border)', borderRadius:'20px', background:'var(--bg)', cursor:'pointer', fontSize:'0.82rem', fontWeight:500, fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.3rem', transition:'all 0.15s' },
  locTabActive:{ background:'var(--green)', color:'#fff', border:'1.5px solid var(--green)' },
  onlineDot:  { width:'7px', height:'7px', borderRadius:'50%', background:'#22c55e' },

  /* Live tracking */
  liveBox:      { background:'var(--bg)', border:'1px solid #fecaca', borderRadius:'var(--radius)', padding:'0.85rem', marginBottom:'0.9rem' },
  liveBoxRow:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.6rem' },
  liveTitleTxt: { fontWeight:600, fontSize:'0.88rem', color:'var(--text)', display:'block' },
  liveHint:     { display:'block', fontSize:'0.76rem', color:'var(--text-3)', marginTop:'0.2rem' },
  liveCoords:   { display:'block', fontSize:'0.73rem', color:'var(--text-2)', marginTop:'0.2rem', fontFamily:'monospace' },
  liveStartBtn: { background:'#ef4444', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'0.42rem 0.85rem', fontWeight:600, cursor:'pointer', fontSize:'0.83rem', whiteSpace:'nowrap', flexShrink:0 },
  liveStopBtn:  { background:'#fee2e2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:'var(--radius-sm)', padding:'0.42rem 0.85rem', fontWeight:600, cursor:'pointer', fontSize:'0.83rem', whiteSpace:'nowrap', flexShrink:0 },
  liveBanner:   { display:'flex', alignItems:'center', gap:'0.45rem', fontSize:'0.78rem', color:'#b91c1c', marginTop:'0.6rem', fontWeight:500 },
  livePulse:    { display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', animation:'ping 1s infinite', flexShrink:0 },

  /* Productos */
  emojiRow:    { display:'flex', flexWrap:'wrap', gap:'0.25rem', marginBottom:'0.6rem' },
  emojiBtn:    { background:'none', border:'2px solid transparent', borderRadius:'6px', fontSize:'1.15rem', cursor:'pointer', padding:'0.15rem' },
  emojiBtnActive:{ border:'2px solid var(--green)', background:'var(--green-light)' },
  prodFormRow: { display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' },
  prodList:    { display:'flex', flexDirection:'column', gap:'0.45rem' },
  prodCard:    { display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.65rem', background:'var(--bg)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)' },
  prodCardImg: { width:'44px', height:'44px', borderRadius:'8px', objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' },
  iconBtn:     { background:'none', border:'none', cursor:'pointer', fontSize:'0.95rem', padding:'0.15rem' },
  prodImgRow:  { display:'flex', alignItems:'center', gap:'0.7rem', marginBottom:'0.6rem' },
  prodImgPreview: {
    width:'64px', height:'64px', borderRadius:'10px',
    border:'2px dashed var(--border)', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center', cursor:'pointer',
    background:'var(--bg)', overflow:'hidden', flexShrink:0,
    transition:'border-color 0.15s',
  },
  prodImgThumb: { width:'100%', height:'100%', objectFit:'cover' },
  removeProdImg: { fontSize:'0.75rem', color:'var(--red)', background:'#fee2e2', border:'none', padding:'0.25rem 0.6rem', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },

  /* Perfil */
  label:      { fontSize:'0.82rem', fontWeight:600, color:'var(--text-2)' },
  codeSelect: { padding:'0.6rem 0.5rem', borderRadius:'var(--radius-sm)', border:'1.5px solid var(--border)', background:'#fff', cursor:'pointer', fontFamily:'inherit' },
  saveBtn:    { padding:'0.6rem 1.2rem', background:'var(--green)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap' },
  cancelBtn:  { padding:'0.6rem 0.8rem', background:'var(--border)', color:'var(--text)', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontFamily:'inherit' },

  /* Zonas frecuentes */
  zoneForm:       { display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' },
  zoneGpsBtn:     { padding:'0.5rem 0.8rem', background:'var(--green)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 },
  zoneMapBtn:     { padding:'0.5rem 0.8rem', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #93c5fd', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.82rem', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 },
  zoneCard:       { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'0.65rem 0.75rem', flexWrap:'wrap' },
  zoneCardLeft:   { display:'flex', flexDirection:'column', gap:'0.15rem', flex:1, minWidth:0 },
  zoneCardRight:  { display:'flex', alignItems:'center', gap:'0.35rem', flexShrink:0, flexWrap:'wrap' },
  zoneName:       { fontWeight:600, fontSize:'0.88rem', color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  zoneCoords:     { fontSize:'0.7rem', color:'var(--text-3)', fontFamily:'monospace' },
  zoneApplyBtn:   { fontSize:'0.78rem', padding:'0.28rem 0.65rem', background:'var(--green-light)', color:'var(--green)', border:'1.5px solid var(--green-border)', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap' },
  zoneApplyPicker:{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap' },
  zoneLocBtn:     { fontSize:'0.75rem', padding:'0.22rem 0.55rem', background:'var(--green)', color:'#fff', border:'none', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap' },
  zoneCancelBtn:  { fontSize:'0.78rem', padding:'0.22rem 0.4rem', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontFamily:'inherit' },

  /* Mejora 19 — cupones */
  couponForm:   { display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' },
  couponCard:   { display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'0.55rem 0.75rem' },
  couponLeft:   { display:'flex', flexDirection:'column', gap:'0.1rem', flex:1, minWidth:0 },
  couponCode:   { fontWeight:700, fontSize:'0.88rem', color:'var(--text)', letterSpacing:'0.04em', fontFamily:'monospace' },
  couponDetail: { fontSize:'0.73rem', color:'var(--text-2)' },
  couponRight:  { display:'flex', alignItems:'center', gap:'0.35rem', flexShrink:0 },
  couponToggle: { fontSize:'0.75rem', padding:'0.2rem 0.55rem', border:'none', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 },

  /* Mejora 21 — QR / compartir */
  qrSection:    { display:'flex', alignItems:'center', gap:'1.2rem', flexWrap:'wrap' },
  qrBox:        { background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:'14px', padding:'0.7rem', flexShrink:0 },
  qrInfo:       { display:'flex', flexDirection:'column', gap:'0.5rem', flex:1 },
  qrUrl:        { fontSize:'0.72rem', color:'var(--text-3)', fontFamily:'monospace', wordBreak:'break-all', margin:0 },
  shareBtn:     { padding:'0.55rem 1rem', background:'var(--green)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.85rem', fontFamily:'inherit' },
  copyLinkBtn:  { padding:'0.5rem 1rem', background:'var(--green-light)', color:'var(--green)', border:'1.5px solid var(--green-border)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontWeight:600, fontSize:'0.85rem', fontFamily:'inherit' },

  /* Mejora 22 — galería multi-imagen */
  imgSlotRemove:{ position:'absolute', top:'-4px', right:'-4px', width:'18px', height:'18px', borderRadius:'50%', background:'#dc2626', color:'#fff', border:'none', cursor:'pointer', fontSize:'0.65rem', display:'flex', alignItems:'center', justifyContent:'center', padding:0 },
  prodImgBadge: { position:'absolute', bottom:'-2px', right:'-2px', background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:'0.58rem', fontWeight:700, borderRadius:'20px', padding:'1px 4px' },

  /* Estadísticas */
  statsGrid:    { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'0.6rem' },
  statCard:     { background:'var(--bg)', borderRadius:'var(--radius)', padding:'0.85rem 0.5rem', border:'1px solid var(--border)', borderTop:'3px solid #ccc', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.2rem', textAlign:'center' },
  statIcon:     { fontSize:'1.2rem', lineHeight:1 },
  statVal:      { fontSize:'1.3rem', fontWeight:800, lineHeight:1 },
  statLabel:    { fontSize:'0.67rem', color:'var(--text-3)', fontWeight:500 },
  totalRevPill: { fontSize:'0.8rem', color:'var(--green)', fontWeight:600, background:'var(--green-light)', border:'1px solid var(--green-border)', padding:'0.2rem 0.7rem', borderRadius:'20px' },
};
