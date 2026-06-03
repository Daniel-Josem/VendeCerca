import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function formatTime(ts) {
  if (!ts?.toDate) return '...';
  return ts.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatDrawer({ order, onClose }) {
  const { currentUser, userName } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'orders', order.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [order.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
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

  const isVendor  = currentUser?.uid === order.vendorId;
  const otherName = isVendor ? order.buyerName : order.vendorName;

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.drawer} className="anim-scale-in">

        <div style={s.header}>
          <div>
            <div style={s.title}>💬 Chat del pedido</div>
            <div style={s.subtitle}>Conversación con <strong>{otherName}</strong></div>
          </div>
          <button style={s.close} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.empty}>
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p>Sin mensajes aún.<br />¡Inicia la conversación!</p>
            </div>
          )}
          {messages.map(msg => {
            const isOwn = msg.senderId === currentUser?.uid;
            return (
              <div key={msg.id} style={{ ...s.msgRow, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...s.bubble, ...(isOwn ? s.bubbleOwn : s.bubbleOther) }}>
                  {!isOwn && <div style={s.msgName}>{msg.senderName}</div>}
                  <div style={s.msgText}>{msg.text}</div>
                  <div style={{ ...s.msgTime, textAlign: isOwn ? 'right' : 'left' }}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

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

      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  drawer: {
    background: '#fff', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: '520px',
    height: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '1rem 1.2rem 0.8rem',
    borderBottom: '1px solid #f3f4f6',
  },
  title:    { fontWeight: 800, fontSize: '1rem', color: '#111827' },
  subtitle: { fontSize: '0.82rem', color: '#6b7280', marginTop: '0.15rem' },
  close: {
    background: '#f3f4f6', border: 'none', borderRadius: '50%',
    width: '30px', height: '30px', cursor: 'pointer',
    fontSize: '0.85rem', color: '#6b7280', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  messages: {
    flex: 1, overflowY: 'auto', padding: '0.8rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: '#9ca3af', fontSize: '0.88rem', textAlign: 'center',
    gap: '0.4rem', padding: '3rem 0',
  },

  msgRow:   { display: 'flex' },
  bubble:   { maxWidth: '75%', padding: '0.55rem 0.8rem', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  bubbleOwn:   { background: '#1a5c1a', color: '#fff', borderBottomRightRadius: '4px' },
  bubbleOther: { background: '#f3f4f6', color: '#111827', borderBottomLeftRadius: '4px' },
  msgName:  { fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.1rem' },
  msgText:  { fontSize: '0.9rem', lineHeight: 1.45, wordBreak: 'break-word' },
  msgTime:  { fontSize: '0.68rem', opacity: 0.65, marginTop: '0.15rem' },

  inputRow: {
    display: 'flex', gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderTop: '1px solid #f3f4f6',
    background: '#fff',
  },
  input: {
    flex: 1, border: '1.5px solid #e5e7eb', borderRadius: '20px',
    padding: '0.6rem 1rem', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'inherit',
    background: '#f9fafb',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #1a5c1a, #2d7a2d)',
    color: '#fff', border: 'none', borderRadius: '50%',
    width: '42px', height: '42px', flexShrink: 0,
    cursor: 'pointer', fontSize: '1rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', transition: 'opacity 0.15s',
  },
};
