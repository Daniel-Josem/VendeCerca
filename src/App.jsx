import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
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

function HomeOrLanding() {
  const { currentUser } = useAuth();
  return currentUser ? <Home /> : <Landing />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomeOrLanding />} />
          <Route path="/mapa" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<VendorDashboard />} />
          <Route path="/vendor/:id" element={<VendorProfile />} />
          <Route path="/mis-pedidos" element={<MyOrders />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/reset-password" element={<ForgotPassword />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
