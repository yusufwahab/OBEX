import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from './store/camera-store';
import StreamCard from './StreamCard';

const StreamClient = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [serverUrl, setServerUrl] = useState('ws://localhost:8040/ws/streams');
  const [authToken, setAuthToken] = useState('');
  
  // Use existing camera store
  const {
    CameraStreams = [],
    fetchCameras,
    removeCamera,
    isLoading: isLoadingCameras,
    error: cameraError
  } = useCameraStore();

  // Streams state (for WebRTC connection)
  const [streamStatuses, setStreamStatuses] = useState({});
  
  // Logs state
  const [logs, setLogs] = useState([]);
  
  // Refs for WebSocket and peer connections
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      {
        urls: [
          'turn:teletraan-backend.avzdax.com:3478?transport=udp',
          'turn:teletraan-backend.avzdax.com:3478?transport=tcp'
        ],
        username: 'adm',
        credential: 'Avz25'
      }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Logging function
  const addLog = useCallback((message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [
      ...prev.slice(-99),
      { timestamp, message, type, id: Date.now() + Math.random() }
    ]);
  }, []);

  const clearLogs = () => setLogs([]);

  // Choose codecs function
  const chooseCodecs = useCallback(() => {
    const caps = RTCRtpReceiver.getCapabilities?.('video');
    if (!caps?.codecs) return null;

    const filtered = caps.codecs.filter(c => {
      const mime = (c.mimeType || '').toUpperCase();
      if (!/^VIDEO\/(VP8|H264)$/.test(mime)) return false;
      if (mime === 'VIDEO/H264') {
        return /packetization-mode=1/i.test(c.sdpFmtpLine || '');
      }
      return true;
    });

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const pref = isSafari ? ['VIDEO/H264', 'VIDEO/VP8'] : ['VIDEO/VP8', 'VIDEO/H264'];

    filtered.sort((a, b) => {
      const A = (a.mimeType || '').toUpperCase();
      const B = (b.mimeType || '').toUpperCase();
      return pref.indexOf(A) - pref.indexOf(B);
    });

    return filtered;
  }, []);

  // WebSocket message handling
  const handleMessage = useCallback(async (message) => {
    addLog(`Received: ${message.type}`);
    
    switch (message.type) {
      case 'stream_list':
        addLog(`Received stream list with ${message.data?.length || 0} streams`);
        break;
        
      case 'webrtc_answer':
        await handleWebRTCAnswer(message);
        break;
        
      case 'ice_candidate':
        await handleICECandidate(message);
        break;
        
      case 'success':
        addLog(`Success: ${message.data?.message || 'Operation completed'}`);
        break;
        
      case 'error':
        addLog(`Error: ${message.error}`, 'error');
        if (message.stream_id) {
          updateStreamStatus(message.stream_id, 'inactive');
        }
        break;
    }
  }, [addLog]);

  // Send WebSocket message
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        message.timestamp = new Date().toISOString();
        const jsonMessage = JSON.stringify(message);
        wsRef.current.send(jsonMessage);
        return true;
      } catch (error) {
        addLog(`Failed to send message: ${error.message}`, 'error');
        return false;
      }
    } else {
      addLog('WebSocket not connected', 'error');
      return false;
    }
  }, [addLog]);

  // Update stream status
  const updateStreamStatus = useCallback((streamId, status) => {
    setStreamStatuses(prev => ({
      ...prev,
      [streamId]: status
    }));
  }, []);

  // WebRTC Answer handler
  const handleWebRTCAnswer = useCallback(async (message) => {
    const streamId = message.data.stream_id;
    const pc = peerConnectionsRef.current.get(streamId);
    if (pc) {
      try {
        addLog(`Setting remote description for stream: ${streamId}`);
        await pc.setRemoteDescription(message.data.answer);
        addLog(`Successfully set remote description for stream: ${streamId}`);
      } catch (error) {
        addLog(`Failed to set remote description for ${streamId}: ${error.message}`, 'error');
        updateStreamStatus(streamId, 'inactive');
      }
    } else {
      addLog(`No peer connection found for stream: ${streamId}`, 'error');
    }
  }, [addLog, updateStreamStatus]);

  // ICE Candidate handler
  const handleICECandidate = useCallback(async (message) => {
    const streamId = message.data.stream_id || message.stream_id;
    const pc = peerConnectionsRef.current.get(streamId);
    if (pc) {
      try {
        const candidate = message.data.candidate || message.data;
        await pc.addIceCandidate(candidate);
        addLog(`Added ICE candidate for stream: ${streamId}`);
      } catch (error) {
        addLog(`Failed to add ICE candidate for ${streamId}: ${error.message}`, 'error');
      }
    }
  }, [addLog]);

  // Connect to WebSocket
  const connect = useCallback((url, token) => {
    if (wsRef.current) disconnect();

    let wsUrl = url;
    if (token) {
      const separator = url.includes('?') ? '&' : '?';
      wsUrl = `${url}${separator}token=${encodeURIComponent(token)}&page=1`;
    }

    addLog('Connecting to ' + wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Connected');
        reconnectAttemptsRef.current = 0;
        addLog('WebSocket connected successfully');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          addLog(`Failed to parse message: ${error.message}`, 'error');
        }
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('Disconnected');

        let reason = 'Unknown';
        switch(event.code) {
          case 1000: reason = 'Normal closure'; break;
          case 1001: reason = 'Going away'; break;
          case 1006: reason = 'Abnormal closure'; break;
          case 1011: reason = 'Server error'; break;
          default: reason = `Code ${event.code}`;
        }
        addLog(`WebSocket closed: ${reason}`);

        if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          addLog(`Attempting reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);
          setTimeout(() => connect(url, token), 2000 * reconnectAttemptsRef.current);
        }
      };

      wsRef.current.onerror = () => {
        addLog('WebSocket error occurred', 'error');
      };
    } catch (error) {
      addLog(`Failed to create WebSocket: ${error.message}`, 'error');
    }
  }, [addLog, handleMessage]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    reconnectAttemptsRef.current = 0;
    setStreamStatuses({});
  }, []);

  // Start stream
  const startStream = useCallback(async (streamId) => {
    addLog(`Starting stream: ${streamId}`);
    updateStreamStatus(streamId, 'connecting');

    if (!sendMessage({ type: 'stream_start', data: { stream_id: streamId } })) {
      updateStreamStatus(streamId, 'inactive');
      return;
    }

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current.set(streamId, pc);

    pc.ontrack = (event) => {
      addLog(`Received track for stream: ${streamId}`);
      const video = document.getElementById(`video-${streamId}`);
      const placeholder = document.getElementById(`placeholder-${streamId}`);
      
      if (!video || !event.streams[0]) return;

      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = event.streams[0];
      video.style.display = 'block';
      
      if (placeholder) placeholder.style.display = 'none';

      const tryPlay = () =>
        video.play().then(() => {
          addLog(`Video playing for stream: ${streamId}`);
          updateStreamStatus(streamId, 'active');
        }).catch(e => {
          addLog(`Video play error: ${e.message}`, 'error');
          updateStreamStatus(streamId, 'inactive');
        });

      if (video.readyState >= 2) tryPlay();
      else video.onloadedmetadata = tryPlay;
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice_candidate',
          data: { stream_id: streamId, candidate: event.candidate.toJSON() }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      addLog(`Connection state for ${streamId}: ${pc.connectionState}`);
      switch (pc.connectionState) {
        case 'connected': updateStreamStatus(streamId, 'active'); break;
        case 'disconnected':
        case 'failed':
          updateStreamStatus(streamId, 'inactive');
          break;
        case 'connecting': updateStreamStatus(streamId, 'connecting'); break;
      }
    };

    try {
      const tx = pc.addTransceiver('video', { direction: 'recvonly' });
      const prefs = chooseCodecs();
      if (prefs && tx.setCodecPreferences) {
        tx.setCodecPreferences(prefs);
      }

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      addLog(`Created offer for stream: ${streamId}`);

      const success = sendMessage({
        type: 'webrtc_offer',
        data: { stream_id: streamId, offer }
      });

      if (!success) {
        pc.close();
        peerConnectionsRef.current.delete(streamId);
        updateStreamStatus(streamId, 'inactive');
      }
    } catch (error) {
      addLog(`Failed to create offer: ${error.message}`, 'error');
      pc.close();
      peerConnectionsRef.current.delete(streamId);
      updateStreamStatus(streamId, 'inactive');
    }
  }, [addLog, sendMessage, updateStreamStatus, chooseCodecs]);

  // Stop stream
  const stopStream = useCallback((streamId) => {
    addLog(`Stopping stream: ${streamId}`);
    const pc = peerConnectionsRef.current.get(streamId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(streamId);
    }
    sendMessage({ type: 'stream_stop', data: { stream_id: streamId } });

    const video = document.getElementById(`video-${streamId}`);
    const placeholder = document.getElementById(`placeholder-${streamId}`);
    if (video) { 
      video.srcObject = null; 
      video.style.display = 'none'; 
    }
    if (placeholder) placeholder.style.display = 'flex';
    updateStreamStatus(streamId, 'inactive');
  }, [addLog, sendMessage, updateStreamStatus]);

  // Delete camera
  const handleDeleteCamera = async (cameraId) => {
    if (window.confirm('Are you sure you want to delete this camera?')) {
      try {
        stopStream(cameraId);
        await removeCamera(cameraId);
        addLog(`Camera ${cameraId} deleted successfully`);
      } catch (error) {
        addLog(`Failed to delete camera ${cameraId}: ${error.message}`, 'error');
      }
    }
  };

  // Toggle connection
  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(serverUrl, authToken);
    }
  };

  // Load token and fetch cameras on mount
  useEffect(() => {
    const token = localStorage.getItem('primusLiteToken');
    if (token) {
      setAuthToken(token);
      addLog('JWT token loaded from localStorage');
      fetchCameras();
    } else {
      addLog('No auth token found. Please enter manually or log in again.', 'error');
    }
  }, [addLog, fetchCameras]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="max-w-6xl mx-auto p-5">
        
        {/* Back Button */}
        <div className="mb-6 text-center">
          <button
            onClick={() => window.history.back()}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">Primus Stream Client</h1>
          <p className="text-lg">Real-time WebRTC video streaming</p>
          {CameraStreams.length > 0 && (
            <p className="text-sm mt-2 text-indigo-200">
              {CameraStreams.length} camera{CameraStreams.length !== 1 ? 's' : ''} loaded from backend
            </p>
          )}
        </div>

        {/* Connection Panel */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="font-semibold text-gray-700">{connectionStatus}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Server URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ws://localhost:8080/ws"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block font-semibold text-gray-700 mb-2">Auth Token</label>
              <input
                type="text"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Bearer token"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            
            <button
              onClick={toggleConnection}
              className={`px-6 py-3 rounded-lg font-semibold transition-all transform hover:-translate-y-1 ${
                isConnected 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {cameraError && (
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
            <strong>Error:</strong> {cameraError}
          </div>
        )}

        {/* Loading State */}
        {isLoadingCameras && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading cameras from backend...</p>
          </div>
        )}

        {/* Streams Grid */}
        {!isLoadingCameras && CameraStreams.length === 0 ? (
          <div className="text-center py-12 bg-white/95 backdrop-blur-sm rounded-2xl p-8">
            <div className="text-6xl mb-4">📹</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Cameras Added</h3>
            <p className="text-gray-600 mb-6">Add your first camera from the Dashboard to start streaming</p>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {CameraStreams.map((camera) => (
              <StreamCard
                key={camera.id}
                camera={camera}
                status={streamStatuses[camera.id] || 'inactive'}
                onStart={() => startStream(camera.id)}
                onStop={() => stopStream(camera.id)}
                onDelete={() => handleDeleteCamera(camera.id)}
              />
            ))}
          </div>
        )}

        {/* Logs Panel */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Connection Logs</h3>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              Clear
            </button>
          </div>
          
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
            {logs.map((log) => (
              <div key={log.id} className="mb-1 opacity-0 animate-fadeIn">
                <span className="text-gray-400 mr-3">[{log.timestamp}]</span>
                <span className={log.type === 'error' ? 'text-red-400' : 'text-green-400'}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s forwards;
        }
      `}</style>
    </div>
  );
};

// Stream Card Component
// const StreamCard = ({ camera, status, onStart, onStop, onDelete }) => {
//   const getStatusColor = (status) => {
//     switch (status) {
//       case 'active': return 'bg-green-100 text-green-800';
//       case 'connecting': return 'bg-yellow-100 text-yellow-800';
//       default: return 'bg-red-100 text-red-800';
//     }
//   };

//   return (
//     <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl hover:-translate-y-2 transition-transform">
//       <div className="flex justify-between items-start mb-4">
//         <div>
//           <h3 className="text-lg font-semibold text-gray-800">{camera.location_name || 'Unknown Camera'}</h3>
//           <p className="text-sm text-gray-600">{camera.ip_address}:{camera.port}</p>
//           {camera.rtsp_url && (
//             <p className="text-xs text-gray-500 mt-1 truncate max-w-[250px]" title={camera.rtsp_url}>
//               RTSP: {camera.rtsp_url}
//             </p>
//           )}
//         </div>
//         <div className="flex flex-col items-end gap-2">
//           <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(status)}`}>
//             {status}
//           </span>
//           <button
//             onClick={onDelete}
//             className="text-red-500 hover:text-red-700 text-sm underline"
//           >
//             Delete
//           </button>
//         </div>
//       </div>
      
//       <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden mb-4">
//         <video
//           id={`video-${camera.id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />
//         <div
//           id={`placeholder-${camera.id}`}
//           className="flex items-center justify-center h-full text-gray-400 text-sm text-center p-5"
//         >
//           Click "Start Stream" to begin viewing
//         </div>
//       </div>
      
//       <div className="flex flex-wrap gap-2">
//         <button
//           onClick={onStart}
//           disabled={status === 'active' || status === 'connecting'}
//           className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {status === 'connecting' ? 'Connecting...' : 'Start Stream'}
//         </button>
//         <button
//           onClick={onStop}
//           disabled={status === 'inactive'}
//           className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           Stop Stream
//         </button>
//       </div>
//     </div>
//   );
// };

export default StreamClient;






































// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom'; // ✅ ADDED FOR NAVIGATION
// // import { Link } from 'react-router-dom';

// const StreamClient = () => {
//   const navigate = useNavigate(); // ✅ FOR BACK BUTTON

//   // Connection state
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('Disconnected');
//   const [serverUrl, setServerUrl] = useState('ws://localhost:8040/ws/streams');
//   const [authToken, setAuthToken] = useState('');
  
//   // Streams state
//   const [streams, setStreams] = useState([]);
//   const [streamStatuses, setStreamStatuses] = useState({});
  
//   // Logs state
//   const [logs, setLogs] = useState([]);
  
//   // Annotation state
//   const [activeAnnotations, setActiveAnnotations] = useState(new Set());
//   const [annotations, setAnnotations] = useState(new Map());
  
//   // Refs for WebSocket and peer connections
//   const wsRef = useRef(null);
//   const peerConnectionsRef = useRef(new Map());
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 3;
  
//   // Canvas refs for annotations
//   const canvasRefs = useRef(new Map());
//   const resizeObserversRef = useRef(new Map());

//   const iceServers = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
//       { urls: 'stun:stun2.l.google.com:19302' },
//       {
//         urls: [
//           'turn:teletraan-backend.avzdax.com:3478?transport=udp',
//           'turn:teletraan-backend.avzdax.com:3478?transport=tcp'
//         ],
//         username: 'adm',
//         credential: 'Avz25'
//       }
//     ],
//     iceCandidatePoolSize: 10,
//     iceTransportPolicy: 'all',
//     bundlePolicy: 'max-bundle',
//     rtcpMuxPolicy: 'require'
//   };

//   // Logging function
//   const addLog = useCallback((message, type = 'info') => {
//     const timestamp = new Date().toLocaleTimeString();
//     setLogs(prev => [
//       ...prev.slice(-99),
//       { timestamp, message, type, id: Date.now() + Math.random() }
//     ]);
//   }, []);

//   const clearLogs = () => setLogs([]);

//   // Choose codecs function
//   const chooseCodecs = useCallback(() => {
//     const caps = RTCRtpReceiver.getCapabilities?.('video');
//     if (!caps?.codecs) return null;

//     const filtered = caps.codecs.filter(c => {
//       const mime = (c.mimeType || '').toUpperCase();
//       if (!/^VIDEO\/(VP8|H264)$/.test(mime)) return false;
//       if (mime === 'VIDEO/H264') {
//         return /packetization-mode=1/i.test(c.sdpFmtpLine || '');
//       }
//       return true;
//     });

//     const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
//     const pref = isSafari ? ['VIDEO/H264', 'VIDEO/VP8'] : ['VIDEO/VP8', 'VIDEO/H264'];

//     filtered.sort((a, b) => {
//       const A = (a.mimeType || '').toUpperCase();
//       const B = (b.mimeType || '').toUpperCase();
//       return pref.indexOf(A) - pref.indexOf(B);
//     });

//     return filtered;
//   }, []);

//   // WebSocket message handling
//   const handleMessage = useCallback(async (message) => {
//     addLog(`Received: ${message.type}`);
    
//     switch (message.type) {
//       case 'stream_list':
//         setStreams(message.data || []);
//         const meta = {
//           page: message.page ?? message.data?.page,
//           total_pages: message.total_pages ?? message.data?.total_pages,
//           total_count: message.total_count ?? message.data?.total_count,
//           note: message.message ?? message.data?.message,
//         };
//         if (typeof meta.page === 'number') {
//           const metaLine = `Streams page ${meta.page}/${meta.total_pages} • total=${meta.total_count}${meta.note ? ' • ' + meta.note : ''}`;
//           addLog(metaLine);
//         }
//         break;
        
//       case 'webrtc_answer':
//         await handleWebRTCAnswer(message);
//         break;
        
//       case 'ice_candidate':
//         await handleICECandidate(message);
//         break;
        
//       case 'success':
//         addLog(`Success: ${message.data?.message || 'Operation completed'}`);
//         break;
        
//       case 'error':
//         addLog(`Error: ${message.error}`, 'error');
//         if (message.stream_id) {
//           updateStreamStatus(message.stream_id, 'inactive');
//         }
//         break;
//     }
//   }, [addLog]);

//   // Send WebSocket message
//   const sendMessage = useCallback((message) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       try {
//         message.timestamp = new Date().toISOString();
//         const jsonMessage = JSON.stringify(message);
//         if (jsonMessage.length > 10000) {
//           addLog(`Sending large message: ${jsonMessage.length} bytes (${message.type})`);
//         }
//         wsRef.current.send(jsonMessage);
//         return true;
//       } catch (error) {
//         addLog(`Failed to send message: ${error.message}`, 'error');
//         return false;
//       }
//     } else {
//       addLog('WebSocket not connected', 'error');
//       return false;
//     }
//   }, [addLog]);

//   // Update stream status
//   const updateStreamStatus = useCallback((streamId, status) => {
//     setStreamStatuses(prev => ({
//       ...prev,
//       [streamId]: status
//     }));
//   }, []);

//   // WebRTC Answer handler
//   const handleWebRTCAnswer = useCallback(async (message) => {
//     const streamId = message.data.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         addLog(`Setting remote description for stream: ${streamId}`);
//         await pc.setRemoteDescription(message.data.answer);
//         addLog(`Successfully set remote description for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to set remote description for ${streamId}: ${error.message}`, 'error');
//         updateStreamStatus(streamId, 'inactive');
//       }
//     } else {
//       addLog(`No peer connection found for stream: ${streamId}`, 'error');
//     }
//   }, [addLog, updateStreamStatus]);

//   // ICE Candidate handler
//   const handleICECandidate = useCallback(async (message) => {
//     const streamId = message.data.stream_id || message.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         const candidate = message.data.candidate || message.data;
//         await pc.addIceCandidate(candidate);
//         addLog(`Added ICE candidate for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to add ICE candidate for ${streamId}: ${error.message}`, 'error');
//       }
//     } else {
//       addLog(`No peer connection found for ICE candidate: ${streamId}`, 'error');
//     }
//   }, [addLog]);

//   // Connect to WebSocket
//   const connect = useCallback((url, token) => {
//     if (wsRef.current) disconnect();

//     let wsUrl = url;
//     if (token) {
//       const separator = url.includes('?') ? '&' : '?';
//       wsUrl = `${url}${separator}token=${encodeURIComponent(token)}&page=1`;
//     }

//     addLog('Connecting to ' + wsUrl);
    
//     try {
//       wsRef.current = new WebSocket(wsUrl);

//       wsRef.current.onopen = () => {
//         setIsConnected(true);
//         setConnectionStatus('Connected');
//         reconnectAttemptsRef.current = 0;
//         addLog('WebSocket connected successfully');
//       };

//       wsRef.current.onmessage = (event) => {
//         try {
//           const message = JSON.parse(event.data);
//           handleMessage(message);
//         } catch (error) {
//           addLog(`Failed to parse message: ${error.message}`, 'error');
//         }
//       };

//       wsRef.current.onclose = (event) => {
//         setIsConnected(false);
//         setConnectionStatus('Disconnected');

//         let reason = 'Unknown';
//         switch(event.code) {
//           case 1000: reason = 'Normal closure'; break;
//           case 1001: reason = 'Going away'; break;
//           case 1002: reason = 'Protocol error'; break;
//           case 1003: reason = 'Unsupported data'; break;
//           case 1006: reason = 'Abnormal closure'; break;
//           case 1009: reason = 'Message too large'; break;
//           case 1011: reason = 'Server error'; break;
//           default: reason = `Code ${event.code}`;
//         }
//         addLog(`WebSocket closed: ${reason}${event.reason ? ' - ' + event.reason : ''}`);

//         if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
//           reconnectAttemptsRef.current++;
//           addLog(`Attempting reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);
//           setTimeout(() => connect(url, token), 2000 * reconnectAttemptsRef.current);
//         }
//       };

//       wsRef.current.onerror = (error) => {
//         addLog('WebSocket error occurred', 'error');
//         console.error('WebSocket error:', error);
//       };
//     } catch (error) {
//       addLog(`Failed to create WebSocket: ${error.message}`, 'error');
//     }
//   }, [addLog, handleMessage]);

//   // Disconnect WebSocket
//   const disconnect = useCallback(() => {
//     if (wsRef.current) {
//       wsRef.current.close(1000, 'Client disconnect');
//       wsRef.current = null;
//     }
    
//     peerConnectionsRef.current.forEach(pc => pc.close());
//     peerConnectionsRef.current.clear();
    
//     setIsConnected(false);
//     setConnectionStatus('Disconnected');
//     reconnectAttemptsRef.current = 0;
//     setStreams([]);
//     setStreamStatuses({});
//   }, []);

//   // Start stream
//   const startStream = useCallback(async (streamId) => {
//     addLog(`Starting stream: ${streamId}`);
//     updateStreamStatus(streamId, 'connecting');

//     if (!sendMessage({ type: 'stream_start', data: { stream_id: streamId } })) {
//       updateStreamStatus(streamId, 'inactive');
//       return;
//     }

//     const pc = new RTCPeerConnection(iceServers);
//     peerConnectionsRef.current.set(streamId, pc);

//     pc.ontrack = (event) => {
//       addLog(`Received track for stream: ${streamId}`);
//       const video = document.getElementById(`video-${streamId}`);
//       const placeholder = document.getElementById(`placeholder-${streamId}`);
      
//       if (!video || !event.streams[0]) return;

//       video.muted = true;
//       video.playsInline = true;
//       video.autoplay = true;
//       video.srcObject = event.streams[0];
//       video.style.display = 'block';
      
//       if (placeholder) placeholder.style.display = 'none';

//       const tryPlay = () =>
//         video.play().then(() => {
//           addLog(`Video playing for stream: ${streamId}`);
//           updateStreamStatus(streamId, 'active');
//         }).catch(e => {
//           addLog(`Video play error: ${e.message}`, 'error');
//           updateStreamStatus(streamId, 'inactive');
//         });

//       if (video.readyState >= 2) tryPlay();
//       else video.onloadedmetadata = tryPlay;
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         sendMessage({
//           type: 'ice_candidate',
//           data: { stream_id: streamId, candidate: event.candidate.toJSON() }
//         });
//         addLog(`Sent ICE candidate for ${streamId}: ${event.candidate.type}`);
//       } else {
//         addLog(`ICE gathering complete for ${streamId}`);
//       }
//     };

//     pc.onicegatheringstatechange = () => {
//       addLog(`ICE gathering state for ${streamId}: ${pc.iceGatheringState}`);
//     };

//     pc.onconnectionstatechange = () => {
//       addLog(`Connection state for ${streamId}: ${pc.connectionState}`);
//       switch (pc.connectionState) {
//         case 'connected': updateStreamStatus(streamId, 'active'); break;
//         case 'disconnected':
//         case 'failed':
//           addLog(`Connection ${pc.connectionState} for ${streamId}`, 'error');
//           updateStreamStatus(streamId, 'inactive');
//           break;
//         case 'connecting': updateStreamStatus(streamId, 'connecting'); break;
//       }
//     };

//     pc.oniceconnectionstatechange = () => {
//       addLog(`ICE connection state for ${streamId}: ${pc.iceConnectionState}`);
//       if (pc.iceConnectionState === 'failed' && iceServers.iceTransportPolicy !== 'relay') {
//         addLog('Retrying with TURN-only (relay) due to ICE failure');
//         stopStream(streamId);
//         const prev = iceServers.iceTransportPolicy;
//         iceServers.iceTransportPolicy = 'relay';
//         startStream(streamId);
//         iceServers.iceTransportPolicy = prev;
//       }
//     };

//     try {
//       const tx = pc.addTransceiver('video', { direction: 'recvonly' });
//       const prefs = chooseCodecs();
//       if (prefs && tx.setCodecPreferences) {
//         tx.setCodecPreferences(prefs);
//         addLog(`Applied codec preferences: ${prefs.map(c => c.mimeType).join(', ')}`);
//       }

//       const offer = await pc.createOffer({});
//       await pc.setLocalDescription(offer);
//       addLog(`Created offer for stream: ${streamId} (${offer.sdp.length} chars)`);

//       const success = sendMessage({
//         type: 'webrtc_offer',
//         data: { stream_id: streamId, offer }
//       });

//       if (!success) {
//         addLog(`Failed to send offer for ${streamId}`, 'error');
//         pc.close();
//         peerConnectionsRef.current.delete(streamId);
//         updateStreamStatus(streamId, 'inactive');
//         return;
//       }
//     } catch (error) {
//       addLog(`Failed to create offer: ${error.message}`, 'error');
//       pc.close();
//       peerConnectionsRef.current.delete(streamId);
//       updateStreamStatus(streamId, 'inactive');
//     }
//   }, [addLog, sendMessage, updateStreamStatus, chooseCodecs]);

//   // Stop stream
//   const stopStream = useCallback((streamId) => {
//     addLog(`Stopping stream: ${streamId}`);
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       pc.close();
//       peerConnectionsRef.current.delete(streamId);
//     }
//     sendMessage({ type: 'stream_stop', data: { stream_id: streamId } });

//     const video = document.getElementById(`video-${streamId}`);
//     const placeholder = document.getElementById(`placeholder-${streamId}`);
//     if (video) { 
//       video.srcObject = null; 
//       video.style.display = 'none'; 
//     }
//     if (placeholder) placeholder.style.display = 'flex';
//     updateStreamStatus(streamId, 'inactive');
//   }, [addLog, sendMessage, updateStreamStatus]);

//   // Toggle connection
//   const toggleConnection = () => {
//     if (isConnected) {
//       disconnect();
//     } else {
//       connect(serverUrl, authToken);
//     }
//   };

//   // Annotation toggle
//   const toggleAnnotate = useCallback((streamId) => {
//     setActiveAnnotations(prev => {
//       const newSet = new Set(prev);
//       if (newSet.has(streamId)) {
//         newSet.delete(streamId);
//       } else {
//         newSet.add(streamId);
//       }
//       return newSet;
//     });
//   }, []);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       disconnect();
//       resizeObserversRef.current.forEach(observer => observer.disconnect());
//     };
//   }, [disconnect]);

//   // ✅ Load token from localStorage on mount
//   useEffect(() => {
//     const token = localStorage.getItem('primusLiteToken');
//     if (token) {
//       setAuthToken(token);
//       addLog('✅ JWT token loaded from localStorage');
      
//       // ⚠️ Optional: Auto-connect if you want (commented out for safety)
//       // setTimeout(() => {
//       //   connect(serverUrl, token);
//       // }, 1000);
//     } else {
//       addLog('⚠️ No auth token found. Please enter manually or log in again.');
//     }
//   }, [addLog]);

//   // Initialize
//   useEffect(() => {
//     addLog('Stream client loaded. Ready to connect.');
//   }, [addLog]);

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600">
//       <div className="max-w-6xl mx-auto p-5">
        
//         {/* ✅ Back Button */}
//         <div className="mb-6 text-center">
//           <button
//             onClick={() => navigate('/dashboard')}
//             className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
//           >
//             ← Back to Dashboard
//           </button>
//         </div>

//         {/* Header */}
//         <div className="text-center mb-8 text-white">
//           <h1 className="text-4xl font-bold mb-2">🎥 Primus Stream Client</h1>
//           <p className="text-lg">Real-time WebRTC video streaming</p>
//         </div>

//         {/* Connection Panel */}
//         <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 mb-8 shadow-xl">
//           <div className="flex items-center gap-4 mb-6">
//             <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
//             <span className="font-semibold text-gray-700">{connectionStatus}</span>
//           </div>
          
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
//             <div>
//               <label className="block font-semibold text-gray-700 mb-2">Server URL</label>
//               <input
//                 type="text"
//                 value={serverUrl}
//                 onChange={(e) => setServerUrl(e.target.value)}
//                 placeholder="ws://localhost:8080/ws"
//                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
//               />
//             </div>
            
//             <div>
//               <label className="block font-semibold text-gray-700 mb-2">Auth Token</label>
//               <input
//                 type="text"
//                 value={authToken}
//                 onChange={(e) => setAuthToken(e.target.value)}
//                 placeholder="Bearer token"
//                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none transition-colors"
//               />
//             </div>
            
//             <button
//               onClick={toggleConnection}
//               className={`px-6 py-3 rounded-lg font-semibold transition-all transform hover:-translate-y-1 ${
//                 isConnected 
//                   ? 'bg-red-500 hover:bg-red-600 text-white' 
//                   : 'bg-indigo-500 hover:bg-indigo-600 text-white'
//               }`}
//             >
//               {isConnected ? 'Disconnect' : 'Connect'}
//             </button>
//           </div>
//         </div>

//         {/* Streams Grid */}
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
//           {streams.map((stream) => (
//             <StreamCard
//               key={stream.stream_id}
//               stream={stream}
//               status={streamStatuses[stream.stream_id] || 'inactive'}
//               onStart={() => startStream(stream.stream_id)}
//               onStop={() => stopStream(stream.stream_id)}
//               onToggleAnnotate={() => toggleAnnotate(stream.stream_id)}
//               isAnnotating={activeAnnotations.has(stream.stream_id)}
//             />
//           ))}
//         </div>

//         {/* Logs Panel */}
//         <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
//           <div className="flex justify-between items-center mb-4">
//             <h3 className="text-xl font-semibold text-gray-800">Connection Logs</h3>
//             <button
//               onClick={clearLogs}
//               className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
//             >
//               Clear
//             </button>
//           </div>
          
//           <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
//             {logs.map((log) => (
//               <div key={log.id} className="mb-1 opacity-0 animate-fadeIn">
//                 <span className="text-gray-400 mr-3">[{log.timestamp}]</span>
//                 <span className={log.type === 'error' ? 'text-red-400' : 'text-green-400'}>
//                   {log.message}
//                 </span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
      
//       <style jsx>{`
//         @keyframes fadeIn {
//           to { opacity: 1; }
//         }
//         .animate-fadeIn {
//           animation: fadeIn 0.3s forwards;
//         }
//       `}</style>
//     </div>
//   );
// };

// // Stream Card Component
// const StreamCard = ({ stream, status, onStart, onStop, onToggleAnnotate, isAnnotating }) => {
//   const getStatusColor = (status) => {
//     switch (status) {
//       case 'active': return 'bg-green-100 text-green-800';
//       case 'connecting': return 'bg-yellow-100 text-yellow-800';
//       default: return 'bg-red-100 text-red-800';
//     }
//   };

//   return (
//     <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl hover:-translate-y-2 transition-transform">
//       <div className="flex justify-between items-center mb-4">
//         <h3 className="text-lg font-semibold text-gray-800">{stream.name || 'Camera Stream'}</h3>
//         <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(status)}`}>
//           {status}
//         </span>
//       </div>
      
//       <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden mb-4">
//         <video
//           id={`video-${stream.stream_id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />
//         <div
//           id={`placeholder-${stream.stream_id}`}
//           className="flex items-center justify-center h-full text-gray-400 text-sm text-center p-5"
//         >
//           Click "Start Stream" to begin viewing
//         </div>
//       </div>
      
//       <div className="flex flex-wrap gap-2">
//         <button
//           onClick={onStart}
//           className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-semibold"
//         >
//           Start Stream
//         </button>
//         <button
//           onClick={onStop}
//           className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
//         >
//           Stop Stream
//         </button>
//         <button
//           onClick={onToggleAnnotate}
//           className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
//         >
//           {isAnnotating ? 'Exit Annotate' : 'Annotate'}
//         </button>
//       </div>
//     </div>
//   );
// };

// export default StreamClient;