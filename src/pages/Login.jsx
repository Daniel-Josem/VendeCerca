import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const toast    = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch {
      toast.error('Correo o contraseña incorrectos');
    }
    setLoading(false);
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={s.logoArea}>
          <div style={s.logoIcon}>📍</div>
          <h1 style={s.brand}>VendeCerca</h1>
        </div>
        <h2 style={s.title}>Bienvenido de vuelta</h2>
        <p style={s.sub}>Inicia sesión para continuar</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <input className="app-input" style={s.input} type="email" placeholder="tu@correo.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input className="app-input" style={s.input} type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div style={{ textAlign:'right' }}>
            <Link to="/reset-password" style={s.forgotLink}>¿Olvidaste tu contraseña?</Link>
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Entrando...' : 'Entrar →'}
          </button>
        </form>

        <p style={s.footer}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={s.link}>Regístrate gratis</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d3b0d, #2d7a2d)', padding: '1.5rem' },
  card: { background: '#fff', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.8rem', justifyContent: 'center' },
  logoIcon: { fontSize: '1.8rem' },
  brand: { fontSize: '1.5rem', fontWeight: 800, color: '#1a5c1a', letterSpacing: '-0.5px' },
  title: { fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem', textAlign: 'center' },
  sub: { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.8rem', textAlign: 'center' },
  errorBox: { background: '#fee2e2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.2rem', fontSize: '0.88rem', border: '1px solid #fecaca' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input: { background: '#f9fafb' },
  btn: { marginTop: '0.4rem', padding: '0.9rem', background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 700, transition: 'opacity 0.2s, transform 0.2s', fontFamily: 'inherit' },
  footer: { textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.88rem' },
  link:       { color:'#2d7a2d', fontWeight:700, textDecoration:'none' },
  forgotLink: { color:'#6b7280', fontSize:'0.82rem', textDecoration:'none' },
};
