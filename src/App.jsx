import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import Login from './pages/Login';
import Dashboard from './Dashboard';
import Settings from './pages/Settings';
import History from './pages/History';
import Profile from './pages/Profile';
import Notification from './pages/Notification';
import ZoneManagement from './pages/ZoneManagement';
import StreamClient from './StreamClient.jsx';

import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ResendCode from './pages/ResendCode';
import ProtectedRoute from './components/ProtectedRoute';
import AlertPopup from './components/AlertPopup';
import { useWebSocket } from './services/websocketService';
import useAuthStore from './store/auth-store';

export default function App() {
  const userId = useAuthStore((state) => state.user?._id);
  useWebSocket(userId);

  return (
    <BrowserRouter>
      <AlertPopup />
      <Routes>
        {/* Auth & Landing */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Forgot/Reset Password */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/resend-code" element={<ResendCode />} />

        {/* Main App - Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/StreamClient" element={<ProtectedRoute><StreamClient /></ProtectedRoute>} />
        <Route path="/zone-management" element={<ProtectedRoute><ZoneManagement /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notification /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
