import { useState, useEffect } from 'react';

export default function GalleryModal({ images, initialIndex = 0, productName = '', onClose }) {
  const [current, setCurrent] = useState(Math.min(initialIndex, images.length - 1));

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setCurrent(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCurrent(i => (i + 1) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  function prev(e) { e.stopPropagation(); setCurrent(i => (i - 1 + images.length) % images.length); }
  function next(e) { e.stopPropagation(); setCurrent(i => (i + 1) % images.length); }

  return (
    <div style={s.overlay} onClick={onClose}>
      <button style={s.close} onClick={onClose}>✕</button>

      <div style={s.frame} onClick={e => e.stopPropagation()}>
        <img
          src={images[current]}
          alt={productName ? `${productName} — foto ${current + 1}` : `foto ${current + 1}`}
          style={s.img}
        />
      </div>

      {images.length > 1 && (
        <>
          <button style={{ ...s.nav, left:'1rem' }} onClick={prev}>◀</button>
          <button style={{ ...s.nav, right:'1rem' }} onClick={next}>▶</button>

          <div style={s.thumbRow} onClick={e => e.stopPropagation()}>
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                style={{ ...s.thumb, ...(i === current ? s.thumbActive : {}) }}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </>
      )}

      <div style={s.counter}>{current + 1} / {images.length}</div>
    </div>
  );
}

const s = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' },
  close:       { position:'fixed', top:'1rem', right:'1rem', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:'38px', height:'38px', borderRadius:'50%', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)', zIndex:1 },
  frame:       { maxWidth:'min(90vw, 600px)', maxHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center' },
  img:         { maxWidth:'100%', maxHeight:'70vh', borderRadius:'12px', objectFit:'contain', boxShadow:'0 8px 40px rgba(0,0,0,0.5)' },
  nav:         { position:'fixed', top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:'44px', height:'44px', borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' },
  thumbRow:    { display:'flex', gap:'0.4rem', padding:'0.3rem' },
  thumb:       { width:'56px', height:'56px', borderRadius:'8px', objectFit:'cover', cursor:'pointer', opacity:0.55, border:'2px solid transparent', transition:'all 0.15s' },
  thumbActive: { opacity:1, border:'2px solid #fff' },
  counter:     { position:'fixed', bottom:'0.8rem', right:'1rem', color:'rgba(255,255,255,0.5)', fontSize:'0.78rem', fontFamily:'monospace' },
};
