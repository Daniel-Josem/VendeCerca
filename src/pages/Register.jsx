import { useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import { VERIFICATION_CODE_EXPIRY_MS } from '../config/constants';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { auth, db } from '../firebase/config';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const googleProvider = new GoogleAuthProvider();

const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function Register() {
  usePageMeta({ title: 'Registrarse', description: 'Crea tu cuenta gratis en VendeCerca. Compra productos locales o vende desde tu barrio.' });
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [step, setStep]     = useState('form'); // 'form' | 'verify'
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast    = useToast();

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function sendCode() {
    setLoading(true);
    try {
      // Borrar códigos viejos del mismo email
      const q = query(collection(db, 'verificationCodes'), where('email', '==', form.email));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

      const newCode   = generateCode();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MS));

      await addDoc(collection(db, 'verificationCodes'), {
        email: form.email,
        code:  newCode,
        expiresAt,
      });

      await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
        to_email: form.email,
        name:     form.name,
        code:     newCode,
        purpose:  'verificar tu cuenta en VendeCerca',
      }, { publicKey: EJS_KEY });

      setStep('verify');
      toast.success('Código enviado, revisa tu correo');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo enviar el código. Verifica tu correo.');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Verificar código — buscar por email y verificar code en JS
      const q    = query(collection(db, 'verificationCodes'), where('email', '==', form.email));
      const snap = await getDocs(q);
      const codeDoc = snap.docs.find(d => d.data().code === code);

      if (!codeDoc) { toast.error('Código incorrecto'); setLoading(false); return; }

      const data = codeDoc.data();
      if (data.expiresAt.toDate() < new Date()) {
        toast.error('El código expiró. Solicita uno nuevo.');
        await deleteDoc(codeDoc.ref);
        setLoading(false);
        return;
      }

      await deleteDoc(codeDoc.ref);

      // Código correcto → crear cuenta
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name, email: form.email, role: form.role, createdAt: serverTimestamp(),
      });
      if (form.role === 'vendor') {
        await setDoc(doc(db, 'vendors', user.uid), {
          userId: user.uid, name: form.name, description: '', phone: '',
          location: null, isOnline: false, products: [],
          rating: 0, ratingsCount: 0, createdAt: serverTimestamp(),
        });
      }

      navigate(form.role === 'vendor' ? '/dashboard' : '/');
    } catch (err) {
      toast.error(err.message?.includes('email-already-in-use') ? 'Ese correo ya está registrado' : 'Error al crear la cuenta');
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result  = await signInWithPopup(auth, googleProvider);
      const user    = result.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) { navigate('/'); return; }

      const name = user.displayName || user.email;
      await setDoc(doc(db, 'users', user.uid), {
        name, email: user.email, role: form.role, createdAt: serverTimestamp(),
      });
      if (form.role === 'vendor') {
        await setDoc(doc(db, 'vendors', user.uid), {
          userId: user.uid, name, description: '', phone: '',
          location: null, isOnline: false, products: [],
          rating: 0, ratingsCount: 0, createdAt: serverTimestamp(),
        });
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch {
      toast.error('No se pudo registrar con Google');
    }
    setLoading(false);
  }

  // ── Pantalla verificación ──
  if (step === 'verify') {
    return (
      <div style={s.page}>
        <div style={s.card} className="anim-scale-in">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📧</div>
            <h2 style={s.title}>Verifica tu correo</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
              Enviamos un código de 6 dígitos a<br />
              <strong style={{ color: 'var(--text)' }}>{form.email}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Código de verificación</label>
              <input
                className="app-input"
                style={{ ...s.input, textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.4rem' }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
            </div>
            <button style={{ ...s.btn, opacity: loading || code.length < 6 ? 0.6 : 1 }} type="submit" disabled={loading || code.length < 6}>
              {loading ? '⏳ Verificando...' : 'Verificar y crear cuenta →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.85rem', color: 'var(--text-2)' }}>
            ¿No llegó?{' '}
            <button style={s.linkBtn} onClick={sendCode} disabled={loading}>
              Reenviar código
            </button>
          </p>
          <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-3)' }}>
            Revisa tu carpeta de spam si no aparece en la bandeja principal.
          </p>
          <button style={s.backBtn} onClick={() => setStep('form')}>← Cambiar correo</button>
        </div>
      </div>
    );
  }

  // ── Pantalla formulario ──
  return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={s.logoArea}>
          <div style={s.logoIcon}>📍</div>
          <h1 style={s.brand}>VendeCerca</h1>
        </div>
        <h2 style={s.title}>Crear cuenta</h2>
        <p style={s.sub}>Únete gratis, sin tarjeta de crédito</p>

        <div style={s.roleWrap}>
          <p style={s.roleLabel}>¿Cómo vas a usar VendeCerca?</p>
          <div style={s.roleOptions}>
            {[
              { value: 'buyer',  icon: '🛒', title: 'Comprador',  desc: 'Busco vendedores cerca' },
              { value: 'vendor', icon: '🏪', title: 'Vendedor',   desc: 'Quiero vender mis productos' },
            ].map(r => (
              <label key={r.value} style={{ ...s.roleCard, ...(form.role === r.value ? s.roleCardActive : {}) }}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handleChange} style={{ display: 'none' }} />
                <span style={s.roleIcon}>{r.icon}</span>
                <span style={s.roleTitle}>{r.title}</span>
                <span style={s.roleDesc}>{r.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading} type="button">
          <GoogleIcon />
          Continuar con Google
        </button>

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>o con correo</span>
          <div style={s.dividerLine} />
        </div>

        <div style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Nombre completo</label>
            <input className="app-input" style={s.input} name="name" placeholder="Tu nombre" value={form.name} onChange={handleChange} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Correo electrónico</label>
            <input className="app-input" style={s.input} name="email" type="email" placeholder="tu@correo.com" value={form.email} onChange={handleChange} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input className="app-input" style={s.input} name="password" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <button
            style={{ ...s.btn, opacity: loading || !form.name || !form.email || form.password.length < 6 ? 0.6 : 1 }}
            type="button"
            disabled={loading || !form.name || !form.email || form.password.length < 6}
            onClick={sendCode}
          >
            {loading ? '⏳ Enviando código...' : 'Continuar →'}
          </button>
        </div>

        <p style={s.footer}>
          ¿Ya tienes cuenta? <Link to="/login" style={s.link}>Inicia sesión</Link>
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
  card:    { background: 'var(--card)', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' },
  logoArea:{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', justifyContent: 'center' },
  logoIcon:{ fontSize: '1.8rem' },
  brand:   { fontSize: '1.5rem', fontWeight: 800, color: '#1a5c1a', letterSpacing: '-0.5px' },
  title:   { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.3rem', textAlign: 'center' },
  sub:     { color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '1.2rem', textAlign: 'center' },
  googleBtn:{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0.75rem', border: '1.5px solid var(--border)', borderRadius: '10px', background: 'var(--card)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit', transition: 'background 0.15s', marginBottom: '1.2rem' },
  divider: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' },
  dividerLine: { flex: 1, height: '1px', background: 'var(--border)' },
  dividerText: { color: 'var(--text-3)', fontSize: '0.82rem', whiteSpace: 'nowrap' },
  form:    { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field:   { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label:   { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' },
  input:   { background: 'var(--bg)' },
  roleWrap:{ border: '1.5px solid var(--border)', borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' },
  roleLabel:{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.7rem' },
  roleOptions:{ display: 'flex', gap: '0.6rem' },
  roleCard:{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.8rem 0.5rem', border: '2px solid var(--border)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' },
  roleCardActive:{ border: '2px solid #2d7a2d', background: 'var(--green-light)' },
  roleIcon:{ fontSize: '1.6rem' },
  roleTitle:{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' },
  roleDesc:{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.3 },
  btn:     { marginTop: '0.4rem', padding: '0.9rem', background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', transition: 'opacity 0.2s' },
  linkBtn: { background: 'none', border: 'none', color: '#2d7a2d', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0 },
  backBtn: { display: 'block', width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' },
  footer:  { textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-2)', fontSize: '0.88rem' },
  link:    { color: '#2d7a2d', fontWeight: 700, textDecoration: 'none' },
};
