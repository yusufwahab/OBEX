import React, { useState, useEffect, UseRef} from "react";
import {useCameraStore} from './store/camera-store';

export default function CameraCard({ cameraName, date, time, threatLevel,id }) {
  const threatColors = {
    Low: "bg-green-500",
    Medium: "bg-yellow-400",
    High: "bg-red-500"
  };

  const cameraStreams = useCameraStore((state) => state.cameraStreams)
  const removeFromCameraStreams = useCameraStore((state) => state.removeFromCameraStreams)

  function deleteCamera () {
    removeFromCameraStreams(id)
  }

  function leaveCameraStreams () {
    cameraStreams()
  }

  function handleConfirmation () {
    let isConfirmed = window.confirm("Are you sure you want to delete this camera stream?");
    if (isConfirmed === true) {
      deleteCamera()
    } else if (isConfirmed === false) {
      leaveCameraStreams()
    }
  }
  // THIS FUNCTION IS PASSING BOTH THE CONFIRMATION AND THE DELETE FUNCTION
  function handleDelete () {
    handleConfirmation()
    deleteCamera()
  }
  return (
    <section className="bg-[#1F2937] rounded-2xl shadow-md shadow-cyan-400/50 overflow-hidden w-[80vw] h-[320px] sm:w-[80vw] sm:h-[420px] md:w-[40vw] md:h-[320px] lg:w-[40vw] lg:h-[420px] xl:w-[25vw] xl:h-[320px] 2xl:w-[28vw] 2xl:h-[420px] cursor-pointer hover:scale-105 transition-all duration-300 2xl:mt-10 outline outline-2  focus-within:outline-cyan-400 hover:outline-cyan-400">
      <div className="bg-black h-[240px] w-full flex items-center justify-center text-white sm:h-[340px] md:h-[240px] lg:h-[340px] xl:h-[240px] 2xl:h-[340px]">
        {/* Replace with actual video stream */}
        <video controls autoPlay muted loop poster="thumbnail.jpg" className="w-full h-full object-cover object-center">
        <source src="https://static.linear.app/assets/web/quality/teaser-full.90D8F66A-6715-41C0-9BC0-74FCD0B1047C.mp4" type="video/mp4"/>
        </video>
        
      </div>
      <div className="p-2 flex justify-between items-center m-2 ">
        <div>
          <p className="text-[#FFFFFF] text-sm">{date}</p>
          <p className="text-[#FFFFFF] text-sm">{time}</p>
          <p className="text-[#FFFFFF] text-sm">{cameraName}</p>
        </div>

        <article className="flex flex-col items-center justify-center">
          <h3 className="text-red-500 font-bold text-[12px]">THREAT DETECTED!!!</h3>
        <p className={`text-white text-xs font-bold px-3 py-1 rounded-full ${threatColors[threatLevel]} text-center`}>
          {threatLevel}
        </p>
        </article>
        <button onClick={handleDelete} className="text-[10px] text-white bg-blue-800 rounded-full p-2 cursor-pointer">Delete</button>
      </div>
    </section>
  );
}
