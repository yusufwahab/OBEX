import React, { useState } from "react";
import { usersAPI } from "../services/api";
import { Mail, Send, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const ResendCode = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage("📧 Please enter your email address.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await usersAPI.resendCode({ email });
      setMessage(res.message || "✅ Verification code sent! Check your email.");
      setMessageType("success");
      
      setTimeout(() => {
        navigate("/verify-email", { state: { email } });
      }, 2000);
    } catch (err) {
      let errorMessage = "❌ Failed to resend code. Try again.";
      
      if (err.userMessage) {
        errorMessage = err.userMessage;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
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
            Resend Code
          </h2>

          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin mr-2" size={20} />
                Sending...
              </>
            ) : (
              <>
                <Send size={20} className="mr-2" />
                Resend Code
              </>
            )}
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

          <div className="text-center">
            <Link
              to="/login"
              className="text-cyan-400 text-sm hover:text-cyan-300 transition"
            >
              ← Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResendCode;