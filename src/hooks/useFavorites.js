import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function useFavorites() {
  const { currentUser, userRole } = useAuth();
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    if (!currentUser || userRole === 'vendor') return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setFavorites(new Set(snap.data().favorites || []));
    });
  }, [currentUser, userRole]);

  async function toggleFavorite(vendorId) {
    if (!currentUser || userRole === 'vendor') return;
    const isFav = favorites.has(vendorId);
    setFavorites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
    const ref = doc(db, 'users', currentUser.uid);
    await updateDoc(ref, { favorites: isFav ? arrayRemove(vendorId) : arrayUnion(vendorId) });
  }

  return { favorites, toggleFavorite };
}
