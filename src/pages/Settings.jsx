import React, { useState, useEffect } from 'react';
import { useNavStore } from '../store/navigation-store';
import { FaEnvelope, FaSms, FaWhatsapp, FaCogs } from 'react-icons/fa';

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
          Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(notificationSettings),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      alert('✅ Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Failed to save settings');
    }
  };

  const Toggle = ({ label, icon: Icon, checked, onChange, description }) => (
    <div className="flex items-start gap-4 p-4 bg-gray-800/70 border border-gray-700 rounded-xl">
      <Icon className="text-cyan-400 mt-1" size={22} />
      <div className="flex flex-col">
        <label className="text-white font-semibold mb-1">{label}</label>
        <span className="text-gray-400 text-sm mb-2">{description}</span>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:bg-cyan-500 transition-all duration-300 relative">
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform peer-checked:translate-x-5 transition" />
          </div>
          <span className="ml-3 text-sm text-gray-300 peer-hover:text-white">
            {checked ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1A2332] text-white p-6 sm:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <FaCogs className="text-cyan-400 mr-3" size={26} />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900/60 rounded-xl p-6 border border-gray-700/60 shadow-lg">
            <h2 className="text-xl font-semibold text-cyan-300 mb-4 flex items-center gap-2">
              <FaEnvelope /> Notification Preferences
            </h2>
            <div className="space-y-4">
              <Toggle
                label="Email Notifications"
                icon={FaEnvelope}
                checked={notificationSettings.email}
                onChange={(e) =>
                  setNotificationSettings({ ...notificationSettings, email: e.target.checked })
                }
                description="Receive alerts via your registered email address."
              />
              <Toggle
                label="SMS Notifications"
                icon={FaSms}
                checked={notificationSettings.sms}
                onChange={(e) =>
                  setNotificationSettings({ ...notificationSettings, sms: e.target.checked })
                }
                description="Get quick alerts through text messages."
              />
              <Toggle
                label="WhatsApp Notifications"
                icon={FaWhatsapp}
                checked={notificationSettings.whatsapp}
                onChange={(e) =>
                  setNotificationSettings({ ...notificationSettings, whatsapp: e.target.checked })
                }
                description="Receive real-time alerts on WhatsApp."
              />
            </div>

            <div className="mt-8 text-right">
              <button
                onClick={handleSave}
                className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
