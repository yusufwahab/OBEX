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
import StreamClient from './StreamClient.jsx'; // ✅ ADDED

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth & Landing */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Main App */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/StreamClient" element={<StreamClient />} /> {/* ✅ NEW ROUTE */}
        <Route path="/zone-management" element={<ZoneManagement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notification />} />
      </Routes>
    </BrowserRouter>
  );
}