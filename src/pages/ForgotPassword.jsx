import React, { useState } from "react";
import { usersAPI } from "../services/api";
import { Mail, Send, ArrowRight, CheckCircle, XCircle } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const res = await usersAPI.forgotPassword({ email });
      setMessage(res.message || "✅ If your email is registered, a reset link has been sent.");
      setMessageType("success");
    } catch (err) {
      let errorMessage = "❌ Something went wrong. Try again.";
      
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
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/20 shadow-2xl shadow-cyan-500/20 space-y-6"
        >
          <div className="text-center mb-6">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Forgot Password?
            </h2>
            <p className="text-slate-300 text-sm mt-2">
              Enter your email to receive a password reset link.
            </p>
          </div>

          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" size={20} />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-4 rounded-xl bg-white/10 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg rounded-xl shadow-lg flex items-center justify-center transition disabled:opacity-50"
          >
            {loading ? (
              "Sending..."
            ) : (
              <>
                <Send size={20} className="mr-2" /> Send Reset Link{" "}
                <ArrowRight size={20} className="ml-2" />
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
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
