import React, { useState, useEffect } from "react";
import {useCameraStore} from './store/camera-store';
import useLoadingStore from './store/loading-store';
import LogoLoader from './LogoLoader';
import CameraCard from "./CameraCard";
import Header from "./Header";

export default function Dashboard() {

  const [showMain, setShowMain] = useState(true)

  const {showLoading, hideLoading} = useLoadingStore();
  useEffect(() => {
    showLoading();
    setShowSection(false)
    setShowMain(false)
    const timer = setTimeout(() => {
      hideLoading();
      setShowSection(true)
      setShowMain(true)
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  

  const [showSection, setShowSection] = useState(true)

  const CameraStreams = useCameraStore((state) => state.CameraStreams)

  const addToCameraStreams = useCameraStore((state) => state.addToCameraStreams)

  const allcameras = [
  { id: 1, cameraName: "Entrance Camera", date: "2025-07-07", time: "21:30", threatLevel: "Low" },
  { id: 2, cameraName: "Backyard Cam", date: "2025-07-07", time: "21:30", threatLevel: "Medium" },
  { id: 3, cameraName: "Office Cam", date: "2025-07-07", time: "21:30", threatLevel: "High" },
  { id: 4, cameraName: "Lobby Cam", date: "2025-07-07", time: "21:30", threatLevel: "Low" },
  { id: 5, cameraName: "Hallway Cam", date: "2025-07-07", time: "21:30", threatLevel: "Medium" },
];
const cameraElement = CameraStreams.map(cam => (
  <CameraCard key={cam.id} {...cam} />
))


  function addCameraStream () {
    const nextCamera = allcameras.find(
      (cam) => !CameraStreams.some((c) => c.id === cam.id)
    );
  
    if (nextCamera) {
      showLoading();
      setTimeout(() => {
        addToCameraStreams(nextCamera);
        hideLoading();
      }, 2000);
    }
  // `  if (CameraStreams.length < allcameras.length) {
  //   showLoading()
  //   setTimeout(() => {
  //     addToCameraStreams(allcameras[CameraStreams.length]);
  //     hideLoading();
  //   }, 2000);
  // }`
  }

  function handleClicks () {
    addCameraStream()
  }


  
  return (
    <>
    <Header />
    <LogoLoader />
    {showMain && <main className="mt-10 bg-gray-800 w-[90vw] h-auto   m-auto rounded-lg shadow shadow-cyan-400/50 mb-10 pb-10 pt-5 xl:w-[95vw]">
<article className="flex justify-between items-center m-5">
    <figure className=" flex text-3xl items-center gap-2 xl:ml-10 lg:ml-8 md:ml-6 ml-8">
    <svg className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 text-cyan-400 "
                    fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round"
                        d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
      <h1 className="text-[16px] md:text-2xl lg:text-3xl font-bold  text-gray-100">Live Feed</h1>
      </figure>

      <figure className="flex items-center gap-2 xl:gap-5 md:gap-5">
        <button className="relative cursor-pointer  text-gray-100 md:hidden group"><i className="fa fa-search rounded-full"></i><span className="hidden group-hover:block absolute bottom-10 text-[14px]">Search for camera</span></button>
        <input type="text"  className="cursor-pointer hidden md:block xl:w-100 md:h-8 md:p-3 xl:h-10 bg-gray-900 outline-2 outline-cyan-400 rounded-full text-gray-100 xl:p-5" placeholder="Search Camera"/>
        <button className="cursor-pointer outline-2 outline-cyan-400 w-40 h-10 rounded-lg text-gray-100 bg-gray-900 hidden md:block md:w-35 md:h-8 md:text-[14px]"><i className="fa-solid fa-trash"></i> clear all camera</button>
        <button className="relative group cursor-pointer text-gray-100  md:hidden xl:hidden w-8 h-8 p-2 bg-gray-900 text-[12px] rounded-full"><i className="fa-solid fa-trash"></i><span className="hidden group-hover:block absolute bottom-10">clear all cameras</span></button>
      {/* Disable "+" When All Cameras Are Added */}
      {CameraStreams.length < allcameras.length && <button onClick={handleClicks} className="cursor-pointer text-sm  text-gray-100 px-3 py-2 rounded-lg animate-bounce outline-2 outline-cyan-400 mr-10 lg:mr-20" ><i className="fa fa-plus" aria-hidden="true"></i></button>}
      </figure>
    </article>


    {/* Hide “Add Stream” Section When Cameras Exist */}
    {CameraStreams.length === 0  && <section className="flex justify-center items-center">
    <article className="grid place-content-center place-items-center bg-black/50 w-[80vw] h-[70vh] rounded-lg outline outline-cyan-900">
    <svg className="h-20 w-20 lg:h-40 lg:w-40  xl:h-60 xl:w-60 text-cyan-400 " fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round"
    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
      <h2 className="text-[20px] lg:text-[40px] font-bold text-gray-100 mb-6 mt-6"> Add Camera Stream</h2>
      <p className="text-sm md:text-md lg:text-lg xl:text-xl 2xl:text-2xl text-gray-100 text-center w-[60%] mb-6">This will allow you to connect a new camera feed to the dashboard in real time. 
      Make sure the stream URL is accessible and correctly connected.</p>
    </article>
    </section> }

      

      <section className=" grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3  gap-y-10  place-items-center 2xl:grid-cols-3 m-auto">

      {/* Show Camera Streams, Declared by mapping through the cameraStreams array */}
        {cameraElement}
    
      </section>

    </main> }
    </>
  );
}



