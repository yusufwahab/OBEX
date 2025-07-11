import React from 'react';
import { useNavigate } from 'react-router-dom';
import bgVideo from '../../public/background.mp4';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen w-full text-white font-sans overflow-hidden bg-gray-900">
      {/* Video Container */}
      <div className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 w-full h-full max-w-[1920px] max-h-[1080px] object-cover transform -translate-x-1/2 -translate-y-1/2 will-change-transform"
        >
          <source src="/background.mp4" type="video/mp4" />
          <img
            src="/fallback-image.jpg"
            alt="PrimusLite surveillance background"
            className="w-full h-full object-cover"
          />
        </video>
      </div>

      {/* Glass-like Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 bg-gradient-to-b from-black/55 to-black/35 backdrop-blur-[1px] animate-fadeIn">
        <div className="text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 text-cyan-200 drop-shadow-[0_2px_4px_rgba(0,255,255,0.5)] tracking-tight leading-tight">
            The Zero Crime Mission
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-50 mb-10 leading-relaxed max-w-2xl mx-auto font-medium">
            Stay one step ahead of danger. PrimusLite delivers real-time alerts, smart surveillance, and crystal-clear monitoring—all in one powerful, easy-to-use platform. From your front door to your business, we keep your world protected. Effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <button
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-[0_4px_12px_rgba(0,255,255,0.3)] transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
              onClick={() => navigate('/auth')}
            >
              Get Started
            </button>
            <button
              className="px-8 py-3 border-2 border-cyan-300 text-cyan-100 hover:bg-cyan-900/40 hover:text-cyan-50 rounded-xl font-semibold shadow-[0_2px_8px_rgba(0,255,255,0.2)] transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-200/50"
            >
              Live Demo
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-4 left-0 right-0 text-center text-gray-100 text-sm z-10 font-light">
          © {new Date().getFullYear()} PrimusLite. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;