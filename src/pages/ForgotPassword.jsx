import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
  const [email,  setEmail]  = useState('');
  const [status, setStatus] = useState('idle');
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus('sent');
    } catch (err) {
      toast.error(
        err.code === 'auth/user-not-found'
          ? 'No encontramos una cuenta con ese correo.'
          : 'Error al enviar. Verifica el correo e intenta de nuevo.'
      );
      setStatus('idle');
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={s.logoArea}>
          <div style={s.logoIcon}>🔑</div>
          <h1 style={s.brand}>VendeCerca</h1>
        </div>

        {status === 'sent' ? (
          <div style={s.successBox}>
            <div style={s.successIcon}>📬</div>
            <h2 style={s.successTitle}>¡Correo enviado!</h2>
            <p style={s.successText}>
              Revisa tu bandeja de entrada en <strong>{email}</strong>.
              Haz clic en el enlace del correo para crear una nueva contraseña.
            </p>
            <p style={s.successNote}>
              Si no lo ves, revisa la carpeta de spam.
            </p>
            <Link to="/login" style={s.btn}>Volver al inicio de sesión</Link>
          </div>
        ) : (
          <>
            <h2 style={s.title}>¿Olvidaste tu contraseña?</h2>
            <p style={s.sub}>
              Escribe tu correo y te enviamos un enlace para crear una nueva.
            </p>

            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Correo electrónico</label>
                <input
                  className="app-input"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ background:'#f9fafb' }}
                />
              </div>
              <button
                style={{ ...s.btn, opacity: status === 'loading' ? 0.7 : 1 }}
                type="submit"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? '⏳ Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <p style={s.footer}>
              <Link to="/login" style={s.link}>← Volver al inicio de sesión</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page:         { minHeight:'calc(100vh - 60px)', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #0d3b0d, #2d7a2d)', padding:'1.5rem' },
  card:         { background:'#fff', padding:'2.5rem', borderRadius:'20px', width:'100%', maxWidth:'400px', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' },
  logoArea:     { display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'1.8rem', justifyContent:'center' },
  logoIcon:     { fontSize:'1.8rem' },
  brand:        { fontSize:'1.5rem', fontWeight:800, color:'#1a5c1a', letterSpacing:'-0.5px' },
  title:        { fontSize:'1.3rem', fontWeight:700, color:'#111827', marginBottom:'0.4rem', textAlign:'center' },
  sub:          { color:'#6b7280', fontSize:'0.9rem', marginBottom:'1.8rem', textAlign:'center', lineHeight:1.5 },
  errorBox:     { background:'#fee2e2', color:'#dc2626', padding:'0.75rem 1rem', borderRadius:'10px', marginBottom:'1rem', fontSize:'0.88rem', border:'1px solid #fecaca' },
  form:         { display:'flex', flexDirection:'column', gap:'1rem' },
  field:        { display:'flex', flexDirection:'column', gap:'0.35rem' },
  label:        { fontSize:'0.82rem', fontWeight:600, color:'#374151' },
  btn:          { display:'block', textAlign:'center', padding:'0.9rem', background:'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color:'#fff', border:'none', borderRadius:'10px', fontSize:'1rem', cursor:'pointer', fontWeight:700, fontFamily:'inherit', textDecoration:'none', transition:'opacity 0.2s' },
  footer:       { textAlign:'center', marginTop:'1.5rem' },
  link:         { color:'#2d7a2d', fontWeight:600, fontSize:'0.9rem', textDecoration:'none' },
  successBox:   { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.8rem' },
  successIcon:  { fontSize:'3rem' },
  successTitle: { fontSize:'1.3rem', fontWeight:700, color:'#2d7a2d', margin:0 },
  successText:  { color:'#555', fontSize:'0.9rem', lineHeight:1.6, margin:0 },
  successNote:  { color:'#9ca3af', fontSize:'0.82rem', margin:0 },
};
