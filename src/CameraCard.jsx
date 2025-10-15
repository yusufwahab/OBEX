import React, { useState, useEffect, useRef } from "react";
import { useCameraStore } from './store/camera-store';
import { useEventStore } from "./store/history-store";
import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle, Brain, BrainCircuit, Target } from 'lucide-react';
import { useNotificationStore } from "./store/notification-store";
import { mlAnalysisAPI } from './services/api';
import ThreatAlertModal from './components/ThreatAlertModal';
import ZoneDrawer from './components/ZoneDrawer';
import { threatWebSocket } from './services/websocket';
import { alertWebSocket } from './services/alertWebSocket';
import useAuthStore from './store/auth-store';
import { mlAnalysisService } from './services/mlAnalysisService';

export default function CameraCard({
  camera_name,
  location_name,
  date,
  time,
  threatLevel,
  id,
  streamId,
  zoneCategory,
  streamUrl,
  rtsp_url,
  streamStatus,
  onStartStream,
  onStopStream
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mlAnalysisStatus, setMlAnalysisStatus] = useState('inactive');
  const [showZoneDrawer, setShowZoneDrawer] = useState(false);
  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [currentThreat, setCurrentThreat] = useState(null);
  const videoContainerRef = useRef(null);

  // Get store methods
  const { addNotification } = useNotificationStore();
  const { removeFromCameraStreams } = useCameraStore();
  const { addEvent } = useEventStore();
  const { user } = useAuthStore();

  // Use location_name or camera_name
  const displayName = location_name || camera_name || "Unknown Camera";
  const finalStreamUrl = rtsp_url || streamUrl;
 
  // Debug logging for ML analysis issues
  useEffect(() => {
    if (streamStatus || mlAnalysisStatus !== 'inactive') {
      console.log(`📊 Camera ${displayName} status update:`);
      console.log(`   ID: ${id}`);
      console.log(`   Stream Status: ${streamStatus}`);
      console.log(`   ML Analysis Status: ${mlAnalysisStatus}`);
      console.log(`   RTSP URL: ${finalStreamUrl ? 'Available' : 'Missing'}`);
      console.log(`   Can Start ML: ${streamStatus === 'active' && finalStreamUrl}`);
    }
  }, [streamStatus, mlAnalysisStatus, displayName, id, finalStreamUrl]);

  const threatColors = {
    Low: "bg-gradient-to-r from-emerald-500 to-green-500",
    Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
    High: "bg-gradient-to-r from-red-600 to-pink-600"
  };

  const threatShadows = {
    Low: "shadow-emerald-500/30",
    Medium: "shadow-amber-500/30",
    High: "shadow-red-500/40"
  };

  const threatIcons = {
    Low: "🟢",
    Medium: "🟡",
    High: "🔴"
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    connecting: "bg-yellow-100 text-yellow-800",
    inactive: "bg-red-100 text-red-800"
  };

  const handleView = (e) => {
    e.stopPropagation();
    const timestamp = new Date().toISOString();
    addEvent({
      streamId,
      camera_name: displayName,
      date: date || new Date().toISOString().split('T')[0],
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      streamUrl: finalStreamUrl,
      threatLevel: threatLevel || 'Low',
      zoneCategory: zoneCategory || "Unknown",
      type: 'VIEWED',
      timestamp,
    });
  };

  const toggleFullscreen = (e) => {
    e.stopPropagation();

    if (!isFullscreen) {
      if (videoContainerRef.current.requestFullscreen) {
        videoContainerRef.current.requestFullscreen();
      } else if (videoContainerRef.current.webkitRequestFullscreen) {
        videoContainerRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Set up WebSocket alert callback for this camera
    const handleAlert = (alertData) => {
      if (alertData.cameraId === id || alertData.camera_id === id) {
        setCurrentThreat(alertData);
        setShowThreatAlert(true);
      }
    };

    // Add alert callback
    alertWebSocket.addAlertCallback(handleAlert);

    // Connect alert WebSocket if not already connected
    if (!alertWebSocket.isConnected && user?._id) {
      alertWebSocket.connect();
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      alertWebSocket.removeAlertCallback(handleAlert);
    };
  }, [id]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (isDeleting) return;

    const isConfirmed = window.confirm(`Are you sure you want to delete "${displayName}"?`);
    if (isConfirmed) {
      setIsDeleting(true);
      try {
        // Stop stream first if active
        if (streamStatus === 'active' && onStopStream) {
          onStopStream();
        }

        const timestamp = new Date().toISOString();
        addEvent({
          id,
          camera_name: displayName,
          date: date || new Date().toISOString().split('T')[0],
          time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          streamUrl: finalStreamUrl,
          threatLevel: threatLevel || 'Low',
          zoneCategory: zoneCategory || "Unknown",
          type: 'DELETED',
          timestamp,
          description: `Deleted camera "${displayName}"`
        });

        await removeFromCameraStreams(id);
        console.log(`✅ Camera ${displayName} deleted successfully`);
      } catch (error) {
        console.error("❌ Error deleting camera:", error);
        alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
        setIsDeleting(false);
      }
    }
  };

  const handleStreamToggle = (e) => {
    e.stopPropagation();

    // CRITICAL FIX: Validate RTSP URL before attempting to stream
    if (!finalStreamUrl || finalStreamUrl.trim() === '') {
      console.error(`❌ No RTSP URL for camera ${displayName}`);
      alert(`Cannot start stream: Camera "${displayName}" has no RTSP URL configured.\n\nPlease delete and re-add this camera with proper configuration.`);
      return;
    }

    // Log the RTSP URL (masked) for debugging
    console.log(`🎥 Stream toggle for "${displayName}":`);
    console.log(`   Status: ${streamStatus || 'inactive'}`);
    console.log(`   RTSP URL: ${finalStreamUrl.replace(/:[^:@]+@/, ':****@')}`);

    if (streamStatus === 'active' && onStopStream) {
      console.log(`⏹️ Stopping stream for ${displayName}`);
      onStopStream();
    } else if ((streamStatus === 'inactive' || !streamStatus) && onStartStream) {
      console.log(`▶️ Starting stream for ${displayName}`);
      onStartStream();
    } else if (streamStatus === 'connecting') {
      console.log(`⏳ Stream is already connecting for ${displayName}`);
    }
  };

  const handleMlAnalysisToggle = async (e) => {
    e.stopPropagation();

    // Enhanced validation for ML analysis
    console.log(`\n🧠 ===== ML Analysis Toggle Debug =====`);
    console.log(`Camera: ${displayName} (ID: ${id})`);
    console.log(`Stream Status: ${streamStatus}`);
    console.log(`ML Analysis Status: ${mlAnalysisStatus}`);
    console.log(`RTSP URL: ${finalStreamUrl ? finalStreamUrl.replace(/:[^:@]+@/, ':****@') : 'MISSING'}`);
    console.log(`Button Disabled: ${streamStatus !== 'active' || mlAnalysisStatus === 'starting' || mlAnalysisStatus === 'stopping'}`);
    console.log(`=====================================\n`);

    // ALLOW ML ANALYSIS FOR LEFT CAMERA (non-streaming) - Remove stream requirement
    // Check if stream is active before allowing ML analysis
    // if (streamStatus !== 'active') {
    //   console.warn(`⚠️ Cannot start ML analysis: Stream not active (status: ${streamStatus})`);
    //   alert(`Cannot start ML analysis: Video stream is not active.\n\nCurrent status: ${streamStatus}\n\nPlease start the video stream first, then try enabling ML analysis.`);
    //   return;
    // }

    // Validate RTSP URL exists
    if (!finalStreamUrl || finalStreamUrl.trim() === '') {
      console.error(`❌ Cannot start ML analysis: No RTSP URL for camera ${displayName}`);
      alert(`Cannot start ML analysis: No RTSP URL configured.\n\nCamera: ${displayName}\n\nPlease check camera configuration and ensure RTSP URL is properly set.`);
      return;
    }

    try {
      if (mlAnalysisStatus === 'active') {
        console.log(`🛑 Stopping ML analysis for camera ${displayName} (ID: ${id})`);
        setMlAnalysisStatus('stopping'); // Add intermediate state
        await mlAnalysisService.stopAnalysis(id, displayName, finalStreamUrl);
        setMlAnalysisStatus('inactive');
        console.log(`✅ ML analysis stopped successfully for ${displayName}`);
      } else {
        console.log(`🚀 Starting ML analysis for camera ${displayName} (ID: ${id})`);
        console.log(`📡 RTSP URL: ${finalStreamUrl.replace(/:[^:@]+@/, ':****@')}`);
        setMlAnalysisStatus('starting'); // Add intermediate state
        await mlAnalysisService.startAnalysis(id, displayName, finalStreamUrl);
        setMlAnalysisStatus('active');
        console.log(`✅ ML analysis started successfully for ${displayName}`);
      }
    } catch (error) {
      console.error(`❌ ML analysis toggle failed for ${displayName}:`, error);
      console.error('Full error object:', error);
     
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to toggle ML analysis';
     
      if (error.userMessage) {
        errorMessage = error.userMessage;
      } else if (error.message?.includes('RTSP URL is required')) {
        errorMessage = 'RTSP URL is missing or invalid';
      } else if (error.message?.includes('unavailable')) {
        errorMessage = 'ML analysis service is currently unavailable';
      } else if (error.response?.status === 500) {
        errorMessage = 'ML analysis service is currently unavailable or not configured on the server. Please contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
     
      alert(`ML Analysis Error\n\nCamera: ${displayName}\nError: ${errorMessage}\n\nThis is likely a backend service issue. The ML analysis service may not be running or properly configured on the server.`);
      setMlAnalysisStatus('inactive');
    }
  };

  const handleZoneDrawing = (e) => {
    e.stopPropagation();
    setShowZoneDrawer(true);
  };

  const handleZoneSet = async (zoneCoords) => {
    try {
      await mlAnalysisService.setDetectionZone(id, zoneCoords, displayName);
      console.log(`✅ Detection zone set for ${displayName}:`, zoneCoords);
    } catch (error) {
      console.error(`❌ Failed to set detection zone for ${displayName}:`, error);
      alert('Failed to save detection zone');
    }
  };

  const handleCloseThreatAlert = () => {
    setShowThreatAlert(false);
    setCurrentThreat(null);
  };

  const simulateThreat = (e) => {
    e.stopPropagation();
    alertWebSocket.simulateAlert(id);
  };

  return (
    <section
      className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20"
      onClick={handleView}
    >
      {/* Video Container */}
      <div
        ref={videoContainerRef}
        className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900
          h-64 sm:h-72 lg:h-96
          w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0
          ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
      >
        {/* WebRTC Video Element - CRITICAL: Must have correct ID */}
        <video
          id={`video-${streamId}`}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover hidden"
          onLoadedMetadata={(e) => {
            console.log(`📺 Video metadata loaded for ${displayName}: ${e.target.videoWidth}x${e.target.videoHeight}`);
          }}
          onPlay={() => {
            console.log(`▶️ Video started playing for ${displayName}`);
          }}
          onError={(e) => {
            console.error(`❌ Video error for ${displayName}:`, e);
          }}
        />

        {/* Placeholder */}
        <div
          id={`placeholder-${streamId}`}
          className="w-full h-full flex items-center justify-center bg-slate-800"
        >
          <div className="text-center text-slate-400">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">
              {streamStatus === 'connecting' ? 'Connecting to camera...' :
               streamStatus === 'active' ? 'Loading video stream...' :
               'Stream Inactive'}
            </p>
            {streamStatus === 'inactive' && (
              <p className="text-xs mt-2 opacity-75">Click "Stream" button to start</p>
            )}
            {streamStatus === 'connecting' && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                <span className="text-xs">Establishing connection...</span>
              </div>
            )}
          </div>
        </div>

        {/* Zone Drawer Overlay */}
        <ZoneDrawer
          cameraId={id}
          isActive={showZoneDrawer}
          onZoneSet={handleZoneSet}
          onClose={() => setShowZoneDrawer(false)}
        />

        {/* Control Buttons Overlay */}
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={toggleFullscreen}
            className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Camera Info Section */}
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusColors[streamStatus] || statusColors.inactive} shadow-lg`}></div>
            <h3 className="text-xl font-bold text-white truncate">{displayName}</h3>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${threatColors[threatLevel]} ${threatShadows[threatLevel]} shadow-lg`}>
            {threatIcons[threatLevel]} {threatLevel}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-gray-300">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span className="text-sm">{zoneCategory || "Zone Unknown"}</span>
          </div>
          <div className="flex items-center gap-4 text-gray-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-sm">{date || new Date().toISOString().split('T')[0]}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm">{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </div>
          </div>
         
          {/* ML Analysis Status Indicator */}
          {streamStatus === 'active' && (
            <div className="flex items-center gap-2 text-gray-300">
              <BrainCircuit className={`w-4 h-4 ${
                mlAnalysisStatus === 'active' ? 'text-green-400' :
                mlAnalysisStatus === 'starting' || mlAnalysisStatus === 'stopping' ? 'text-yellow-400' :
                'text-gray-500'
              }`} />
              <span className="text-sm">
                ML Analysis: {
                  mlAnalysisStatus === 'active' ? 'Active' :
                  mlAnalysisStatus === 'starting' ? 'Starting...' :
                  mlAnalysisStatus === 'stopping' ? 'Stopping...' :
                  'Ready'
                }
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Stream Control Button */}
          <button
            onClick={handleStreamToggle}
            disabled={!finalStreamUrl}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              streamStatus === 'active'
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white'
                : streamStatus === 'connecting'
                ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
            } ${!finalStreamUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {streamStatus === 'active' ? (
              <><StopCircle className="w-4 h-4" /> Stop</>
            ) : streamStatus === 'connecting' ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting</>
            ) : (
              <><Play className="w-4 h-4" /> Stream</>
            )}
          </button>

          <button
            onClick={handleMlAnalysisToggle}
            disabled={mlAnalysisStatus === 'starting' || mlAnalysisStatus === 'stopping'}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              mlAnalysisStatus === 'active'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                : mlAnalysisStatus === 'starting' || mlAnalysisStatus === 'stopping'
                ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
            } disabled:transform-none`}
            title={mlAnalysisStatus === 'active' ? 'Stop ML analysis' : 'Start ML analysis'}
          >
            {mlAnalysisStatus === 'active' ? (
              <><BrainCircuit className="w-4 h-4" /> ML Active</>
            ) : mlAnalysisStatus === 'starting' ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Starting</>
            ) : mlAnalysisStatus === 'stopping' ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Stopping</>
            ) : (
              <><Brain className="w-4 h-4" /> Start ML</>
            )}
          </button>

          <button
            onClick={handleZoneDrawing}
            disabled={streamStatus !== 'active'}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              streamStatus === 'active'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-300 cursor-not-allowed opacity-50'
            } disabled:transform-none`}
            title={streamStatus !== 'active' ? 'Start video stream first to set detection zone' : 'Set detection zone for ML analysis'}
          >
            <Target className="w-4 h-4" /> Set Zone
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete</>
            )}
          </button>
        </div>

        {/* Test Button (Development Only) */}
        {/* {import.meta.env.DEV && (
          <button
            onClick={simulateThreat}
            className="w-full mt-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
          >
            🧪 Simulate Threat
          </button>
        )} */}
      </div>

      {/* Threat Alert Modal */}
      <ThreatAlertModal
        isOpen={showThreatAlert}
        onClose={handleCloseThreatAlert}
        alertData={currentThreat}
      />
    </section>
  );
};
