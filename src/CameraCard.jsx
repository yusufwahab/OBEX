import React, { useState, useEffect, useRef } from "react";
import { useCameraStore } from './store/camera-store';
import { useEventStore } from "./store/history-store";
import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle, Brain, BrainCircuit, Target } from 'lucide-react';
import { useNotificationStore } from "./store/notification-store";
import { mlAnalysisAPI } from './services/api';
import ThreatAlertModal from './components/ThreatAlertModal';
import ZoneDrawer from './components/ZoneDrawer';
import { threatWebSocket } from './services/websocket';
import { mlAnalysisService } from './services/mlAnalysisService';

export default function CameraCard({ 
  camera_name, 
  location_name,
  date, 
  time, 
  threatLevel, 
  id, 
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

  // Use location_name or camera_name
  const displayName = location_name || camera_name || "Unknown Camera";
  const finalStreamUrl = rtsp_url || streamUrl;

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
      id,
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

    // Set up WebSocket threat callback for this camera
    threatWebSocket.setThreatCallback((threatData) => {
      if (threatData.cameraId === id) {
        setCurrentThreat(threatData);
        setShowThreatAlert(true);
      }
    });

    // Connect WebSocket if not already connected
    if (!threatWebSocket.isConnected) {
      threatWebSocket.connect();
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
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

    try {
      if (mlAnalysisStatus === 'active') {
        console.log(`🧠 Stopping ML analysis for camera ${displayName} (ID: ${id})`);
        await mlAnalysisService.stopAnalysis(id, displayName);
        setMlAnalysisStatus('inactive');
        console.log(`✅ ML analysis stopped for ${displayName}`);
      } else {
        console.log(`🧠 Starting ML analysis for camera ${displayName} (ID: ${id})`);
        await mlAnalysisService.startAnalysis(id, displayName);
        setMlAnalysisStatus('active');
        console.log(`✅ ML analysis started for ${displayName}`);
      }
    } catch (error) {
      console.error(`❌ ML analysis toggle failed for ${displayName}:`, error);
      const errorMessage = error.userMessage || error.message || 'Failed to toggle ML analysis';
      alert(`ML Analysis Error: ${errorMessage}`);
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
    threatWebSocket.simulateThreat('intrusion');
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
          id={`video-${id}`}
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
          id={`placeholder-${id}`}
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
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
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
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              mlAnalysisStatus === 'active'
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white'
                : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
            }`}
          >
            {mlAnalysisStatus === 'active' ? (
              <><BrainCircuit className="w-4 h-4" /> ML Active</>
            ) : (
              <><Brain className="w-4 h-4" /> Start ML</>
            )}
          </button>

          <button
            onClick={handleZoneDrawing}
            disabled={streamStatus !== 'active'}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              streamStatus === 'active'
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white'
                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-400 cursor-not-allowed opacity-50'
            }`}
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






































// import React, { useState, useEffect, useRef } from "react";
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle } from 'lucide-react';
// import { useNotificationStore } from "./store/notification-store";

// export default function CameraCard({ 
//   camera_name, 
//   location_name,
//   date, 
//   time, 
//   threatLevel, 
//   id, 
//   zoneCategory, 
//   streamUrl,
//   rtsp_url,
//   streamStatus,
//   onStartStream,
//   onStopStream
// }) {
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const videoContainerRef = useRef(null);

//   // Get store methods
//   const { addNotification } = useNotificationStore();
//   const { removeFromCameraStreams } = useCameraStore();
//   const { addEvent } = useEventStore();

//   // Use location_name or camera_name
//   const displayName = location_name || camera_name || "Unknown Camera";
//   const finalStreamUrl = rtsp_url || streamUrl;

//   const threatColors = {
//     Low: "bg-gradient-to-r from-emerald-500 to-green-500",
//     Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
//     High: "bg-gradient-to-r from-red-600 to-pink-600"
//   };

//   const threatShadows = {
//     Low: "shadow-emerald-500/30",
//     Medium: "shadow-amber-500/30",
//     High: "shadow-red-500/40"
//   };

//   const threatIcons = {
//     Low: "🟢",
//     Medium: "🟡",
//     High: "🔴"
//   };

//   const statusColors = {
//     active: "bg-green-100 text-green-800",
//     connecting: "bg-yellow-100 text-yellow-800",
//     inactive: "bg-red-100 text-red-800"
//   };

//   const handleView = (e) => {
//     e.stopPropagation();
//     const timestamp = new Date().toISOString();
//     addEvent({
//       id,
//       camera_name: displayName,
//       date: date || new Date().toISOString().split('T')[0],
//       time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//       streamUrl: finalStreamUrl,
//       threatLevel: threatLevel || 'Low',
//       zoneCategory: zoneCategory || "Unknown",
//       type: 'VIEWED',
//       timestamp,
//     });
//   };

//   const toggleFullscreen = (e) => {
//     e.stopPropagation();

//     if (!isFullscreen) {
//       if (videoContainerRef.current.requestFullscreen) {
//         videoContainerRef.current.requestFullscreen();
//       } else if (videoContainerRef.current.webkitRequestFullscreen) {
//         videoContainerRef.current.webkitRequestFullscreen();
//       }
//     } else {
//       if (document.exitFullscreen) {
//         document.exitFullscreen();
//       } else if (document.webkitExitFullscreen) {
//         document.webkitExitFullscreen();
//       }
//     }
//   };

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(!!document.fullscreenElement);
//     };

//     document.addEventListener('fullscreenchange', handleFullscreenChange);
//     document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

//     return () => {
//       document.removeEventListener('fullscreenchange', handleFullscreenChange);
//       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
//     };
//   }, []);

//   const handleDelete = async (e) => {
//     e.stopPropagation();
//     if (isDeleting) return;

//     const isConfirmed = window.confirm(`Are you sure you want to delete "${displayName}"?`);
//     if (isConfirmed) {
//       setIsDeleting(true);
//       try {
//         // Stop stream first if active
//         if (streamStatus === 'active' && onStopStream) {
//           onStopStream();
//         }

//         const timestamp = new Date().toISOString();
//         addEvent({
//           id,
//           camera_name: displayName,
//           date: date || new Date().toISOString().split('T')[0],
//           time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           streamUrl: finalStreamUrl,
//           threatLevel: threatLevel || 'Low',
//           zoneCategory: zoneCategory || "Unknown",
//           type: 'DELETED',
//           timestamp,
//           description: `Deleted camera "${displayName}"`
//         });

//         await removeFromCameraStreams(id);
//         console.log(`Camera ${displayName} deleted successfully`);
//       } catch (error) {
//         console.error("Error deleting camera:", error);
//         alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
//         setIsDeleting(false);
//       }
//     }
//   };

//   const handleStreamToggle = (e) => {
//     e.stopPropagation();
    
//     if (!finalStreamUrl) {
//       alert('No stream URL configured for this camera');
//       return;
//     }

//     if (streamStatus === 'active' && onStopStream) {
//       onStopStream();
//     } else if ((streamStatus === 'inactive' || !streamStatus) && onStartStream) {
//       onStartStream();
//     }
//   };

//   return (
//     <section
//       className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20"
//       onClick={handleView}
//     >
//       {/* Video Container */}
//       <div
//         ref={videoContainerRef}
//         className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
//           h-64 sm:h-72 lg:h-96 
//           w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
//           ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
//       >
//         {/* WebRTC Video Element */}
//         <video
//           id={`video-${id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />

//         {/* Placeholder */}
//         <div
//           id={`placeholder-${id}`}
//           className="w-full h-full flex items-center justify-center bg-slate-800"
//         >
//           <div className="text-center text-slate-400">
//             <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
//             <p className="text-sm">
//               {streamStatus === 'connecting' ? 'Connecting...' : 
//                streamStatus === 'active' ? 'Loading stream...' : 
//                'Stream Inactive'}
//             </p>
//             {streamStatus === 'inactive' && (
//               <p className="text-xs mt-2">Click stream button to start</p>
//             )}
//           </div>
//         </div>

//         {/* Stream Status Badge */}
//         {streamStatus && (
//           <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[streamStatus]} shadow-lg`}>
//             {streamStatus.toUpperCase()}
//           </div>
//         )}

//         {/* Fullscreen Toggle */}
//         <button
//           onClick={toggleFullscreen}
//           className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
//         >
//           {isFullscreen ? (
//             <Minimize2 size={18} className="text-cyan-400" />
//           ) : (
//             <Maximize2 size={18} className="text-cyan-400" />
//           )}
//         </button>
//       </div>

//       {/* Card Info Section */}
//       {!isFullscreen && (
//         <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 transition-all duration-300 min-h-[110px]">
//           <div className="space-y-3 mb-4">
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Calendar className="w-3 h-3 text-cyan-400" />
//               <span>{date || new Date().toISOString().split('T')[0]}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Clock className="w-3 h-3 text-cyan-400" />
//               <span>{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
//             </div>
//             <h3 className="text-white text-base font-bold uppercase tracking-wide flex items-center gap-2 truncate">
//               <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0" />
//               <span className="truncate">{displayName}</span>
//             </h3>
//           </div>

//           <div className="flex items-center justify-between gap-2">
//             <div className="flex items-center gap-2 flex-wrap">
//               {/* Threat Level Badge */}
//               {threatLevel && (
//                 <div className="relative group/badge">
//                   <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} flex items-center gap-1.5`}>
//                     <span className="text-xs">{threatIcons[threatLevel]}</span>
//                     <span>{threatLevel}</span>
//                   </span>
//                 </div>
//               )}

//               {/* Zone Badge */}
//               {zoneCategory && (
//                 <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5">
//                   <MapPin className="w-3 h-3 flex-shrink-0" />
//                   <span className="truncate max-w-[80px]">{zoneCategory}</span>
//                 </div>
//               )}

//               {/* Stream Control Button */}
//               <button
//                 onClick={handleStreamToggle}
//                 disabled={streamStatus === 'connecting'}
//                 className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 shadow-lg ${
//                   streamStatus === 'active'
//                     ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
//                     : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
//                 } disabled:opacity-50 disabled:cursor-not-allowed`}
//               >
//                 {streamStatus === 'connecting' ? (
//                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 ) : streamStatus === 'active' ? (
//                   <StopCircle size={14} />
//                 ) : (
//                   <Play size={14} />
//                 )}
//                 <span>
//                   {streamStatus === 'connecting' ? 'Connecting' : streamStatus === 'active' ? 'Stop' : 'Stream'}
//                 </span>
//               </button>
//             </div>

//             {/* Delete Button */}
//             <button
//               onClick={handleDelete}
//               disabled={isDeleting}
//               className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 transition-all duration-300 transform hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
//             >
//               {isDeleting ? (
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//               ) : (
//                 <Trash2 size={14} />
//               )}
//               <span className="text-xs font-medium hidden sm:block">
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </span>
//             </button>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }







































// import React, { useState, useEffect, useRef } from "react";
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle } from 'lucide-react';
// import { useNotificationStore } from "./store/notification-store";

// export default function CameraCard({ 
//   camera_name, 
//   location_name,
//   date, 
//   time, 
//   threatLevel, 
//   id, 
//   zoneCategory, 
//   streamUrl,
//   rtsp_url,
//   streamStatus,
//   onStartStream,
//   onStopStream,
//   savedLocally // New prop to indicate local-only camera
// }) {
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const videoContainerRef = useRef(null);

//   // Get store methods
//   const { addNotification } = useNotificationStore();
//   const { removeFromCameraStreams } = useCameraStore();
//   const { addEvent } = useEventStore();

//   // Use location_name or camera_name
//   const displayName = location_name || camera_name || "Unknown Camera";
//   const finalStreamUrl = rtsp_url || streamUrl;

//   const threatColors = {
//     Low: "bg-gradient-to-r from-emerald-500 to-green-500",
//     Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
//     High: "bg-gradient-to-r from-red-600 to-pink-600"
//   };

//   const threatShadows = {
//     Low: "shadow-emerald-500/30",
//     Medium: "shadow-amber-500/30",
//     High: "shadow-red-500/40"
//   };

//   const threatIcons = {
//     Low: "🟢",
//     Medium: "🟡",
//     High: "🔴"
//   };

//   const statusColors = {
//     active: "bg-green-100 text-green-800",
//     connecting: "bg-yellow-100 text-yellow-800",
//     inactive: "bg-red-100 text-red-800"
//   };

//   const handleView = (e) => {
//     e.stopPropagation();
//     const timestamp = new Date().toISOString();
//     addEvent({
//       id,
//       camera_name: displayName,
//       date: date || new Date().toISOString().split('T')[0],
//       time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//       streamUrl: finalStreamUrl,
//       threatLevel: threatLevel || 'Low',
//       zoneCategory: zoneCategory || "Unknown",
//       type: 'VIEWED',
//       timestamp,
//     });
//   };

//   const toggleFullscreen = (e) => {
//     e.stopPropagation();

//     if (!isFullscreen) {
//       if (videoContainerRef.current.requestFullscreen) {
//         videoContainerRef.current.requestFullscreen();
//       } else if (videoContainerRef.current.webkitRequestFullscreen) {
//         videoContainerRef.current.webkitRequestFullscreen();
//       }
//     } else {
//       if (document.exitFullscreen) {
//         document.exitFullscreen();
//       } else if (document.webkitExitFullscreen) {
//         document.webkitExitFullscreen();
//       }
//     }
//   };

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(!!document.fullscreenElement);
//     };

//     document.addEventListener('fullscreenchange', handleFullscreenChange);
//     document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

//     return () => {
//       document.removeEventListener('fullscreenchange', handleFullscreenChange);
//       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
//     };
//   }, []);

//   const handleDelete = async (e) => {
//     e.stopPropagation();
//     if (isDeleting) return;

//     const isConfirmed = window.confirm(`Are you sure you want to delete "${displayName}"?`);
//     if (isConfirmed) {
//       setIsDeleting(true);
//       try {
//         // Stop stream first if active
//         if (streamStatus === 'active' && onStopStream) {
//           onStopStream();
//         }

//         const timestamp = new Date().toISOString();
//         addEvent({
//           id,
//           camera_name: displayName,
//           date: date || new Date().toISOString().split('T')[0],
//           time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           streamUrl: finalStreamUrl,
//           threatLevel: threatLevel || 'Low',
//           zoneCategory: zoneCategory || "Unknown",
//           type: 'DELETED',
//           timestamp,
//           description: `Deleted camera "${displayName}"`
//         });

//         await removeFromCameraStreams(id);
//         console.log(`Camera ${displayName} deleted successfully`);
//       } catch (error) {
//         console.error("Error deleting camera:", error);
//         alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
//       } finally {
//         setIsDeleting(false);
//       }
//     }
//   };

//   const handleStreamToggle = (e) => {
//     e.stopPropagation();
    
//     if (!finalStreamUrl) {
//       alert('No stream URL configured for this camera');
//       return;
//     }

//     if (streamStatus === 'active' && onStopStream) {
//       onStopStream();
//     } else if ((streamStatus === 'inactive' || !streamStatus) && onStartStream) {
//       onStartStream();
//     }
//   };

//   return (
//     <section
//       className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20"
//       onClick={handleView}
//     >
//       {/* Video Container */}
//       <div
//         ref={videoContainerRef}
//         className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
//           h-64 sm:h-72 lg:h-96 
//           w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
//           ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
//       >
//         {/* WebRTC Video Element */}
//         <video
//           id={`video-${id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />

//         {/* Placeholder */}
//         <div
//           id={`placeholder-${id}`}
//           className="w-full h-full flex items-center justify-center bg-slate-800"
//         >
//           <div className="text-center text-slate-400">
//             <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
//             <p className="text-sm">
//               {streamStatus === 'connecting' ? 'Connecting...' : 
//                streamStatus === 'active' ? 'Loading stream...' : 
//                'Stream Inactive'}
//             </p>
//             {streamStatus === 'inactive' && (
//               <p className="text-xs mt-2">Click stream button to start</p>
//             )}
//           </div>
//         </div>

//         {/* Stream Status Badge */}
//         {streamStatus && (
//           <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[streamStatus]} shadow-lg`}>
//             {streamStatus.toUpperCase()}
//           </div>
//         )}

//         {/* Fullscreen Toggle */}
//         <button
//           onClick={toggleFullscreen}
//           className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
//         >
//           {isFullscreen ? (
//             <Minimize2 size={18} className="text-cyan-400" />
//           ) : (
//             <Maximize2 size={18} className="text-cyan-400" />
//           )}
//         </button>
//       </div>

//       {/* Card Info Section */}
//       {!isFullscreen && (
//         <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 transition-all duration-300 min-h-[110px]">
//           <div className="space-y-3 mb-4">
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Calendar className="w-3 h-3 text-cyan-400" />
//               <span>{date || new Date().toISOString().split('T')[0]}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Clock className="w-3 h-3 text-cyan-400" />
//               <span>{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
//             </div>
//             <h3 className="text-white text-base font-bold uppercase tracking-wide flex items-center gap-2 truncate">
//               <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0" />
//               <span className="truncate">{displayName}</span>
//             </h3>
//           </div>

//           <div className="flex items-center justify-between gap-2">
//             <div className="flex items-center gap-2 flex-wrap">
//               {/* Threat Level Badge */}
//               {threatLevel && (
//                 <div className="relative group/badge">
//                   <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} flex items-center gap-1.5`}>
//                     <span className="text-xs">{threatIcons[threatLevel]}</span>
//                     <span>{threatLevel}</span>
//                   </span>
//                 </div>
//               )}

//               {/* Zone Badge */}
//               {zoneCategory && (
//                 <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5">
//                   <MapPin className="w-3 h-3 flex-shrink-0" />
//                   <span className="truncate max-w-[80px]">{zoneCategory}</span>
//                 </div>
//               )}

//               {/* Stream Control Button */}
//               <button
//                 onClick={handleStreamToggle}
//                 disabled={streamStatus === 'connecting'}
//                 className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 shadow-lg ${
//                   streamStatus === 'active'
//                     ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
//                     : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
//                 } disabled:opacity-50 disabled:cursor-not-allowed`}
//               >
//                 {streamStatus === 'connecting' ? (
//                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 ) : streamStatus === 'active' ? (
//                   <StopCircle size={14} />
//                 ) : (
//                   <Play size={14} />
//                 )}
//                 <span>
//                   {streamStatus === 'connecting' ? 'Connecting' : streamStatus === 'active' ? 'Stop' : 'Stream'}
//                 </span>
//               </button>
//             </div>

//             {/* Delete Button */}
//             <button
//               onClick={handleDelete}
//               disabled={isDeleting}
//               className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 transition-all duration-300 transform hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
//             >
//               {isDeleting ? (
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//               ) : (
//                 <Trash2 size={14} />
//               )}
//               <span className="text-xs font-medium hidden sm:block">
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </span>
//             </button>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }






































// import React, { useState, useEffect, useRef } from "react";
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle } from 'lucide-react';
// import { useNotificationStore } from "./store/notification-store";

// export default function CameraCard({ 
//   camera_name, 
//   location_name,
//   date, 
//   time, 
//   threatLevel, 
//   id, 
//   zoneCategory, 
//   streamUrl,
//   rtsp_url,
//   streamStatus,
//   onStartStream,
//   onStopStream
// }) {
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const videoContainerRef = useRef(null);

//   // Get store methods
//   const { addNotification } = useNotificationStore();
//   const { removeFromCameraStreams } = useCameraStore();
//   const { addEvent } = useEventStore();

//   // Use location_name or camera_name
//   const displayName = location_name || camera_name || "Unknown Camera";
//   const finalStreamUrl = rtsp_url || streamUrl;

//   const threatColors = {
//     Low: "bg-gradient-to-r from-emerald-500 to-green-500",
//     Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
//     High: "bg-gradient-to-r from-red-600 to-pink-600"
//   };

//   const threatShadows = {
//     Low: "shadow-emerald-500/30",
//     Medium: "shadow-amber-500/30",
//     High: "shadow-red-500/40"
//   };

//   const threatIcons = {
//     Low: "🟢",
//     Medium: "🟡",
//     High: "🔴"
//   };

//   const statusColors = {
//     active: "bg-green-100 text-green-800",
//     connecting: "bg-yellow-100 text-yellow-800",
//     inactive: "bg-red-100 text-red-800"
//   };

//   const handleView = (e) => {
//     e.stopPropagation();
//     const timestamp = new Date().toISOString();
//     addEvent({
//       id,
//       camera_name: displayName,
//       date: date || new Date().toISOString().split('T')[0],
//       time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//       streamUrl: finalStreamUrl,
//       threatLevel: threatLevel || 'Low',
//       zoneCategory: zoneCategory || "Unknown",
//       type: 'VIEWED',
//       timestamp,
//     });
//   };

//   const toggleFullscreen = (e) => {
//     e.stopPropagation();

//     if (!isFullscreen) {
//       if (videoContainerRef.current.requestFullscreen) {
//         videoContainerRef.current.requestFullscreen();
//       } else if (videoContainerRef.current.webkitRequestFullscreen) {
//         videoContainerRef.current.webkitRequestFullscreen();
//       }
//     } else {
//       if (document.exitFullscreen) {
//         document.exitFullscreen();
//       } else if (document.webkitExitFullscreen) {
//         document.webkitExitFullscreen();
//       }
//     }
//   };

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(!!document.fullscreenElement);
//     };

//     document.addEventListener('fullscreenchange', handleFullscreenChange);
//     document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

//     return () => {
//       document.removeEventListener('fullscreenchange', handleFullscreenChange);
//       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
//     };
//   }, []);

//   const handleDelete = async (e) => {
//     e.stopPropagation();
//     if (isDeleting) return;

//     const isConfirmed = window.confirm(`Are you sure you want to delete "${displayName}"?`);
//     if (isConfirmed) {
//       setIsDeleting(true);
//       try {
//         // Stop stream first if active
//         if (streamStatus === 'active' && onStopStream) {
//           onStopStream();
//         }

//         const timestamp = new Date().toISOString();
//         addEvent({
//           id,
//           camera_name: displayName,
//           date: date || new Date().toISOString().split('T')[0],
//           time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           streamUrl: finalStreamUrl,
//           threatLevel: threatLevel || 'Low',
//           zoneCategory: zoneCategory || "Unknown",
//           type: 'DELETED',
//           timestamp,
//           description: `Deleted camera "${displayName}"`
//         });

//         await removeFromCameraStreams(id);
//         console.log(`Camera ${displayName} deleted successfully`);
//       } catch (error) {
//         console.error("Error deleting camera:", error);
//         alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
//       } finally {
//         setIsDeleting(false);
//       }
//     }
//   };

//   const handleStreamToggle = (e) => {
//     e.stopPropagation();
    
//     if (!finalStreamUrl) {
//       alert('No stream URL configured for this camera');
//       return;
//     }

//     if (streamStatus === 'active' && onStopStream) {
//       onStopStream();
//     } else if ((streamStatus === 'inactive' || !streamStatus) && onStartStream) {
//       onStartStream();
//     }
//   };

//   return (
//     <section
//       className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20"
//       onClick={handleView}
//     >
//       {/* Video Container */}
//       <div
//         ref={videoContainerRef}
//         className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
//           h-64 sm:h-72 lg:h-96 
//           w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
//           ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
//       >
//         {/* WebRTC Video Element */}
//         <video
//           id={`video-${id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />

//         {/* Placeholder */}
//         <div
//           id={`placeholder-${id}`}
//           className="w-full h-full flex items-center justify-center bg-slate-800"
//         >
//           <div className="text-center text-slate-400">
//             <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
//             <p className="text-sm">
//               {streamStatus === 'connecting' ? 'Connecting...' : 
//                streamStatus === 'active' ? 'Loading stream...' : 
//                'Stream Inactive'}
//             </p>
//             {streamStatus === 'inactive' && (
//               <p className="text-xs mt-2">Click stream button to start</p>
//             )}
//           </div>
//         </div>

//         {/* Stream Status Badge */}
//         {streamStatus && (
//           <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[streamStatus]} shadow-lg`}>
//             {streamStatus.toUpperCase()}
//           </div>
//         )}

//         {/* Fullscreen Toggle */}
//         <button
//           onClick={toggleFullscreen}
//           className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
//         >
//           {isFullscreen ? (
//             <Minimize2 size={18} className="text-cyan-400" />
//           ) : (
//             <Maximize2 size={18} className="text-cyan-400" />
//           )}
//         </button>
//       </div>

//       {/* Card Info Section */}
//       {!isFullscreen && (
//         <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 transition-all duration-300 min-h-[110px]">
//           <div className="space-y-3 mb-4">
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Calendar className="w-3 h-3 text-cyan-400" />
//               <span>{date || new Date().toISOString().split('T')[0]}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Clock className="w-3 h-3 text-cyan-400" />
//               <span>{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
//             </div>
//             <h3 className="text-white text-base font-bold uppercase tracking-wide flex items-center gap-2 truncate">
//               <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0" />
//               <span className="truncate">{displayName}</span>
//             </h3>
//           </div>

//           <div className="flex items-center justify-between gap-2">
//             <div className="flex items-center gap-2 flex-wrap">
//               {/* Threat Level Badge */}
//               {threatLevel && (
//                 <div className="relative group/badge">
//                   <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} flex items-center gap-1.5`}>
//                     <span className="text-xs">{threatIcons[threatLevel]}</span>
//                     <span>{threatLevel}</span>
//                   </span>
//                 </div>
//               )}

//               {/* Zone Badge */}
//               {zoneCategory && (
//                 <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5">
//                   <MapPin className="w-3 h-3 flex-shrink-0" />
//                   <span className="truncate max-w-[80px]">{zoneCategory}</span>
//                 </div>
//               )}

//               {/* Stream Control Button */}
//               <button
//                 onClick={handleStreamToggle}
//                 disabled={streamStatus === 'connecting'}
//                 className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 shadow-lg ${
//                   streamStatus === 'active'
//                     ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
//                     : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
//                 } disabled:opacity-50 disabled:cursor-not-allowed`}
//               >
//                 {streamStatus === 'connecting' ? (
//                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 ) : streamStatus === 'active' ? (
//                   <StopCircle size={14} />
//                 ) : (
//                   <Play size={14} />
//                 )}
//                 <span>
//                   {streamStatus === 'connecting' ? 'Connecting' : streamStatus === 'active' ? 'Stop' : 'Stream'}
//                 </span>
//               </button>
//             </div>

//             {/* Delete Button */}
//             <button
//               onClick={handleDelete}
//               disabled={isDeleting}
//               className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 transition-all duration-300 transform hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
//             >
//               {isDeleting ? (
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//               ) : (
//                 <Trash2 size={14} />
//               )}
//               <span className="text-xs font-medium hidden sm:block">
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </span>
//             </button>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }
















































// import React, { useState, useEffect, useRef } from "react";
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// import { Camera, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2, Play, StopCircle } from 'lucide-react';
// import { useNotificationStore } from "./store/notification-store";

// export default function CameraCard({ 
//   camera_name, 
//   location_name,
//   date, 
//   time, 
//   threatLevel, 
//   id, 
//   zoneCategory, 
//   streamUrl,
//   rtsp_url,
//   streamStatus,
//   onStartStream,
//   onStopStream
// }) {
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const videoContainerRef = useRef(null);

//   // Get store methods
//   const { addNotification } = useNotificationStore();
//   const { removeFromCameraStreams } = useCameraStore();
//   const { addEvent } = useEventStore();

//   // Use location_name or camera_name
//   const displayName = location_name || camera_name || "Unknown Camera";
//   const finalStreamUrl = rtsp_url || streamUrl;

//   const threatColors = {
//     Low: "bg-gradient-to-r from-emerald-500 to-green-500",
//     Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
//     High: "bg-gradient-to-r from-red-600 to-pink-600"
//   };

//   const threatShadows = {
//     Low: "shadow-emerald-500/30",
//     Medium: "shadow-amber-500/30",
//     High: "shadow-red-500/40"
//   };

//   const threatIcons = {
//     Low: "🟢",
//     Medium: "🟡",
//     High: "🔴"
//   };

//   const statusColors = {
//     active: "bg-green-100 text-green-800",
//     connecting: "bg-yellow-100 text-yellow-800",
//     inactive: "bg-red-100 text-red-800"
//   };

//   const handleView = (e) => {
//     e.stopPropagation();
//     const timestamp = new Date().toISOString();
//     addEvent({
//       id,
//       camera_name: displayName,
//       date: date || new Date().toISOString().split('T')[0],
//       time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//       streamUrl: finalStreamUrl,
//       threatLevel: threatLevel || 'Low',
//       zoneCategory: zoneCategory || "Unknown",
//       type: 'VIEWED',
//       timestamp,
//     });
//   };

//   const toggleFullscreen = (e) => {
//     e.stopPropagation();

//     if (!isFullscreen) {
//       if (videoContainerRef.current.requestFullscreen) {
//         videoContainerRef.current.requestFullscreen();
//       } else if (videoContainerRef.current.webkitRequestFullscreen) {
//         videoContainerRef.current.webkitRequestFullscreen();
//       }
//     } else {
//       if (document.exitFullscreen) {
//         document.exitFullscreen();
//       } else if (document.webkitExitFullscreen) {
//         document.webkitExitFullscreen();
//       }
//     }
//   };

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(!!document.fullscreenElement);
//     };

//     document.addEventListener('fullscreenchange', handleFullscreenChange);
//     document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

//     return () => {
//       document.removeEventListener('fullscreenchange', handleFullscreenChange);
//       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
//     };
//   }, []);

//   const handleDelete = async (e) => {
//     e.stopPropagation();
//     if (isDeleting) return;

//     const isConfirmed = window.confirm("Are you sure you want to delete this camera?");
//     if (isConfirmed) {
//       setIsDeleting(true);
//       try {
//         // Stop stream first if active
//         if (streamStatus === 'active' && onStopStream) {
//           onStopStream();
//         }

//         const timestamp = new Date().toISOString();
//         addEvent({
//           id,
//           camera_name: displayName,
//           date: date || new Date().toISOString().split('T')[0],
//           time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           streamUrl: finalStreamUrl,
//           threatLevel: threatLevel || 'Low',
//           zoneCategory: zoneCategory || "Unknown",
//           type: 'DELETED',
//           timestamp,
//           description: `Deleted camera "${displayName}"`
//         });

//         await removeFromCameraStreams(id);
//         console.log(`Camera ${displayName} deleted successfully`);
//       } catch (error) {
//         console.error("Error deleting camera:", error);
//         alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
//       } finally {
//         setIsDeleting(false);
//       }
//     }
//   };

//   const handleStreamToggle = (e) => {
//     e.stopPropagation();
//     if (streamStatus === 'active' && onStopStream) {
//       onStopStream();
//     } else if (streamStatus === 'inactive' && onStartStream) {
//       onStartStream();
//     }
//   };

//   return (
//     <section
//       className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20"
//       onClick={handleView}
//     >
//       {/* Video Container */}
//       <div
//         ref={videoContainerRef}
//         className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
//           h-64 sm:h-72 lg:h-96 
//           w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
//           ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
//       >
//         {/* WebRTC Video Element */}
//         <video
//           id={`video-${id}`}
//           autoPlay
//           playsInline
//           muted
//           className="w-full h-full object-cover hidden"
//         />

//         {/* Placeholder */}
//         <div
//           id={`placeholder-${id}`}
//           className="w-full h-full flex items-center justify-center bg-slate-800"
//         >
//           <div className="text-center text-slate-400">
//             <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
//             <p className="text-sm">{streamStatus === 'inactive' ? 'Stream Inactive' : 'Connecting...'}</p>
//             <p className="text-xs mt-2">Click stream button to start</p>
//           </div>
//         </div>

//         {/* Stream Status Badge */}
//         {streamStatus && (
//           <div className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[streamStatus]} shadow-lg`}>
//             {streamStatus.toUpperCase()}
//           </div>
//         )}

//         {/* Fullscreen Toggle */}
//         <button
//           onClick={toggleFullscreen}
//           className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
//         >
//           {isFullscreen ? (
//             <Minimize2 size={18} className="text-cyan-400" />
//           ) : (
//             <Maximize2 size={18} className="text-cyan-400" />
//           )}
//         </button>
//       </div>

//       {/* Card Info Section */}
//       {!isFullscreen && (
//         <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 transition-all duration-300 min-h-[110px]">
//           <div className="space-y-3 mb-4">
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Calendar className="w-3 h-3 text-cyan-400" />
//               <span>{date || new Date().toISOString().split('T')[0]}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
//               <Clock className="w-3 h-3 text-cyan-400" />
//               <span>{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
//             </div>
//             <h3 className="text-white text-base font-bold uppercase tracking-wide flex items-center gap-2 truncate">
//               <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0" />
//               <span className="truncate">{displayName}</span>
//             </h3>
//           </div>

//           <div className="flex items-center justify-between gap-2">
//             <div className="flex items-center gap-2 flex-wrap">
//               {/* Threat Level Badge */}
//               {threatLevel && (
//                 <div className="relative group/badge">
//                   <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} flex items-center gap-1.5`}>
//                     <span className="text-xs">{threatIcons[threatLevel]}</span>
//                     <span>{threatLevel}</span>
//                   </span>
//                 </div>
//               )}

//               {/* Zone Badge */}
//               {zoneCategory && (
//                 <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5">
//                   <MapPin className="w-3 h-3 flex-shrink-0" />
//                   <span className="truncate max-w-[80px]">{zoneCategory}</span>
//                 </div>
//               )}

//               {/* Stream Control Button */}
//               <button
//                 onClick={handleStreamToggle}
//                 disabled={streamStatus === 'connecting'}
//                 className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 shadow-lg ${
//                   streamStatus === 'active'
//                     ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
//                     : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
//                 } disabled:opacity-50 disabled:cursor-not-allowed`}
//               >
//                 {streamStatus === 'connecting' ? (
//                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 ) : streamStatus === 'active' ? (
//                   <StopCircle size={14} />
//                 ) : (
//                   <Play size={14} />
//                 )}
//                 <span>
//                   {streamStatus === 'connecting' ? 'Connecting' : streamStatus === 'active' ? 'Stop' : 'Stream'}
//                 </span>
//               </button>
//             </div>

//             {/* Delete Button */}
//             <button
//               onClick={handleDelete}
//               disabled={isDeleting}
//               className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 transition-all duration-300 transform hover:scale-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
//             >
//               {isDeleting ? (
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//               ) : (
//                 <Trash2 size={14} />
//               )}
//               <span className="text-xs font-medium hidden sm:block">
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </span>
//             </button>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }









// import React, { useState, useEffect, useRef } from "react";
// import { useCameraStore } from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// import { Camera, AlertTriangle, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2 } from 'lucide-react';
// import { useNotificationStore } from "./store/notification-store";

// export default function CameraCard({ camera_name, date, time, threatLevel, id, zoneCategory, streamUrl }) {
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [hasNotified, setHasNotified] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const notificationSentRef = useRef(false);
//   const videoContainerRef = useRef(null);

//   // Get store methods
//   const { addNotification } = useNotificationStore();
//   const { removeFromCameraStreams } = useCameraStore();
//   const { addEvent } = useEventStore();

//   const threatColors = {
//     Low: "bg-gradient-to-r from-emerald-500 to-green-500",
//     Medium: "bg-gradient-to-r from-amber-500 to-yellow-500",
//     High: "bg-gradient-to-r from-red-600 to-pink-600"
//   };

//   const threatShadows = {
//     Low: "shadow-emerald-500/30",
//     Medium: "shadow-amber-500/30",
//     High: "shadow-red-500/40"
//   };

//   const threatIcons = {
//     Low: "🟢",
//     Medium: "🟡",
//     High: "🔴"
//   };

//   // Check for high threat level and send notification (only once per component)
//   useEffect(() => {
//     if (threatLevel === "High" && !notificationSentRef.current) {
//       const notificationData = {
//         type: 'threat',
//         level: 'High',
//         title: 'Critical Security Alert',
//         message: `High threat detected at ${camera_name} in zone ${zoneCategory || "Unknown"}. Stream: ${streamUrl || "N/A"}. Immediate attention required.`,
//         priority: 'urgent'
//       };

//       addNotification(notificationData);
//       notificationSentRef.current = true;
//       setHasNotified(true);

//       console.log(`High threat notification: ${camera_name} - ${threatLevel} threat detected`);
//     }
//   }, [threatLevel, camera_name, zoneCategory, streamUrl, addNotification]);

//   const handleView = (e) => {
//     e.stopPropagation();
//     const timestamp = new Date().toISOString();
//     addEvent({
//       id,
//       camera_name,
//       date,
//       time,
//       streamUrl: streamUrl,
//       threatLevel,
//       zoneCategory: zoneCategory || "Unknown",
//       type: 'VIEWED',
//       timestamp,
//     });
//   };

//   const toggleFullscreen = (e) => {
//     e.stopPropagation();

//     if (!isFullscreen) {
//       if (videoContainerRef.current.requestFullscreen) {
//         videoContainerRef.current.requestFullscreen();
//       } else if (videoContainerRef.current.webkitRequestFullscreen) {
//         videoContainerRef.current.webkitRequestFullscreen();
//       } else if (videoContainerRef.current.msRequestFullscreen) {
//         videoContainerRef.current.msRequestFullscreen();
//       }
//     } else {
//       if (document.exitFullscreen) {
//         document.exitFullscreen();
//       } else if (document.webkitExitFullscreen) {
//         document.webkitExitFullscreen();
//       } else if (document.msExitFullscreen) {
//         document.msExitFullscreen();
//       }
//     }
//   };

//   useEffect(() => {
//     const handleFullscreenChange = () => {
//       setIsFullscreen(!!document.fullscreenElement);
//     };

//     document.addEventListener('fullscreenchange', handleFullscreenChange);
//     document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
//     document.addEventListener('msfullscreenchange', handleFullscreenChange);

//     return () => {
//       document.removeEventListener('fullscreenchange', handleFullscreenChange);
//       document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
//       document.removeEventListener('msfullscreenchange', handleFullscreenChange);
//     };
//   }, []);

//   const handleConfirmation = async (e) => {
//     e.stopPropagation();

//     if (isDeleting) return; // Prevent multiple clicks

//     const isConfirmed = window.confirm("Are you sure you want to delete this camera stream?");
//     if (isConfirmed) {
//       setIsDeleting(true);

//       try {
//         // Add event to history before deletion
//         const timestamp = new Date().toISOString();
//         addEvent({
//           id,
//           camera_name,
//           date,
//           time,
//           streamUrl: streamUrl,
//           threatLevel,
//           zoneCategory: zoneCategory || "Unknown",
//           type: 'DELETED',
//           timestamp,
//           description: `Deleted camera "${camera_name}" from ${zoneCategory || "Unknown"} zone`
//         });

//         // Use the store method to delete camera (handles both API and local store)
//         await removeFromCameraStreams(id);

//         console.log(`Camera ${camera_name} deleted successfully`);

//       } catch (error) {
//         console.error("Error deleting camera:", error);
//         alert(`Failed to delete camera: ${error.message || "Unknown error"}`);
//       } finally {
//         setIsDeleting(false);
//       }
//     }
//   };

//   return (
//     <section
//       className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20 hover:shadow-3xl"
//       onClick={handleView}
//     >
//       {/* Video Container */}
//       <div
//         ref={videoContainerRef}
//         className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
//           h-64 sm:h-72 lg:h-96 
//           w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
//           group-hover:shadow-inner group-hover:shadow-cyan-400/20 transition-all duration-500
//           ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
//       >
//         {streamUrl ? (
//           <video
//             className="w-full h-full object-cover"
//             autoPlay
//             muted
//             loop
//             src={streamUrl}
//             onError={(e) => {
//               console.error("Video stream error:", e);
//               // Fallback to placeholder if stream fails
//             }}
//           ></video>
//         ) : (
//           <div className="w-full h-full flex items-center justify-center bg-slate-800">
//             <div className="text-center text-slate-400">
//               <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
//               <p className="text-sm">No Stream Available</p>
//             </div>
//           </div>
//         )}

//         {!isFullscreen && (
//           <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60 group-hover:opacity-80 transition-opacity duration-300">
//             <AlertTriangle className="w-20 h-20 text-red-600/100 group-hover:scale-110 transition-transform duration-300 animate-ping" />
//             <p className="text-white text-sm mt-3 text-center px-4 font-bold animate-ping bg-red-600 rounded-full px-2 py-1.5">Threat Detected</p>
//             <p className="text-red-300 text-xs mt-1 text-center px-4 opacity-75">Click to view details</p>
//           </div>
//         )}

//         {/* High Threat Notification Indicator */}
//         {threatLevel === "High" && (
//           <div className="absolute top-3 left-3 bg-gradient-to-r from-red-600 to-pink-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-pulse border-2 border-red-400/50">
//             🚨 CRITICAL ALERT
//           </div>
//         )}

//         <button
//           onClick={toggleFullscreen}
//           className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
//         >
//           {isFullscreen ? (
//             <Minimize2 size={18} className="text-cyan-400" />
//           ) : (
//             <Maximize2 size={18} className="text-cyan-400" />
//           )}
//         </button>
//       </div>

//       {/* Card Info Section */}
//       {!isFullscreen && (
//         <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 group-hover:bg-gradient-to-r group-hover:from-slate-700/80 group-hover:to-slate-800/80 transition-all duration-300 min-h-[110px] lg:h-[40px]">
//           <div className="space-y-3 mb-4">
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity duration-300">
//               <Calendar className="w-3 h-3 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
//               <span className="truncate">{date}</span>
//             </div>
//             <div className="flex items-center gap-2 text-slate-300 text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity duration-300">
//               <Clock className="w-3 h-3 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
//               <span className="truncate">{time}</span>
//             </div>
//             <h3 className="text-white text-base font-bold uppercase tracking-wide group-hover:text-cyan-100 transition-colors duration-300 flex items-center gap-2 truncate">
//               <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
//               <span className="truncate">{camera_name || "Unknown Camera"}</span>
//             </h3>
//           </div>

//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2 flex-wrap">
//               <div className="relative group/badge">
//                 <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} backdrop-blur-sm flex items-center gap-1.5 group-hover/badge:scale-105 transition-transform duration-300 ${threatLevel === "High" ? "animate-pulse" : ""}`}>
//                   <span className="text-xs">{threatIcons[threatLevel]}</span>
//                   <span className="truncate">{threatLevel}</span>
//                 </span>
//                 <div className={`absolute inset-0 rounded-full blur-sm opacity-30 ${threatColors[threatLevel]} group-hover/badge:opacity-50 transition-opacity duration-300`}></div>
//               </div>

//               <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 backdrop-blur-sm text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5 group-hover:scale-105 transition-transform duration-300 group-hover:border-cyan-400/50 group-hover:shadow-cyan-400/20">
//                 <MapPin className="w-3 h-3 flex-shrink-0" />
//                 <span className="truncate max-w-[80px]">{zoneCategory || "Unknown"}</span>
//               </div>
//             </div>

//             <button
//               onClick={handleConfirmation}
//               disabled={isDeleting}
//               className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-red-500/30 group/btn flex items-center gap-1.5 flex-shrink-0 hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
//             >
//               {isDeleting ? (
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//               ) : (
//                 <Trash2 size={14} className="group-hover/btn:rotate-12 transition-transform duration-300" />
//               )}
//               <span className="text-xs font-medium hidden sm:block">
//                 {isDeleting ? 'Deleting...' : 'Delete'}
//               </span>
//               <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur-sm opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300"></div>
//             </button>
//           </div>
//         </div>
//       )}
//     </section>
//   );
// }