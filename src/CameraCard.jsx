import React, { useState, useEffect, useRef } from "react";
import { useCameraStore } from './store/camera-store';
import { useEventStore } from "./store/history-store";
import { Camera, AlertTriangle, MapPin, Clock, Calendar, Trash2, Eye, Shield, Video, VideoOff } from 'lucide-react';

export default function CameraCard({ cameraName, date, time, threatLevel, id, url, zoneCategory, ipAddress }) {

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

  const cameraStreams = useCameraStore((state) => state.CameraStreams)
  const removeFromCameraStreams = useCameraStore((state) => state.removeFromCameraStreams)

  // Function to log view event
  const handleView = () => {
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

  // Function to handle deletion
  const handleConfirmation = () => {
    let isConfirmed = window.confirm("Are you sure you want to delete this camera stream?");
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
      removeFromCameraStreams(id);
    } else {
      cameraStreams();
    }
  };

  return (
    <section
      className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-3xl shadow-2xl shadow-slate-900/50 overflow-hidden w-full h-auto min-h-[420px] cursor-pointer hover:scale-105 transition-all duration-500 border border-slate-600/30 hover:border-cyan-400/50 group backdrop-blur-xl flex flex-col hover:shadow-cyan-400/20 hover:shadow-3xl"
      onClick={handleView}
    >
      {/* Enhanced glowing border effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-cyan-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100"></div>
      
      {/* Video container with enhanced styling - Fixed height */}
      <div className="relative bg-gradient-to-br from-slate-900 via-black to-slate-900 h-64 w-full flex items-center justify-center text-white overflow-hidden rounded-t-3xl flex-shrink-0 group-hover:shadow-inner group-hover:shadow-cyan-400/20 transition-all duration-500">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Camera icon overlay for camera cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-60 group-hover:opacity-80 transition-opacity duration-300">
          <Camera className="w-20 h-20 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-cyan-300 text-sm mt-3 text-center px-4">Camera Feed</p>
          <p className="text-cyan-200 text-xs mt-1 text-center px-4 opacity-75">Click to view details</p>
        </div>
        
        {/* Enhanced overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none"></div>
        
        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 translate-x-[-100%] group-hover:translate-x-[100%]"></div>
      </div>

      {/* Enhanced Info section with better layout - Flexible height */}
      <div className="relative p-4 flex flex-col justify-between flex-1 bg-gradient-to-r from-slate-700/60 to-slate-800/60 backdrop-blur-sm border-t border-slate-600/20 min-h-[140px] group-hover:bg-gradient-to-r group-hover:from-slate-700/80 group-hover:to-slate-800/80 transition-all duration-300">
        {/* Camera details with improved typography */}
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

        {/* Enhanced Threat indicator and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Threat Level Badge */}
            <div className="relative group/badge">
              <span className={`text-white text-xs font-bold px-2 py-1.5 rounded-full ${threatColors[threatLevel]} text-center shadow-lg ${threatShadows[threatLevel]} backdrop-blur-sm flex items-center gap-1.5 group-hover/badge:scale-105 transition-transform duration-300`}>
                <span className="text-xs">{threatIcons[threatLevel]}</span>
                <span className="truncate">{threatLevel}</span>
              </span>
              <div className={`absolute inset-0 rounded-full blur-sm opacity-30 ${threatColors[threatLevel]} group-hover/badge:opacity-50 transition-opacity duration-300`}></div>
            </div>

            {/* Zone Category Badge */}
            <div className="bg-gradient-to-r from-slate-700/90 to-slate-600/90 backdrop-blur-sm text-cyan-300 text-xs font-semibold px-2 py-1.5 rounded-full border border-cyan-400/30 shadow-lg flex items-center gap-1.5 group-hover:scale-105 transition-transform duration-300 group-hover:border-cyan-400/50 group-hover:shadow-cyan-400/20">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[80px]">{zoneCategory || "Unknown"}</span>
            </div>
          </div>

          {/* Enhanced Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // prevent triggering handleView
              handleConfirmation();
            }}
            className="relative text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-xl p-2.5 cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-red-500/30 group/btn flex items-center gap-1.5 flex-shrink-0 hover:shadow-red-500/50"
          >
            <Trash2 size={14} className="group-hover/btn:rotate-12 transition-transform duration-300" />
            <span className="text-xs font-medium hidden sm:block">Delete</span>
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur-sm opacity-50 group-hover/btn:opacity-70 transition-opacity duration-300"></div>
          </button>
        </div>
      </div>

      {/* Floating threat alert badge */}
      <div className="absolute top-3 left-3 bg-gradient-to-r from-red-600/90 to-pink-600/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full border border-red-400/30 shadow-lg flex items-center gap-1.5 animate-pulse group-hover:animate-none group-hover:scale-110 transition-transform duration-300">
        <AlertTriangle className="w-3 h-3" />
        <span className="hidden sm:inline">THREAT</span>
      </div>

      {/* Status indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 group-hover:scale-110 transition-transform duration-300">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse group-hover:animate-bounce"></div>
        <span className="text-green-400 text-xs font-medium px-1.5 py-0.5 rounded-full backdrop-blur-sm group-hover:bg-green-400/20 group-hover:text-green-300 transition-all duration-300">
          ACTIVE
        </span>
      </div>
    </section>
  );
}


























// import React, { useState, useEffect, UseRef} from "react";
// import {useCameraStore} from './store/camera-store';
// import { useEventStore } from "./store/history-store";
// // import useLoadingStore from "./store/loading-store";


// export default function CameraCard({ cameraName, date, time, threatLevel, id, url }) {

//   const threatColors = {
//     Low: "bg-green-500",
//     Medium: "bg-yellow-400",
//     High: "bg-red-500"
//   };

//   const cameraStreams = useCameraStore((state) => state.cameraStreams)
//   const removeFromCameraStreams = useCameraStore((state) => state.removeFromCameraStreams)

//   function deleteCamera () {
//     removeFromCameraStreams(id)
//   }

//   function leaveCameraStreams () {
//     cameraStreams()
//   }

//   function handleConfirmation () {
//     let isConfirmed = window.confirm("Are you sure you want to delete this camera stream?");
//     if (isConfirmed === true) {
//       deleteCamera()
//     } else if (isConfirmed === false) {
//       leaveCameraStreams()
//     }
//   }
//   // THIS FUNCTION IS PASSING BOTH THE CONFIRMATION AND THE DELETE FUNCTION
//   function handleDelete () {
//     handleConfirmation()
//     deleteCamera()
//   }
//   return (
//     <section className="bg-[#1F2937] rounded-2xl shadow-md shadow-cyan-400/50 overflow-hidden w-[80vw] h-[320px] sm:w-[80vw] sm:h-[420px] md:w-[40vw] md:h-[320px] lg:w-[40vw] lg:h-[420px] xl:w-[25vw] xl:h-[320px] 2xl:w-[28vw] 2xl:h-[420px] cursor-pointer hover:scale-105 transition-all duration-300 2xl:mt-10 outline outline-2  focus-within:outline-cyan-400 hover:outline-cyan-400">
//       <div className="bg-black h-[240px] w-full flex items-center justify-center text-white sm:h-[340px] md:h-[240px] lg:h-[340px] xl:h-[240px] 2xl:h-[340px]">
//         {/* Replace with actual video stream */}
//         {/* <video controls autoPlay muted loop poster="thumbnail.jpg" className="w-full h-full object-cover object-center">
//         <source src="https://vdo.ninja/v17/?view=SN9rmgQ&label=PrimusLite_Camera" type="video/mp4"/>
//         </video> */}
//         <iframe
//         src={url}
//         allow="camera; microphone; autoplay"
//         allowFullScreen
//         className="w-full h-full border-none"
//       />
//       </div>
//       <div className="p-2 flex justify-between items-center m-2 ">
//         <div>
//           <p className="text-[#FFFFFF] text-sm">{date}</p>
//           <p className="text-[#FFFFFF] text-sm">{time}</p>
//           <p className="text-[#FFFFFF] text-sm font-[700] uppercase">{cameraName}</p>
//         </div>

//         <article className="flex flex-col items-center justify-center">
//           <h3 className="text-white bg-red-700  font-bold text-[12px] animate-ping ">THREAT DETECTED!!!</h3>
//         <p className={`text-white text-xs font-bold px-3 py-1 rounded-full ${threatColors[threatLevel]} text-center`}>
//           {threatLevel}
//         </p>
//         </article>
//         <button onClick={handleDelete} className="text-[10px] text-white bg-blue-800 rounded-full p-2 cursor-pointer">Delete</button>
//       </div>
//     </section>
//   );
// }
