import { useState } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { db } from '../firebase/config';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const EJS_SERVICE  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EJS_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EJS_KEY      = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function generateToken() { return crypto.randomUUID(); }

export default function ForgotPassword() {
  const [step,        setStep]        = useState('email');
  const [email,       setEmail]       = useState('');
  const [code,        setCode]        = useState('');
  const [resetToken,  setResetToken]  = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading,     setLoading]     = useState(false);
  const toast = useToast();

  // Paso 1: enviar código
  async function handleSendCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const q    = query(collection(db, 'verificationCodes'), where('email', '==', email));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

      const newCode   = generateCode();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
      await addDoc(collection(db, 'verificationCodes'), { email, code: newCode, expiresAt });

      await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
        to_email: email,
        name:     email.split('@')[0],
        code:     newCode,
        purpose:  'restablecer tu contraseña en VendeCerca',
      }, { publicKey: EJS_KEY });

      setStep('code');
      toast.success('Código enviado, revisa tu correo');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo enviar el código. Verifica el correo e intenta de nuevo.');
    }
    setLoading(false);
  }

  // Paso 2: verificar código
  async function handleVerifyCode(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Buscar solo por email, verificar el código en JS para evitar índice compuesto
      const q    = query(collection(db, 'verificationCodes'), where('email', '==', email));
      const snap = await getDocs(q);

      if (snap.empty) { toast.error('Código incorrecto'); setLoading(false); return; }

      const doc  = snap.docs.find(d => d.data().code === code);
      if (!doc)  { toast.error('Código incorrecto'); setLoading(false); return; }

      const data = doc.data();
      if (data.expiresAt.toDate() < new Date()) {
        toast.error('El código expiró. Solicita uno nuevo.');
        await deleteDoc(doc.ref);
        setStep('email');
        setLoading(false);
        return;
      }

      await deleteDoc(doc.ref);

      // Generar token seguro para autorizar el cambio de contraseña
      const token     = generateToken();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));
      await addDoc(collection(db, 'resetTokens'), { email, token, expiresAt });

      setResetToken(token);
      setStep('newpass');
    } catch (err) {
      console.error('Error verificando código:', err?.code, err?.message, err);
      toast.error('Error: ' + (err?.code || err?.message || JSON.stringify(err)));
    }
    setLoading(false);
  }

  // Paso 3: nueva contraseña
  async function handleNewPassword(e) {
    e.preventDefault();
    if (newPass !== confirmPass) { toast.error('Las contraseñas no coinciden'); return; }
    if (newPass.length < 6)     { toast.error('Mínimo 6 caracteres');           return; }
    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, newPassword: newPass, token: resetToken }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error al actualizar'); setLoading(false); return; }
      setStep('done');
    } catch (err) {
      console.error(err);
      toast.error('Error de conexión. Intenta de nuevo.');
    }
    setLoading(false);
  }

  // ── Pantalla: nueva contraseña ──
  if (step === 'newpass') return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={s.logoArea}><div style={s.logoIcon}>🔑</div><h1 style={s.brand}>VendeCerca</h1></div>
        <h2 style={s.title}>Crear nueva contraseña</h2>
        <p style={s.sub}>Elige una contraseña segura para tu cuenta.</p>
        <form onSubmit={handleNewPassword} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Nueva contraseña</label>
            <input className="app-input" style={s.input} type="password" placeholder="Mínimo 6 caracteres"
              value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={6} autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirmar contraseña</label>
            <input className="app-input" style={s.input} type="password" placeholder="Repite tu contraseña"
              value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required minLength={6} />
          </div>
          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Guardando...' : 'Guardar contraseña →'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Pantalla: éxito ──
  if (step === 'done') return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={{ textAlign:'center', padding:'1rem 0' }}>
          <div style={{ fontSize:'3.5rem', marginBottom:'1rem' }}>✅</div>
          <h2 style={{ ...s.title, color:'#16a34a' }}>¡Contraseña actualizada!</h2>
          <p style={{ color:'var(--text-2)', margin:'0.75rem 0 1.5rem', lineHeight:1.5 }}>
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Link to="/login" style={s.btn}>Ir a iniciar sesión →</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.card} className="anim-scale-in">
        <div style={s.logoArea}><div style={s.logoIcon}>🔑</div><h1 style={s.brand}>VendeCerca</h1></div>

        {/* Paso 1: email */}
        {step === 'email' && <>
          <h2 style={s.title}>¿Olvidaste tu contraseña?</h2>
          <p style={s.sub}>Escribe tu correo y te enviamos un código de verificación.</p>
          <form onSubmit={handleSendCode} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Correo electrónico</label>
              <input className="app-input" style={s.input} type="email" placeholder="tu@correo.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? '⏳ Enviando...' : 'Enviar código →'}
            </button>
          </form>
          <p style={s.footer}><Link to="/login" style={s.link}>← Volver al inicio de sesión</Link></p>
        </>}

        {/* Paso 2: código */}
        {step === 'code' && <>
          <h2 style={s.title}>Ingresa el código</h2>
          <p style={s.sub}>
            Enviamos un código de 6 dígitos a<br />
            <strong style={{ color:'var(--text)' }}>{email}</strong>
          </p>
          <form onSubmit={handleVerifyCode} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Código de verificación</label>
              <input
                className="app-input"
                style={{ ...s.input, textAlign:'center', fontSize:'1.8rem', fontWeight:800, letterSpacing:'0.4rem' }}
                type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required autoFocus
              />
            </div>
            <button style={{ ...s.btn, opacity: loading || code.length < 6 ? 0.6 : 1 }} type="submit" disabled={loading || code.length < 6}>
              {loading ? '⏳ Verificando...' : 'Verificar código →'}
            </button>
          </form>
          <p style={{ textAlign:'center', marginTop:'1rem', fontSize:'0.85rem', color:'var(--text-2)' }}>
            ¿No llegó?{' '}
            <button style={s.linkBtn} onClick={() => { setStep('email'); setCode(''); }}>Reenviar código</button>
          </p>
        </>}
      </div>
    </div>
  );
}

const s = {
  page:    { minHeight:'calc(100vh - 60px)', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #0d3b0d, #2d7a2d)', padding:'1.5rem' },
  card:    { background:'var(--card)', padding:'2.5rem', borderRadius:'20px', width:'100%', maxWidth:'400px', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' },
  logoArea:{ display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'1.8rem', justifyContent:'center' },
  logoIcon:{ fontSize:'1.8rem' },
  brand:   { fontSize:'1.5rem', fontWeight:800, color:'#1a5c1a', letterSpacing:'-0.5px' },
  title:   { fontSize:'1.3rem', fontWeight:700, color:'var(--text)', marginBottom:'0.4rem', textAlign:'center' },
  sub:     { color:'var(--text-2)', fontSize:'0.9rem', marginBottom:'1.5rem', textAlign:'center', lineHeight:1.5 },
  form:    { display:'flex', flexDirection:'column', gap:'1rem' },
  field:   { display:'flex', flexDirection:'column', gap:'0.35rem' },
  label:   { fontSize:'0.82rem', fontWeight:600, color:'var(--text)' },
  input:   { background:'var(--bg)' },
  btn:     { display:'block', textAlign:'center', padding:'0.9rem', background:'linear-gradient(135deg, #1a5c1a, #2d7a2d)', color:'#fff', border:'none', borderRadius:'10px', fontSize:'1rem', cursor:'pointer', fontWeight:700, fontFamily:'inherit', textDecoration:'none', transition:'opacity 0.2s' },
  linkBtn: { background:'none', border:'none', color:'#2d7a2d', fontWeight:700, cursor:'pointer', fontSize:'0.85rem', fontFamily:'inherit', padding:0 },
  footer:  { textAlign:'center', marginTop:'1.5rem' },
  link:    { color:'#2d7a2d', fontWeight:600, fontSize:'0.9rem', textDecoration:'none' },
};
