import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  orderBy, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

const ACTIVE = new Set(['pendiente', 'en_camino', 'listo']);

function formatTime(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export default function ActiveOrderChat() {
  const { currentUser, userName } = useAuth();
  const [orders, setOrders]     = useState([]);
  const [idx, setIdx]           = useState(0);
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [unread, setUnread]     = useState(0);
  const openRef    = useRef(false);
  const prevCount  = useRef(0);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Keep openRef in sync so Firestore callbacks don't have stale closure
  useEffect(() => { openRef.current = open; }, [open]);

  // Subscribe to active orders (as buyer AND as vendor)
  useEffect(() => {
    if (!currentUser) { setOrders([]); return; }

    const cache = { buyer: [], vendor: [] };

    function merge() {
      const all    = [...cache.buyer, ...cache.vendor];
      const unique = all.filter((o, i, a) => a.findIndex(x => x.id === o.id) === i);
      setOrders(unique.filter(o => ACTIVE.has(o.status)));
    }

    const unsubBuyer = onSnapshot(
      query(collection(db, 'orders'), where('buyerId', '==', currentUser.uid)),
      snap => { cache.buyer = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }
    );
    const unsubVendor = onSnapshot(
      query(collection(db, 'orders'), where('vendorId', '==', currentUser.uid)),
      snap => { cache.vendor = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }
    );

    return () => { unsubBuyer(); unsubVendor(); };
  }, [currentUser?.uid]);

  // Reset idx if the selected order disappears
  useEffect(() => {
    setIdx(i => (orders[i] ? i : 0));
  }, [orders.length]);

  const order = orders[idx] ?? orders[0];

  // Subscribe to messages of the selected order
  useEffect(() => {
    if (!order) { setMessages([]); prevCount.current = 0; return; }
    prevCount.current = 0;

    const q = query(
      collection(db, 'orders', order.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!openRef.current) {
        const newCount = msgs.length - prevCount.current;
        if (newCount > 0) setUnread(u => u + newCount);
      }
      prevCount.current = msgs.length;
      setMessages(msgs);
    });
  }, [order?.id]);

  // Scroll to bottom and focus input when opening
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 80);
    }
  }, [open, messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || !order) return;
    setSending(true);
    setText('');
    await addDoc(collection(db, 'orders', order.id, 'messages'), {
      text: trimmed,
      senderId: currentUser.uid,
      senderName: userName || 'Usuario',
      createdAt: serverTimestamp(),
    });
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!currentUser || orders.length === 0) return null;

  const isVendor = currentUser.uid === order?.vendorId;
  const otherName = order
    ? (isVendor ? (order.buyerName || 'Comprador') : (order.vendorName || 'Vendedor'))
    : '—';

  return (
    <>
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
        }
      `}</style>

      <div style={{ ...s.wrap, height: open ? 400 : 54 }}>

        {/* Tab bar — always visible */}
        <div style={s.tab} onClick={() => setOpen(o => !o)}>
          <div style={s.tabLeft}>
            <span style={s.dot} />
            <span style={s.tabIcon}>💬</span>
            <div>
              <div style={s.tabTitle}>Pedido activo</div>
              <div style={s.tabSub}>{otherName}</div>
            </div>
          </div>
          <div style={s.tabRight}>
            {!open && unread > 0 && <span style={s.badge}>{unread > 9 ? '9+' : unread}</span>}
            {orders.length > 1 && (
              <span style={s.multiPill}>{orders.length} pedidos</span>
            )}
            <span style={s.chevron}>{open ? '▼' : '▲'}</span>
          </div>
        </div>

        {/* Expanded panel */}
        {open && (
          <>
            {/* Order selector when multiple */}
            {orders.length > 1 && (
              <div style={s.selector}>
                {orders.map((o, i) => {
                  const label = currentUser.uid === o.vendorId
                    ? (o.buyerName || 'Comprador')
                    : (o.vendorName || 'Vendedor');
                  return (
                    <button
                      key={o.id}
                      onClick={e => { e.stopPropagation(); setIdx(i); }}
                      style={{ ...s.selBtn, ...(i === idx ? s.selActive : {}) }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Messages */}
            <div style={s.msgs}>
              {messages.length === 0 && (
                <div style={s.empty}>💬 Sin mensajes aún. ¡Escribe primero!</div>
              )}
              {messages.map(msg => {
                const isOwn = msg.senderId === currentUser.uid;
                return (
                  <div key={msg.id} style={{ ...s.row, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...s.bubble, ...(isOwn ? s.own : s.other) }}>
                      {!isOwn && <div style={s.name}>{msg.senderName}</div>}
                      <div style={s.msgText}>{msg.text}</div>
                      <div style={{ ...s.time, textAlign: isOwn ? 'right' : 'left' }}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={s.inputRow}>
              <input
                ref={inputRef}
                style={s.input}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Escribe un mensaje..."
                maxLength={300}
              />
              <button
                style={{ ...s.sendBtn, opacity: !text.trim() || sending ? 0.5 : 1 }}
                onClick={send}
                disabled={!text.trim() || sending}
              >
                {sending ? '…' : '➤'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const s = {
  wrap: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '520px',
    zIndex: 1500,
    background: '#fff',
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 28px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
  },

  tab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1rem',
    height: 54,
    flexShrink: 0,
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff',
    userSelect: 'none',
  },
  tabLeft:  { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  tabRight: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dot: {
    width: 9, height: 9, borderRadius: '50%',
    background: '#4ade80', flexShrink: 0,
    animation: 'chatPulse 2s ease-in-out infinite',
  },
  tabIcon:  { fontSize: '1.1rem' },
  tabTitle: { fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2 },
  tabSub:   { fontSize: '0.73rem', opacity: 0.85, lineHeight: 1.2 },
  badge: {
    background: '#ef4444', color: '#fff',
    borderRadius: '50%', minWidth: 20, height: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700, padding: '0 3px',
  },
  multiPill: {
    fontSize: '0.7rem',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 8, padding: '2px 7px',
  },
  chevron: { fontSize: '0.72rem', opacity: 0.8 },

  selector: {
    display: 'flex', gap: '0.4rem', padding: '0.45rem 0.8rem',
    overflowX: 'auto', flexShrink: 0,
    borderBottom: '1px solid #f3f4f6',
    background: '#fafafa',
  },
  selBtn: {
    border: 'none', borderRadius: 20, padding: '4px 12px',
    fontSize: '0.77rem', cursor: 'pointer', fontFamily: 'inherit',
    background: '#f3f4f6', color: '#374151', whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  selActive: { background: '#1a5c1a', color: '#fff' },

  msgs: {
    flex: 1, overflowY: 'auto',
    padding: '0.55rem 0.8rem',
    display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  empty: {
    textAlign: 'center', color: '#9ca3af',
    fontSize: '0.83rem', padding: '1.2rem 0',
  },
  row:    { display: 'flex' },
  bubble: {
    maxWidth: '78%', padding: '0.45rem 0.7rem',
    borderRadius: '12px', display: 'flex',
    flexDirection: 'column', gap: '0.08rem',
  },
  own:   { background: '#1a5c1a', color: '#fff', borderBottomRightRadius: 3 },
  other: { background: '#f3f4f6', color: '#111827', borderBottomLeftRadius: 3 },
  name:    { fontSize: '0.67rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.05rem' },
  msgText: { fontSize: '0.87rem', lineHeight: 1.4, wordBreak: 'break-word' },
  time:    { fontSize: '0.63rem', opacity: 0.6, marginTop: '0.08rem' },

  inputRow: {
    display: 'flex', gap: '0.4rem',
    padding: '0.55rem 0.8rem',
    borderTop: '1px solid #f3f4f6',
    background: '#fff', flexShrink: 0,
  },
  input: {
    flex: 1, border: '1.5px solid #e5e7eb',
    borderRadius: '18px', padding: '0.5rem 0.9rem',
    fontSize: '0.87rem', outline: 'none',
    fontFamily: 'inherit', background: '#f9fafb',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', border: 'none', borderRadius: '50%',
    width: 38, height: 38, flexShrink: 0,
    cursor: 'pointer', fontSize: '0.95rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', transition: 'opacity 0.15s',
  },
};
