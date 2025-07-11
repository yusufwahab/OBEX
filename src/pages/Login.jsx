import React, { useState } from "react";
import axios from "axios";
import { Mail, Lock, LogIn, CheckCircle, XCircle } from 'lucide-react'; // Importing icons
import { useNavigate } from 'react-router-dom'; // For navigation

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null); // 'success' or 'error'
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Initialize navigate hook

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMessageType(null);

    try {
      const res = await axios.post("https://primus-lite.onrender.com/api/users/login", formData);
      setMessage(res.data.message || "Login successful!");
      setMessageType('success');

      // Store the token in localStorage
      localStorage.setItem('primusLiteToken', res.data.token);

      // Redirect to the Dashboard page
      navigate('/dashboard');

    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed. Please check your credentials.");
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 font-sans">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-gray-800 p-8 md:p-10 rounded-2xl shadow-2xl shadow-cyan-500/30 border border-gray-700 space-y-6 transform transition-all duration-300 hover:scale-[1.01]"
      >
        <h2 className="text-4xl font-extrabold text-center text-cyan-400 mb-8 tracking-wide">
          Welcome Back
        </h2>

        {/* Email Input */}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full pl-10 pr-3 py-3 rounded-lg bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        {/* Password Input */}
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full pl-10 pr-3 py-3 rounded-lg bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-cyan-600 text-white font-bold text-lg rounded-lg shadow-lg shadow-cyan-500/40 hover:bg-cyan-500 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Logging in...
            </>
          ) : (
            <>
              <LogIn size={20} className="mr-2" /> Login
            </>
          )}
        </button>

        {/* Message Display */}
        {message && (
          <p className={`text-center text-sm mt-4 flex items-center justify-center ${messageType === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {messageType === 'success' ? <CheckCircle size={16} className="mr-2" /> : <XCircle size={16} className="mr-2" />}
            {message}
          </p>
        )}
      </form>
    </div>
  );
};

export default Login;
