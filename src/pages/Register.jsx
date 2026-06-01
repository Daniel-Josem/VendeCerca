import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast    = useToast();

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'users', user.uid), { name: form.name, email: form.email, role: form.role, createdAt: serverTimestamp() });
      if (form.role === 'vendor') {
        await setDoc(doc(db, 'vendors', user.uid), { userId: user.uid, name: form.name, description: '', phone: '', location: null, isOnline: false, products: [], rating: 0, ratingsCount: 0, createdAt: serverTimestamp() });
        navigate('/dashboard');
      } else { navigate('/'); }
    } catch (err) {
      toast.error(err.message.includes('email-already-in-use') ? 'Ese correo ya está registrado' : 'Error al registrarse');
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
        <h2 style={s.title}>Crear cuenta</h2>
        <p style={s.sub}>Únete gratis, sin tarjeta de crédito</p>

        <form onSubmit={handleSubmit} style={s.form}>
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

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Registrando...' : 'Crear cuenta →'}
          </button>
        </form>

        <p style={s.footer}>
          ¿Ya tienes cuenta? <Link to="/login" style={s.link}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0d3b0d, #2d7a2d)', padding: '1.5rem' },
  card: { background: '#fff', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', justifyContent: 'center' },
  logoIcon: { fontSize: '1.8rem' },
  brand: { fontSize: '1.5rem', fontWeight: 800, color: '#1a5c1a', letterSpacing: '-0.5px' },
  title: { fontSize: '1.3rem', fontWeight: 700, color: '#111827', marginBottom: '0.3rem', textAlign: 'center' },
  sub: { color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' },
  errorBox: { background: '#fee2e2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', border: '1px solid #fecaca' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input: { background: '#f9fafb' },
  roleWrap: { border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '1rem' },
  roleLabel: { fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.7rem' },
  roleOptions: { display: 'flex', gap: '0.6rem' },
  roleCard: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.8rem 0.5rem', border: '2px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' },
  roleCardActive: { border: '2px solid #2d7a2d', background: '#f0f7f0' },
  roleIcon: { fontSize: '1.6rem' },
  roleTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#111827' },
  roleDesc: { fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.3 },
  btn: { marginTop: '0.4rem', padding: '0.9rem', background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
  footer: { textAlign: 'center', marginTop: '1.5rem', color: '#6b7280', fontSize: '0.88rem' },
  link: { color: '#2d7a2d', fontWeight: 700, textDecoration: 'none' },
};
