import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useNotificationStore } from '../store/notification-store';

const ThreatAlertModal = ({ isOpen, onClose, alertData }) => {
  const { addNotification } = useNotificationStore();
  
  useEffect(() => {
    if (isOpen && alertData) {
      // Store the alert in notifications
      addNotification({
        type: 'threat',
        level: alertData.severity || 'High',
        title: alertData.title || 'Threat Detected',
        message: alertData.description || 'A security threat has been detected',
        priority: 'urgent'
      });
      
      // Play danger sound
      const audio = new Audio('./AlertSound.mp3');
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  }, [isOpen, alertData, addNotification]);
  
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
      case 'High': return 'from-red-600 to-red-700';
      case 'Medium': return 'from-red-500 to-red-600';
      case 'Low': return 'from-red-400 to-red-500';
      default: return 'from-red-600 to-red-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-red-500/30 shadow-2xl">
        {/* Blinking Alert Icon */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center animate-pulse shadow-lg">
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
          
          <h2 className="text-2xl font-bold text-white mb-2 animate-pulse" style={{animation: 'dangerPop 1s ease-in-out infinite'}}>
            THREAT DETECTED
          </h2>
          <style jsx>{`
            @keyframes dangerPop {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
          `}</style>
          
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
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Acknowledge Alert
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreatAlertModal;