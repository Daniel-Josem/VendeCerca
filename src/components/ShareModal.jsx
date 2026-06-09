import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function ShareModal({ vendorId, vendorName, onClose }) {
  const url = `${window.location.origin}/vendor/${vendorId}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function copyLink() {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: `${vendorName} en VendeCerca`, url }); } catch {}
      return;
    }
    copyLink();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <button style={s.close} onClick={onClose}>✕</button>
        <h3 style={s.title}>Compartir perfil</h3>
        <p style={s.sub}>{vendorName}</p>

        <div style={s.qrWrap}>
          <QRCodeSVG value={url} size={180} fgColor="#1a5c1a" bgColor="#fff" />
        </div>

        <div style={s.urlBox}>
          <span style={s.urlText}>{url.replace('https://', '')}</span>
        </div>

        <div style={s.btns}>
          <button style={s.copyBtn} onClick={copyLink}>
            {copied ? '✅ Copiado' : '📋 Copiar enlace'}
          </button>
          <button style={s.shareBtn} onClick={handleShare}>
            📤 Compartir
          </button>
        </div>

        <p style={s.hint}>
          Muestra este QR a tus clientes para que vean tu perfil y te hagan pedidos.
        </p>
      </div>
    </div>
  );
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  modal:   { background:'var(--card)', borderRadius:'20px', padding:'2rem 1.5rem', width:'100%', maxWidth:'340px', textAlign:'center', position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  close:   { position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-3)' },
  title:   { margin:'0 0 0.2rem', fontSize:'1.15rem', fontWeight:700, color:'var(--text)' },
  sub:     { margin:'0 0 1.2rem', color:'var(--text-2)', fontSize:'0.88rem' },
  qrWrap:  { display:'inline-block', padding:'0.9rem', background:'#f8faf8', borderRadius:'16px', border:'1px solid #e5e7eb', marginBottom:'1rem' },
  urlBox:  { background:'var(--bg)', borderRadius:'8px', padding:'0.5rem 0.8rem', marginBottom:'1rem', overflow:'hidden' },
  urlText: { fontSize:'0.73rem', color:'var(--text-3)', wordBreak:'break-all', fontFamily:'monospace' },
  btns:    { display:'flex', gap:'0.5rem', justifyContent:'center', marginBottom:'1rem' },
  copyBtn: { flex:1, padding:'0.65rem', background:'var(--green-light)', color:'var(--green)', border:'1.5px solid var(--green-border)', borderRadius:'10px', cursor:'pointer', fontWeight:600, fontSize:'0.88rem', fontFamily:'inherit' },
  shareBtn:{ flex:1, padding:'0.65rem', background:'var(--green)', color:'#fff', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:600, fontSize:'0.88rem', fontFamily:'inherit' },
  hint:    { fontSize:'0.77rem', color:'var(--text-3)', lineHeight:1.5, margin:0 },
};
