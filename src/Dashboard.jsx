import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from './store/camera-store';
import { useEventStore } from './store/history-store';
import Header from './Header';
import LogoLoader from './LogoLoader';
import CameraCard from './CameraCard';
import PopupModal from './PopupModal';
import WelcomePopup from './components/WelcomePopup';
import useLoadingStore from './store/loading-store';

export default function Dashboard() {
  const [showMain, setShowMain] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(() => !localStorage.getItem('hasSeenWelcome'));
  const { showLoading, hideLoading } = useLoadingStore();

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const [serverUrl] = useState('wss://teletraan-backend.avzdax.com/stream/ws/streams');
  const wsRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // Stream status tracking
  const [streamStatuses, setStreamStatuses] = useState({});
  const [logs, setLogs] = useState([]);

  // Camera store
  const {
    CameraStreams,
    isLoading: isLoadingCameras,
    error: cameraError,
    clearCameraStreams,
    clearError,
    setCameraStreams,
    fetchCameras,
    addCamera
  } = useCameraStore();

  const { addEvent } = useEventStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
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
    console.log(`[${timestamp}] ${message}`);
  }, []);

  // Update stream status
  const updateStreamStatus = useCallback((streamId, status) => {
    setStreamStatuses(prev => ({
      ...prev,
      [streamId]: status
    }));
  }, []);

  // Choose codecs
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

  // Send WebSocket message
  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        message.timestamp = new Date().toISOString();
        wsRef.current.send(JSON.stringify(message));
        addLog(`📤 Sent message: ${message.type}`, 'info');
        return true;
      } catch (error) {
        addLog(`❌ Failed to send message: ${error.message}`, 'error');
        return false;
      }
    }
    addLog('❌ WebSocket not connected', 'error');
    return false;
  }, [addLog]);

  // Handle WebRTC Answer - ENHANCED VERSION
  const handleWebRTCAnswer = useCallback(async (message) => {
    const streamId = message.data.stream_id;
    const pc = peerConnectionsRef.current.get(streamId);
    
    if (!pc) {
      addLog(`❌ No peer connection found for stream: ${streamId}`, 'error');
      return;
    }

    if (!message.data.answer) {
      addLog(`❌ No answer in WebRTC answer message for ${streamId}`, 'error');
      updateStreamStatus(streamId, 'inactive');
      return;
    }

    try {
      addLog(`📥 Received WebRTC answer for stream: ${streamId}`, 'info');
      addLog(`   Answer type: ${message.data.answer.type}`, 'info');
      
      await pc.setRemoteDescription(message.data.answer);
      addLog(`✅ Set remote description for stream: ${streamId}`, 'info');
      addLog(`   Remote description type: ${pc.remoteDescription.type}`, 'info');
      
    } catch (error) {
      addLog(`❌ Failed to set remote description: ${error.message}`, 'error');
      updateStreamStatus(streamId, 'inactive');
      alert(`WebRTC connection failed for camera ${streamId}: ${error.message}`);
    }
  }, [addLog, updateStreamStatus]);

  // Handle ICE Candidate
  const handleICECandidate = useCallback(async (message) => {
    const streamId = message.data.stream_id || message.stream_id;
    const pc = peerConnectionsRef.current.get(streamId);
    if (pc) {
      try {
        await pc.addIceCandidate(message.data.candidate || message.data);
        addLog(`🧊 Added ICE candidate for stream: ${streamId}`, 'info');
      } catch (error) {
        addLog(`❌ Failed to add ICE candidate: ${error.message}`, 'error');
      }
    }
  }, [addLog]);

  // Handle stream list from WebSocket
  const handleStreamList = useCallback((message) => {
    addLog(`📋 Received stream list with ${message.data?.length || 0} streams`, 'info');
    
    if (!message.data || !Array.isArray(message.data)) {
      addLog('❌ Invalid stream list data', 'error');
      return;
    }

    // Transform WebSocket stream list to match camera store format
    const wsStreams = message.data.map(stream => {
      const streamId = stream.stream_id || stream.id || stream._id || `ws_${Date.now()}_${Math.random()}`;
      const cameraName = stream.camera_name || stream.location_name || stream.name || 'Unknown Camera';
      const rtspUrl = stream.rtsp_url || stream.stream_url || '';

      addLog(`   📹 ${cameraName} (${streamId}) - RTSP: ${rtspUrl ? '✓' : '✗'}`, 'info');

      return {
        id: streamId,
        location_name: cameraName,
        ip_address: stream.ip_address || '',
        port: stream.port || '554',
        username: stream.username || 'admin',
        password: stream.password || '',
        extra_path: stream.extra_path || stream.path || '',
        rtsp_url: rtspUrl,
        created_at: stream.created_at || new Date().toISOString(),
        updated_at: stream.updated_at || new Date().toISOString(),
        status: stream.status || 'inactive',
        camera_name: cameraName,
        streamUrl: rtspUrl,
        date: stream.created_at ? new Date(stream.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: stream.created_at ? new Date(stream.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        threatLevel: stream.threat_level || 'Low',
        zoneCategory: stream.zone_category || 'Default'
      };
    });

    addLog(`✅ Processed ${wsStreams.length} cameras from WebSocket`, 'info');

    // Merge with existing cameras from backend
    setCameraStreams(prev => {
      const existingIds = new Set(prev.map(cam => cam.id));
      const newCameras = wsStreams.filter(cam => !existingIds.has(cam.id));
      
      if (newCameras.length > 0) {
        addLog(`➕ Adding ${newCameras.length} new cameras from WebSocket`, 'info');
        return [...prev, ...newCameras];
      }
      
      // Update existing cameras with fresh data
      const updated = prev.map(existingCam => {
        const wsCam = wsStreams.find(ws => ws.id === existingCam.id);
        if (wsCam) {
          return { ...existingCam, ...wsCam };
        }
        return existingCam;
      });
      
      return updated;
    });
  }, [addLog, setCameraStreams]);

  // Handle WebSocket messages
  const handleMessage = useCallback(async (message) => {
    addLog(`📨 Received: ${message.type}`, 'info');
    
    switch (message.type) {
      case 'stream_list':
        handleStreamList(message);
        break;
      case 'webrtc_answer':
        await handleWebRTCAnswer(message);
        break;
      case 'ice_candidate':
        await handleICECandidate(message);
        break;
      case 'success':
        addLog(`✅ Success: ${message.data?.message || 'Operation completed'}`, 'info');
        break;
      case 'error':
        addLog(`❌ Error: ${message.error}`, 'error');
        if (message.stream_id) {
          updateStreamStatus(message.stream_id, 'inactive');
        }
        break;
      default:
        addLog(`⚠️ Unknown message type: ${message.type}`, 'error');
    }
  }, [addLog, handleStreamList, handleWebRTCAnswer, handleICECandidate, updateStreamStatus]);

  // Request stream list from WebSocket
  const requestStreamList = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLog('📋 Requesting stream list from WebSocket...', 'info');
      sendMessage({ type: 'get_streams' });
      return true;
    }
    addLog('❌ Cannot request streams - WebSocket not connected', 'error');
    return false;
  }, [addLog, sendMessage]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((token) => {
    // Check if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addLog('✅ WebSocket already connected', 'info');
      setTimeout(() => requestStreamList(), 500);
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!token) {
      addLog('❌ No auth token available', 'error');
      return;
    }

    let wsUrl = serverUrl;
    const separator = serverUrl.includes('?') ? '&' : '?';
    wsUrl = `${serverUrl}${separator}token=${encodeURIComponent(token)}`;

    addLog('🔌 Connecting to WebSocket...', 'info');
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
        addLog('✅ WebSocket connected successfully', 'info');
        
        // Request stream list after successful connection
        setTimeout(() => requestStreamList(), 1000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          addLog(`❌ Failed to parse message: ${error.message}`, 'error');
        }
      };

      wsRef.current.onclose = (event) => {
        setWsConnected(false);
        wsRef.current = null;
        addLog(`🔌 WebSocket closed: ${event.code} - ${event.reason || 'No reason provided'}`, 'error');

        if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          addLog(`🔄 Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`, 'info');
          setTimeout(() => connectWebSocket(token), 2000 * reconnectAttemptsRef.current);
        }
      };

      wsRef.current.onerror = (error) => {
        addLog('❌ WebSocket error occurred', 'error');
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      addLog(`❌ Failed to create WebSocket: ${error.message}`, 'error');
    }
  }, [serverUrl, addLog, handleMessage, requestStreamList]);

  // Stop streaming
  const stopStream = useCallback((cameraId) => {
    addLog(`⏹️ Stopping stream for camera: ${cameraId}`, 'info');
    const pc = peerConnectionsRef.current.get(cameraId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(cameraId);
    }
    sendMessage({ type: 'stream_stop', data: { stream_id: cameraId } });

    const video = document.getElementById(`video-${cameraId}`);
    const placeholder = document.getElementById(`placeholder-${cameraId}`);
    if (video) {
      video.srcObject = null;
      video.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    updateStreamStatus(cameraId, 'inactive');
  }, [addLog, sendMessage, updateStreamStatus]);

  // Start streaming - ENHANCED VERSION
  const startStream = useCallback(async (cameraId, rtspUrl) => {
    // CRITICAL VALIDATION
    if (!rtspUrl || rtspUrl.trim() === '') {
      addLog(`❌ ERROR: No RTSP URL provided for camera ${cameraId}`, 'error');
      alert(`Cannot start stream: Camera ${cameraId} has no RTSP URL configured!\n\nPlease check the camera configuration.`);
      updateStreamStatus(cameraId, 'inactive');
      return;
    }

    addLog(`🎥 Starting stream for camera: ${cameraId}`, 'info');
    addLog(`📡 RTSP URL (masked): ${rtspUrl.replace(/:[^:@]+@/, ':****@')}`, 'info');
    
    // Check WebSocket connection first
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('❌ WebSocket not connected. Attempting to reconnect...', 'error');
      const token = localStorage.getItem('primusLiteToken');
      if (token) {
        connectWebSocket(token);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        updateStreamStatus(cameraId, 'inactive');
        alert('Cannot start stream: WebSocket not connected. Please refresh the page and try again.');
        return;
      }
    }

    updateStreamStatus(cameraId, 'connecting');

    // Send stream_start message with RTSP URL
    const streamStartMessage = {
      type: 'stream_start',
      data: {
        stream_id: cameraId,
        rtsp_url: rtspUrl // CRITICAL: Must include valid RTSP URL
      }
    };

    addLog(`📤 Sending stream_start message:`, 'info');
    addLog(`   Stream ID: ${cameraId}`, 'info');
    addLog(`   RTSP URL: ${rtspUrl.replace(/:[^:@]+@/, ':****@')}`, 'info');

    if (!sendMessage(streamStartMessage)) {
      updateStreamStatus(cameraId, 'inactive');
      alert('Failed to send stream start command. Please try again.');
      return;
    }

    // Create WebRTC peer connection
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current.set(cameraId, pc);

    // Handle incoming video track
    pc.ontrack = (event) => {
      addLog(`✅ Received track for camera: ${cameraId}`, 'info');
      addLog(`   Track kind: ${event.track.kind}`, 'info');
      addLog(`   Track readyState: ${event.track.readyState}`, 'info');
      
      const video = document.getElementById(`video-${cameraId}`);
      const placeholder = document.getElementById(`placeholder-${cameraId}`);
      
      if (!video) {
        addLog(`❌ Video element not found: video-${cameraId}`, 'error');
        return;
      }

      if (!event.streams || event.streams.length === 0) {
        addLog(`❌ No streams in track event`, 'error');
        return;
      }

      const stream = event.streams[0];
      addLog(`📺 Setting video srcObject. Stream active: ${stream.active}, tracks: ${stream.getTracks().length}`, 'info');

      video.srcObject = stream;
      video.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';

      // Play the video
      video.play()
        .then(() => {
          addLog(`✅ Video playing for camera: ${cameraId}`, 'info');
          updateStreamStatus(cameraId, 'active');
          
          // Log video stats after 2 seconds
          setTimeout(() => {
            addLog(`📊 Video stats: ${video.videoWidth}x${video.videoHeight}, paused: ${video.paused}`, 'info');
          }, 2000);
        })
        .catch(e => {
          addLog(`❌ Video play error: ${e.message}`, 'error');
          updateStreamStatus(cameraId, 'inactive');
        });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addLog(`🧊 Sending ICE candidate for ${cameraId}`, 'info');
        sendMessage({
          type: 'ice_candidate',
          data: {
            stream_id: cameraId,
            candidate: event.candidate.toJSON()
          }
        });
      } else {
        addLog(`✅ ICE gathering complete for ${cameraId}`, 'info');
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      addLog(`🔌 Connection state for ${cameraId}: ${state}`, 'info');
      
      switch (state) {
        case 'connected':
          addLog(`✅ WebRTC connected for ${cameraId}`, 'info');
          updateStreamStatus(cameraId, 'active');
          break;
        case 'disconnected':
          addLog(`⚠️ WebRTC disconnected for ${cameraId}`, 'error');
          updateStreamStatus(cameraId, 'inactive');
          break;
        case 'failed':
          addLog(`❌ WebRTC connection failed for ${cameraId}`, 'error');
          updateStreamStatus(cameraId, 'inactive');
          break;
        case 'connecting':
          updateStreamStatus(cameraId, 'connecting');
          break;
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      addLog(`🧊 ICE connection state for ${cameraId}: ${pc.iceConnectionState}`, 'info');
    };

    // Monitor signaling state
    pc.onsignalingstatechange = () => {
      addLog(`📡 Signaling state for ${cameraId}: ${pc.signalingState}`, 'info');
    };

    try {
      // Add video transceiver
      const tx = pc.addTransceiver('video', { direction: 'recvonly' });
      addLog(`➕ Added video transceiver (recvonly)`, 'info');
      
      // Set codec preferences
      const prefs = chooseCodecs();
      if (prefs && tx.setCodecPreferences) {
        tx.setCodecPreferences(prefs);
        addLog(`🎬 Set codec preferences: ${prefs.map(c => c.mimeType).join(', ')}`, 'info');
      }

      // Create and set local offer
      const offer = await pc.createOffer({});
      addLog(`📝 Created WebRTC offer for ${cameraId}`, 'info');
      
      await pc.setLocalDescription(offer);
      addLog(`✅ Set local description for ${cameraId}`, 'info');

      // Send offer to server
      const offerMessage = {
        type: 'webrtc_offer',
        data: {
          stream_id: cameraId,
          offer: offer
        }
      };

      addLog(`📤 Sending WebRTC offer to server`, 'info');
      const success = sendMessage(offerMessage);

      if (!success) {
        addLog(`❌ Failed to send WebRTC offer`, 'error');
        pc.close();
        peerConnectionsRef.current.delete(cameraId);
        updateStreamStatus(cameraId, 'inactive');
        alert('Failed to establish WebRTC connection. Please try again.');
      } else {
        addLog(`✅ WebRTC offer sent successfully. Waiting for answer...`, 'info');
        
        // Set a timeout for receiving answer
        setTimeout(() => {
          if (pc.signalingState === 'have-local-offer') {
            addLog(`⏰ Timeout waiting for WebRTC answer for ${cameraId}`, 'error');
            alert(`Stream connection timeout for camera ${cameraId}.\n\nPossible issues:\n1. RTSP URL is incorrect\n2. Camera is not accessible\n3. Network issues\n4. Streaming server error`);
            stopStream(cameraId);
          }
        }, 15000); // 15 second timeout
      }
    } catch (error) {
      addLog(`❌ Failed to create WebRTC offer: ${error.message}`, 'error');
      pc.close();
      peerConnectionsRef.current.delete(cameraId);
      updateStreamStatus(cameraId, 'inactive');
      alert(`Failed to start stream: ${error.message}`);
    }
  }, [addLog, sendMessage, updateStreamStatus, chooseCodecs, connectWebSocket, stopStream, iceServers]);

  // Initialize on mount
  useEffect(() => {
    showLoading();
    const timer = setTimeout(() => {
      hideLoading();
      setShowMain(true);
    }, 3000);

    const initializeDashboard = async () => {
      const token = localStorage.getItem('primusLiteToken');
      if (token) {
        addLog('🔑 Auth token loaded from localStorage', 'info');
        
        // First, fetch cameras from backend
        try {
          addLog('📡 Fetching cameras from backend...', 'info');
          await fetchCameras();
          addLog('✅ Fetched cameras from backend', 'info');
        } catch (error) {
          addLog(`❌ Failed to fetch cameras from backend: ${error.message}`, 'error');
        }
        
        // Then connect to WebSocket and request stream list
        connectWebSocket(token);
      } else {
        addLog('❌ No auth token found', 'error');
      }
    };

    initializeDashboard();

    return () => {
      clearTimeout(timer);
      if (wsRef.current) {
        wsRef.current.close();
      }
      peerConnectionsRef.current.forEach(pc => pc.close());
    };
  }, [showLoading, hideLoading, addLog, connectWebSocket, fetchCameras]);

  // Handle modal save with proper backend integration
  const handleModalSave = async (cameraData) => {
    try {
      console.log("📝 Received camera data from PopupModal:", cameraData);

      // Validate required fields
      if (!cameraData.location_name || !cameraData.ip_address || !cameraData.username || !cameraData.password) {
        throw new Error("Missing required camera fields. Please fill in all required information.");
      }

      addLog(`➕ Adding new camera: ${cameraData.location_name}`, 'info');

      // Use the store's addCamera method which calls the backend
      await addCamera(cameraData);

      addLog(`✅ Camera "${cameraData.location_name}" added successfully`, 'info');

      // Add event to history
      addEvent({
        camera_name: cameraData.location_name,
        zone_name: "Default",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        streamUrl: cameraData.rtsp_url,
        type: "ADDED",
        timestamp: new Date().toISOString(),
        description: `Camera "${cameraData.location_name}" added successfully`
      });

      setIsModalOpen(false);
      
      // Refresh stream list from WebSocket after adding camera
      setTimeout(() => {
        addLog('🔄 Refreshing stream list after camera addition...', 'info');
        requestStreamList();
      }, 1000);
      
      alert(`✅ Camera "${cameraData.location_name}" has been added successfully!\n\nClick the "Stream" button to start viewing.`);

    } catch (error) {
      console.error("❌ Failed to add camera:", error);
      addLog(`❌ Failed to add camera: ${error.message}`, 'error');
      alert(`Failed to add camera: ${error.message || "Unknown error"}\n\nPlease check the console for more details.`);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("⚠️ Are you sure you want to delete all cameras?\n\nThis action cannot be undone.")) {
      try {
        addLog('🗑️ Clearing all cameras...', 'info');
        
        // Stop all active streams first
        CameraStreams.forEach(camera => {
          if (streamStatuses[camera.id] === 'active') {
            stopStream(camera.id);
          }
        });
        
        await clearCameraStreams();
        
        addEvent({
          type: "BULK_DELETE",
          timestamp: new Date().toISOString(),
          description: "All cameras cleared from system",
        });
        
        addLog('✅ All cameras deleted successfully', 'info');
        
        // Refresh stream list from WebSocket
        setTimeout(() => {
          requestStreamList();
        }, 1000);
        
        alert("✅ All cameras have been deleted successfully!");
      } catch (error) {
        console.error("❌ Error clearing cameras:", error);
        addLog(`❌ Error clearing cameras: ${error.message}`, 'error');
        alert("❌ Some cameras could not be deleted. Please try again.");
      }
    }
  };

  const filteredCameras = (CameraStreams || []).filter(camera => {
    if (!camera || !camera.location_name) return false;
    return camera.location_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <>
      {showWelcomePopup && (
        <WelcomePopup
          onClose={() => {
            localStorage.setItem('hasSeenWelcome', 'true');
            setShowWelcomePopup(false);
          }}
        />
      )}
      <Header />
      <LogoLoader />
      {isModalOpen && (
        <PopupModal
          onSave={handleModalSave}
          onCancel={() => setIsModalOpen(false)}
        />
      )}

      {showMain && (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
            <div className="mb-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                    Security Cameras with Live Streaming
                  </h1>
                  <p className="text-gray-400 mt-3 text-lg">
                    Real-time WebRTC video monitoring system
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                    <span className="text-sm text-gray-400">
                      WebSocket: {wsConnected ? '✅ Connected' : '❌ Disconnected'}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({CameraStreams.length} cameras available)
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWelcomePopup(true)}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <i className="fa-solid fa-sparkles text-lg"></i>
                    <span className="font-semibold">Welcome Guide</span>
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <i className="fa-solid fa-plus text-lg"></i>
                    <span className="font-semibold">Add Camera</span>
                  </button>
                  <button
                    onClick={requestStreamList}
                    disabled={!wsConnected}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={wsConnected ? "Refresh stream list" : "WebSocket disconnected"}
                  >
                    <i className="fa-solid fa-rotate text-lg"></i>
                    <span className="font-semibold">Refresh Streams</span>
                  </button>
                </div>
              </div>
            </div>

            {cameraError && (
              <div className="mb-8 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl"></i>
                  <p className="text-red-300">{cameraError}</p>
                  <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
                    <i className="fa-solid fa-times text-lg"></i>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="🔍 Search cameras by location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white placeholder-gray-400 border border-slate-600/50 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
                <button
                  onClick={handleClearAll}
                  disabled={!CameraStreams || CameraStreams.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                  title={CameraStreams.length > 0 ? "Delete all cameras" : "No cameras to delete"}
                >
                  <i className="fa-solid fa-trash mr-2"></i>
                  Clear All
                </button>
              </div>
              {searchTerm && (
                <p className="text-sm text-gray-400 mt-3">
                  Found {filteredCameras.length} of {CameraStreams.length} cameras
                </p>
              )}
            </div>

            {/* Debug Logs Panel (collapsible) */}
            {logs.length > 0 && (
              <div className="mb-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <details className="group">
                  <summary className="cursor-pointer px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <i className="fa-solid fa-terminal text-cyan-400"></i>
                      <span className="text-white font-semibold">Debug Logs</span>
                      <span className="text-xs text-gray-500">({logs.length} messages)</span>
                    </div>
                    <i className="fa-solid fa-chevron-down text-gray-400 group-open:rotate-180 transition-transform"></i>
                  </summary>
                  <div className="px-6 py-4 max-h-96 overflow-y-auto bg-slate-900/50">
                    <div className="space-y-1 font-mono text-xs">
                      {logs.slice(-50).map(log => (
                        <div 
                          key={log.id} 
                          className={`flex gap-3 ${
                            log.type === 'error' ? 'text-red-400' : 
                            log.type === 'info' ? 'text-cyan-300' : 
                            'text-gray-400'
                          }`}
                        >
                          <span className="text-gray-500">[{log.timestamp}]</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Loading State */}
            {isLoadingCameras && (
              <div className="text-center py-24">
                <div className="w-32 h-32 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl animate-pulse">
                  <i className="fa-solid fa-spinner fa-spin text-white text-5xl"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-6">Loading Cameras...</h2>
                <p className="text-gray-400">Please wait while we fetch your camera streams</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingCameras && filteredCameras.length === 0 && CameraStreams.length === 0 && (
              <div className="text-center py-24">
                <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
                  <i className="fa-solid fa-video text-slate-400 text-5xl"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-6">No Cameras Connected</h2>
                <p className="text-gray-400 mb-8">Add your first camera to start monitoring</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-10 py-5 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <i className="fa-solid fa-plus mr-3"></i>
                  Add Your First Camera
                </button>
                {wsConnected && (
                  <p className="text-sm text-gray-500 mt-6">
                    WebSocket connected • Ready to stream
                  </p>
                )}
              </div>
            )}

            {/* No Search Results */}
            {!isLoadingCameras && filteredCameras.length === 0 && CameraStreams.length > 0 && (
              <div className="text-center py-24">
                <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
                  <i className="fa-solid fa-search text-slate-400 text-5xl"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-6">No Cameras Found</h2>
                <p className="text-gray-400 mb-8">
                  No cameras match "{searchTerm}"
                </p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300"
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* Camera Grid */}
            {!isLoadingCameras && filteredCameras.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    Available Cameras ({filteredCameras.length})
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      <span>{filteredCameras.filter(c => streamStatuses[c.id] === 'active').length} Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      <span>{filteredCameras.filter(c => streamStatuses[c.id] === 'connecting').length} Connecting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span>{filteredCameras.filter(c => !streamStatuses[c.id] || streamStatuses[c.id] === 'inactive').length} Inactive</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredCameras.map((camera) => (
                    <CameraCard
                      key={camera.id}
                      id={camera.id}
                      camera_name={camera.location_name}
                      location_name={camera.location_name}
                      date={camera.date}
                      time={camera.time}
                      threatLevel={camera.threatLevel || 'Low'}
                      zoneCategory={camera.zoneCategory || 'Default'}
                      rtsp_url={camera.rtsp_url}
                      streamUrl={camera.rtsp_url}
                      streamStatus={streamStatuses[camera.id] || 'inactive'}
                      onStartStream={() => {
                        console.log(`🎬 Dashboard: Starting stream for ${camera.location_name} (${camera.id})`);
                        console.log(`   RTSP URL: ${camera.rtsp_url ? camera.rtsp_url.replace(/:[^:@]+@/, ':****@') : 'MISSING'}`);
                        startStream(camera.id, camera.rtsp_url);
                      }}
                      onStopStream={() => {
                        console.log(`⏹️ Dashboard: Stopping stream for ${camera.location_name} (${camera.id})`);
                        stopStream(camera.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* WebSocket Status Indicator (floating) */}
          <div className="fixed bottom-6 right-6 z-40">
            <div className={`px-4 py-2 rounded-xl backdrop-blur-md border shadow-lg transition-all duration-300 ${
              wsConnected 
                ? 'bg-green-500/20 border-green-500/50 text-green-300' 
                : 'bg-red-500/20 border-red-500/50 text-red-300'
            }`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <span>{wsConnected ? 'WebSocket Active' : 'WebSocket Down'}</span>
                {!wsConnected && (
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('primusLiteToken');
                      if (token) connectWebSocket(token);
                    }}
                    className="ml-2 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
































// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from './store/history-store';
// import Header from './Header';
// import LogoLoader from './LogoLoader';
// import CameraCard from './CameraCard';
// import PopupModal from './PopupModal';
// import useLoadingStore from './store/loading-store';

// export default function Dashboard() {
//   const [showMain, setShowMain] = useState(false);
//   const { showLoading, hideLoading } = useLoadingStore();

//   // WebSocket state
//   const [wsConnected, setWsConnected] = useState(false);
//   const [serverUrl] = useState('wss://teletraan-backend.avzdax.com/stream/ws/streams');
//   const wsRef = useRef(null);
//   const peerConnectionsRef = useRef(new Map());
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 3;

//   // Stream status tracking
//   const [streamStatuses, setStreamStatuses] = useState({});
//   const [logs, setLogs] = useState([]);

//   // Camera store
//   const {
//     CameraStreams,
//     isLoading: isLoadingCameras,
//     error: cameraError,
//     clearCameraStreams,
//     clearError,
//     setCameraStreams,
//     fetchCameras,
//     addCamera
//   } = useCameraStore();

//   const { addEvent } = useEventStore();
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');

//   // ICE servers configuration
//   const iceServers = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
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
//     console.log(`[${timestamp}] ${message}`);
//   }, []);

//   // Update stream status
//   const updateStreamStatus = useCallback((streamId, status) => {
//     setStreamStatuses(prev => ({
//       ...prev,
//       [streamId]: status
//     }));
//   }, []);

//   // Choose codecs
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

//   // Send WebSocket message
//   const sendMessage = useCallback((message) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       try {
//         message.timestamp = new Date().toISOString();
//         wsRef.current.send(JSON.stringify(message));
//         addLog(`Sent message: ${message.type}`);
//         return true;
//       } catch (error) {
//         addLog(`Failed to send message: ${error.message}`, 'error');
//         return false;
//       }
//     }
//     addLog('WebSocket not connected', 'error');
//     return false;
//   }, [addLog]);

//   // Handle WebRTC Answer
//   const handleWebRTCAnswer = useCallback(async (message) => {
//     const streamId = message.data.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.setRemoteDescription(message.data.answer);
//         addLog(`Set remote description for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to set remote description: ${error.message}`, 'error');
//         updateStreamStatus(streamId, 'inactive');
//       }
//     }
//   }, [addLog, updateStreamStatus]);

//   // Handle ICE Candidate
//   const handleICECandidate = useCallback(async (message) => {
//     const streamId = message.data.stream_id || message.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.addIceCandidate(message.data.candidate || message.data);
//         addLog(`Added ICE candidate for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to add ICE candidate: ${error.message}`, 'error');
//       }
//     }
//   }, [addLog]);

//   // Handle WebSocket messages
//   const handleMessage = useCallback(async (message) => {
//     addLog(`Received: ${message.type}`);
    
//     switch (message.type) {
//       case 'stream_list':
//         addLog(`Received stream list with ${message.data?.length || 0} streams`);
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
//   }, [addLog, handleWebRTCAnswer, handleICECandidate, updateStreamStatus]);

//   // Connect to WebSocket - FIXED VERSION
//   const connectWebSocket = useCallback((token) => {
//     // Check if already connected
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       addLog('WebSocket already connected');
//       return;
//     }

//     // Close existing connection if any
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }

//     if (!token) {
//       addLog('No auth token available', 'error');
//       return;
//     }

//     let wsUrl = serverUrl;
//     const separator = serverUrl.includes('?') ? '&' : '?';
//     wsUrl = `${serverUrl}${separator}token=${encodeURIComponent(token)}`;

//     addLog('Connecting to WebSocket...');
    
//     try {
//       wsRef.current = new WebSocket(wsUrl);

//       wsRef.current.onopen = () => {
//         setWsConnected(true);
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
//         setWsConnected(false);
//         wsRef.current = null;
//         addLog(`WebSocket closed: ${event.code} - ${event.reason || 'No reason provided'}`);

//         if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
//           reconnectAttemptsRef.current++;
//           addLog(`Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
//           setTimeout(() => connectWebSocket(token), 2000 * reconnectAttemptsRef.current);
//         }
//       };

//       wsRef.current.onerror = (error) => {
//         addLog('WebSocket error occurred', 'error');
//         console.error('WebSocket error:', error);
//       };
//     } catch (error) {
//       addLog(`Failed to create WebSocket: ${error.message}`, 'error');
//     }
//   }, [serverUrl, addLog, handleMessage]);

//   // Start streaming for a camera - FIXED VERSION
//   const startStream = useCallback(async (cameraId, rtspUrl) => {
//     addLog(`Starting stream for camera: ${cameraId}`);
    
//     // Check WebSocket connection first
//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//       addLog('WebSocket not connected. Attempting to reconnect...', 'error');
//       const token = localStorage.getItem('primusLiteToken');
//       if (token) {
//         connectWebSocket(token);
//         // Wait for connection
//         await new Promise(resolve => setTimeout(resolve, 2000));
//       }
      
//       if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//         updateStreamStatus(cameraId, 'inactive');
//         alert('Cannot start stream: WebSocket not connected. Please refresh the page and try again.');
//         return;
//       }
//     }

//     updateStreamStatus(cameraId, 'connecting');

//     if (!sendMessage({ type: 'stream_start', data: { stream_id: cameraId, rtsp_url: rtspUrl } })) {
//       updateStreamStatus(cameraId, 'inactive');
//       alert('Failed to send stream start command. Please try again.');
//       return;
//     }

//     const pc = new RTCPeerConnection(iceServers);
//     peerConnectionsRef.current.set(cameraId, pc);

//     pc.ontrack = (event) => {
//       addLog(`Received track for camera: ${cameraId}`);
//       const video = document.getElementById(`video-${cameraId}`);
//       const placeholder = document.getElementById(`placeholder-${cameraId}`);
      
//       if (!video || !event.streams[0]) {
//         addLog(`Video element or stream not found for camera: ${cameraId}`, 'error');
//         return;
//       }

//       video.srcObject = event.streams[0];
//       video.style.display = 'block';
//       if (placeholder) placeholder.style.display = 'none';

//       video.play()
//         .then(() => {
//           addLog(`Video playing for camera: ${cameraId}`);
//           updateStreamStatus(cameraId, 'active');
//         })
//         .catch(e => {
//           addLog(`Video play error: ${e.message}`, 'error');
//           updateStreamStatus(cameraId, 'inactive');
//         });
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         sendMessage({
//           type: 'ice_candidate',
//           data: { stream_id: cameraId, candidate: event.candidate.toJSON() }
//         });
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       addLog(`Connection state for ${cameraId}: ${pc.connectionState}`);
//       switch (pc.connectionState) {
//         case 'connected':
//           updateStreamStatus(cameraId, 'active');
//           break;
//         case 'disconnected':
//         case 'failed':
//           updateStreamStatus(cameraId, 'inactive');
//           addLog(`Connection failed for camera: ${cameraId}`, 'error');
//           break;
//         case 'connecting':
//           updateStreamStatus(cameraId, 'connecting');
//           break;
//       }
//     };

//     try {
//       const tx = pc.addTransceiver('video', { direction: 'recvonly' });
//       const prefs = chooseCodecs();
//       if (prefs && tx.setCodecPreferences) {
//         tx.setCodecPreferences(prefs);
//       }

//       const offer = await pc.createOffer({});
//       await pc.setLocalDescription(offer);
//       addLog(`Created offer for camera: ${cameraId}`);

//       const success = sendMessage({
//         type: 'webrtc_offer',
//         data: { stream_id: cameraId, offer }
//       });

//       if (!success) {
//         pc.close();
//         peerConnectionsRef.current.delete(cameraId);
//         updateStreamStatus(cameraId, 'inactive');
//       }
//     } catch (error) {
//       addLog(`Failed to create offer: ${error.message}`, 'error');
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//       updateStreamStatus(cameraId, 'inactive');
//     }
//   }, [addLog, sendMessage, updateStreamStatus, chooseCodecs, connectWebSocket]);

//   // Stop streaming
//   const stopStream = useCallback((cameraId) => {
//     addLog(`Stopping stream for camera: ${cameraId}`);
//     const pc = peerConnectionsRef.current.get(cameraId);
//     if (pc) {
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//     }
//     sendMessage({ type: 'stream_stop', data: { stream_id: cameraId } });

//     const video = document.getElementById(`video-${cameraId}`);
//     const placeholder = document.getElementById(`placeholder-${cameraId}`);
//     if (video) {
//       video.srcObject = null;
//       video.style.display = 'none';
//     }
//     if (placeholder) placeholder.style.display = 'flex';
//     updateStreamStatus(cameraId, 'inactive');
//   }, [addLog, sendMessage, updateStreamStatus]);

//   // Initialize WebSocket on mount
//   useEffect(() => {
//     showLoading();
//     const timer = setTimeout(() => {
//       hideLoading();
//       setShowMain(true);
//     }, 3000);

//     const token = localStorage.getItem('primusLiteToken');
//     if (token) {
//       addLog('Auth token loaded from localStorage');
//       connectWebSocket(token);
//     } else {
//       addLog('No auth token found', 'error');
//     }

//     return () => {
//       clearTimeout(timer);
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//       peerConnectionsRef.current.forEach(pc => pc.close());
//     };
//   }, [showLoading, hideLoading, addLog, connectWebSocket]);

//   // FIXED: Handle modal save with proper backend integration
//   const handleModalSave = async (cameraData) => {
//     try {
//       console.log("Received camera data from PopupModal:", cameraData);

//       // Validate required fields
//       if (!cameraData.location_name || !cameraData.ip_address || !cameraData.username || !cameraData.password) {
//         throw new Error("Missing required camera fields. Please fill in all required information.");
//       }

//       // Use the store's addCamera method which calls the backend
//       await addCamera(cameraData);

//       // Add event to history
//       addEvent({
//         camera_name: cameraData.location_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: cameraData.rtsp_url,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cameraData.location_name}" added successfully`
//       });

//       setIsModalOpen(false);
//       alert(`Camera "${cameraData.location_name}" has been added successfully! Click the Stream button to start viewing.`);

//     } catch (error) {
//       console.error("Failed to add camera:", error);
//       alert(`Failed to add camera: ${error.message || "Unknown error"}\n\nPlease check the console for more details.`);
//     }
//   };

//   const handleClearAll = async () => {
//     if (window.confirm("Are you sure you want to delete all cameras?")) {
//       try {
//         // Stop all active streams first
//         CameraStreams.forEach(camera => {
//           if (streamStatuses[camera.id] === 'active') {
//             stopStream(camera.id);
//           }
//         });
        
//         await clearCameraStreams();
        
//         addEvent({
//           type: "BULK_DELETE",
//           timestamp: new Date().toISOString(),
//           description: "All cameras cleared from system",
//         });
        
//         alert("All cameras have been deleted successfully!");
//       } catch (error) {
//         console.error("Error clearing cameras:", error);
//         alert("Some cameras could not be deleted. Please try again.");
//       }
//     }
//   };

//   const filteredCameras = (CameraStreams || []).filter(camera => {
//     if (!camera || !camera.location_name) return false;
//     return camera.location_name.toLowerCase().includes(searchTerm.toLowerCase());
//   });

//   return (
//     <>
//       <Header />
//       <LogoLoader />
//       {isModalOpen && (
//         <PopupModal
//           onSave={handleModalSave}
//           onCancel={() => setIsModalOpen(false)}
//         />
//       )}

//       {showMain && (
//         <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
//           <div className="absolute inset-0 overflow-hidden pointer-events-none">
//             <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
//             <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
//           </div>

//           <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
//             <div className="mb-10">
//               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//                 <div>
//                   <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
//                     Security Cameras with Live Streaming
//                   </h1>
//                   <p className="text-gray-400 mt-3 text-lg">
//                     Real-time WebRTC video monitoring system
//                   </p>
//                   <div className="flex items-center gap-3 mt-3">
//                     <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
//                     <span className="text-sm text-gray-400">
//                       WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="flex gap-3">
//                   <button
//                     onClick={() => setIsModalOpen(true)}
//                     className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
//                   >
//                     <i className="fa-solid fa-plus text-lg"></i>
//                     <span className="font-semibold">Add Camera</span>
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {cameraError && (
//               <div className="mb-8 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6">
//                 <div className="flex items-center gap-4">
//                   <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl"></i>
//                   <p className="text-red-300">{cameraError}</p>
//                   <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
//                     <i className="fa-solid fa-times text-lg"></i>
//                   </button>
//                 </div>
//               </div>
//             )}

//             <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
//               <div className="flex gap-4">
//                 <input
//                   type="text"
//                   placeholder="Search cameras..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white placeholder-gray-400 border border-slate-600/50 rounded-xl"
//                 />
//                 <button
//                   onClick={handleClearAll}
//                   disabled={!CameraStreams || CameraStreams.length === 0}
//                   className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold disabled:opacity-50"
//                 >
//                   Clear All
//                 </button>
//               </div>
//             </div>

//             {filteredCameras.length === 0 ? (
//               <div className="text-center py-24">
//                 <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
//                   <i className="fa-solid fa-video text-slate-400 text-5xl"></i>
//                 </div>
//                 <h2 className="text-3xl font-bold text-white mb-6">No Cameras Connected</h2>
//                 <button
//                   onClick={() => setIsModalOpen(true)}
//                   className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-10 py-5 rounded-xl font-semibold"
//                 >
//                   Add Your First Camera
//                 </button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
//                 {filteredCameras.map((camera) => (
//                   <CameraCard
//                     key={camera.id}
//                     id={camera.id}
//                     camera_name={camera.location_name}
//                     location_name={camera.location_name}
//                     date={camera.date}
//                     time={camera.time}
//                     threatLevel={camera.threatLevel || 'Low'}
//                     zoneCategory={camera.zoneCategory || 'Default'}
//                     rtsp_url={camera.rtsp_url}
//                     streamUrl={camera.rtsp_url}
//                     streamStatus={streamStatuses[camera.id] || 'inactive'}
//                     onStartStream={() => startStream(camera.id, camera.rtsp_url)}
//                     onStopStream={() => stopStream(camera.id)}
//                   />
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }






















// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from './store/history-store';
// import Header from './Header';
// import LogoLoader from './LogoLoader';
// import CameraCard from './CameraCard';
// import PopupModal from './PopupModal';
// import useLoadingStore from './store/loading-store';

// export default function Dashboard() {
//   const [showMain, setShowMain] = useState(false);
//   const { showLoading, hideLoading } = useLoadingStore();

//   // WebSocket state
//   const [wsConnected, setWsConnected] = useState(false);
//   const [serverUrl] = useState('wss://teletraan-backend.avzdax.com/stream/ws/streams');
//   const wsRef = useRef(null);
//   const peerConnectionsRef = useRef(new Map());
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 3;

//   // Stream status tracking
//   const [streamStatuses, setStreamStatuses] = useState({});
//   const [logs, setLogs] = useState([]);

//   // Camera store
//   const {
//     CameraStreams,
//     isLoading: isLoadingCameras,
//     error: cameraError,
//     clearCameraStreams,
//     clearError,
//     setCameraStreams,
//     fetchCameras,
//     addCamera
//   } = useCameraStore();

//   const { addEvent } = useEventStore();
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');

//   // ICE servers configuration
//   const iceServers = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
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
//     console.log(`[${timestamp}] ${message}`);
//   }, []);

//   // Update stream status
//   const updateStreamStatus = useCallback((streamId, status) => {
//     setStreamStatuses(prev => ({
//       ...prev,
//       [streamId]: status
//     }));
//   }, []);

//   // Choose codecs
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

//   // Send WebSocket message
//   const sendMessage = useCallback((message) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       try {
//         message.timestamp = new Date().toISOString();
//         wsRef.current.send(JSON.stringify(message));
//         addLog(`Sent message: ${message.type}`);
//         return true;
//       } catch (error) {
//         addLog(`Failed to send message: ${error.message}`, 'error');
//         return false;
//       }
//     }
//     addLog('WebSocket not connected', 'error');
//     return false;
//   }, [addLog]);

//   // Handle WebRTC Answer
//   const handleWebRTCAnswer = useCallback(async (message) => {
//     const streamId = message.data.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.setRemoteDescription(message.data.answer);
//         addLog(`Set remote description for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to set remote description: ${error.message}`, 'error');
//         updateStreamStatus(streamId, 'inactive');
//       }
//     }
//   }, [addLog, updateStreamStatus]);

//   // Handle ICE Candidate
//   const handleICECandidate = useCallback(async (message) => {
//     const streamId = message.data.stream_id || message.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.addIceCandidate(message.data.candidate || message.data);
//         addLog(`Added ICE candidate for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to add ICE candidate: ${error.message}`, 'error');
//       }
//     }
//   }, [addLog]);

//   // Handle WebSocket messages
//   const handleMessage = useCallback(async (message) => {
//     addLog(`Received: ${message.type}`);
    
//     switch (message.type) {
//       case 'stream_list':
//         addLog(`Received stream list with ${message.data?.length || 0} streams`);
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
//   }, [addLog, handleWebRTCAnswer, handleICECandidate, updateStreamStatus]);

//   // Connect to WebSocket - FIXED VERSION
//   const connectWebSocket = useCallback((token) => {
//     // Check if already connected
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       addLog('WebSocket already connected');
//       return;
//     }

//     // Close existing connection if any
//     if (wsRef.current) {
//       wsRef.current.close();
//       wsRef.current = null;
//     }

//     if (!token) {
//       addLog('No auth token available', 'error');
//       return;
//     }

//     let wsUrl = serverUrl;
//     const separator = serverUrl.includes('?') ? '&' : '?';
//     wsUrl = `${serverUrl}${separator}token=${encodeURIComponent(token)}`;

//     addLog('Connecting to WebSocket...');
    
//     try {
//       wsRef.current = new WebSocket(wsUrl);

//       wsRef.current.onopen = () => {
//         setWsConnected(true);
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
//         setWsConnected(false);
//         wsRef.current = null;
//         addLog(`WebSocket closed: ${event.code} - ${event.reason || 'No reason provided'}`);

//         if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
//           reconnectAttemptsRef.current++;
//           addLog(`Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
//           setTimeout(() => connectWebSocket(token), 2000 * reconnectAttemptsRef.current);
//         }
//       };

//       wsRef.current.onerror = (error) => {
//         addLog('WebSocket error occurred', 'error');
//         console.error('WebSocket error:', error);
//       };
//     } catch (error) {
//       addLog(`Failed to create WebSocket: ${error.message}`, 'error');
//     }
//   }, [serverUrl, addLog, handleMessage]);

//   // Start streaming for a camera - FIXED VERSION
//   const startStream = useCallback(async (cameraId, rtspUrl) => {
//     addLog(`Starting stream for camera: ${cameraId}`);
    
//     // Check WebSocket connection first
//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//       addLog('WebSocket not connected. Attempting to reconnect...', 'error');
//       const token = localStorage.getItem('primusLiteToken');
//       if (token) {
//         connectWebSocket(token);
//         // Wait for connection
//         await new Promise(resolve => setTimeout(resolve, 2000));
//       }
      
//       if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
//         updateStreamStatus(cameraId, 'inactive');
//         alert('Cannot start stream: WebSocket not connected. Please refresh the page and try again.');
//         return;
//       }
//     }

//     updateStreamStatus(cameraId, 'connecting');

//     if (!sendMessage({ type: 'stream_start', data: { stream_id: cameraId, rtsp_url: rtspUrl } })) {
//       updateStreamStatus(cameraId, 'inactive');
//       alert('Failed to send stream start command. Please try again.');
//       return;
//     }

//     const pc = new RTCPeerConnection(iceServers);
//     peerConnectionsRef.current.set(cameraId, pc);

//     pc.ontrack = (event) => {
//       addLog(`Received track for camera: ${cameraId}`);
//       const video = document.getElementById(`video-${cameraId}`);
//       const placeholder = document.getElementById(`placeholder-${cameraId}`);
      
//       if (!video || !event.streams[0]) {
//         addLog(`Video element or stream not found for camera: ${cameraId}`, 'error');
//         return;
//       }

//       video.srcObject = event.streams[0];
//       video.style.display = 'block';
//       if (placeholder) placeholder.style.display = 'none';

//       video.play()
//         .then(() => {
//           addLog(`Video playing for camera: ${cameraId}`);
//           updateStreamStatus(cameraId, 'active');
//         })
//         .catch(e => {
//           addLog(`Video play error: ${e.message}`, 'error');
//           updateStreamStatus(cameraId, 'inactive');
//         });
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         sendMessage({
//           type: 'ice_candidate',
//           data: { stream_id: cameraId, candidate: event.candidate.toJSON() }
//         });
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       addLog(`Connection state for ${cameraId}: ${pc.connectionState}`);
//       switch (pc.connectionState) {
//         case 'connected':
//           updateStreamStatus(cameraId, 'active');
//           break;
//         case 'disconnected':
//         case 'failed':
//           updateStreamStatus(cameraId, 'inactive');
//           addLog(`Connection failed for camera: ${cameraId}`, 'error');
//           break;
//         case 'connecting':
//           updateStreamStatus(cameraId, 'connecting');
//           break;
//       }
//     };

//     try {
//       const tx = pc.addTransceiver('video', { direction: 'recvonly' });
//       const prefs = chooseCodecs();
//       if (prefs && tx.setCodecPreferences) {
//         tx.setCodecPreferences(prefs);
//       }

//       const offer = await pc.createOffer({});
//       await pc.setLocalDescription(offer);
//       addLog(`Created offer for camera: ${cameraId}`);

//       const success = sendMessage({
//         type: 'webrtc_offer',
//         data: { stream_id: cameraId, offer }
//       });

//       if (!success) {
//         pc.close();
//         peerConnectionsRef.current.delete(cameraId);
//         updateStreamStatus(cameraId, 'inactive');
//       }
//     } catch (error) {
//       addLog(`Failed to create offer: ${error.message}`, 'error');
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//       updateStreamStatus(cameraId, 'inactive');
//     }
//   }, [addLog, sendMessage, updateStreamStatus, chooseCodecs, connectWebSocket]);

//   // Stop streaming
//   const stopStream = useCallback((cameraId) => {
//     addLog(`Stopping stream for camera: ${cameraId}`);
//     const pc = peerConnectionsRef.current.get(cameraId);
//     if (pc) {
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//     }
//     sendMessage({ type: 'stream_stop', data: { stream_id: cameraId } });

//     const video = document.getElementById(`video-${cameraId}`);
//     const placeholder = document.getElementById(`placeholder-${cameraId}`);
//     if (video) {
//       video.srcObject = null;
//       video.style.display = 'none';
//     }
//     if (placeholder) placeholder.style.display = 'flex';
//     updateStreamStatus(cameraId, 'inactive');
//   }, [addLog, sendMessage, updateStreamStatus]);

//   // Initialize WebSocket on mount
//   useEffect(() => {
//     showLoading();
//     const timer = setTimeout(() => {
//       hideLoading();
//       setShowMain(true);
//     }, 3000);

//     const token = localStorage.getItem('primusLiteToken');
//     if (token) {
//       addLog('Auth token loaded from localStorage');
//       connectWebSocket(token);
//     } else {
//       addLog('No auth token found', 'error');
//     }

//     return () => {
//       clearTimeout(timer);
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//       peerConnectionsRef.current.forEach(pc => pc.close());
//     };
//   }, [showLoading, hideLoading, addLog, connectWebSocket]);

//   // FIXED: Handle modal save with proper backend integration
//   const handleModalSave = async (cameraData) => {
//     try {
//       console.log("Adding camera with data:", cameraData);

//       // Use the store's addCamera method which calls the backend
//       await addCamera(cameraData);

//       // Add event to history
//       addEvent({
//         camera_name: cameraData.location_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: cameraData.rtsp_url,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cameraData.location_name}" added successfully`
//       });

//       setIsModalOpen(false);
//       alert(`Camera "${cameraData.location_name}" has been added successfully! Click the Stream button to start viewing.`);

//     } catch (error) {
//       console.error("Failed to add camera:", error);
//       alert(`Failed to add camera: ${error.message || "Unknown error"}`);
//     }
//   };

//   const handleClearAll = async () => {
//     if (window.confirm("Are you sure you want to delete all cameras?")) {
//       try {
//         // Stop all active streams first
//         CameraStreams.forEach(camera => {
//           if (streamStatuses[camera.id] === 'active') {
//             stopStream(camera.id);
//           }
//         });
        
//         await clearCameraStreams();
        
//         addEvent({
//           type: "BULK_DELETE",
//           timestamp: new Date().toISOString(),
//           description: "All cameras cleared from system",
//         });
        
//         alert("All cameras have been deleted successfully!");
//       } catch (error) {
//         console.error("Error clearing cameras:", error);
//         alert("Some cameras could not be deleted. Please try again.");
//       }
//     }
//   };

//   const filteredCameras = (CameraStreams || []).filter(camera => {
//     if (!camera || !camera.location_name) return false;
//     return camera.location_name.toLowerCase().includes(searchTerm.toLowerCase());
//   });

//   return (
//     <>
//       <Header />
//       <LogoLoader />
//       {isModalOpen && (
//         <PopupModal
//           onSave={handleModalSave}
//           onCancel={() => setIsModalOpen(false)}
//         />
//       )}

//       {showMain && (
//         <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
//           <div className="absolute inset-0 overflow-hidden pointer-events-none">
//             <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
//             <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
//           </div>

//           <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
//             <div className="mb-10">
//               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//                 <div>
//                   <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
//                     Security Cameras with Live Streaming
//                   </h1>
//                   <p className="text-gray-400 mt-3 text-lg">
//                     Real-time WebRTC video monitoring system
//                   </p>
//                   <div className="flex items-center gap-3 mt-3">
//                     <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
//                     <span className="text-sm text-gray-400">
//                       WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="flex gap-3">
//                   <button
//                     onClick={() => setIsModalOpen(true)}
//                     className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
//                   >
//                     <i className="fa-solid fa-plus text-lg"></i>
//                     <span className="font-semibold">Add Camera</span>
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {cameraError && (
//               <div className="mb-8 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6">
//                 <div className="flex items-center gap-4">
//                   <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl"></i>
//                   <p className="text-red-300">{cameraError}</p>
//                   <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
//                     <i className="fa-solid fa-times text-lg"></i>
//                   </button>
//                 </div>
//               </div>
//             )}

//             <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
//               <div className="flex gap-4">
//                 <input
//                   type="text"
//                   placeholder="Search cameras..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white placeholder-gray-400 border border-slate-600/50 rounded-xl"
//                 />
//                 <button
//                   onClick={handleClearAll}
//                   disabled={!CameraStreams || CameraStreams.length === 0}
//                   className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold disabled:opacity-50"
//                 >
//                   Clear All
//                 </button>
//               </div>
//             </div>

//             {filteredCameras.length === 0 ? (
//               <div className="text-center py-24">
//                 <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
//                   <i className="fa-solid fa-video text-slate-400 text-5xl"></i>
//                 </div>
//                 <h2 className="text-3xl font-bold text-white mb-6">No Cameras Connected</h2>
//                 <button
//                   onClick={() => setIsModalOpen(true)}
//                   className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-10 py-5 rounded-xl font-semibold"
//                 >
//                   Add Your First Camera
//                 </button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
//                 {filteredCameras.map((camera) => (
//                   <CameraCard
//                     key={camera.id}
//                     id={camera.id}
//                     camera_name={camera.location_name}
//                     location_name={camera.location_name}
//                     date={camera.date}
//                     time={camera.time}
//                     threatLevel={camera.threatLevel || 'Low'}
//                     zoneCategory={camera.zoneCategory || 'Default'}
//                     rtsp_url={camera.rtsp_url}
//                     streamUrl={camera.rtsp_url}
//                     streamStatus={streamStatuses[camera.id] || 'inactive'}
//                     onStartStream={() => startStream(camera.id, camera.rtsp_url)}
//                     onStopStream={() => stopStream(camera.id)}
//                   />
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }























































// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from './store/history-store';
// import Header from './Header';
// import LogoLoader from './LogoLoader';
// import CameraCard from './CameraCard';
// import PopupModal from './PopupModal';
// import useLoadingStore from './store/loading-store';

// export default function Dashboard() {
//   const [showMain, setShowMain] = useState(false);
//   const { showLoading, hideLoading } = useLoadingStore();

//   // WebSocket state
//   const [wsConnected, setWsConnected] = useState(false);
//   // const [serverUrl] = useState('ws://localhost:8040/ws/streams');
//   const [serverUrl] = useState('wss://teletraan-backend.avzdax.com/stream/ws/streams')
//   const wsRef = useRef(null);
//   const peerConnectionsRef = useRef(new Map());
//   const reconnectAttemptsRef = useRef(0);
//   const maxReconnectAttempts = 3;

//   // Stream status tracking
//   const [streamStatuses, setStreamStatuses] = useState({});
//   const [logs, setLogs] = useState([]);

//   // Camera store
//   const {
//     CameraStreams,
//     isLoading: isLoadingCameras,
//     error: cameraError,
//     clearCameraStreams,
//     clearError,
//     setCameraStreams,
//     fetchCameras,
//     addCamera
//   } = useCameraStore();

//   const { addEvent } = useEventStore();
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');

//   // ICE servers configuration
//   const iceServers = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
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
//     console.log(`[${timestamp}] ${message}`);
//   }, []);

//   // Update stream status
//   const updateStreamStatus = useCallback((streamId, status) => {
//     setStreamStatuses(prev => ({
//       ...prev,
//       [streamId]: status
//     }));
//   }, []);

//   // Choose codecs
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

//   // Send WebSocket message
//   const sendMessage = useCallback((message) => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//       try {
//         message.timestamp = new Date().toISOString();
//         wsRef.current.send(JSON.stringify(message));
//         return true;
//       } catch (error) {
//         addLog(`Failed to send message: ${error.message}`, 'error');
//         return false;
//       }
//     }
//     addLog('WebSocket not connected', 'error');
//     return false;
//   }, [addLog]);

//   // Handle WebRTC Answer
//   const handleWebRTCAnswer = useCallback(async (message) => {
//     const streamId = message.data.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.setRemoteDescription(message.data.answer);
//         addLog(`Set remote description for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to set remote description: ${error.message}`, 'error');
//         updateStreamStatus(streamId, 'inactive');
//       }
//     }
//   }, [addLog, updateStreamStatus]);

//   // Handle ICE Candidate
//   const handleICECandidate = useCallback(async (message) => {
//     const streamId = message.data.stream_id || message.stream_id;
//     const pc = peerConnectionsRef.current.get(streamId);
//     if (pc) {
//       try {
//         await pc.addIceCandidate(message.data.candidate || message.data);
//         addLog(`Added ICE candidate for stream: ${streamId}`);
//       } catch (error) {
//         addLog(`Failed to add ICE candidate: ${error.message}`, 'error');
//       }
//     }
//   }, [addLog]);

//   // Handle WebSocket messages
//   const handleMessage = useCallback(async (message) => {
//     addLog(`Received: ${message.type}`);
    
//     switch (message.type) {
//       case 'stream_list':
//         addLog(`Received stream list with ${message.data?.length || 0} streams`);
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
//   }, [addLog, handleWebRTCAnswer, handleICECandidate, updateStreamStatus]);

//   // Connect to WebSocket
//   const connectWebSocket = useCallback((token) => {
//     if (wsRef.current) return;

//     let wsUrl = serverUrl;
//     if (token) {
//       const separator = serverUrl.includes('?') ? '&' : '?';
//       wsUrl = `${serverUrl}${separator}token=${encodeURIComponent(token)}&page=1`;
//     }

//     addLog('Connecting to WebSocket...');
    
//     try {
//       wsRef.current = new WebSocket(wsUrl);

//       wsRef.current.onopen = () => {
//         setWsConnected(true);
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
//         setWsConnected(false);
//         addLog(`WebSocket closed: ${event.code}`);

//         if ([1006, 1011].includes(event.code) && reconnectAttemptsRef.current < maxReconnectAttempts) {
//           reconnectAttemptsRef.current++;
//           addLog(`Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
//           setTimeout(() => connectWebSocket(token), 2000 * reconnectAttemptsRef.current);
//         }
//       };

//       wsRef.current.onerror = () => {
//         addLog('WebSocket error occurred', 'error');
//       };
//     } catch (error) {
//       addLog(`Failed to create WebSocket: ${error.message}`, 'error');
//     }
//   }, [serverUrl, addLog, handleMessage]);

//   // Start streaming for a camera
//   const startStream = useCallback(async (cameraId, rtspUrl) => {
//     addLog(`Starting stream for camera: ${cameraId}`);
//     updateStreamStatus(cameraId, 'connecting');

//     if (!sendMessage({ type: 'stream_start', data: { stream_id: cameraId, rtsp_url: rtspUrl } })) {
//       updateStreamStatus(cameraId, 'inactive');
//       return;
//     }

//     const pc = new RTCPeerConnection(iceServers);
//     peerConnectionsRef.current.set(cameraId, pc);

//     pc.ontrack = (event) => {
//       addLog(`Received track for camera: ${cameraId}`);
//       const video = document.getElementById(`video-${cameraId}`);
//       const placeholder = document.getElementById(`placeholder-${cameraId}`);
      
//       if (!video || !event.streams[0]) return;

//       video.srcObject = event.streams[0];
//       video.style.display = 'block';
//       if (placeholder) placeholder.style.display = 'none';

//       video.play()
//         .then(() => {
//           addLog(`Video playing for camera: ${cameraId}`);
//           updateStreamStatus(cameraId, 'active');
//         })
//         .catch(e => {
//           addLog(`Video play error: ${e.message}`, 'error');
//           updateStreamStatus(cameraId, 'inactive');
//         });
//     };

//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         sendMessage({
//           type: 'ice_candidate',
//           data: { stream_id: cameraId, candidate: event.candidate.toJSON() }
//         });
//       }
//     };

//     pc.onconnectionstatechange = () => {
//       addLog(`Connection state for ${cameraId}: ${pc.connectionState}`);
//       switch (pc.connectionState) {
//         case 'connected':
//           updateStreamStatus(cameraId, 'active');
//           break;
//         case 'disconnected':
//         case 'failed':
//           updateStreamStatus(cameraId, 'inactive');
//           break;
//         case 'connecting':
//           updateStreamStatus(cameraId, 'connecting');
//           break;
//       }
//     };

//     try {
//       const tx = pc.addTransceiver('video', { direction: 'recvonly' });
//       const prefs = chooseCodecs();
//       if (prefs && tx.setCodecPreferences) {
//         tx.setCodecPreferences(prefs);
//       }

//       const offer = await pc.createOffer({});
//       await pc.setLocalDescription(offer);
//       addLog(`Created offer for camera: ${cameraId}`);

//       const success = sendMessage({
//         type: 'webrtc_offer',
//         data: { stream_id: cameraId, offer }
//       });

//       if (!success) {
//         pc.close();
//         peerConnectionsRef.current.delete(cameraId);
//         updateStreamStatus(cameraId, 'inactive');
//       }
//     } catch (error) {
//       addLog(`Failed to create offer: ${error.message}`, 'error');
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//       updateStreamStatus(cameraId, 'inactive');
//     }
//   }, [addLog, sendMessage, updateStreamStatus, chooseCodecs]);

//   // Stop streaming
//   const stopStream = useCallback((cameraId) => {
//     addLog(`Stopping stream for camera: ${cameraId}`);
//     const pc = peerConnectionsRef.current.get(cameraId);
//     if (pc) {
//       pc.close();
//       peerConnectionsRef.current.delete(cameraId);
//     }
//     sendMessage({ type: 'stream_stop', data: { stream_id: cameraId } });

//     const video = document.getElementById(`video-${cameraId}`);
//     const placeholder = document.getElementById(`placeholder-${cameraId}`);
//     if (video) {
//       video.srcObject = null;
//       video.style.display = 'none';
//     }
//     if (placeholder) placeholder.style.display = 'flex';
//     updateStreamStatus(cameraId, 'inactive');
//   }, [addLog, sendMessage, updateStreamStatus]);

//   // Initialize WebSocket on mount
//   useEffect(() => {
//     showLoading();
//     const timer = setTimeout(() => {
//       hideLoading();
//       setShowMain(true);
//     }, 3000);

//     const token = localStorage.getItem('primusLiteToken');
//     if (token) {
//       addLog('Auth token loaded from localStorage');
//       connectWebSocket(token);
//     } else {
//       addLog('No auth token found', 'error');
//     }

//     return () => {
//       clearTimeout(timer);
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//       peerConnectionsRef.current.forEach(pc => pc.close());
//     };
//   }, [showLoading, hideLoading, addLog, connectWebSocket]);

//   const handleModalSave = async (cameraData) => {
//     try {
//       const newCamera = {
//         ...cameraData,
//         id: cameraData.id || Date.now().toString(),
//         status: 'inactive'
//       };

//       const currentCameras = CameraStreams || [];
//       setCameraStreams([...currentCameras, newCamera]);

//       addEvent({
//         camera_name: cameraData.location_name,
//         zone_name: "N/A",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: cameraData.rtsp_url,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cameraData.location_name}" added successfully`
//       });

//       setIsModalOpen(false);
//       alert(`Camera "${cameraData.location_name}" has been added successfully!`);

//     } catch (error) {
//       console.error("Failed to add camera:", error);
//       alert(`Failed to add camera: ${error.message || "Unknown error"}`);
//     }
//   };

//   const handleClearAll = async () => {
//     if (window.confirm("Are you sure you want to delete all cameras?")) {
//       try {
//         CameraStreams.forEach(camera => stopStream(camera.id));
//         await clearCameraStreams();
//         addEvent({
//           type: "BULK_DELETE",
//           timestamp: new Date().toISOString(),
//           description: "All cameras cleared from system",
//         });
//         alert("All cameras have been deleted successfully!");
//       } catch (error) {
//         console.error("Error clearing cameras:", error);
//         alert("Some cameras could not be deleted. Please try again.");
//       }
//     }
//   };

//   const filteredCameras = (CameraStreams || []).filter(camera => {
//     if (!camera || !camera.location_name) return false;
//     return camera.location_name.toLowerCase().includes(searchTerm.toLowerCase());
//   });

//   return (
//     <>
//       <Header />
//       <LogoLoader />
//       {isModalOpen && (
//         <PopupModal
//           onSave={handleModalSave}
//           onCancel={() => setIsModalOpen(false)}
//         />
//       )}

//       {showMain && (
//         <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
//           <div className="absolute inset-0 overflow-hidden pointer-events-none">
//             <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
//             <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
//           </div>

//           <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
//             <div className="mb-10">
//               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//                 <div>
//                   <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
//                     Security Cameras with Live Streaming
//                   </h1>
//                   <p className="text-gray-400 mt-3 text-lg">
//                     Real-time WebRTC video monitoring system
//                   </p>
//                   <div className="flex items-center gap-3 mt-3">
//                     <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
//                     <span className="text-sm text-gray-400">
//                       WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="flex gap-3">
//                   <button
//                     onClick={() => setIsModalOpen(true)}
//                     className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
//                   >
//                     <i className="fa-solid fa-plus text-lg"></i>
//                     <span className="font-semibold">Add Camera</span>
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {cameraError && (
//               <div className="mb-8 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-6">
//                 <div className="flex items-center gap-4">
//                   <i className="fa-solid fa-exclamation-triangle text-red-400 text-xl"></i>
//                   <p className="text-red-300">{cameraError}</p>
//                   <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
//                     <i className="fa-solid fa-times text-lg"></i>
//                   </button>
//                 </div>
//               </div>
//             )}

//             <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
//               <div className="flex gap-4">
//                 <input
//                   type="text"
//                   placeholder="Search cameras..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white placeholder-gray-400 border border-slate-600/50 rounded-xl"
//                 />
//                 <button
//                   onClick={handleClearAll}
//                   disabled={!CameraStreams || CameraStreams.length === 0}
//                   className="px-8 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold disabled:opacity-50"
//                 >
//                   Clear All
//                 </button>
//               </div>
//             </div>

//             {filteredCameras.length === 0 ? (
//               <div className="text-center py-24">
//                 <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-2xl">
//                   <i className="fa-solid fa-video text-slate-400 text-5xl"></i>
//                 </div>
//                 <h2 className="text-3xl font-bold text-white mb-6">No Cameras Connected</h2>
//                 <button
//                   onClick={() => setIsModalOpen(true)}
//                   className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-10 py-5 rounded-xl font-semibold"
//                 >
//                   Add Your First Camera
//                 </button>
//               </div>
//             ) : (
//               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
//                 {filteredCameras.map((camera) => (
//                   <CameraCard
//                     key={camera.id}
//                     {...camera}
//                     camera_name={camera.location_name}
//                     streamStatus={streamStatuses[camera.id] || 'inactive'}
//                     onStartStream={() => startStream(camera.id, camera.rtsp_url)}
//                     onStopStream={() => stopStream(camera.id)}
//                   />
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }








































// import React, { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom'; // ✅ ADDED
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from './store/history-store';
// import Header from './Header';
// import LogoLoader from './LogoLoader';
// import CameraCard from './CameraCard';
// import PopupModal from './PopupModal';
// import useLoadingStore from './store/loading-store';
// // import { Link } from 'react-router-dom';

// export default function Dashboard() {
//   const navigate = useNavigate(); // ✅ ADDED

//   // LOAD BEFORE IT SHOWS DASHBOARD PAGE
//   const [showMain, setShowMain] = useState(false);

//   const { showLoading, hideLoading } = useLoadingStore();

//   useEffect(() => {
//     showLoading();
//     const timer = setTimeout(() => {
//       hideLoading();
//       setShowMain(true);
//     }, 3000);
//     return () => clearTimeout(timer);
//   }, []);

//   // Camera store state and actions
//   const {
//     CameraStreams,
//     isLoading: isLoadingCameras,
//     error: cameraError,
//     clearCameraStreams,
//     clearError,
//     addCamera
//   } = useCameraStore();

//   const { addEvent } = useEventStore();
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [showWebcam, setShowWebcam] = useState(false);
//   const [stream, setStream] = useState(null);
//   const videoRef = useRef(null);

//   // Clear any errors when component unmounts
//   useEffect(() => {
//     return () => clearError();
//   }, [clearError]);

//   const handleModalSave = async (cameraData) => {
//     try {
//       const cameraWithId = {
//         ...cameraData,
//         id: Date.now().toString(),
//         status: 'active',
//         threatLevel: 'Low',
//         lastSeen: new Date().toLocaleString(),
//         isOnline: true,
//         recording: false,
//         motionDetected: false
//       };

//       console.log("Adding camera to store:", cameraWithId);

//       if (addCamera && typeof addCamera === 'function') {
//         await addCamera(cameraWithId);
//       } else {
//         const currentState = useCameraStore.getState();
//         if (currentState.setCameraStreams && typeof currentState.setCameraStreams === 'function') {
//           const updatedCameras = [...(currentState.CameraStreams || []), cameraWithId];
//           currentState.setCameraStreams(updatedCameras);
//         } else {
//           console.warn("No proper camera store method found. Camera added but may not render immediately.");
//         }
//       }

//       setIsModalOpen(false);
//       alert(`Camera "${cameraData.camera_name}" has been added successfully!`);

//     } catch (error) {
//       console.error("Failed to add camera:", error);
//       alert(`Failed to add camera: ${error.message || "Unknown error"}`);
//     }
//   };

//   useEffect(() => {
//     if (videoRef.current && stream) {
//       videoRef.current.srcObject = stream;
//       videoRef.current.onloadedmetadata = () => {
//         videoRef.current.play().catch(err => {
//           console.error("Autoplay failed:", err);
//         });
//       };
//     }
//   }, [stream]);

//   const handleWebcamAccess = async () => {
//     try {
//       const mediaStream = await navigator.mediaDevices.getUserMedia({
//         video: {
//           width: { ideal: 1280 },
//           height: { ideal: 720 },
//           facingMode: 'user'
//         },
//         audio: false
//       });
//       setStream(mediaStream);
//       setShowWebcam(true);

//       if (videoRef.current) {
//         videoRef.current.srcObject = mediaStream;
//         videoRef.current.onloadedmetadata = () => {
//           videoRef.current.play().catch(console.error);
//         };
//       }
//     } catch (error) {
//       console.error('Error accessing webcam:', error);
//       alert('Unable to access webcam. Please check permissions and ensure no other application is using the camera.');
//     }
//   };

//   const closeWebcam = () => {
//     if (stream) {
//       stream.getTracks().forEach(track => track.stop());
//       setStream(null);
//     }
//     setShowWebcam(false);
//   };

//   const handleClearAll = async () => {
//     if (window.confirm("Are you sure you want to delete all cameras? This action cannot be undone.")) {
//       try {
//         await clearCameraStreams();

//         addEvent({
//           type: "BULK_DELETE",
//           timestamp: new Date().toISOString(),
//           description: "All cameras cleared from system",
//         });

//         alert("All cameras have been deleted successfully!");
//       } catch (error) {
//         console.error("Error clearing cameras:", error);
//         alert("Some cameras could not be deleted. Please try again.");
//       }
//     }
//   };

//   const filteredCameras = (CameraStreams || []).filter(camera => {
//     if (!camera || !camera.camera_name) return false;

//     const camera_name = camera.camera_name.toString().toLowerCase();
//     const searchTermLower = searchTerm.toLowerCase();

//     return camera_name.includes(searchTermLower);
//   });

//   const getSystemStats = () => {
//     const totalCameras = CameraStreams?.length || 0;
//     const activeCameras = CameraStreams?.filter(c => c.status === 'active').length || 0;
//     const highThreats = CameraStreams?.filter(c => c.threatLevel === 'High').length || 0;
//     const totalEvents = (CameraStreams?.length || 0) * 2;

//     return { totalCameras, activeCameras, highThreats, totalEvents };
//   };

//   const stats = getSystemStats();

//   return (
//     <>
//       <Header />
//       <LogoLoader />
//       {isModalOpen && (
//         <PopupModal
//           onSave={handleModalSave}
//           onCancel={() => setIsModalOpen(false)}
//         />
//       )}

//       {showMain && (
//         <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
//           {/* Animated Background Elements */}
//           <div className="absolute inset-0 overflow-hidden pointer-events-none">
//             <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
//             <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-400/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse animation-delay-1000"></div>
//             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-cyan-400/5 to-blue-500/5 rounded-full blur-3xl animate-ping"></div>
//           </div>

//           <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
//             {/* Enhanced Header Section */}
//             <div className="mb-10">
//               <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
//                 <div className="space-y-3 self-start mr-auto w-full">
//                   <div className="flex items-start gap-4">
//                     <div>
//                       <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent leading-tight">
//                         Security Cameras
//                       </h1>
//                       <p className="text-gray-400 mt-2 sm:mt-3 text-base sm:text-lg lg:text-xl">
//                         Real-time monitoring and control center for your security system
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 ml-auto">
//                   <div className="flex items-center gap-3 bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-slate-600/30">
//                     <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50 animate-pulse"></div>
//                     <span className="text-sm sm:text-base text-gray-300 font-medium">
//                       System Online
//                     </span>
//                   </div>

//                   {/* ✅ Updated: Primus Stream button now navigates */}
//                   <div className="flex gap-3">
//                     <button
//                       onClick={() => setIsModalOpen(true)}
//                       className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 sm:px-10 lg:px-12 py-3 sm:py-4 rounded-xl flex items-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-cyan-400/30 whitespace-nowrap min-w-0"
//                     >
//                       <i className="fa-solid fa-plus text-lg shrink-0"></i>
//                       <span className="font-semibold text-sm sm:text-base shrink-0">Add Camera</span>
//                     </button>

//                     <button
//                       onClick={() => {
//                         navigate('/StreamClient'); // ✅ NAVIGATE TO STREAM CLIENT
//                       }}
//                       className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-purple-400/30"
//                     >
//                       <i className="fa-solid fa-satellite-dish text-lg"></i>
//                       <span className="font-semibold hidden sm:inline">Primus Stream</span>
//                       <span className="font-semibold sm:hidden">Stream</span>
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               {/* Status Ticker */}
//               <div className="relative overflow-hidden mb-6">
//                 <div className="whitespace-nowrap text-xs sm:text-sm text-gray-300/80" style={{ animation: 'marquee 18s linear infinite' }}>
//                   <span className="mx-4 sm:mx-6">System Online</span>
//                   <span className="mx-2 text-slate-600">•</span>
//                   <span className="mx-4 sm:mx-6">High alerts: {stats.highThreats}</span>
//                   <span className="mx-2 text-slate-600">•</span>
//                   <span className="mx-4 sm:mx-6">Active cameras: {stats.activeCameras}/{stats.totalCameras}</span>
//                   <span className="mx-2 text-slate-600">•</span>
//                   <span className="mx-4 sm:mx-6">Last sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
//                 </div>
//               </div>
//             </div>

//             {/* Error Display */}
//             {cameraError && (
//               <div className="mb-6 sm:mb-8 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl p-4 sm:p-6">
//                 <div className="flex items-center gap-3 sm:gap-4">
//                   <i className="fa-solid fa-exclamation-triangle text-red-400 text-lg sm:text-xl"></i>
//                   <p className="text-red-300 text-sm sm:text-base">{cameraError}</p>
//                   <button
//                     onClick={clearError}
//                     className="ml-auto text-red-400 hover:text-red-300 p-1"
//                   >
//                     <i className="fa-solid fa-times text-lg"></i>
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* Search and Controls */}
//             <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
//               <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
//                 <div className="flex flex-wrap gap-3 flex-1">
//                   <div className="relative flex-1 min-w-[280px]">
//                     <i className="fa-solid fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
//                     <input
//                       type="text"
//                       placeholder="Search cameras by name..."
//                       value={searchTerm}
//                       onChange={(e) => setSearchTerm(e.target.value)}
//                       className="w-full pl-12 pr-4 py-3 sm:py-4 bg-gradient-to-r from-slate-700 to-slate-800 text-white placeholder-gray-400 border border-slate-600/50 focus:border-cyan-400/50 rounded-xl focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 backdrop-blur-sm text-sm sm:text-base"
//                     />
//                   </div>

//                   <button
//                     onClick={handleClearAll}
//                     disabled={CameraStreams?.length === 0}
//                     className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-red-400/30 flex items-center gap-2 sm:gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base whitespace-nowrap"
//                   >
//                     <i className="fa-solid fa-trash text-lg"></i>
//                     <span className="hidden sm:inline">Clear All</span>
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* Loading State */}
//             {isLoadingCameras && (
//               <div className="text-center py-16 sm:py-20 lg:py-24">
//                 <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-6"></div>
//                 <p className="text-white text-lg sm:text-xl">Loading cameras...</p>
//               </div>
//             )}

//             {/* Camera Streams Section */}
//             {!isLoadingCameras && filteredCameras.length === 0 ? (
//               <div className="text-center py-16 sm:py-20 lg:py-24">
//                 <div className="w-32 h-32 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 sm:mb-10 shadow-2xl border border-slate-600/30">
//                   <i className="fa-solid fa-video text-slate-400 text-5xl"></i>
//                 </div>
//                 <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 sm:mb-6">
//                   {(CameraStreams?.length || 0) === 0 ? "No Cameras Connected" : "No cameras match your search"}
//                 </h2>
//                 <p className="text-gray-400 text-base sm:text-lg lg:text-xl max-w-md mx-auto mb-8 sm:mb-10 leading-relaxed">
//                   {(CameraStreams?.length || 0) === 0
//                     ? "Get started by adding your first security camera to begin monitoring your premises."
//                     : `No cameras found matching "${searchTerm}". Try adjusting your search term.`}
//                 </p>
//                 <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
//                   <button
//                     onClick={() => setIsModalOpen(true)}
//                     className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-cyan-400/30 flex items-center gap-3 text-sm sm:text-base"
//                   >
//                     <i className="fa-solid fa-plus text-xl"></i>
//                     {(CameraStreams?.length || 0) === 0 ? "Add Your First Camera" : "Add New Camera"}
//                   </button>
//                 </div>
//               </div>
//             ) : !isLoadingCameras && (
//               <>
//                 {/* Live Feed Header */}
//                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-8 sm:mb-10">
//                   <div className="flex items-center gap-3 sm:gap-4">
//                     <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
//                       <i className="fa-solid fa-broadcast-tower text-white text-lg sm:text-xl"></i>
//                     </div>
//                     <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Live Camera Feeds</h2>
//                     <span className="px-3 sm:px-4 py-1 sm:py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm sm:text-base font-semibold rounded-full shadow-lg">
//                       {filteredCameras.length} Active
//                     </span>
//                   </div>

//                   {/* ✅ Updated: Primus Stream button now navigates */}
//                   <div className="flex gap-3">
//                     <button
//                       onClick={() => setIsModalOpen(true)}
//                       className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-cyan-400/30 flex items-center gap-2 sm:gap-3 text-sm sm:text-base whitespace-nowrap"
//                     >
//                       <i className="fa-solid fa-plus text-lg"></i>
//                       Add Camera
//                     </button>

//                     <button
//                       onClick={() => {
//                         navigate('/StreamClient');  
//                       }}
//                       className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-purple-400/30 flex items-center gap-2"
//                     >
//                       <i className="fa-solid fa-satellite-dish text-lg"></i>
//                       <span className="hidden sm:inline">Primus Stream</span>
//                       <span className="sm:hidden">Stream</span>
//                     </button>
//                   </div>
//                 </div>

//                 {/* Camera Grid */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mb-10 sm:mb-12">
//                   {filteredCameras.map((camera, index) => (
//                     <div key={camera.id || index} className="w-full">
//                       <CameraCard {...camera} />
//                     </div>
//                   ))}
//                 </div>

//                 {/* Inline Spark KPI */}
//                 <div className="mt-2">
//                   <div className="text-sm text-gray-300">
//                     Events {stats.totalEvents}
//                     <div className="h-6 mt-2">
//                       <svg viewBox="0 0 100 24" className="w-32 h-6 text-purple-400">
//                         <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,18 12,16 24,18 36,12 48,14 60,8 72,14 84,10 96,6" />
//                       </svg>
//                     </div>
//                   </div>
//                 </div>
//               </>
//             )}

//             {/* Webcam Section */}
//             {showWebcam && (
//               <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-white/10 shadow-xl mb-8 sm:mb-10 relative z-20">
//                 <div className="flex items-center justify-between mb-6 sm:mb-8">
//                   <div className="flex items-center gap-3 sm:gap-4">
//                     <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
//                       <i className="fa-solid fa-camera text-white text-lg sm:text-xl"></i>
//                     </div>
//                     <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Webcam Access</h3>
//                   </div>
//                   <button
//                     onClick={closeWebcam}
//                     className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 border border-red-400/30 text-sm sm:text-base"
//                   >
//                     <i className="fa-solid fa-times text-lg"></i>
//                   </button>
//                 </div>

//                 <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-2xl p-4 sm:p-6 lg:p-8 border border-slate-600/30 shadow-2xl">
//                   <video
//                     ref={videoRef}
//                     autoPlay
//                     playsInline
//                     muted
//                     className="w-full h-64 md:h-80 lg:h-96 rounded-xl border border-slate-600/50 shadow-lg object-cover bg-slate-800"
//                     style={{ minHeight: '256px' }}
//                   />
//                   {!stream && (
//                     <div className="w-full h-64 md:h-80 lg:h-96 rounded-xl border border-slate-600/50 bg-slate-800 flex items-center justify-center">
//                       <div className="text-center text-slate-400">
//                         <i className="fa-solid fa-camera text-4xl mb-4"></i>
//                         <p className="text-base sm:text-lg">Initializing webcam...</p>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Right-side Rail Counters */}
//           <div className="hidden xl:block fixed right-6 top-32 z-20 space-y-3">
//             <div className="group relative">
//               <div className="w-12 h-12 rounded-full bg-slate-800/70 border border-white/10 flex items-center justify-center text-cyan-400 shadow-md">
//                 <i className="fa-solid fa-video"></i>
//               </div>
//               <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-slate-900/90 text-white text-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
//                 Total: {stats.totalCameras}
//               </div>
//             </div>
//             <div className="group relative">
//               <div className="w-12 h-12 rounded-full bg-slate-800/70 border border-white/10 flex items-center justify-center text-emerald-400 shadow-md">
//                 <i className="fa-solid fa-play"></i>
//               </div>
//               <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-slate-900/90 text-white text-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
//                 Active: {stats.activeCameras}
//               </div>
//             </div>
//             <div className="group relative">
//               <div className="w-12 h-12 rounded-full bg-slate-800/70 border border-white/10 flex items-center justify-center text-red-400 shadow-md">
//                 <i className="fa-solid fa-exclamation-triangle"></i>
//               </div>
//               <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-slate-900/90 text-white text-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
//                 High: {stats.highThreats}
//               </div>
//             </div>
//             <div className="group relative">
//               <div className="w-12 h-12 rounded-full bg-slate-800/70 border border-white/10 flex items-center justify-center text-purple-400 shadow-md">
//                 <i className="fa-solid fa-chart-line"></i>
//               </div>
//               <div className="absolute right-14 top-1/2 -translate-y-1/2 px-3 py-1 rounded bg-slate-900/90 text-white text-xs border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
//                 Events: {stats.totalEvents}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }