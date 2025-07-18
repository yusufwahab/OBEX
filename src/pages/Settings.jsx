import React, { useState, useEffect } from 'react';
import { useNavStore } from '../store/navigation-store';

const Settings = () => {
  const { setActive } = useNavStore();
  const [notificationSettings, setNotificationSettings] = useState({
    email: false,
    sms: false,
    whatsapp: false,
  });

  useEffect(() => {
    setActive('settings');
    const fetchSettings = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/notifications/settings', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        setNotificationSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, [setActive]);

  const handleSave = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(notificationSettings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 flex justify-center items-start">
      <div className="w-full max-w-lg bg-gray-800/80 rounded-xl shadow-lg p-6 sm:p-8 border border-gray-700/50 backdrop-blur-sm">
        <h1 className="text-2xl sm:text-3xl font-bold text-cyan-200 mb-6">Settings</h1>
        <section className="space-y-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100 mb-4">Notification Preferences</h2>
          <div className="space-y-5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notificationSettings.email}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, email: e.target.checked })}
                  className="peer h-5 w-5 appearance-none border-2 border-gray-600 rounded-md bg-gray-700 checked:bg-cyan-500 checked:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200"
                  aria-label="Enable email notifications"
                />
                <span className="absolute left-1 top-1 hidden peer-checked:block text-white">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors duration-200">
                Email Notifications
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notificationSettings.sms}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, sms: e.target.checked })}
                  className="peer h-5 w-5 appearance-none border-2 border-gray-600 rounded-md bg-gray-700 checked:bg-cyan-500 checked:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200"
                  aria-label="Enable SMS notifications"
                />
                <span className="absolute left-1 top-1 hidden peer-checked:block text-white">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors duration-200">
                SMS Notifications
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notificationSettings.whatsapp}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp: e.target.checked })}
                  className="peer h-5 w-5 appearance-none border-2 border-gray-600 rounded-md bg-gray-700 checked:bg-cyan-500 checked:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200"
                  aria-label="Enable WhatsApp notifications"
                />
                <span className="absolute left-1 top-1 hidden peer-checked:block text-white">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors duration-200">
                WhatsApp Notifications
              </span>
            </label>
          </div>
          <button
            onClick={handleSave}
            className="mt-6 w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-semibold rounded-md hover:from-cyan-600 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transform hover:scale-105 transition-all duration-200"
            aria-label="Save notification settings"
          >
            Save Settings
          </button>
        </section>
      </div>
    </div>
  );
};

export default Settings;
