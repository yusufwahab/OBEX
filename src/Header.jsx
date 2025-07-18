import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import primusLogo from './logo-primus.png';
import { useNavStore } from "./store/navigation-store";

export default function Header({ addCameraStream }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDashboardOpen, setIsDashboarddownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  function handleDropdownDashboard() {
    setIsDashboarddownOpen(!isDashboardOpen);
  }

  function handledropdownSettings() {
    setIsSettingsOpen(!isSettingsOpen);
  }

  return (
    <header className="bg-gray-800/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-700">
      <nav className="mx-4 sm:mx-6 lg:mx-10">
        <section className="flex items-center justify-between h-16 xl:h-20">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center">
            <img
              src={primusLogo}
              alt="primus logo"
              className="w-10 h-10 md:w-8 md:h-8 xl:w-10 xl:h-10 cursor-pointer"
            />
            <span className="text-2xl font-bold text-white cursor-pointer ml-2 md:text-[16px] lg:text-[20px]">
              Primus
              <span className="text-cyan-400 font-medium font-black">Lite</span>
            </span>
          </Link>

          {/* Mobile Notification Icon */}
          <div className="md:hidden flex items-center rounded-full w-10 h-10 p-1 outline-cyan-400 outline-2">
            <button className="relative group inline-block text-white md:px-2 md:py-1 lg:px-3 lg:py-2 rounded-md text-sm font-medium cursor-pointer focus:bg-gray-700 active:bg-gray-700">
              <span><i className="fa-regular fa-bell text-yellow-400 text-[20px] md:text-[16px]"></i></span>
              <div className="absolute top-full left hidden group-hover:block bg-gray-800 text-white whitespace-nowrap z-10">
                <span>Intrusion Alert</span>
              </div>
            </button>
          </div>

          {/* Hamburger (Mobile) */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-white focus:outline-none"
              aria-label="Toggle Menu"
            >
              <svg
                className="w-6 h-6 text-cyan-400 cursor-pointer"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {menuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Nav Links (Desktop) */}
          <article className="hidden md:flex space-x-1 items-center">
            <div className="relative">
              <Link
                to="/dashboard"
                onClick={handleDropdownDashboard}
                className={`text-white md:px-2 md:py-1 px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 md:text-[10px] xl:text-[16px] lg:text-[12px] ${
                  isActive('/dashboard') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
                }`}
              >
                <article className="flex items-center gap-2 group">
                  <i className="fa-solid fa-table-columns group-hover:text-cyan-400"></i>
                  <span className="group-hover:text-white">Dashboard</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="xl:w-5 xl:h-4 md:w-4 md:h-3 text-[#FFFFFF]"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </article>
              </Link>
              {isDashboardOpen && (
                <article className="w-[200px] h-[150px] bg-gray-900 rounded-md absolute flex justify-around flex-col p-5 mt-10 transition-all duration-300 ease-out">
                  <h3 className="group flex items-center gap-2">
                    <span><i className="fa-solid fa-camera group-hover:text-cyan-400"></i></span>
                    <span className="text-gray-400 group-hover:text-[#FFFFFF]"> Security Cameras</span>
                  </h3>
                  <h3 className="group flex items-center gap-2">
                    <span><i className="fa-solid fa-video group-hover:text-cyan-400"></i></span>
                    <span className="text-gray-400 group-hover:text-[#FFFFFF]">Heatmap/Analytics</span>
                  </h3>
                  <h3 className="group flex items-center gap-2">
                    <span><i className="fa-solid fa-chart-line group-hover:text-cyan-400"></i></span>
                    <span className="text-gray-400 group-hover:text-[#FFFFFF]"> Active Alerts</span>
                  </h3>
                </article>
              )}
            </div>

            <Link
              to="/zones"
              className={`text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px] ${
                isActive('/zones') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              <span className="group-hover:text-cyan-400"><i className="fa-solid fa-money-bill-trend-up"></i></span>
              <span className="group-hover:text-white">Zone Management</span>
            </Link>

            <Link
              to="/history"
              className={`text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px] ${
                isActive('/history') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              <span className="group-hover:text-cyan-400"><i className="fa-solid fa-clock-rotate-left"></i></span>
              <span className="group-hover:text-white">History</span>
            </Link>

            <div className="relative">
              <Link
                to="/settings"
                onClick={handledropdownSettings}
                className={`text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 md:text-[10px] lg:text-[12px] xl:text-[16px] ${
                  isActive('/settings') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
                }`}
              >
                <article className="flex items-center gap-2 group">
                  <i className="fas fa-gear group-hover:text-cyan-400"></i>
                  <span className="group-hover:text-white">Settings</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="xl:w-5 xl:h-4 md:w-4 md:h-3 text-[#FFFFFF]"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </article>
              </Link>
              {isSettingsOpen && (
                <article className="w-[220px] h-[150px] bg-gray-900 rounded-md absolute flex justify-around flex-col p-5 mt-10 transition-all duration-300 ease-out">
                  <h3 className="group flex items-center gap-2">
                    <span><i className="fa-solid fa-camera group-hover:text-cyan-400"></i></span>
                    <span className="text-gray-400 group-hover:text-[#FFFFFF]"> System settings</span>
                  </h3>
                  <h3 className="group flex items-center gap-2">
                    <span><i className="fa-solid fa-video group-hover:text-cyan-400"></i></span>
                    <span className="text-gray-400 group-hover:text-[#FFFFFF]"> Device Management</span>
                  </h3>
                </article>
              )}
            </div>
          </article>

          <div className="hidden md:flex space-x-1 items-center lg:gap-1">
            <Link
              to="/profile"
              className={`text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 bg-gray-900 lg:text-[12px] xl:text-[16px] ${
                isActive('/profile') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              <span><i className="fa-regular fa-user text-cyan-400"></i></span>
              <span className="hidden lg:inline">Profile</span>
            </Link>

            <Link
              to="/notification"
              className={`text-white md:px-2 md:py-1 lg:px-3 lg:py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 bg-gray-900 lg:text-[12px] xl:text-[16px] ${
                isActive('/notification') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              <span><i className="fa-regular fa-envelope text-cyan-400"></i></span>
              <span className="hidden lg:inline">Notification</span>
            </Link>

            <Link
              to="/alert"
              className={`relative group inline-block text-white md:px-2 md:py-1 lg:px-3 lg:py-2 rounded-md text-sm font-medium hover:outline-1 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 ${
                isActive('/alert') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              <span><i className="fa-regular fa-bell text-yellow-400 text-[20px] md:text-[16px]"></i></span>
              <div className="absolute top-full left 1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white whitespace-nowrap z-10">
                <span>Intrusion Alert</span>
              </div>
            </Link>

            <Link
              to="/logout"
              className={`text-white md:px-2 md:py-1 lg:px-3 lg:py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 bg-cyan-700 md:text-[10px] xl:text-[16px] ${
                isActive('/logout') ? 'bg-gray-700 outline-2 outline-cyan-400' : 'hover:outline-2 hover:outline-cyan-400'
              }`}
            >
              Logout
            </Link>
          </div>
        </section>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div>
            <div className="flex flex-col md:hidden mt-2 space-y-1 pb-4">
              <div className="relative">
                <button
                  onClick={handleDropdownDashboard}
                  className="text-white md:px-2 md:py-1 px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 md:text-[10px] xl:text-[16px] lg:text-[12px] w-full text-left"
                >
                  <article className="flex items-center gap-2 group">
                    <i className="fa-solid fa-table-columns group-hover:text-cyan-400"></i>
                    <span className="group-hover:text-white">Dashboard</span>
                    <i className="fa-solid fa-caret-down"></i>
                  </article>
                </button>
                {isDashboardOpen && (
                  <div className="ml-4 mt-2 space-y-2">
                    <Link to="/dashboard/cameras" className="block px-3 py-2 text-gray-400 hover:text-white">
                      <i className="fa-solid fa-camera mr-2"></i>Security Cameras
                    </Link>
                    <Link to="/dashboard/analytics" className="block px-3 py-2 text-gray-400 hover:text-white">
                      <i className="fa-solid fa-video mr-2"></i>Heatmap/Analytics
                    </Link>
                    <Link to="/dashboard/alerts" className="block px-3 py-2 text-gray-400 hover:text-white">
                      <i className="fa-solid fa-chart-line mr-2"></i>Active Alerts
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/zones"
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px]"
              >
                <span className="group-hover:text-cyan-400"><i className="fa-solid fa-money-bill-trend-up"></i></span>
                <span className="group-hover:text-white">Zone Management</span>
              </Link>

              <Link
                to="/history"
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px]"
              >
                <span className="group-hover:text-cyan-400"><i className="fa-solid fa-clock-rotate-left"></i></span>
                <span className="group-hover:text-white">History</span>
              </Link>

              <div className="relative">
                <button
                  onClick={handledropdownSettings}
                  className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 md:text-[10px] lg:text-[12px] xl:text-[16px] w-full text-left"
                >
                  <article className="flex items-center gap-2 group">
                    <i className="fas fa-gear group-hover:text-cyan-400"></i>
                    <span className="group-hover:text-white">Settings</span>
                    <i className="fa-solid fa-caret-down"></i>
                  </article>
                </button>
                {isSettingsOpen && (
                  <div className="ml-4 mt-2 space-y-2">
                    <Link to="/settings/system" className="block px-3 py-2 text-gray-400 hover:text-white">
                      <i className="fa-solid fa-camera mr-2"></i>System settings
                    </Link>
                    <Link to="/settings/devices" className="block px-3 py-2 text-gray-400 hover:text-white">
                      <i className="fa-solid fa-video mr-2"></i>Device Management
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/profile"
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px] bg-cyan-700"
              >
                <span className="group-hover:text-white">Profile</span>
              </Link>

              <Link
                to="/logout"
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-2 hover:outline-cyan-400 cursor-pointer focus:bg-gray-700 active:bg-gray-700 xl:text-[16px] flex items-center gap-2 group md:text-[10px] xl:text-[16px] lg:text-[12px] bg-cyan-700"
              >
                <span className="group-hover:text-white">Logout</span>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
