import { useState } from 'react';
import { collection, addDoc, serverTimestamp, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useToast } from '../context/ToastContext';

export default function RatingModal({ order, vendor, onClose, onDone }) {
  const [stars,   setStars]   = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stars) { toast.warning('Selecciona una calificación'); return; }
    setLoading(true);
    try {
      // Guardar reseña individual
      await addDoc(collection(db, 'reviews'), {
        vendorId:   order.vendorId,
        buyerId:    order.buyerId,
        buyerName:  order.buyerName,
        orderId:    order.id,
        rating:     stars,
        comment:    comment.trim(),
        createdAt:  serverTimestamp(),
      });

      // Recalcular promedio del vendedor
      const snap = await getDocs(query(collection(db, 'reviews'), where('vendorId', '==', order.vendorId)));
      const ratings = snap.docs.map(d => d.data().rating);
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      await updateDoc(doc(db, 'vendors', order.vendorId), {
        rating:       Math.round(avg * 10) / 10,
        ratingsCount: ratings.length,
      });

      toast.success('¡Gracias por tu reseña!');
      onDone();
    } catch {
      toast.error('Error al enviar la reseña. Intenta de nuevo.');
    }
    setLoading(false);
  }

  const display = hover || stars;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        <div style={s.vendorInfo}>
          {vendor?.photoURL
            ? <img src={vendor.photoURL} alt={vendor.name} style={s.avatar} />
            : <div style={s.avatarPlaceholder}>{order.vendorName?.[0]?.toUpperCase()}</div>
          }
          <div>
            <h3 style={s.title}>Califica tu pedido</h3>
            <p style={s.sub}>{order.vendorName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Estrellas */}
          <div style={s.starsRow}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n} type="button"
                style={{ ...s.star, color: n <= display ? '#f59e0b' : '#d1d5db' }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setStars(n)}
              >★</button>
            ))}
          </div>
          <p style={s.starLabel}>
            {display === 0 && 'Toca una estrella'}
            {display === 1 && 'Muy malo 😞'}
            {display === 2 && 'Malo 😕'}
            {display === 3 && 'Regular 😐'}
            {display === 4 && 'Bueno 😊'}
            {display === 5 && 'Excelente 🤩'}
          </p>

          {/* Comentario */}
          <div style={s.field}>
            <label style={s.label}>Comentario (opcional)</label>
            <textarea
              style={s.textarea}
              placeholder="¿Cómo fue tu experiencia?"
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={300}
            />
            <span style={s.charCount}>{comment.length}/300</span>
          </div>

          <button style={{ ...s.btn, opacity: loading || !stars ? 0.6 : 1 }} type="submit" disabled={loading || !stars}>
            {loading ? 'Enviando...' : 'Enviar reseña ⭐'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  modal:   { background:'#fff', borderRadius:'20px', padding:'1.8rem', width:'100%', maxWidth:'380px', position:'relative' },
  closeBtn:{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', fontSize:'1.1rem', cursor:'pointer', color:'#9ca3af', fontFamily:'inherit' },

  vendorInfo: { display:'flex', alignItems:'center', gap:'0.8rem', marginBottom:'1.5rem' },
  avatar:     { width:'48px', height:'48px', borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)' },
  avatarPlaceholder: { width:'48px', height:'48px', borderRadius:'50%', background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.2rem', flexShrink:0 },
  title:   { fontSize:'1.05rem', fontWeight:700, color:'var(--text)', margin:0 },
  sub:     { fontSize:'0.85rem', color:'var(--text-2)', margin:'0.1rem 0 0' },

  starsRow: { display:'flex', justifyContent:'center', gap:'0.3rem', marginBottom:'0.4rem' },
  star:     { background:'none', border:'none', fontSize:'2.5rem', cursor:'pointer', padding:'0 0.1rem', transition:'transform 0.1s, color 0.1s', lineHeight:1 },
  starLabel:{ textAlign:'center', fontSize:'0.88rem', color:'var(--text-2)', marginBottom:'1.2rem', minHeight:'1.2em' },

  field:    { display:'flex', flexDirection:'column', gap:'0.3rem', marginBottom:'1rem' },
  label:    { fontSize:'0.82rem', fontWeight:600, color:'var(--text-2)' },
  textarea: { padding:'0.65rem 0.8rem', borderRadius:'10px', border:'1.5px solid var(--border)', fontSize:'0.9rem', fontFamily:'inherit', minHeight:'80px', resize:'vertical', outline:'none' },
  charCount:{ fontSize:'0.72rem', color:'var(--text-3)', textAlign:'right' },

  btn: { width:'100%', padding:'0.85rem', background:'linear-gradient(135deg,#1a5c1a,#2d7a2d)', color:'#fff', border:'none', borderRadius:'10px', fontWeight:700, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' },
};
