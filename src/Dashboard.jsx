import { useState } from "react";
import primusLogo from './logo-primus.png';

export default function Header({ addCameraStream }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-800/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-gray-700">
      <div className="mx-4 sm:mx-6 lg:mx-10">
        <div className="flex items-center justify-between h-16 xl:h-20">
          {/* Logo */}
          <a className="flex items-center">
            <img
              src={primusLogo}
              alt="primus logo"
              className="w-10 h-10 xl:w-10 xl:h-10 cursor-pointer"
            />
            <span className="text-2xl font-bold text-white cursor-pointer ml-2">
              Primus
              <span className="text-cyan-400 font-light font-black">Lite</span>
            </span>
          </a>

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
          <div className="hidden md:flex space-x-1 items-center">
            {["Home", "Dashboard", "History", "Settings"].map((text) => (
              <a
                key={text}
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-1 hover:outline-cyan-800 cursor-pointer focus:bg-gray-700 active:bg-gray-700"
              >
                {text}
              </a>
            ))}
          </div>
        </div>

        {/* Nav Links (Mobile dropdown) */}
        {menuOpen && (
          <div className="flex flex-col md:hidden mt-2 space-y-1 pb-4">
            {["Home", "Dashboard", "History", "Settings"].map((text) => (
              <a
                key={text}
                className="text-white px-3 py-2 rounded-md text-sm font-medium hover:outline-1 hover:outline-cyan-800 cursor-pointer focus:bg-gray-700 active:bg-gray-700"
              >
                {text}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
