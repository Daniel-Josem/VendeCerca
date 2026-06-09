import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setCors } from './_cors.js';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.replace(/^﻿/, '').trim();
  const serviceAccount = JSON.parse(raw);
  // Asegura que los saltos de línea del private_key estén bien
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { email, newPassword, token } = req.body;
    if (!email || !newPassword || !token) return res.status(400).json({ error: 'Faltan datos' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });

    const app = getAdminApp();
    const db  = getFirestore(app);
    const auth = getAuth(app);

    const snap = await db.collection('resetTokens')
      .where('email', '==', email)
      .where('token', '==', token)
      .get();

    if (snap.empty) return res.status(401).json({ error: 'Token inválido o expirado' });

    const data = snap.docs[0].data();
    if (data.expiresAt.toDate() < new Date()) {
      await snap.docs[0].ref.delete();
      return res.status(401).json({ error: 'El código expiró, solicita uno nuevo' });
    }

    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: newPassword });
    await snap.docs[0].ref.delete();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    return res.status(500).json({ error: err?.message || err?.code || 'Error interno' });
  }
}
