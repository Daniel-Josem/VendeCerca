import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import ActiveOrderChat from './components/ActiveOrderChat';

const Home           = lazy(() => import('./pages/Home'));
const Landing        = lazy(() => import('./pages/Landing'));
const Login          = lazy(() => import('./pages/Login'));
const Register       = lazy(() => import('./pages/Register'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'));
const VendorProfile  = lazy(() => import('./pages/VendorProfile'));
const MyOrders       = lazy(() => import('./pages/MyOrders'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Profile        = lazy(() => import('./pages/Profile'));
const AdminPanel     = lazy(() => import('./pages/AdminPanel'));
const NotFound       = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="skeleton" style={{ height: '2rem', width: '40%' }} />
      <div className="skeleton" style={{ height: '1rem', width: '70%' }} />
      <div className="skeleton" style={{ height: '1rem', width: '55%' }} />
      <div className="skeleton" style={{ height: '200px', width: '100%', marginTop: '1rem' }} />
    </div>
  );
}

function HomeOrLanding() {
  const { currentUser } = useAuth();
  return currentUser ? <Home /> : <Landing />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route path="/"               element={<HomeOrLanding />} />
          <Route path="/mapa"           element={<Home />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/dashboard"      element={<VendorDashboard />} />
          <Route path="/vendor/:id"     element={<VendorProfile />} />
          <Route path="/mis-pedidos"    element={<MyOrders />} />
          <Route path="/perfil"         element={<Profile />} />
          <Route path="/reset-password" element={<ForgotPassword />} />
          <Route path="/admin"          element={<AdminPanel />} />
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <Navbar />
              <AnimatedRoutes />
              <ActiveOrderChat />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
