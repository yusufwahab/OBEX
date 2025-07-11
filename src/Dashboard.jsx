import React, { useState, useEffect } from "react";
import { useCameraStore } from './store/camera-store';
import useLoadingStore from './store/loading-store';
import CameraCard from "./CameraCard";
import Header from "./Header";
import LogoLoader from "./LogoLoader";

export default function Dashboard() {
  const [showMain, setShowMain] = useState(false);
  const [showSection, setShowSection] = useState(false);

  const { showLoading, hideLoading } = useLoadingStore();
  const CameraStreams = useCameraStore((state) => state.CameraStreams);
  const addToCameraStreams = useCameraStore((state) => state.addToCameraStreams);

  const allcameras = [
    { id: 1, cameraName: "Entrance Camera", date: "2025-07-07", time: "21:30", threatLevel: "Low" },
    { id: 2, cameraName: "Backyard Cam", date: "2025-07-07", time: "21:30", threatLevel: "Medium" },
    { id: 3, cameraName: "Office Cam", date: "2025-07-07", time: "21:30", threatLevel: "High" },
    { id: 4, cameraName: "Lobby Cam", date: "2025-07-07", time: "21:30", threatLevel: "Low" },
    { id: 5, cameraName: "Hallway Cam", date: "2025-07-07", time: "21:30", threatLevel: "Medium" },
  ];

  useEffect(() => {
    showLoading();
    const timer = setTimeout(() => {
      hideLoading();
      setShowMain(true);
      setShowSection(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleAddCamera = () => {
    setShowSection(false);
    showLoading();

    setTimeout(() => {
      const nextCamera = allcameras[CameraStreams.length];
      if (nextCamera) {
        addToCameraStreams(nextCamera);
      }
      hideLoading();
      setShowSection(true);
    }, 1000);
  };

  return (
    <>
      <LogoLoader />
      <Header addCameraStream={handleAddCamera} />

      {showMain && (
        <main className="mt-10 bg-gray-800 w-[90vw] min-h-screen m-auto rounded-lg shadow shadow-cyan-400/50 pb-10 pt-5 xl:w-[95vw]">
          <article className="flex justify-between items-center m-5">
            <figure className="flex text-3xl items-center gap-2 ml-12">
              <svg className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-100">Live Feed</h1>
            </figure>
            <button
              onClick={handleAddCamera}
              className="text-sm text-gray-100 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 transition duration-300 mr-10 lg:mr-20"
            >
              Add Camera
            </button>
          </article>

          {/* Empty State */}
          {showSection && CameraStreams.length === 0 && (
            <section className="flex justify-center items-center h-[60vh]">
              <article className="grid place-items-center bg-black/50 w-[80vw] rounded-lg outline outline-cyan-900 p-10 text-center">
                <svg className="h-20 w-20 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75M2.697 16.126c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-100 my-4">No Camera Stream Yet</h2>
                <p className="text-gray-300 max-w-md">
                  Click the button above to add your first camera feed to the dashboard. Make sure the stream URL is accessible and correctly connected.
                </p>
              </article>
            </section>
          )}

          {/* Camera Cards */}
          {CameraStreams.length > 0 && (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-10 mt-6">
              {CameraStreams.map((cam) => (
                <CameraCard key={cam.id} {...cam} />
              ))}
            </section>
          )}
        </main>
      )}
    </>
  );
}
