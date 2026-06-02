import { Link, useNavigate } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta({ title: 'Página no encontrada' });
  const navigate = useNavigate();

  return (
    <div style={s.page} className="page-enter">
      <div style={s.card}>

        {/* Pin roto */}
        <div style={s.iconWrap}>
          <svg width="72" height="86" viewBox="0 0 20 24" fill="none" aria-hidden="true" style={s.pin}>
            <path d="M10 0C5.58 0 2 3.58 2 8c0 6.5 8 16 8 16s8-9.5 8-16c0-4.42-3.58-8-8-8z" fill="#e5e7eb"/>
            <circle cx="10" cy="8" r="3.2" fill="#d1d5db"/>
          </svg>
          <div style={s.badge}>404</div>
        </div>

        <h1 style={s.title}>Esta página no existe</h1>
        <p style={s.sub}>
          La dirección que escribiste no es válida o el contenido fue removido.
        </p>

        <div style={s.actions}>
          <Link to="/" style={s.btnPrimary}>
            🗺️ Ir al mapa
          </Link>
          <button style={s.btnSecondary} onClick={() => navigate(-1)}>
            ← Volver
          </button>
        </div>

        <p style={s.hint}>
          ¿Buscas un vendedor? <Link to="/" style={s.hintLink}>Usa el mapa para encontrarlo →</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem 1.5rem', background: 'var(--bg)',
  },
  card: {
    background: '#fff', borderRadius: 'var(--radius-lg)',
    padding: '3rem 2rem', maxWidth: '420px', width: '100%',
    textAlign: 'center', boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
  },
  iconWrap: { position: 'relative', display: 'inline-block', marginBottom: '1.5rem' },
  pin: { display: 'block', opacity: 0.6 },
  badge: {
    position: 'absolute', top: '-10px', right: '-18px',
    background: 'linear-gradient(135deg, #1a5c1a, #3d9e3d)',
    color: '#fff', fontWeight: 800, fontSize: '0.8rem',
    padding: '0.2rem 0.55rem', borderRadius: '20px',
    boxShadow: '0 2px 8px rgba(45,122,45,0.35)',
  },
  title: {
    fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)',
    marginBottom: '0.75rem', letterSpacing: '-0.5px',
  },
  sub: {
    fontSize: '0.95rem', color: 'var(--text-2)', lineHeight: 1.6,
    marginBottom: '2rem',
  },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' },
  btnPrimary: {
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', textDecoration: 'none',
    padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-sm)',
    fontWeight: 700, fontSize: '0.95rem',
    boxShadow: '0 2px 8px rgba(45,122,45,0.3)',
  },
  btnSecondary: {
    background: 'var(--bg)', color: 'var(--text-2)',
    border: '1.5px solid var(--border)',
    padding: '0.75rem 1.2rem', borderRadius: 'var(--radius-sm)',
    fontWeight: 600, fontSize: '0.95rem',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  hint: { fontSize: '0.82rem', color: 'var(--text-3)' },
  hintLink: { color: 'var(--green)', fontWeight: 600, textDecoration: 'none' },
};
