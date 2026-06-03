# VendeCerca — Resumen del Proyecto

## ¿Qué es?
App de marketplace geolocalizado que conecta vendedores ambulantes con compradores cercanos.
- **Repo:** https://github.com/Daniel-Josem/VendeCerca.git
- **App en vivo:** https://vendecerca.vercel.app
- **Firebase project:** vendecerca

---

## Stack tecnológico
- React 19 + Vite
- React Router DOM 7
- Firebase (Auth + Firestore)
- Leaflet + React-Leaflet (mapa interactivo)
- Cloudinary (fotos de productos y perfil)
- vite-plugin-pwa (app instalable)
- Vercel (deploy)

---

## Archivo .env (crear en la raíz del proyecto)
```
VITE_FIREBASE_API_KEY=AIzaSyA6aEwFVTUPVwgSafmesgesmM5Tu0eX_Ds
VITE_FIREBASE_AUTH_DOMAIN=vendecerca.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vendecerca
VITE_FIREBASE_STORAGE_BUCKET=vendecerca.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=308494109448
VITE_FIREBASE_APP_ID=1:308494109448:web:79d1c29221442bd81e3abd
VITE_FIREBASE_MEASUREMENT_ID=G-87KL3YZQEP
```

---

## Cloudinary
- Cloud name: `dhjkhvfmf`
- Upload preset: `vendecerca`
- Fotos de productos: transformación `w_400,h_400,c_fill,f_auto,q_auto`
- Fotos de perfil vendedor: `w_300,h_300,c_fill,f_auto,q_auto`, public_id: `vendor_{uid}`
- Fotos de perfil comprador: `w_300,h_300,c_fill,f_auto,q_auto`, public_id: `user_{uid}`

---

## Colecciones Firestore
| Colección | Descripción |
|-----------|-------------|
| `vendors` | Vendedores: name, photoURL, isOnline, locations[], products[], rating, ratingsCount |
| `users` | Compradores/admins: name, photoURL, role (buyer/admin), favorites[] |
| `orders` | Pedidos: buyerId, vendorId, status, products[], type, address, createdAt, updatedAt |
| `reviews` | Reseñas: vendorId, buyerId, orderId, rating, comment, createdAt |

### Estados de un pedido
`pendiente` → `en_camino` / `listo` → `completado` / `cancelado`

---

## Rutas de la app
| Ruta | Componente | Acceso |
|------|-----------|--------|
| `/` | HomeOrLanding | Landing si no hay sesión, mapa si hay sesión |
| `/mapa` | Home | Mapa siempre |
| `/login` | Login | Público |
| `/register` | Register | Público |
| `/reset-password` | ForgotPassword | Público |
| `/dashboard` | VendorDashboard | Solo vendedores |
| `/vendor/:id` | VendorProfile | Público |
| `/mis-pedidos` | MyOrders | Solo compradores |
| `/perfil` | Profile | Autenticados |
| `/admin` | AdminPanel | Solo admins |

---

## Archivos clave creados/modificados
```
src/
├── context/
│   ├── AuthContext.jsx       — currentUser, userRole, userName
│   └── ToastContext.jsx      — toast.success/error/warning/info
├── hooks/
│   ├── useIsMobile.js        — detecta pantalla < 768px
│   └── useFavorites.js       — leer/escribir favoritos en Firestore
├── components/
│   ├── Navbar.jsx            — responsive, badge pedidos, link admin
│   ├── RatingModal.jsx       — modal de calificación con estrellas
│   └── OrderModal.jsx        — modal para hacer pedido
├── pages/
│   ├── Home.jsx              — mapa + lista + filtros + favoritos
│   ├── Landing.jsx           — página de bienvenida
│   ├── Login.jsx             — con toasts
│   ├── Register.jsx          — con toasts
│   ├── ForgotPassword.jsx    — con toasts
│   ├── VendorDashboard.jsx   — panel vendedor + estadísticas
│   ├── VendorProfile.jsx     — perfil público + reseñas
│   ├── MyOrders.jsx          — historial + repetir + calificar
│   ├── Profile.jsx           — perfil comprador + favoritos
│   └── AdminPanel.jsx        — panel admin (métricas/vendedores/pedidos)
public/
└── icon.svg                  — ícono PWA
```

---

## Mejoras implementadas (en orden)
1. **Mobile responsive** — Tab bar Lista/Mapa, fix Leaflet con position:absolute
2. **Landing page** — Hero, features, CTA para vendedores
3. **Toast notifications** — Reemplazó todos los alert() y error boxes
4. **PWA instalable** — Manifest, service worker, íconos, offline cache
5. **Fotos de productos** — Upload Cloudinary en VendorDashboard
6. **Sistema de reseñas** — RatingModal, colección reviews, promedio recalculado
7. **Mi Perfil** — Foto, nombre editable, stats de pedidos
8. **Repetir pedido** — Botón en historial, verifica si vendedor está online
9. **Búsqueda y filtros** — Chips: orden (distancia/rating/A-Z), calificación mínima, radio
10. **Favoritos** — Botón ❤️ en mapa, lista en Mi Perfil, hook useFavorites
11. **Stats para vendedores** — Hoy/semana/totales, ingresos, producto estrella
12. **Notificaciones pedidos** — Badge navbar + toast automático al cambio de estado
13. **Panel de admin** — Métricas globales, gestión vendedores, historial pedidos
14. **Chat en tiempo real** — ChatDrawer en pedidos activos para vendedor y comprador (subcolección Firestore orders/{id}/messages)
15. **Notificaciones push** — FCM via Vercel API route (`api/notify-vendor.js`). El vendedor recibe push aunque tenga la app cerrada cuando llega un pedido. VAPID key en `.env` como `VITE_FIREBASE_VAPID_KEY`.
16. **Zonas frecuentes** — El vendedor guarda sus spots habituales (GPS o posición del mapa) y los aplica a cualquier sede con un clic. Guardado en `vendors/{uid}.savedZones`.
17. **Modo oscuro** — Toggle 🌙/☀️ en Navbar. ThemeContext guarda preferencia en localStorage, aplica `data-theme` al `<html>`. Variables CSS en `index.css`.

---

## Activar panel de admin
En Firestore → colección `users` → documento con tu UID → campo `role` → cambiar a `admin`

Link directo: https://console.firebase.google.com/project/vendecerca/firestore/data/~2Fusers

---

## Reglas de Firestore (actualizar si el admin no puede leer pedidos)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /vendors/{vendorId} {
      allow read: if true;
      allow write: if request.auth.uid == vendorId || isAdmin();
    }
    match /orders/{orderId} {
      allow read: if request.auth.uid == resource.data.buyerId
                  || request.auth.uid == resource.data.vendorId
                  || isAdmin();
      allow write: if request.auth.uid == resource.data.buyerId
                   || request.auth.uid == resource.data.vendorId
                   || isAdmin();
    }
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if request.auth.uid == userId || isAdmin();
    }
    match /reviews/{reviewId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{orderId}/messages/{messageId} {
      allow read: if request.auth.uid == get(/databases/$(database)/documents/orders/$(orderId)).data.buyerId
                  || request.auth.uid == get(/databases/$(database)/documents/orders/$(orderId)).data.vendorId
                  || isAdmin();
      allow create: if (request.auth.uid == get(/databases/$(database)/documents/orders/$(orderId)).data.buyerId
                    || request.auth.uid == get(/databases/$(database)/documents/orders/$(orderId)).data.vendorId)
                   && request.resource.data.senderId == request.auth.uid;
    }
  }
}
```

---

## Comandos útiles
```bash
npm run dev          # Correr en local (http://localhost:5173)
npm run build        # Build de producción
npx vercel@53 --prod # Desplegar a Vercel
```

---

## Detalles técnicos importantes
- **Fix mapa en móvil**: Usar `position:absolute + z-index` en lugar de `display:none` para que Leaflet inicialice con dimensiones reales
- **pendingFlyRef**: Patrón para ejecutar flyTo después de que el mapa sea visible
- **updatedAt**: Se guarda en cada orden cuando el vendedor cambia el estado (para el badge de notificaciones)
- **Badge notificaciones**: Usa localStorage `orders_visited_{uid}` para saber qué pedidos ya vio el comprador
