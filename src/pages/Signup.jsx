import React, { useState } from "react";
import { usersAPI } from "../services/api";
import {
  User,
  Mail,
  Phone,
  Lock,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  Shield,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const Signup = () => {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageType(null);
    setShowResend(false);
    setIsTimeout(false);

    try {
      // Transform form data to match backend schema exactly
      const backendPayload = {
        full_name: formData.full_name,
        email: formData.email,
        phone: parseInt(formData.phone) || 0,
        role: "user",
        time_zone: "UTC",
        language: "en",
        is_verified: false,
        login_attempts: 0,
        alert_preferences: {
          sms: false,
          email: false,
          whatsapp: true
        },
        password: formData.password
      };

      console.log('Sending signup request with payload:', backendPayload);
      
      const res = await usersAPI.signup(backendPayload);
      
      setMessage(res.message || "Account created successfully! Please check your email for verification.");
      setMessageType("success");

      // Clear form on success
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        password: "",
      });

      // Navigate to verification page after showing success message
      setTimeout(() => {
        navigate("/verify-email", { state: { email: formData.email } });
      }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      
      let errorMessage = "Signup failed. Please try again.";
      
      // Handle timeout errors specifically
      if (err.code === 'ECONNABORTED' || err.userMessage?.includes('timeout')) {
        setIsTimeout(true);
        errorMessage = "Connection timeout. The server might be starting up. Please wait a moment and try again.";
        setMessageType("warning");
      }
      // Handle user-friendly error messages from interceptor
      else if (err.userMessage) {
        errorMessage = err.userMessage;
        setMessageType("error");
      }
      // Handle FastAPI validation errors (422)
      else if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map(e => e.msg).join(", ");
        } else {
          errorMessage = err.response.data.detail;
        }
        setMessageType("error");
      }
      // Handle other backend error messages
      else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
        setMessageType("error");
      }
      // Fallback to generic error message
      else if (err.message) {
        errorMessage = err.message;
        setMessageType("error");
      }

      setMessage(errorMessage);

      // Show resend option if user already exists
      if (errorMessage.toLowerCase().includes("already") || 
          errorMessage.toLowerCase().includes("exist")) {
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      const res = await usersAPI.resendCode({ email: formData.email });
      setMessage(res.message || "Verification code resent!");
      setMessageType("success");
      setShowResend(false);

      setTimeout(() => {
        navigate("/verify-email", { state: { email: formData.email } });
      }, 2000);
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Failed to resend verification code."
      );
      setMessageType("error");
    }
  };

  const getMessageIcon = () => {
    switch (messageType) {
      case 'success':
        return <CheckCircle size={16} className="text-green-400 flex-shrink-0" />;
      case 'warning':
        return <Clock size={16} className="text-yellow-400 flex-shrink-0" />;
      case 'error':
      default:
        return <XCircle size={16} className="text-red-400 flex-shrink-0" />;
    }
  };

  const getMessageStyle = () => {
    switch (messageType) {
      case 'success':
        return 'bg-green-500/20 border-green-500/30 text-green-300';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300';
      case 'error':
      default:
        return 'bg-red-500/20 border-red-500/30 text-red-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-ping"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-1 h-1 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-blue-500 rounded-full animate-ping animation-delay-300 opacity-60"></div>
        <div className="absolute bottom-32 left-32 w-1 h-1 bg-cyan-400 rounded-full animate-ping animation-delay-600 opacity-60"></div>
        <div className="absolute bottom-20 right-20 w-1 h-1 bg-blue-500 rounded-full animate-ping animation-delay-900 opacity-60"></div>
      </div>

      {/* Main form container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glowing effect behind form */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
        
        <form
          onSubmit={handleSubmit}
          className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-8 md:p-10 rounded-3xl border border-white/20 shadow-2xl shadow-cyan-500/20 space-y-6 transform transition-all duration-300 hover:scale-[1.02]"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 tracking-wide">
              Create Account
            </h2>
            <p className="text-slate-300 text-sm">Join OBEX for complete security</p>
          </div>

          {/* Full Name Input */}
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:text-cyan-300 transition-colors duration-200" size={20} />
            <input
              type="text"
              name="full_name"
              placeholder="Full Name"
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200 backdrop-blur-sm"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Email Input */}
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:text-cyan-300 transition-colors duration-200" size={20} />
            <input
              type="email"
              name="email"
              placeholder="Email"
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200 backdrop-blur-sm"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Phone Input */}
          <div className="relative group">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:text-cyan-300 transition-colors duration-200" size={20} />
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number (digits only)"
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200 backdrop-blur-sm"
              value={formData.phone}
              onChange={handleChange}
              pattern="[0-9]*"
              title="Please enter only numbers"
              required
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:text-cyan-300 transition-colors duration-200" size={20} />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              className="w-full pl-10 pr-12 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all duration-200 backdrop-blur-sm"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition-colors duration-200"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-cyan-400/30"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isTimeout ? 'Waiting for server...' : 'Creating Account...'}
              </>
            ) : (
              <>
                <Shield size={20} className="mr-2" /> Create Account
                <ArrowRight size={20} className="ml-2 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-xl border ${getMessageStyle()} flex items-start space-x-3`}>
              {getMessageIcon()}
              <div className="text-sm leading-relaxed">
                {message}
                {isTimeout && (
                  <div className="mt-2 text-xs opacity-80">
                    Render free tier may take up to 30 seconds to start after being idle.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Retry Button for Timeouts */}
          {isTimeout && !loading && (
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-xl flex items-center justify-center transition-all duration-300 border border-yellow-500/30 hover:border-yellow-400/50"
            >
              <AlertTriangle size={16} className="mr-2" /> Try Again
            </button>
          )}

          {/* Resend Code Button */}
          {showResend && (
            <button
              type="button"
              onClick={handleResendCode}
              className="w-full py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-cyan-300 rounded-xl flex items-center justify-center transition-all duration-300 border border-slate-500/30 hover:border-cyan-400/50"
            >
              <Send size={16} className="mr-2" /> Resend Verification Code
            </button>
          )}

          {/* Login Link */}
          <div className="text-center pt-4">
            <span className="text-slate-300">Already have an account? </span>
            <Link
              to="/login"
              className="text-cyan-400 font-semibold hover:text-cyan-300 transition duration-200 hover:underline"
            >
              Login here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;