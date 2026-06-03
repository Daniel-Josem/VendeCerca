import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VendorDashboard from './pages/VendorDashboard';
import VendorProfile from './pages/VendorProfile';
import MyOrders from './pages/MyOrders';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';

function HomeOrLanding() {
  const { currentUser } = useAuth();
  return currentUser ? <Home /> : <Landing />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
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
        <Route path="*"               element={<NotFound />} />
      </Routes>
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
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
