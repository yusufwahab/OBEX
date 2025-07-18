import React, { useState, useEffect } from 'react';
import { useNavStore } from '../store/navigation-store';

const History = () => {
  const { setActive } = useNavStore();
  const [detections, setDetections] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setActive('history');
    const fetchDetections = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/detections', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch detections');
        const data = await response.json();
        setDetections(data);
      } catch (error) {
        console.error('Error fetching detections:', error);
      }
    };
    fetchDetections();
  }, [setActive]);

  const filteredDetections = detections.filter(
    (d) =>
      d.type.toLowerCase().includes(filter.toLowerCase()) ||
      d.timestamp.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-10">
      <h1 className="text-3xl font-bold text-cyan-200 mb-6">Detection History</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by type or date..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="p-3 text-sm font-medium text-cyan-200">Timestamp</th>
              <th className="p-3 text-sm font-medium text-cyan-200">Type</th>
              <th className="p-3 text-sm font-medium text-cyan-200">Camera</th>
              <th className="p-3 text-sm font-medium text-cyan-200">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredDetections.length > 0 ? (
              filteredDetections.map((detection) => (
                <tr key={detection.id} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="p-3">{new Date(detection.timestamp).toLocaleString()}</td>
                  <td className="p-3">{detection.type}</td>
                  <td className="p-3">{detection.cameraId}</td>
                  <td className="p-3">{detection.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-3 text-center">No detections found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;
