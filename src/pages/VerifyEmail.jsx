import React, { useState, useEffect, useRef } from "react";
import { usersAPI } from "../services/api";
import { Mail, ShieldCheck, XCircle, RefreshCw, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const codeInputRef = useRef(null);

  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    code: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-focus code input on mount
  useEffect(() => {
    if (codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Only allow 6 digits for code
    if (name === "code" && !/^\d{0,6}$/.test(value)) return;

    setFormData({ ...formData, [name]: value });

    // Auto-submit when 6 digits entered
    if (name === "code" && value.length === 6) {
      handleVerify(e);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (formData.code.length !== 6) {
      setMessage("Please enter a 6-digit verification code.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage(null);
    setMessageType(null);

    try {
      const res = await usersAPI.verifyEmail(formData);

      setMessage(res.message || "✅ Email verified successfully!");
      setMessageType("success");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      let errorMessage = "❌ Verification failed. Please try again.";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.userMessage) {
        errorMessage = err.userMessage;
      }

      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!formData.email) {
      setMessage("📧 Please enter your email first.");
      setMessageType("error");
      return;
    }

    if (resendCooldown > 0) return;

    setMessage(null);
    setMessageType(null);
    setResendCooldown(30); // 30 second cooldown

    try {
      await usersAPI.resendCode({ email: formData.email });
      setMessage("📬 New code sent! Check your inbox.");
      setMessageType("success");
    } catch (err) {
      let errorMessage = "⚠️ Failed to resend code. Please try again.";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.userMessage) {
        errorMessage = err.userMessage;
      }

      setMessage(errorMessage);
      setMessageType("error");
      setResendCooldown(0); // Reset on error
    }
  };

  const getMessageIcon = () => {
    if (messageType === "success") return <ShieldCheck size={18} className="text-green-400" />;
    return <XCircle size={18} className="text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-white flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-cyan-600/20 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
      </div>

      <form
        onSubmit={handleVerify}
        className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm p-8 md:p-10 rounded-3xl shadow-2xl shadow-cyan-500/20 border border-gray-700/50 space-y-6 transform transition-all duration-300 hover:scale-[1.02] relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-300 text-sm">Enter the 6-digit code sent to your inbox</p>
        </div>

        {/* Email Field */}
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-400 transition-colors" size={20} />
          <input
            type="email"
            name="email"
            placeholder="Your email address"
            className="w-full pl-10 pr-3 py-4 rounded-xl bg-gray-700/80 text-gray-200 placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all backdrop-blur-sm"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        {/* OTP Field */}
        <div className="relative group">
          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-cyan-400 transition-colors" size={20} />
          <input
            ref={codeInputRef}
            type="text"
            name="code"
            placeholder="6-digit code"
            className="w-full pl-10 pr-3 py-4 rounded-xl bg-gray-700/80 text-gray-200 placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all backdrop-blur-sm text-center text-lg tracking-wider"
            value={formData.code}
            onChange={handleChange}
            required
            maxLength="6"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>

        {/* Resend Code Button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={loading || resendCooldown > 0}
          className="w-full py-3 text-cyan-400 border border-cyan-500/50 rounded-xl hover:bg-cyan-500/20 hover:text-cyan-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
        >
          {resendCooldown > 0 ? (
            <>
              <Clock size={16} />
              Resend ({resendCooldown}s)
            </>
          ) : (
            <>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Resend Code
            </>
          )}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || formData.code.length !== 6}
          className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            "✅ Verify Email"
          )}
        </button>

        {/* Message Display */}
        {message && (
          <div
            className={`p-4 rounded-xl border text-center flex items-center justify-center gap-2 ${
              messageType === "success"
                ? "bg-green-500/20 border-green-500/30 text-green-300"
                : "bg-red-500/20 border-red-500/30 text-red-300"
            }`}
          >
            {getMessageIcon()}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}

        {/* Back to Login */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-cyan-400 text-sm hover:text-cyan-300 transition duration-200 hover:underline"
          >
            ← Back to Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default VerifyEmail;