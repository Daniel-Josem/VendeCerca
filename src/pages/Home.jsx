import { useEffect, useState, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import OrderModal from '../components/OrderModal';
import { useAuth } from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import useFavorites from '../hooks/useFavorites';

// Ícono personalizado verde — cacheado para no recrear en cada render
const _iconCache = {};
function makeVendorIcon(emoji = '🏪') {
  if (!_iconCache[emoji]) {
    _iconCache[emoji] = L.divIcon({
      className: '',
      html: `<div class="vendor-marker"><span class="vendor-marker-icon">${emoji}</span></div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -46],
    });
  }
  return _iconCache[emoji];
}

// Ícono rojo pulsante para vendedores en vivo
const _liveIconCache = {};
function makeVendorLiveIcon(emoji = '🏪') {
  if (!_liveIconCache[emoji]) {
    _liveIconCache[emoji] = L.divIcon({
      className: '',
      html: `<div class="vendor-live-marker"><div class="vendor-live-ring"></div><span class="vendor-marker-icon">${emoji}</span></div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 46],
      popupAnchor: [0, -50],
    });
  }
  return _liveIconCache[emoji];
}

// liveLocation fresca = actualizada hace menos de 5 min
function isLiveFresh(v) {
  return !!(v.liveLocation?.lat && v.liveLocation?.updatedAt && Date.now() - v.liveLocation.updatedAt < 300_000);
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ícono azul pulsante para el comprador
const userIcon = L.divIcon({
  className: '',
  html: `<div class="user-marker"><div class="user-marker-ring"></div><div class="user-marker-dot"></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -16],
});

function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// Recalcula el tamaño del mapa cuando se vuelve visible (fix Leaflet display:none)
function InvalidateSize({ active }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [active, map]);
  return null;
}

// Centra el mapa en el usuario la primera vez que llega la posición
function AutoCenter({ userPos, active }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (userPos && !done.current && active) {
      map.flyTo([userPos.lat, userPos.lng], 15, { duration: 1.5 });
      done.current = true;
    }
  }, [userPos, active, map]);
  return null;
}

function formatDist(d) {
  if (d === null) return '';
  return d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1)} km`;
}

function distStyle(d) {
  if (d === null) return { bg:'#f3f4f6', color:'#6b7280', label:'' };
  if (d < 0.3)   return { bg:'#dcfce7', color:'#16a34a', label:'🟢' };
  if (d < 1)     return { bg:'#f0fdf4', color:'#16a34a', label:'🟡' };
  if (d < 3)     return { bg:'#fffbeb', color:'#d97706', label:'🟡' };
  return               { bg:'#fff1f2', color:'#e11d48', label:'🔴' };
}

const SORT_OPTS   = [{ val:'dist', label:'🏃 Cercanos' }, { val:'rating', label:'⭐ Mejor nota' }, { val:'name', label:'🔤 A-Z' }];
const RATING_OPTS = [{ val:4, label:'⭐ 4+' }, { val:3, label:'⭐ 3+' }];
const DIST_OPTS   = [{ val:0.5, label:'500m' }, { val:1, label:'1 km' }, { val:3, label:'3 km' }];

export default function Home() {
  const { currentUser, userRole } = useAuth();
  const isMobile = useIsMobile();
  const { favorites, toggleFavorite } = useFavorites();
  const [vendors, setVendors]           = useState([]);
  const [search, setSearch]             = useState('');
  const [userPos, setUserPos]           = useState(null);
  const [selectedVendor, setSelected]   = useState(null);
  const [orderModal, setOrderModal]     = useState(null);
  const [mapReady, setMapReady]         = useState(false);
  const [activeView, setActiveView]     = useState('list');
  const mapRef        = useRef(null);
  const markerRefs    = useRef({});
  const pendingFlyRef = useRef(null);
  const [filterRating, setFilterRating] = useState(0);
  const [filterDist,   setFilterDist]   = useState(0);
  const [sortBy,       setSortBy]       = useState('dist');
  // En móvil el mapa no se monta hasta que el usuario lo pida por primera vez
  const [mapMounted,   setMapMounted]   = useState(!isMobile);

  function flyToSede(v, loc) {
    if (!mapRef.current || !loc.lat) return;
    mapRef.current.flyTo([loc.lat, loc.lng], 17, { duration: 1.2 });
    const key = loc.id === 'live' ? `${v.id}-live` : `${v.id}-${loc.id}`;
    setTimeout(() => markerRefs.current[key]?.openPopup(), 1300);
  }

  // Monta el mapa la primera vez que el usuario cambia a la vista mapa
  useEffect(() => {
    if (activeView === 'map') setMapMounted(true);
  }, [activeView]);

  // Ejecuta el fly pendiente cuando el mapa se vuelve visible
  useEffect(() => {
    if (activeView !== 'map' || !pendingFlyRef.current) return;
    const { v, loc } = pendingFlyRef.current;
    pendingFlyRef.current = null;
    const t = setTimeout(() => flyToSede(v, loc), 120);
    return () => clearTimeout(t);
  }, [activeView]);

  function goToVendorOnMap(e, v) {
    e.stopPropagation();
    const onlineLocs = v.locations?.filter(l => l.isOnline && l.lat) || [];
    const loc = isLiveFresh(v)
      ? { id: 'live', lat: v.liveLocation.lat, lng: v.liveLocation.lng }
      : (onlineLocs[0] || (v.location?.lat ? { id: 'main', ...v.location } : null));
    if (!loc) return;
    setSelected(v);
    pendingFlyRef.current = { v, loc };
    setActiveView('map');
  }

  useEffect(() => {
    const watcher = navigator.geolocation?.watchPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      null,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation?.clearWatch(watcher);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'vendors'), where('isOnline', '==', true));
    return onSnapshot(q, snap => setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const filtered = useMemo(() => vendors
    .filter(v => {
      const hasOnline = v.locations?.some(l => l.isOnline) || v.isOnline;
      if (!hasOnline) return false;
      if (search) {
        const q = search.toLowerCase();
        const allProds = v.locations?.flatMap(l => l.products || []) || v.products || [];
        if (!v.name?.toLowerCase().includes(q) && !allProds.some(p => p.name?.toLowerCase().includes(q))) return false;
      }
      if (filterRating > 0 && (v.rating || 0) < filterRating) return false;
      return true;
    })
    .map(v => {
      let distance = null;
      if (userPos) {
        const onlineLocs = v.locations?.filter(l => l.isOnline && l.lat) || [];
        if (isLiveFresh(v)) {
          distance = haversineDistance(userPos.lat, userPos.lng, v.liveLocation.lat, v.liveLocation.lng);
        } else if (onlineLocs.length > 0) {
          distance = Math.min(...onlineLocs.map(l => haversineDistance(userPos.lat, userPos.lng, l.lat, l.lng)));
        } else if (v.location?.lat) {
          distance = haversineDistance(userPos.lat, userPos.lng, v.location.lat, v.location.lng);
        }
      }
      return { ...v, distance };
    })
    .filter(v => filterDist > 0 ? (v.distance === null || v.distance <= filterDist) : true)
    .sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'name')   return (a.name || '').localeCompare(b.name || '');
      return (a.distance ?? Infinity) - (b.distance ?? Infinity);
    }), [vendors, userPos, search, filterRating, filterDist, sortBy]);

  function selectVendor(v) {
    if (selectedVendor?.id === v.id) { setSelected(null); return; }
    setSelected(v);
    if (isLiveFresh(v)) {
      if (isMobile) setActiveView('map');
      flyToSede(v, { id: 'live', lat: v.liveLocation.lat, lng: v.liveLocation.lng });
      return;
    }
    const onlineLocs = v.locations?.filter(l => l.isOnline && l.lat) || [];
    if (onlineLocs.length === 1) {
      if (isMobile) setActiveView('map');
      flyToSede(v, onlineLocs[0]);
    } else if (onlineLocs.length === 0 && v.location?.lat) {
      if (isMobile) setActiveView('map');
      mapRef.current?.flyTo([v.location.lat, v.location.lng], 17, { duration: 1.2 });
    }
  }

  const waUrl = (v) => v.phone ? `https://wa.me/${v.phone.replace(/\D/g, '')}` : null;
  const mapCenter = userPos ? [userPos.lat, userPos.lng] : [4.7109, -74.0721];

  const mobileHeight = 'calc(100vh - 60px - 56px)';
  const desktopHeight = 'calc(100vh - 60px)';

  return (
    <div style={{
      ...s.container,
      flexDirection: isMobile ? 'column' : 'row',
      height: isMobile ? mobileHeight : desktopHeight,
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{
        ...s.sidebar,
        width: isMobile ? '100%' : '340px',
        minWidth: isMobile ? 'unset' : '280px',
        height: isMobile ? '100%' : desktopHeight,
        ...(isMobile ? {
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: activeView === 'list' ? 2 : 1,
          visibility: activeView === 'list' ? 'visible' : 'hidden',
        } : {}),
      }}>
        {/* Search */}
        <div style={s.searchWrap}>
          <div style={s.searchInner}>
            <span style={s.searchIcon}>🔍</span>
            <input
              className="app-input"
              style={s.searchInput}
              placeholder="Buscar producto o vendedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button style={s.clearBtn} onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {/* ── FILTROS ── */}
        <div style={s.filterScroll}>
          {SORT_OPTS.map(opt => (
            <button key={opt.val} style={{ ...s.chip, ...(sortBy === opt.val ? s.chipOn : {}) }} onClick={() => setSortBy(opt.val)}>
              {opt.label}
            </button>
          ))}
          <div style={s.chipDivider} />
          {RATING_OPTS.map(opt => (
            <button key={opt.val} style={{ ...s.chip, ...(filterRating === opt.val ? s.chipOn : {}) }} onClick={() => setFilterRating(filterRating === opt.val ? 0 : opt.val)}>
              {opt.label}
            </button>
          ))}
          {userPos && <div style={s.chipDivider} />}
          {userPos && DIST_OPTS.map(opt => (
            <button key={opt.val} style={{ ...s.chip, ...(filterDist === opt.val ? s.chipOn : {}) }} onClick={() => setFilterDist(filterDist === opt.val ? 0 : opt.val)}>
              📍 {opt.label}
            </button>
          ))}
          {(filterRating > 0 || filterDist > 0) && (
            <button style={s.clearFiltersBtn} onClick={() => { setFilterRating(0); setFilterDist(0); }}>
              ✕
            </button>
          )}
        </div>

        {/* Count */}
        <div style={s.countRow}>
          <span style={s.countDot} />
          <span style={s.countText}>
            {filtered.length} vendedor{filtered.length !== 1 ? 'es' : ''}
            {search ? ` con "${search}"` : ' en línea'}
            {sortBy === 'dist'   && userPos && filtered.length > 0 ? ' · por distancia' : ''}
            {sortBy === 'rating' && filtered.length > 0 ? ' · mejor calificados' : ''}
            {sortBy === 'name'   && filtered.length > 0 ? ' · A-Z' : ''}
          </span>
        </div>

        {/* List */}
        <div style={s.list}>
          {filtered.length === 0 && (
            <div style={s.empty} className="anim-fade-in">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🗺️</div>
              <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Sin vendedores cerca</p>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Intenta más tarde o amplía la búsqueda</p>
            </div>
          )}

          {filtered.map((v, i) => {
            const isSelected = selectedVendor?.id === v.id;
            const isOwn      = currentUser?.uid === v.id;
            const isNearest  = i === 0 && filtered.length > 1 && v.distance !== null;
            const ds         = distStyle(v.distance);

            // Productos que coinciden con la búsqueda
            const allProds = v.locations?.flatMap(l => l.products||[])
              .filter((p,i,arr) => arr.findIndex(x=>x.name===p.name)===i)
              || v.products || [];
            const matchedProds = search
              ? allProds.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
              : [];

            return (
              <div
                key={v.id}
                onClick={() => selectVendor(v)}
                className={`anim-fade-up delay-${Math.min(i + 1, 5)}`}
                style={{ ...s.card, ...(isSelected ? s.cardActive : {}) }}
              >
                {/* Badge más cercano */}
                {isNearest && (
                  <div style={s.nearestBadge}>
                    🏆 {search ? `Más cercano con "${search}"` : 'Más cercano'}
                  </div>
                )}

                {/* Header */}
                <div style={s.cardHead}>
                  {v.photoURL
                    ? <img src={v.photoURL} alt={v.name} style={s.avatarImg} />
                    : <div style={s.avatar}>{v.name?.[0]?.toUpperCase()}</div>
                  }
                  <div style={s.cardInfo}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', flexWrap:'wrap' }}>
                      <span style={s.vendorName}>{v.name}</span>
                      {isLiveFresh(v) && <span style={s.liveBadge}>🔴 En vivo</span>}
                    </div>
                    {v.rating > 0 && (
                      <div style={s.rating}>
                        {'⭐'.repeat(Math.round(v.rating))} <span style={s.ratingNum}>{v.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {v.distance !== null && (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'0.15rem' }}>
                      <span style={{ ...s.distTag, background: ds.bg, color: ds.color, fontWeight:700, fontSize:'0.88rem' }}>
                        {formatDist(v.distance)}
                      </span>
                      <span style={{ fontSize:'0.65rem', color: ds.color, opacity:0.8 }}>
                        {v.distance < 0.3 ? 'Muy cerca' : v.distance < 1 ? 'Cerca' : v.distance < 3 ? 'Moderado' : 'Lejos'}
                      </span>
                    </div>
                  )}
                  {currentUser && userRole !== 'vendor' && (
                    <button
                      style={{ ...s.favBtn, ...(favorites.has(v.id) ? s.favBtnOn : {}) }}
                      onClick={e => { e.stopPropagation(); toggleFavorite(v.id); }}
                      title={favorites.has(v.id) ? 'Quitar de favoritos' : 'Guardar favorito'}
                    >
                      {favorites.has(v.id) ? '❤️' : '🤍'}
                    </button>
                  )}
                </div>

                {/* Productos que coinciden con búsqueda (resaltados) */}
                {matchedProds.length > 0 && (
                  <div style={s.matchRow}>
                    {matchedProds.map((p,idx) => (
                      <span key={idx} style={s.matchTag}>
                        {p.emoji} {p.name} — <strong>${p.price}/{p.unit}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Products preview (all sedes combined) */}
                {(() => {
                  const allProds = v.locations?.flatMap(l => l.products || [])
                    .filter((p,i,arr) => arr.findIndex(x=>x.name===p.name)===i)
                    || v.products || [];
                  return (
                    <div style={s.tagRow}>
                      {allProds.slice(0, 4).map((p,i) => (
                        <span key={i} style={s.tag}>{p.emoji} {p.name}</span>
                      ))}
                      {allProds.length > 4 && <span style={s.tagMore}>+{allProds.length - 4}</span>}
                    </div>
                  );
                })()}

                {/* Botón ver en mapa (solo mobile) */}
                {isMobile && (
                  <button style={s.verMapaBtn} onClick={e => goToVendorOnMap(e, v)}>
                    🗺️ Ver en mapa
                  </button>
                )}

                {/* Expanded */}
                {isSelected && (
                  <div style={s.expanded} onClick={e => e.stopPropagation()} className="anim-fade-in">
                    <div style={s.divider} />
                    {v.description && <p style={s.description}>{v.description}</p>}

                    {isOwn ? (
                      <div style={s.ownBadge}>🏪 Este es tu puesto</div>
                    ) : (() => {
                      const onlineLocs = v.locations?.filter(l => l.isOnline && l.lat) || [];

                      // ── MULTI-SEDE ──────────────────────────────
                      if (onlineLocs.length > 1) {
                        return (
                          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                            <p style={s.sedeHint}>Elige una sede para ver productos y pedir:</p>
                            {onlineLocs.map(loc => {
                              const dist = userPos ? haversineDistance(userPos.lat, userPos.lng, loc.lat, loc.lng) : null;
                              const prods = loc.products || [];
                              return (
                                <div key={loc.id} style={s.sedeCard}>
                                  <div style={s.sedeCardHead}>
                                    <div>
                                      <span style={s.sedeName}>📍 {loc.name}</span>
                                      {dist !== null && <span style={s.sedeDist}>{formatDist(dist)}</span>}
                                    </div>
                                    <button style={s.sedeMapBtn} onClick={() => {
                                      if (isMobile) {
                                        pendingFlyRef.current = { v, loc };
                                        setActiveView('map');
                                      } else {
                                        flyToSede(v, loc);
                                      }
                                    }}>
                                      Ver en mapa →
                                    </button>
                                  </div>
                                  {prods.length > 0 && (
                                    <div style={s.sedeProdRow}>
                                      {prods.slice(0,4).map((p,i) => (
                                        <span key={i} style={s.tag}>{p.emoji} {p.name} <span style={{ color:'var(--green)', fontWeight:700 }}>${p.price}</span></span>
                                      ))}
                                      {prods.length > 4 && <span style={s.tagMore}>+{prods.length-4}</span>}
                                    </div>
                                  )}
                                  <div style={s.actionRow}>
                                    <button style={s.btnDomicilio} onClick={() => setOrderModal({ vendor:v, type:'domicilio', locationId:loc.id })}>
                                      🛵 Domicilio
                                    </button>
                                    <button style={s.btnRetiro} onClick={() => setOrderModal({ vendor:v, type:'retiro', locationId:loc.id })}>
                                      🛒 Ir a comprar
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // ── UNA SOLA SEDE (o formato antiguo) ───────
                      const prods = onlineLocs[0]?.products?.length
                        ? onlineLocs[0].products
                        : (v.products || []);
                      return (
                        <>
                          {prods.length > 0 && (
                            <div style={s.productTable}>
                              {prods.map((p,i) => (
                                <div key={i} style={s.productTableRow}>
                                  <span style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                                    {p.imageURL
                                      ? <img src={p.imageURL} alt={p.name} style={{ width:'28px', height:'28px', borderRadius:'6px', objectFit:'cover', flexShrink:0 }} />
                                      : <span>{p.emoji}</span>
                                    }
                                    {p.name}
                                  </span>
                                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                                    {p.stock && parseInt(p.stock) <= 5 && parseInt(p.stock) > 0 && <span style={s.lowStock}>¡Solo {p.stock}!</span>}
                                    {p.stock === '0' && <span style={s.outStock}>Agotado</span>}
                                    <span style={s.productPrice}>${p.price}/{p.unit}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={s.actionRow}>
                            <button style={s.btnDomicilio} onClick={() => setOrderModal({ vendor:v, type:'domicilio' })}>🛵 Domicilio</button>
                            <button style={s.btnRetiro}    onClick={() => setOrderModal({ vendor:v, type:'retiro' })}>🛒 Ir a comprar</button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── MAPA ── */}
      <div style={{
        ...s.mapWrap,
        height: isMobile ? '100%' : desktopHeight,
        ...(isMobile ? {
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: activeView === 'map' ? 2 : 1,
        } : {}),
      }}>
        {/* Botón flotante para centrar en el usuario */}
        {userPos && (
          <button
            style={{ ...s.centerBtn, bottom: isMobile ? 'calc(56px + 1.8rem)' : '1.5rem' }}
            onClick={() => mapRef.current?.flyTo([userPos.lat, userPos.lng], 16, { duration: 1 })}
            title="Centrar en mi ubicación"
          >
            📍 Mi ubicación
          </button>
        )}

        {!mapMounted && (
          <div style={s.mapSkeleton}>
            <svg width="48" height="58" viewBox="0 0 20 24" fill="none" style={{ animation:'pinPulse 1.4s ease-in-out infinite' }}>
              <path d="M10 0C5.58 0 2 3.58 2 8c0 6.5 8 16 8 16s8-9.5 8-16c0-4.42-3.58-8-8-8z" fill="#1a5c1a"/>
              <circle cx="10" cy="8" r="3.2" fill="white"/>
            </svg>
            <span style={{ color:'#1a5c1a', fontWeight:700, fontSize:'0.9rem' }}>Cargando mapa...</span>
            <style>{`@keyframes pinPulse{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.08)}}`}</style>
          </div>
        )}
        {mapMounted && <MapContainer
          center={mapCenter} zoom={14}
          style={{ height: '100%', width: '100%' }}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapController mapRef={mapRef} />
          <InvalidateSize active={!isMobile || activeView === 'map'} />
          <AutoCenter userPos={userPos} active={!isMobile || activeView === 'map'} />

          {/* Marcador del comprador */}
          {userPos && (
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>
                <div style={{ padding:'0.4rem 0.2rem', textAlign:'center' }}>
                  <strong style={{ color:'#3b82f6' }}>📍 Tú estás aquí</strong>
                </div>
              </Popup>
            </Marker>
          )}
          {filtered.flatMap(v => {
            const emoji = v.products?.[0]?.emoji || '🏪';
            const fresh = isLiveFresh(v);

            // Vendedor en vivo: pin rojo pulsante en su posición actual
            if (fresh) {
              return [(
                <Marker
                  key={`${v.id}-live`}
                  position={[v.liveLocation.lat, v.liveLocation.lng]}
                  icon={makeVendorLiveIcon(emoji)}
                  ref={el => { if (el) markerRefs.current[`${v.id}-live`] = el; }}
                >
                  <Popup>
                    <div style={s.popup}>
                      <div style={s.popupHead}>
                        <div>
                          <strong style={s.popupName}>{v.name}</strong>
                          <div style={{ fontSize:'0.73rem', color:'#ef4444', fontWeight:600, marginTop:'0.1rem' }}>
                            📡 En vivo · hace {Math.round((Date.now() - v.liveLocation.updatedAt) / 1000)}s
                          </div>
                        </div>
                        {v.rating > 0 && <span style={s.popupRating}>⭐ {v.rating.toFixed(1)}</span>}
                      </div>
                      <div style={s.popupProducts}>
                        {v.products?.slice(0, 3).map(p => (
                          <div key={p.id} style={s.popupProduct}>
                            <span>{p.emoji} {p.name}</span>
                            <strong style={{ color: 'var(--green)' }}>${p.price}/{p.unit}</strong>
                          </div>
                        ))}
                      </div>
                      <div style={s.popupActions}>
                        {waUrl(v) && (
                          <a href={waUrl(v)} target="_blank" rel="noreferrer" style={s.popupWA}>📱 WhatsApp</a>
                        )}
                        <Link to={`/vendor/${v.id}`} style={s.popupProfile}>Ver perfil →</Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )];
            }

            // Vendedor con sedes fijas
            const locs = v.locations?.filter(l => l.isOnline && l.lat && l.lng)
              || (v.location?.lat ? [{ id: 'main', lat: v.location.lat, lng: v.location.lng, name: '' }] : []);
            return locs.map(loc => (
              <Marker
                key={`${v.id}-${loc.id}`}
                position={[loc.lat, loc.lng]}
                icon={makeVendorIcon(emoji)}
                ref={el => { if (el) markerRefs.current[v.id] = el; }}
              >
                <Popup>
                  <div style={s.popup}>
                    <div style={s.popupHead}>
                      <div>
                        <strong style={s.popupName}>{v.name}</strong>
                        {loc.name && <div style={{ fontSize:'0.75rem', color:'#888' }}>📍 {loc.name}</div>}
                      </div>
                      {v.rating > 0 && <span style={s.popupRating}>⭐ {v.rating.toFixed(1)}</span>}
                    </div>
                    <div style={s.popupProducts}>
                      {v.products?.slice(0, 3).map(p => (
                        <div key={p.id} style={s.popupProduct}>
                          <span>{p.emoji} {p.name}</span>
                          <strong style={{ color: 'var(--green)' }}>${p.price}/{p.unit}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={s.popupActions}>
                      {waUrl(v) && (
                        <a href={waUrl(v)} target="_blank" rel="noreferrer" style={s.popupWA}>📱 WhatsApp</a>
                      )}
                      <Link to={`/vendor/${v.id}`} style={s.popupProfile}>Ver perfil →</Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ));
          })}
        </MapContainer>}

        {/* Badge flotante sobre el mapa */}
        {!mapReady && (
          <div style={s.mapLoading}>
            <div style={s.mapLoadingDot} /> Cargando mapa...
          </div>
        )}
      </div>

      {/* ── TAB BAR MOBILE ── */}
      {isMobile && (
        <div style={s.tabBar}>
          <button
            style={{ ...s.tabBtn, ...(activeView === 'list' ? s.tabBtnActive : {}) }}
            onClick={() => setActiveView('list')}
          >
            <span style={s.tabIcon}>📋</span>
            <span>Lista</span>
            {filtered.length > 0 && activeView !== 'list' && (
              <span style={s.tabCount}>{filtered.length}</span>
            )}
          </button>
          <button
            style={{ ...s.tabBtn, ...(activeView === 'map' ? s.tabBtnActive : {}) }}
            onClick={() => setActiveView('map')}
          >
            <span style={s.tabIcon}>🗺️</span>
            <span>Mapa</span>
          </button>
        </div>
      )}

      {orderModal && (
        <OrderModal
          vendor={orderModal.vendor}
          type={orderModal.type}
          locationId={orderModal.locationId || null}
          onClose={() => setOrderModal(null)}
        />
      )}
    </div>
  );
}

const s = {
  container: { display: 'flex', background: 'var(--bg)', position: 'relative', overflow: 'hidden' },

  /* Sidebar */
  sidebar: {
    width: '340px', minWidth: '280px', display: 'flex', flexDirection: 'column',
    background: '#fff', borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },

  /* Tab bar mobile */
  tabBar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1002,
    display: 'flex', height: '56px',
    background: '#fff', borderTop: '1px solid var(--border)',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
  },
  tabBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.1rem',
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#9ca3af', fontSize: '0.7rem', fontWeight: 600,
    fontFamily: 'inherit', transition: 'color 0.15s', position: 'relative',
  },
  tabBtnActive: { color: 'var(--green)' },
  tabIcon: { fontSize: '1.2rem', lineHeight: 1 },
  tabCount: {
    position: 'absolute', top: '4px', right: 'calc(50% - 18px)',
    background: '#ef4444', color: '#fff', fontSize: '0.6rem',
    fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '20px',
    minWidth: '16px', textAlign: 'center', lineHeight: 1.5,
  },
  searchWrap: { padding: '0.9rem 0.9rem 0.5rem' },
  searchInner: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: '0.8rem', fontSize: '0.9rem', pointerEvents: 'none', zIndex: 1 },
  searchInput: {
    paddingLeft: '2.2rem', paddingRight: '2.2rem',
    border: '1.5px solid var(--border)', borderRadius: '10px',
    fontSize: '0.9rem', background: 'var(--bg)',
    transition: 'all 0.2s',
  },
  clearBtn: {
    position: 'absolute', right: '0.7rem', background: 'none',
    border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.85rem',
  },
  countRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 1rem 0.5rem' },
  countDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)', animation: 'ping 2s ease-in-out infinite' },
  countText: { fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 },
  list: { flex: 1, overflowY: 'auto', padding: '0 0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--text-2)', textAlign: 'center' },

  /* Card */
  card: {
    background: '#fff', borderRadius: 'var(--radius)',
    padding: '0.9rem', cursor: 'pointer',
    border: '1.5px solid var(--border)',
    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
    boxShadow: 'var(--shadow-sm)',
  },
  cardActive: { borderColor: 'var(--green)', boxShadow: '0 0 0 3px rgba(45,122,45,0.1)', transform: 'none' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.55rem' },
  avatar: {
    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--green), var(--green-mid))',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '1rem',
  },
  avatarImg: { width:'38px', height:'38px', borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid var(--border)' },
  cardInfo: { flex: 1, minWidth: 0 },
  vendorName: { fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rating: { fontSize: '0.78rem', color: '#f59e0b', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.2rem' },
  ratingNum: { color: 'var(--text-2)', fontWeight: 600 },
  distTag: { fontSize:'0.82rem', fontWeight:700, padding:'0.25rem 0.6rem', borderRadius:'20px', whiteSpace:'nowrap', flexShrink:0, border:'1px solid rgba(0,0,0,0.06)' },
  nearestBadge: { background:'linear-gradient(135deg,#fef3c7,#fde68a)', color:'#92400e', fontSize:'0.75rem', fontWeight:700, padding:'0.25rem 0.7rem', borderRadius:'20px', marginBottom:'0.4rem', display:'inline-block', border:'1px solid #fcd34d' },
  liveBadge: { background:'#fee2e2', color:'#b91c1c', fontSize:'0.7rem', fontWeight:700, padding:'0.12rem 0.45rem', borderRadius:'20px', border:'1px solid #fecaca', whiteSpace:'nowrap', flexShrink:0 },
  matchRow: { display:'flex', flexWrap:'wrap', gap:'0.3rem', margin:'0.1rem 0' },
  matchTag: { background:'#f0fdf4', color:'#166534', fontSize:'0.78rem', padding:'0.22rem 0.55rem', borderRadius:'20px', border:'1px solid #bbf7d0', fontWeight:500 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.4rem' },
  verMapaBtn: {
    width: '100%', marginTop: '0.45rem',
    padding: '0.5rem', background: 'var(--green-light)',
    color: 'var(--green)', border: '1.5px solid var(--green-border)',
    borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
  },
  tag: { background: 'var(--bg)', color: 'var(--text-2)', fontSize: '0.75rem', padding: '0.18rem 0.5rem', borderRadius: '20px', border: '1px solid var(--border)' },
  tagMore: { background: 'var(--green-light)', color: 'var(--green)', fontSize: '0.75rem', padding: '0.18rem 0.5rem', borderRadius: '20px', fontWeight: 600 },

  /* Expanded */
  expanded: { marginTop: '0.7rem' },
  divider: { height: '1px', background: 'var(--border)', margin: '0 0 0.7rem' },
  description: { fontSize: '0.83rem', color: 'var(--text-2)', marginBottom: '0.6rem', lineHeight: 1.5 },
  productTable: { display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '0.8rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' },
  productTableRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    borderBottom: '1px solid var(--border)', background: '#fff',
  },
  lowStock: { fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.4rem', borderRadius: '20px', fontWeight: 600 },
  outStock: { fontSize: '0.72rem', background: '#fee2e2', color: 'var(--red)', padding: '0.1rem 0.4rem', borderRadius: '20px', fontWeight: 600 },
  productPrice: { color: 'var(--green)', fontWeight: 700, fontSize: '0.83rem' },
  actionRow: { display: 'flex', gap: '0.5rem' },
  btnDomicilio: { flex: 1, background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', border: 'none', padding: '0.55rem 0', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit' },
  btnRetiro:    { flex: 1, background: 'linear-gradient(135deg, var(--green), var(--green-mid))', color: '#fff', border: 'none', padding: '0.55rem 0', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit' },
  ownBadge:     { background:'var(--green-light)', color:'var(--green)', textAlign:'center', padding:'0.5rem', borderRadius:'var(--radius-sm)', fontSize:'0.85rem', fontWeight:600 },
  sedeHint:     { fontSize:'0.8rem', color:'var(--text-2)', marginBottom:'0.2rem', fontStyle:'italic' },
  sedeCard:     { border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'0.7rem', display:'flex', flexDirection:'column', gap:'0.5rem', background:'var(--bg)' },
  sedeCardHead: { display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.3rem' },
  sedeName:     { fontWeight:700, fontSize:'0.9rem', color:'var(--text)' },
  sedeDist:     { marginLeft:'0.4rem', background:'var(--green-light)', color:'var(--green)', fontSize:'0.72rem', fontWeight:700, padding:'0.15rem 0.45rem', borderRadius:'20px' },
  sedeMapBtn:   { fontSize:'0.78rem', color:'var(--green)', fontWeight:600, background:'none', border:'1px solid var(--green-border)', padding:'0.2rem 0.6rem', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  sedeProdRow:  { display:'flex', flexWrap:'wrap', gap:'0.25rem' },

  /* Map */
  mapWrap: { flex: 1, position: 'relative', height: 'calc(100vh - 60px)' },
  centerBtn: {
    position: 'absolute', bottom: '1.5rem', right: '1rem', zIndex: 1000,
    background: '#fff', color: '#3b82f6',
    border: '2px solid #3b82f6', borderRadius: '25px',
    padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem',
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    transition: 'all 0.2s ease',
  },
  mapLoading: { position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--text-2)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 999 },
  mapSkeleton: { position: 'absolute', inset: 0, background: '#f0f7f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', zIndex: 10 },
  mapLoadingDot: { width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', animation: 'ping 1s ease-in-out infinite' },

  /* Popup */
  popup: { padding: '0.9rem', minWidth: '180px' },
  popupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' },
  popupName: { fontSize: '0.95rem', color: 'var(--text)' },
  popupRating: { fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 },
  popupProducts: { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.7rem' },
  popupProduct: { display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-2)' },
  popupActions: { display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' },
  popupWA: { background: '#25d366', color: '#fff', textDecoration: 'none', padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 },
  popupProfile: { color: 'var(--green)', fontSize: '0.8rem', fontWeight: 600, alignSelf: 'center', textDecoration: 'none' },

  /* Filter bar */
  filterScroll:    { display:'flex', overflowX:'auto', padding:'0 0.9rem 0.65rem', gap:'0.35rem', scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch', alignItems:'center' },
  chip:            { flexShrink:0, padding:'0.28rem 0.65rem', border:'1.5px solid var(--border)', borderRadius:'20px', fontSize:'0.75rem', fontWeight:500, cursor:'pointer', background:'#fff', color:'var(--text-2)', fontFamily:'inherit', transition:'all 0.15s', whiteSpace:'nowrap' },
  chipOn:          { background:'var(--green)', color:'#fff', borderColor:'var(--green)' },
  chipDivider:     { width:'1px', height:'20px', background:'var(--border)', flexShrink:0 },
  clearFiltersBtn: { flexShrink:0, padding:'0.28rem 0.6rem', border:'1.5px solid #fca5a5', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700, cursor:'pointer', background:'#fee2e2', color:'#dc2626', fontFamily:'inherit', whiteSpace:'nowrap' },

  /* Favorite button */
  favBtn:   { flexShrink:0, width:'30px', height:'30px', border:'1.5px solid var(--border)', borderRadius:'50%', background:'#fff', cursor:'pointer', fontSize:'0.95rem', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', fontFamily:'inherit', padding:0 },
  favBtnOn: { background:'#fff0f0', borderColor:'#fca5a5' },
};
