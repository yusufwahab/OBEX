import React, { useState, useEffect, useRef } from "react";
import { useCameraStore } from './store/camera-store';
import { useEventStore } from "./store/history-store";
import { Camera, AlertTriangle, MapPin, Clock, Calendar, Trash2, Maximize2, Minimize2 } from 'lucide-react';

export default function CameraCard({ cameraName, date, time, threatLevel, id, url, zoneCategory, ipAddress }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef(null);

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

  // Add the missing handleView function
  const handleView = (e) => {
    e.stopPropagation();
    const timestamp = new Date().toISOString();
    useEventStore.getState().addEvent({
      id,
      cameraName,
      date,
      time,
      ipAddress: url || ipAddress,
      threatLevel,
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
      } else if (videoContainerRef.current.msRequestFullscreen) {
        videoContainerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Add handleConfirmation function if not present
  const handleConfirmation = (e) => {
    e.stopPropagation();
    const isConfirmed = window.confirm("Are you sure you want to delete this camera stream?");
    if (isConfirmed) {
      const timestamp = new Date().toISOString();
      useEventStore.getState().addEvent({
        id,
        cameraName,
        date,
        time,
        ipAddress: url || ipAddress,
        threatLevel,
        zoneCategory: zoneCategory || "Unknown",
        type: 'DELETED',
        timestamp,
      });
      useCameraStore.getState().removeFromCameraStreams(id);
    }
  };

  return (
    <section
      className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[120px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20 hover:shadow-3xl"
      onClick={handleView}
    >
      {/* Video Container */}
      <div
        ref={videoContainerRef}
        className={`relative bg-gradient-to-br from-slate-900 via-black to-slate-900 
          h-64 sm:h-72 lg:h-96 
          w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 
          group-hover:shadow-inner group-hover:shadow-cyan-400/20 transition-all duration-500
          ${isFullscreen ? 'fixed inset-0 z-50 !rounded-none !m-0 !h-screen !w-screen' : ''}`}
      >
        <video
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          src=""
        />

        {!isFullscreen && (
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60 group-hover:opacity-80 transition-opacity duration-300">
            <AlertTriangle className="w-20 h-20 text-red-600/100 group-hover:scale-110 transition-transform duration-300 animate-ping" />
            <p className="text-white-600 text-sm mt-3 text-center px-4 font-bold animate-ping bg-red-600 rounded-full px-2 py-1.5 ">Threat Detected</p>
            <p className="text-red-300 text-xs mt-1 text-center px-4 opacity-75">Click to view details</p>
          </div>
        )}

        <button
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-lg p-2 cursor-pointer transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 z-10"
        >
          {isFullscreen ? (
            <Minimize2 size={18} className="text-cyan-400" />
          ) : (
            <Maximize2 size={18} className="text-cyan-400" />
          )}
        </button>
      </div>

      {/* Card Info Section */}
      {!isFullscreen && (
        <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 group-hover:bg-gradient-to-r group-hover:from-slate-700/80 group-hover:to-slate-800/80 transition-all duration-300 min-h-[110px] lg:h-[40px]">
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-slate-300 text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity duration-300">
              <Calendar className="w-3 h-3 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
              <span className="truncate">{date}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs font-medium opacity-90 group-hover:opacity-100 transition-opacity duration-300">
              <Clock className="w-3 h-3 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
              <span className="truncate">{time}</span>
            </div>
            <h3 className="text-white text-base font-bold uppercase tracking-wide group-hover:text-cyan-100 transition-colors duration-300 flex items-center gap-2 truncate">
              <Camera className="w-4 h-4 text-cyan-400 flex-shrink-0 group-hover:scale-110 transition-transform duration-300" />
              <span className="truncate">{cameraName}</span>
            </h3>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative group/badge">
                <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} backdrop-blur-sm flex items-center gap-1.5 group-hover/badge:scale-105 transition-transform duration-300`}>
                  <span className="text-xs">{threatIcons[threatLevel]}</span>
                  <span className="truncate">{threatLevel}</span>
                </span>
                <div className={`absolute inset-0 rounded-full blur-sm opacity-30 ${threatColors[threatLevel]} group-hover/badge:opacity-50 transition-opacity duration-300`}></div>
              </div>

              <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 backdrop-blur-sm text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5 group-hover:scale-105 transition-transform duration-300 group-hover:border-cyan-400/50 group-hover:shadow-cyan-400/20">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[80px]">{zoneCategory || "Unknown"}</span>
              </div>
            </div>
            
            <button
              onClick={handleConfirmation}
              className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-red-500/30 group/btn flex items-center gap-1.5 flex-shrink-0 hover:shadow-red-500/50"
            >
              <Trash2 size={14} className="group-hover/btn:rotate-12 transition-transform duration-300" />
              <span className="text-xs font-medium hidden sm:block">Delete</span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur-sm opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}