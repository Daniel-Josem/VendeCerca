import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setCors } from './_cors.js';

const PRODUCTS_NOTIFY_MAX = 3;

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.replace(/^﻿/, '').trim();
  const serviceAccount = JSON.parse(raw);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { vendorId, buyerName, type, products } = req.body;
    if (!vendorId || !buyerName) return res.status(400).json({ error: 'Faltan datos' });

    const app = getAdminApp();
    const db  = getFirestore(app);

    const vendorSnap = await db.collection('vendors').doc(vendorId).get();
    const fcmToken   = vendorSnap.data()?.fcmToken;

    if (!fcmToken) return res.status(200).json({ sent: false, reason: 'no token' });

    const typeLabel = type === 'domicilio' ? '🛵 Domicilio' : '🛒 Retiro en puesto';
    const prodList  = (products || [])
      .slice(0, PRODUCTS_NOTIFY_MAX)
      .map(p => `${p.emoji || ''} ${p.name} ×${p.qty}`.trim())
      .join(', ');

    await getMessaging(app).send({
      token: fcmToken,
      data: {
        title: `Nuevo pedido de ${buyerName}`,
        body:  `${typeLabel}${prodList ? ': ' + prodList : ''}`,
        url:   '/dashboard',
        icon:  '/icon.svg',
      },
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('notify-vendor error:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
}
