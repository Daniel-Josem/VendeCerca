import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function BackButton({ to = '/', label = 'Volver al mapa' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      style={{ ...s.btn, ...(hovered ? s.btnHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...s.arrow, transform: hovered ? 'translateX(-4px)' : 'translateX(0)' }}>
        ←
      </span>
      {label}
    </Link>
  );
}

const s = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', textDecoration: 'none',
    padding: '0.55rem 1.2rem 0.55rem 1rem',
    borderRadius: '25px', fontWeight: 600, fontSize: '0.88rem',
    boxShadow: '0 2px 10px rgba(45,122,45,0.3)',
    transition: 'all 0.2s ease',
    userSelect: 'none',
  },
  btnHover: {
    boxShadow: '0 6px 20px rgba(45,122,45,0.45)',
    transform: 'translateY(-2px)',
    background: 'linear-gradient(135deg, #1e6b1e, #359435)',
  },
  arrow: {
    fontSize: '1rem', lineHeight: 1,
    transition: 'transform 0.2s ease',
    display: 'inline-block',
  },
};
