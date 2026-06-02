import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import usePageMeta from '../hooks/usePageMeta';

const googleProvider = new GoogleAuthProvider();

export default function Login() {
  usePageMeta({ title: 'Iniciar sesión', description: 'Accede a tu cuenta de VendeCerca.' });
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

  async function handleGoogle() {
    setLoading(true);
    try {
      const result  = await signInWithPopup(auth, googleProvider);
      const user    = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          name: user.displayName || user.email,
          email: user.email,
          role: 'buyer',
          createdAt: serverTimestamp(),
        });
      } else if (user.displayName && !userDoc.data().name) {
        await setDoc(userRef, { name: user.displayName }, { merge: true });
      }
      navigate('/');
    } catch {
      toast.error('No se pudo iniciar sesión con Google');
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

        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading} type="button">
          <GoogleIcon />
          Continuar con Google
        </button>

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>o con correo</span>
          <div style={s.dividerLine} />
        </div>

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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

const s = {
  page:    { minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d3b0d, #2d7a2d)', padding: '1.5rem' },
  card:    { background: '#fff', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' },
  logoArea:{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.8rem', justifyContent: 'center' },
  logoIcon:{ fontSize: '1.8rem' },
  brand:   { fontSize: '1.5rem', fontWeight: 800, color: '#1a5c1a', letterSpacing: '-0.5px' },
  title:   { fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem', textAlign: 'center' },
  sub:     { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' },
  googleBtn:{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, color: '#374151', fontFamily: 'inherit', transition: 'background 0.15s', marginBottom: '1.2rem' },
  divider: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' },
  dividerLine: { flex: 1, height: '1px', background: '#e5e7eb' },
  dividerText: { color: '#9ca3af', fontSize: '0.82rem', whiteSpace: 'nowrap' },
  form:    { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:   { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label:   { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input:   { background: '#f9fafb' },
  btn:     { marginTop: '0.4rem', padding: '0.9rem', background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 700, transition: 'opacity 0.2s', fontFamily: 'inherit' },
  footer:  { textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.88rem' },
  link:       { color:'#2d7a2d', fontWeight:700, textDecoration:'none' },
  forgotLink: { color:'#6b7280', fontSize:'0.82rem', textDecoration:'none' },
};
