import React, { useState, useEffect } from 'react';
import { useNavStore } from '../store/navigation-store';

const Profile = () => {
  const { setActive } = useNavStore();
  const [profile, setProfile] = useState({ name: '', email: '', role: '' });

  useEffect(() => {
    setActive('profile');
    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/auth/profile', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, [setActive]);

  const handleSave = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      alert('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-10">
      <h1 className="text-3xl font-bold text-cyan-200 mb-6">User Profile</h1>
      <div className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-100">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-100">Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-100">Role</label>
            <input
              type="text"
              value={profile.role}
              disabled
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-gray-400 border border-gray-700"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          className="mt-6 px-6 py-2 bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Save Profile
        </button>
      </div>
    </div>
  );
};

export default Profile;
