import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ThreatAlertModal = ({ isOpen, onClose, alertData }) => {
  if (!isOpen || !alertData) return null;

  const getThreatIcon = (type) => {
    switch (type) {
      case 'intrusion': return '🚨';
      case 'loitering': return '⏰';
      case 'theft': return '🔓';
      case 'suspicious': return '👁️';
      case 'weapon': return '⚔️';
      default: return '⚠️';
    }
  };

  const getThreatColor = (severity) => {
    switch (severity) {
      case 'High': return 'from-red-600 to-pink-600';
      case 'Medium': return 'from-amber-500 to-orange-500';
      case 'Low': return 'from-yellow-500 to-amber-500';
      default: return 'from-red-600 to-pink-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-red-500/30 shadow-2xl">
        {/* Blinking Alert Icon */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center animate-pulse shadow-lg">
            <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Alert Content */}
        <div className="text-center mt-4">
          <div className="text-4xl mb-4 animate-pulse">
            {getThreatIcon(alertData.type)}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            THREAT DETECTED
          </h2>
          
          <div className={`inline-block px-4 py-2 rounded-full text-white font-semibold mb-4 bg-gradient-to-r ${getThreatColor(alertData.severity)}`}>
            {alertData.severity} Priority
          </div>
          
          <h3 className="text-xl font-semibold text-white mb-3">
            {alertData.title}
          </h3>
          
          <p className="text-gray-300 mb-4 leading-relaxed">
            {alertData.description}
          </p>
          
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Camera:</span>
                <p className="text-white font-medium">{alertData.cameraName}</p>
              </div>
              <div>
                <span className="text-gray-400">Time:</span>
                <p className="text-white font-medium">{new Date(alertData.timestamp).toLocaleTimeString()}</p>
              </div>
              <div>
                <span className="text-gray-400">Type:</span>
                <p className="text-white font-medium capitalize">{alertData.type}</p>
              </div>
              <div>
                <span className="text-gray-400">Zone:</span>
                <p className="text-white font-medium">{alertData.zone || 'Main Area'}</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Acknowledge Alert
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreatAlertModal;