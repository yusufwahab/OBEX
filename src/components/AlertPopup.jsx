import React from 'react';
import { useNotificationStore } from '../store/notification-store';

const AlertPopup = () => {
  const { showAlert, alertData, closeAlert } = useNotificationStore();

  if (!showAlert || !alertData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-red-600 to-pink-700 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-red-400/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-exclamation-triangle text-white text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">{alertData.title}</h3>
            <p className="text-red-100 mb-4">{alertData.message}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-200">
                {new Date(alertData.timestamp).toLocaleTimeString()}
              </span>
              <button
                onClick={closeAlert}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertPopup;
