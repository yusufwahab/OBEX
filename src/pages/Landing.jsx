import React from 'react';
import { useNavigate } from 'react-router-dom';
import bgVideo from '../../public/background.mp4';
 

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen w-full text-white font-sans overflow-hidden bg-gray-900">
      {/* Fullscreen Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
       <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Glass-like overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 bg-black/60 backdrop-blur-sm">
        <div className="text-center max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-cyan-400 drop-shadow-md tracking-tight">
            The Zero Crime Mission
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-10 leading-relaxed">
          Stay one step ahead of danger.
PrimusLite gives you real-time alerts, smart surveillance, and crystal-clear monitoring ; all in one powerful, easy-to-use platform.
From your front door to your business, we keep your world protected. Effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <button className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400" onClick={() => navigate('/auth')}>
              Get Started
            </button>
            <button className="px-8 py-3 border border-cyan-500 text-cyan-300 hover:bg-cyan-800/40 rounded-lg font-semibold shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400">
              Live Demo
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="absolute bottom-4 left-0 right-0 text-center text-gray-400 text-sm z-10">
          &copy; {new Date().getFullYear()} PrimusLite. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
