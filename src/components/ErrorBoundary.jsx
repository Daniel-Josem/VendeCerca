import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.icon}>⚠️</div>
          <h2 style={s.title}>Algo salió mal</h2>
          <p style={s.sub}>
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          {this.state.error?.message && (
            <pre style={s.code}>{this.state.error.message}</pre>
          )}
          <div style={s.actions}>
            <button style={s.btnPrimary} onClick={() => window.location.reload()}>
              🔄 Recargar página
            </button>
            <button style={s.btnSecondary} onClick={() => {
              this.setState({ hasError: false, error: null });
              window.history.pushState({}, '', '/');
              window.location.reload();
            }}>
              🏠 Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '2rem', background: '#f9fafb',
  },
  card: {
    background: '#fff', borderRadius: '18px',
    padding: '2.5rem 2rem', maxWidth: '420px', width: '100%',
    textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.09)',
    border: '1px solid #e5e7eb',
  },
  icon:  { fontSize: '3rem', marginBottom: '1rem' },
  title: { fontSize: '1.4rem', fontWeight: 800, color: '#111827', marginBottom: '0.6rem' },
  sub:   { fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, marginBottom: '1.2rem' },
  code:  {
    background: '#f3f4f6', borderRadius: '8px', padding: '0.6rem 0.8rem',
    fontSize: '0.75rem', color: '#dc2626', textAlign: 'left',
    overflowX: 'auto', marginBottom: '1.5rem', fontFamily: 'monospace',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  actions:     { display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' },
  btnPrimary:  {
    background: '#1a5c1a', color: '#fff', border: 'none',
    padding: '0.7rem 1.3rem', borderRadius: '10px',
    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSecondary: {
    background: '#f3f4f6', color: '#374151', border: '1.5px solid #e5e7eb',
    padding: '0.7rem 1.2rem', borderRadius: '10px',
    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit',
  },
};
