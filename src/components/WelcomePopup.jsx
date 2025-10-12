import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Shield, Sparkles, X, ChevronRight } from 'lucide-react';
import useAuthStore from '../store/auth-store';

const WelcomePopup = ({ onClose }) => {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const steps = [
    {
      icon: Camera,
      title: "Add Your First Camera",
      description: "Set up surveillance by adding and configuring your cameras. Test connections and preview feeds in real-time.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: MapPin,
      title: "Configure Zones",
      description: "Define specific monitoring areas and zones for targeted security. Customize alerts for different locations.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Shield,
      title: "Monitor & Alerts",
      description: "Receive real-time notifications for security events. View history, manage alerts, and stay protected 24/7.",
      color: "from-green-500 to-emerald-500"
    }
  ];

  const handleGetStarted = () => {
    setShowConfetti(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-500/20 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-ping"></div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping opacity-60"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Main popup */}
      <div className="relative z-10 w-full max-w-4xl mx-4 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl shadow-cyan-500/20 overflow-hidden">
        {/* Header */}
        <div className="relative p-8 text-center bg-gradient-to-r from-cyan-600/20 to-blue-600/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <X size={24} />
          </button>

          <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/30 animate-bounce">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Welcome to OBEX, {user?.full_name?.split(' ')[0] || 'User'}! 🎉
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Your advanced security monitoring dashboard is ready. Let's get you started with a quick setup guide.
          </p>
        </div>

        {/* Steps */}
        <div className="p-8">
          <div className="flex items-center justify-center mb-8">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index <= currentStep ? 'bg-cyan-400 scale-125' : 'bg-slate-600'
                  }`}
                />
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                      index < currentStep ? 'bg-cyan-400' : 'bg-slate-600'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mb-8">
            <div className={`w-24 h-24 bg-gradient-to-r ${steps[currentStep].color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse`}>
              {React.createElement(steps[currentStep].icon, { className: "w-12 h-12 text-white" })}
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">{steps[currentStep].title}</h2>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronRight size={20} className="rotate-180" />
              Previous
            </button>

            <div className="text-slate-400 text-sm">
              {currentStep + 1} of {steps.length}
            </div>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={nextStep}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-cyan-500/30"
              >
                Next
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-lg rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-green-500/30 transform hover:scale-105"
              >
                <Sparkles size={20} />
                Get Started
              </button>
            )}
          </div>
        </div>

        {/* Confetti effect */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-ping"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomePopup;
