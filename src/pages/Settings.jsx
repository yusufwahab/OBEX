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
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-10">
      <h1 className="text-3xl font-bold text-cyan-200 mb-6">Settings</h1>
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notificationSettings.email}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, email: e.target.checked })}
              className="h-5 w-5 text-cyan-400 focus:ring-cyan-400 border-gray-700 rounded"
            />
            <span>Email Notifications</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notificationSettings.sms}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, sms: e.target.checked })}
              className="h-5 w-5 text-cyan-400 focus:ring-cyan-400 border-gray-700 rounded"
            />
            <span>SMS Notifications</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={notificationSettings.whatsapp}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp: e.target.checked })}
              className="h-5 w-5 text-cyan-400 focus:ring-cyan-400 border-gray-700 rounded"
            />
            <span>WhatsApp Notifications</span>
          </label>
        </div>
        <button
          onClick={handleSave}
          className="mt-6 px-6 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default Settings;
