import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import useIsMobile from '../hooks/useIsMobile';
import usePageMeta from '../hooks/usePageMeta';

const FEATURES = [
  {
    icon: '📍',
    title: 'Vendedores cerca de ti',
    desc: 'Ve en el mapa exactamente dónde están los vendedores de tu barrio en tiempo real.',
  },
  {
    icon: '🛵',
    title: 'Domicilio o retiro',
    desc: 'Pide a domicilio o ve directamente al puesto. Tú eliges cómo recibir tu pedido.',
  },
  {
    icon: '🥑',
    title: 'Productos frescos',
    desc: 'Frutas, verduras y más. Directamente de vendedores locales con precios justos.',
  },
  {
    icon: '⭐',
    title: 'Calificaciones reales',
    desc: 'Lee opiniones de otros compradores y encuentra los mejores vendedores.',
  },
];

const STEPS = [
  { num: '1', icon: '📡', title: 'Activa tu ubicación', desc: 'Permite el acceso y el mapa muestra los vendedores más cercanos a ti.' },
  { num: '2', icon: '🗺️', title: 'Explora el mapa',    desc: 'Toca un vendedor para ver sus productos, precios y disponibilidad.' },
  { num: '3', icon: '🛒', title: 'Haz tu pedido',      desc: 'Elige domicilio o retiro. El vendedor recibe tu pedido al instante.' },
];

const STATS = [
  { value: '500+', label: 'Vendedores activos' },
  { value: '4.8★', label: 'Calificación promedio' },
  { value: '3',    label: 'Ciudades' },
  { value: '< 5m', label: 'Tiempo de respuesta' },
];

const TESTIMONIALS = [
  {
    quote: 'Ahora compro mis frutas directamente al vendedor del barrio. Más fresco y más barato que el supermercado.',
    name: 'Camila R.',
    role: 'Compradora',
    city: 'Bogotá',
    avatar: 'C',
    color: '#7c3aed',
  },
  {
    quote: 'En una semana ya tenía 15 clientes nuevos. Es muy fácil de usar y los pedidos llegan al instante al celular.',
    name: 'Don Edilson',
    role: 'Vendedor de frutas',
    city: 'Medellín',
    avatar: 'E',
    color: '#1a5c1a',
  },
  {
    quote: 'Lo mejor es que veo en el mapa dónde está el vendedor. ¡Nunca más llego a un puesto cerrado!',
    name: 'Andrés P.',
    role: 'Comprador',
    city: 'Cali',
    avatar: 'A',
    color: '#0369a1',
  },
];

function PinLogo({ color = 'white', accentColor = '#86efac' }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.3px', color }}>
      <svg width="18" height="22" viewBox="0 0 20 24" fill="none" aria-hidden="true">
        <path d="M10 0C5.58 0 2 3.58 2 8c0 6.5 8 16 8 16s8-9.5 8-16c0-4.42-3.58-8-8-8z" fill={color}/>
        <circle cx="10" cy="8" r="3.2" fill={color === 'white' ? '#1a5c1a' : 'white'}/>
      </svg>
      Vende<span style={{ color: accentColor }}>Cerca</span>
    </span>
  );
}

function useInView(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.2, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

export default function Landing() {
  usePageMeta({
    title: 'Compra a vendedores de tu barrio',
    description: 'Encuentra frutas, verduras y productos frescos cerca de ti. Apoya a los vendedores locales con domicilio o retiro. ¡Gratis y sin intermediarios!',
  });
  const isMobile = useIsMobile();
  const [statsRef, statsVisible] = useInView();
  const [testimonialsRef, testimonialsVisible] = useInView();

  return (
    <div style={s.page} className="page-enter">

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.heroBadge}>🟢 Vendedores en línea ahora</div>
          <h1 style={{ ...s.heroTitle, fontSize: isMobile ? '2rem' : '3rem' }}>
            Compra a vendedores<br />
            <span style={s.heroAccent}>de tu barrio</span>
          </h1>
          <p style={{ ...s.heroSub, fontSize: isMobile ? '1rem' : '1.15rem' }}>
            Encuentra frutas, verduras y productos frescos cerca de ti.<br />
            Apoya a los vendedores locales con un solo toque.
          </p>
          <div style={{ ...s.heroCtas, flexDirection: isMobile ? 'column' : 'row' }}>
            <Link to="/register" style={s.ctaPrimary}>Empezar gratis →</Link>
            <Link to="/mapa"     style={s.ctaSecondary}>Ver el mapa</Link>
          </div>
        </div>

        {/* Tarjeta decorativa */}
        <div style={s.heroDecor}>
          <div style={s.heroCard}>
            <div style={s.heroCardRow}>
              <div style={s.heroAvatar}>M</div>
              <div>
                <div style={s.heroCardName}>Mercado Don Luis</div>
                <div style={s.heroCardDist}>🟢 150 m · Muy cerca</div>
              </div>
              <div style={s.heroCardBadge}>En línea</div>
            </div>
            <div style={s.heroCardProds}>
              <span style={s.heroCardTag}>🥑 Aguacate</span>
              <span style={s.heroCardTag}>🍋 Limón</span>
              <span style={s.heroCardTag}>🍅 Tomate</span>
            </div>
            <div style={s.heroCardBtns}>
              <div style={s.heroCardBtnA}>🛵 Domicilio</div>
              <div style={s.heroCardBtnB}>🛒 Ir a comprar</div>
            </div>
            {/* Rating row */}
            <div style={s.heroCardRating}>
              <span style={s.heroStars}>★★★★★</span>
              <span style={s.heroRatingText}>4.9 · 48 reseñas</span>
            </div>
          </div>
          <div style={s.heroMap}>
            <span style={{ fontSize: '2.5rem' }}>🗺️</span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem' }}>Mapa en tiempo real</span>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} style={s.statsSection}>
        <div style={s.statsInner}>
          {STATS.map((st, i) => (
            <div key={i} style={s.statItem} className={statsVisible ? 'stat-visible' : ''} style2={{ animationDelay: `${i * 0.1}s` }}>
              <div style={s.statValue}>{st.value}</div>
              <div style={s.statLabel}>{st.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionLabel}>¿Por qué VendeCerca?</p>
          <h2 style={s.sectionTitle}>Todo lo que necesitas para comprar local</h2>
          <div style={{ ...s.featGrid, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={s.featCard} className="feat-card-hover anim-fade-up">
                <div style={s.featIcon}>{f.icon}</div>
                <h3 style={s.featTitle}>{f.title}</h3>
                <p style={s.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section style={s.sectionAlt}>
        <div style={s.sectionInner}>
          <p style={s.sectionLabel}>Simple y rápido</p>
          <h2 style={s.sectionTitle}>¿Cómo funciona?</h2>
          <div style={{ ...s.stepsRow, flexDirection: isMobile ? 'column' : 'row' }}>
            {STEPS.map((step, i) => (
              <div key={i} style={s.stepCard}>
                <div style={s.stepNum}>{step.num}</div>
                <div style={s.stepIcon}>{step.icon}</div>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
                {i < STEPS.length - 1 && !isMobile && <div style={s.stepArrow}>→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ── */}
      <section ref={testimonialsRef} style={s.section}>
        <div style={s.sectionInner}>
          <p style={s.sectionLabel}>Lo que dicen nuestros usuarios</p>
          <h2 style={s.sectionTitle}>Reales. Locales. Satisfechos.</h2>
          <div style={{ ...s.testimonialGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)' }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={s.testimonialCard} className={`testimonial-card${testimonialsVisible ? ' anim-fade-up' : ''}`}>
                <div style={s.quoteIcon}>"</div>
                <p style={s.quoteText}>{t.quote}</p>
                <div style={s.testimonialAuthor}>
                  <div style={{ ...s.testimonialAvatar, background: t.color }}>{t.avatar}</div>
                  <div>
                    <div style={s.testimonialName}>{t.name}</div>
                    <div style={s.testimonialRole}>{t.role} · {t.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VENDEDOR CTA ── */}
      <section style={s.vendorSection}>
        <div style={s.vendorInner}>
          <div style={s.vendorText}>
            <h2 style={s.vendorTitle}>¿Eres vendedor?</h2>
            <p style={s.vendorSub}>
              Crea tu perfil gratis, sube tus productos y empieza a recibir pedidos
              de clientes cerca de ti hoy mismo.
            </p>
            <ul style={s.vendorList}>
              {['Sin comisiones ocultas', 'Pedidos en tiempo real', 'Gestiona varias sedes', 'Notificaciones al instante'].map((item, i) => (
                <li key={i} style={s.vendorItem}>✅ {item}</li>
              ))}
            </ul>
          </div>
          <div style={s.vendorCta}>
            <Link to="/register" style={s.vendorBtn}>Registrarme como vendedor →</Link>
            <p style={s.vendorNote}>Gratis · Sin tarjeta · En menos de 2 minutos</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerLogo}>
            <PinLogo color="white" accentColor="#86efac" />
          </div>
          <p style={s.footerSub}>Conectando compradores con vendedores locales</p>
          <div style={s.footerLinks}>
            <Link to="/login"    style={s.footerLink}>Iniciar sesión</Link>
            <Link to="/register" style={s.footerLink}>Registrarse</Link>
            <Link to="/mapa"     style={s.footerLink}>Ver mapa</Link>
          </div>
          <p style={s.footerCopy}>© {new Date().getFullYear()} VendeCerca · Hecho con ❤️ para el comercio local</p>
        </div>
      </footer>

    </div>
  );
}

const s = {
  page: { background: '#fff', overflowX: 'hidden' },

  /* Hero */
  hero: {
    background: 'linear-gradient(135deg, #0d3b0d 0%, #1a5c1a 50%, #2d7a2d 100%)',
    padding: '4rem 1.5rem 5rem',
    display: 'flex', flexWrap: 'wrap', gap: '3rem',
    alignItems: 'center', justifyContent: 'center',
  },
  heroInner: { flex: '1', minWidth: '280px', maxWidth: '520px' },
  heroBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '0.35rem 0.9rem', borderRadius: '20px',
    fontSize: '0.82rem', fontWeight: 600, marginBottom: '1.2rem',
  },
  heroTitle: {
    color: '#fff', fontWeight: 800, lineHeight: 1.15,
    letterSpacing: '-1px', marginBottom: '1rem',
  },
  heroAccent: {
    background: 'linear-gradient(90deg, #86efac, #4ade80)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: '2rem',
  },
  heroCtas: { display: 'flex', gap: '0.8rem', flexWrap: 'wrap' },
  ctaPrimary: {
    background: '#fff', color: '#1a5c1a', textDecoration: 'none',
    padding: '0.85rem 1.8rem', borderRadius: '12px',
    fontWeight: 800, fontSize: '1rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    transition: 'transform 0.15s',
  },
  ctaSecondary: {
    background: 'rgba(255,255,255,0.12)', color: '#fff',
    textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.3)',
    padding: '0.85rem 1.8rem', borderRadius: '12px',
    fontWeight: 600, fontSize: '1rem',
  },

  /* Hero decoration */
  heroDecor: { display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' },
  heroCard: {
    background: '#fff', borderRadius: '16px', padding: '1rem 1.1rem',
    width: '260px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  heroCardRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' },
  heroAvatar: {
    width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '1rem',
  },
  heroCardName: { fontWeight: 700, fontSize: '0.88rem', color: '#111827' },
  heroCardDist: { fontSize: '0.72rem', color: '#6b7280', marginTop: '0.1rem' },
  heroCardBadge: {
    marginLeft: 'auto', background: '#dcfce7', color: '#166534',
    fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '20px',
  },
  heroCardProds: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.7rem' },
  heroCardTag: {
    background: '#f3f7f3', color: '#374151', fontSize: '0.72rem',
    padding: '0.18rem 0.5rem', borderRadius: '20px', border: '1px solid #e5e7eb',
  },
  heroCardBtns: { display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' },
  heroCardBtnA: {
    flex: 1, background: 'linear-gradient(135deg, #f59e0b, #f97316)',
    color: '#fff', textAlign: 'center', padding: '0.45rem 0',
    borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
  },
  heroCardBtnB: {
    flex: 1, background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', textAlign: 'center', padding: '0.45rem 0',
    borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700,
  },
  heroCardRating: { display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.5rem' },
  heroStars:      { color: '#f59e0b', fontSize: '0.75rem', letterSpacing: '-1px' },
  heroRatingText: { fontSize: '0.72rem', color: '#6b7280' },
  heroMap: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '12px', padding: '1rem 1.5rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    color: '#fff', fontSize: '0.8rem',
  },

  /* Stats */
  statsSection: {
    background: 'linear-gradient(90deg, #0d3b0d, #1a5c1a)',
    padding: '2.5rem 1.5rem',
  },
  statsInner: {
    maxWidth: '900px', margin: '0 auto',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1rem',
  },
  statItem: {
    textAlign: 'center', padding: '0.5rem',
    borderRight: '1px solid rgba(255,255,255,0.1)',
  },
  statValue: { fontSize: '2rem', fontWeight: 800, color: '#86efac', lineHeight: 1 },
  statLabel: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.3rem', fontWeight: 500 },

  /* Sections */
  section:    { padding: '4rem 1.5rem', background: '#fff' },
  sectionAlt: { padding: '4rem 1.5rem', background: '#f9fafb' },
  sectionInner: { maxWidth: '1100px', margin: '0 auto' },
  sectionLabel: { color: 'var(--green)', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  sectionTitle: { fontSize: '1.75rem', fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: '2.5rem', letterSpacing: '-0.5px' },

  /* Features */
  featGrid: { display: 'grid', gap: '1.2rem' },
  featCard: {
    background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '16px',
    padding: '1.5rem 1.2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  featIcon:  { fontSize: '2rem', marginBottom: '0.8rem' },
  featTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.4rem' },
  featDesc:  { fontSize: '0.83rem', color: '#6b7280', lineHeight: 1.6 },

  /* Steps */
  stepsRow: { display: 'flex', gap: '1.5rem', alignItems: 'flex-start', position: 'relative' },
  stepCard: {
    flex: 1, background: '#fff', border: '1.5px solid #e5e7eb',
    borderRadius: '16px', padding: '1.8rem 1.3rem', textAlign: 'center',
    position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  stepNum: {
    position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', width: '28px', height: '28px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.82rem', fontWeight: 800,
  },
  stepIcon:  { fontSize: '2.2rem', marginBottom: '0.8rem' },
  stepTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.4rem' },
  stepDesc:  { fontSize: '0.83rem', color: '#6b7280', lineHeight: 1.6 },
  stepArrow: {
    position: 'absolute', right: '-20px', top: '50%',
    transform: 'translateY(-50%)', fontSize: '1.3rem', color: '#d1d5db', zIndex: 1,
  },

  /* Testimonials */
  testimonialGrid: { display: 'grid', gap: '1.2rem' },
  testimonialCard: {
    background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '18px',
    padding: '1.6rem 1.4rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  quoteIcon: { fontSize: '2.5rem', lineHeight: 1, color: '#e5e7eb', fontFamily: 'Georgia,serif', marginBottom: '-0.5rem' },
  quoteText: { fontSize: '0.9rem', color: '#374151', lineHeight: 1.7, fontStyle: 'italic', flex: 1 },
  testimonialAuthor: { display: 'flex', alignItems: 'center', gap: '0.7rem' },
  testimonialAvatar: {
    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '1rem',
  },
  testimonialName: { fontWeight: 700, fontSize: '0.88rem', color: '#111827' },
  testimonialRole: { fontSize: '0.75rem', color: '#9ca3af' },

  /* Vendor CTA */
  vendorSection: {
    background: 'linear-gradient(135deg, #0d3b0d 0%, #1a5c1a 50%, #2d7a2d 100%)',
    padding: '4rem 1.5rem',
  },
  vendorInner: {
    maxWidth: '1000px', margin: '0 auto',
    display: 'flex', flexWrap: 'wrap', gap: '3rem',
    alignItems: 'center', justifyContent: 'space-between',
  },
  vendorText: { flex: '1', minWidth: '260px' },
  vendorTitle: { fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '0.8rem', letterSpacing: '-0.5px' },
  vendorSub:   { color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: '1.2rem', fontSize: '0.95rem' },
  vendorList:  { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  vendorItem:  { color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' },
  vendorCta:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem' },
  vendorBtn: {
    background: '#fff', color: '#1a5c1a', textDecoration: 'none',
    padding: '1rem 2rem', borderRadius: '12px',
    fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  vendorNote: { color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem' },

  /* Footer */
  footer: { background: '#0d3b0d', padding: '2.5rem 1.5rem' },
  footerInner: { maxWidth: '1100px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' },
  footerLogo: { marginBottom: '0.3rem' },
  footerSub:   { color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' },
  footerLinks: { display: 'flex', gap: '1.5rem', marginTop: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' },
  footerLink:  { color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.82rem', transition: 'color 0.15s' },
  footerCopy:  { color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginTop: '0.6rem' },
};
