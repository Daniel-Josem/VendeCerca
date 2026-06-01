import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur ?? 5000),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info',    dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TYPES = {
  success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', icon: '✅' },
  error:   { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', icon: '❌' },
  warning: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', icon: '⚠️' },
  info:    { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', icon: 'ℹ️' },
};

function ToastContainer({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={s.container}>
      {toasts.map(t => {
        const style = TYPES[t.type] || TYPES.info;
        return (
          <div key={t.id} className="anim-slide-in" style={{ ...s.toast, background: style.bg, border: `1.5px solid ${style.border}`, color: style.color }}>
            <span style={s.icon}>{style.icon}</span>
            <span style={s.msg}>{t.message}</span>
            <button style={{ ...s.close, color: style.color }} onClick={() => dismiss(t.id)}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  container: {
    position: 'fixed', top: '70px', right: '1rem', zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    maxWidth: '360px', width: 'calc(100vw - 2rem)',
  },
  toast: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.75rem 1rem', borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.4,
  },
  icon: { fontSize: '1rem', flexShrink: 0 },
  msg:  { flex: 1 },
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '0.8rem', opacity: 0.6, padding: '0.1rem',
    flexShrink: 0, fontFamily: 'inherit',
  },
};
