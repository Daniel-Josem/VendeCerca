import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './config';

export const messaging = getMessaging(app);

export async function requestFCMToken() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    return token || null;
  } catch {
    return null;
  }
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}
