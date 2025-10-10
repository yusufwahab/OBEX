import React from "react";

// Stream Card Component
const StreamCard = ({ camera, status, onStart, onStop, onDelete }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl hover:-translate-y-2 transition-transform">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{camera.location_name || 'Unknown Camera'}</h3>
          <p className="text-sm text-gray-600">{camera.ip_address}:{camera.port}</p>
          {camera.rtsp_url && (
            <p className="text-xs text-gray-500 mt-1 truncate max-w-[250px]" title={camera.rtsp_url}>
              RTSP: {camera.rtsp_url}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(status)}`}>
            {status}
          </span>
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 text-sm underline"
          >
            Delete
          </button>
        </div>
      </div>
      
      <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden mb-4">
        <video
          id={`video-${camera.id}`}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover hidden"
        />
        <div
          id={`placeholder-${camera.id}`}
          className="flex items-center justify-center h-full text-gray-400 text-sm text-center p-5"
        >
          Click "Start Stream" to begin viewing
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onStart}
          disabled={status === 'active' || status === 'connecting'}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'connecting' ? 'Connecting...' : 'Start Stream'}
        </button>
        <button
          onClick={onStop}
          disabled={status === 'inactive'}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop Stream
        </button>
      </div>
    </div>
  );
};

export default StreamCard