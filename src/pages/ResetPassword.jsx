import React, { useState, useEffect } from "react";
import { usersAPI } from "../services/api";
import { Lock, CheckCircle, XCircle, Key } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setMessage("❌ Invalid reset link. Please request a new password reset.");
      setMessageType("error");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setMessage("❌ Invalid reset link. Please request a new password reset.");
      setMessageType("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      setMessageType("error");
      return;
    }

    if (newPassword.length < 6) {
      setMessage("❌ Password must be at least 6 characters long.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      console.log('🔄 Resetting password with:', { email, token: token?.substring(0, 10) + '...', password_length: newPassword.length });
      
      const res = await usersAPI.resetPassword({ 
        email, 
        token, 
        new_password: newPassword 
      });
      
      console.log('✅ Reset password response:', res);
      
      setMessage(res.message || "✅ Password reset successfully! You can now login with your new password.");
      setMessageType("success");
      
      // Clear form
      setEmail("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      console.error('❌ Reset password error:', err);
      
      let errorMessage = "❌ Reset failed. Try again.";
      
      if (err.response?.status === 400) {
        errorMessage = "❌ Invalid or expired reset token. Please request a new password reset.";
      } else if (err.response?.status === 404) {
        errorMessage = "❌ User not found. Please check your email address.";
      } else if (err.userMessage) {
        errorMessage = err.userMessage;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.detail) {
        errorMessage = Array.isArray(err.response.data.detail) 
          ? err.response.data.detail.map(e => e.msg).join(', ')
          : err.response.data.detail;
      }
      
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/20 shadow-xl space-y-6"
        >
          <h2 className="text-3xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Reset Password
          </h2>

          <div className="relative group">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          {message && (
            <div
              className={`p-3 rounded-xl border flex items-start space-x-2 ${
                messageType === "success"
                  ? "bg-green-500/20 border-green-500/30 text-green-300"
                  : "bg-red-500/20 border-red-500/30 text-red-300"
              }`}
            >
              {messageType === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
              <span className="text-sm">{message}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
