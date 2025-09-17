import { useEffect, useMemo, useRef, useState } from "react";
import { useEventStore } from "./store/history-store";
import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Eye, Lock, User, Smartphone } from "lucide-react";
import { cameraAPI } from "./services/api";

// Helper component for consistent step layout
function WizardStep({ icon, title, instruction, children }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
        {instruction}
      </p>
      <div>{children}</div>
    </div>
  );
}

export default function PopupModal({ onSave, onCancel }) {
  // Wizard state - now with 5 steps instead of 6
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Form fields
  const [camera_name, setCameraName] = useState("");
  const [zone, setZone] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [cameraBrand, setCameraBrand] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");

  // Timestamps
  const [currentDate, setCurrentDate] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // UX states
  const [isLoading, setIsLoading] = useState(false);
  const [testError, setTestError] = useState("");
  const [testSuccess, setTestSuccess] = useState(false);

  const videoRef = useRef(null);
  const addEvent = useEventStore((state) => state.addEvent);

  // Camera brands with their common stream URL patterns
  const cameraBrands = [
    { value: "hikvision", label: "Hikvision", streamPattern: "/ISAPI/Streaming/channels/1/picture" },
    { value: "dahua", label: "Dahua", streamPattern: "/cam/realmonitor?channel=1&subtype=0" },
    { value: "axis", label: "Axis", streamPattern: "/axis-cgi/mjpg/video.cgi" },
    { value: "foscam", label: "Foscam", streamPattern: "/cgi-bin/CGIStream.cgi?cmd=GetMJStream" },
    { value: "tp-link", label: "TP-Link", streamPattern: "/stream.cgi" },
    { value: "reolink", label: "Reolink", streamPattern: "/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=wuuPhkmUCeI9WG7C&user=" },
    { value: "generic", label: "Generic/Other", streamPattern: "/video" }
  ];

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDate(now.toISOString().split('T')[0]);
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Construct stream URL based on brand and IP for frontend flow
  const constructedStreamUrl = useMemo(() => {
    if (!ipAddress) return "";
    
    let streamPattern = "/video"; // default
    const finalBrand = isCustomBrand ? customBrand : cameraBrand;
    
    if (!isCustomBrand && cameraBrand) {
      const brand = cameraBrands.find(b => b.value === cameraBrand);
      streamPattern = brand?.streamPattern || "/video";
    }
    
    const withAuth = username || password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
    return `http://${withAuth}${ipAddress}${streamPattern}`;
  }, [ipAddress, cameraBrand, customBrand, isCustomBrand, username, password]);

  // Validation logic for each step
  const isStepValid = useMemo(() => {
    switch (step) {
      case 1: return !!camera_name.trim();
      case 2: return !!zone;
      case 3: return !!cameraBrand || (isCustomBrand && !!customBrand.trim());
      case 4: return !!ipAddress.trim();
      case 5: return testSuccess; // Must have a successful test to proceed
      default: return false;
    }
  }, [step, camera_name, zone, cameraBrand, ipAddress, testSuccess]);

  function handleNext() {
    if (isStepValid) {
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleTestConnection() {
    setIsLoading(true);
    setTestError("");
    setTestSuccess(false);
    try {
      const urlToTest = constructedStreamUrl;
      if (!urlToTest) {
        throw new Error("Cannot construct stream URL. Please check IP address and brand selection.");
      }

      // Try HTTP stream first (frontend testing)
      await new Promise((resolve, reject) => {
        const video = videoRef.current;
        if (!video) return reject(new Error("Preview element not ready."));
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error("Connection timeout. Check IP address, credentials, or camera brand."));
          }
        }, 10000); // 10 second timeout
        
        const onCanPlay = () => { 
          if (!settled) { 
            settled = true; 
            cleanup(); 
            clearTimeout(timeout);
            resolve(); 
          } 
        };
        const onError = () => { 
          if (!settled) { 
            settled = true; 
            cleanup(); 
            clearTimeout(timeout);
            reject(new Error("Cannot play stream. Check IP address, credentials, or camera brand.")); 
          } 
        };
        const cleanup = () => {
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("canplay", onCanPlay);
        video.addEventListener("error", onError);
        video.src = urlToTest;
        video.load();
      });
      setTestSuccess(true);
    } catch (err) {
      setTestError(err?.message || "Connection test failed");
      setTestSuccess(false);
    } finally {
      setIsLoading(false);
    }
  }
  
  async function handleFinishSave() {
    setIsLoading(true);
    try {
      const finalBrand = isCustomBrand ? customBrand.trim() : cameraBrand;
      const brandLabel = isCustomBrand ? customBrand.trim() : cameraBrands.find(b => b.value === cameraBrand)?.label;
      
      const cameraData = {
        camera_name: camera_name.trim(),
        cameraType: "IP",
        streamUrl: constructedStreamUrl,
        zoneCategory: zone,
        date: currentDate,
        time: currentTime,
        ipAddress: ipAddress.trim(),
        cameraBrand: finalBrand,
        username: username.trim(),
        password,
      };

      addEvent({
        camera_name: camera_name.trim(),
        zone_name: zone,
        date: currentDate,
        time: currentTime,
        streamUrl: constructedStreamUrl,
        type: "ADDED",
        timestamp: new Date().toISOString(),
        description: `Added ${brandLabel} camera "${camera_name.trim()}" in ${zone} zone.`,
      });

      // Simulate saving (no backend) - just call onSave with the data
      console.log("Camera data to save:", cameraData);
      
      // Call onSave callback (parent component handles the actual saving)
      if (onSave) {
        await onSave(cameraData);
      }

      // Show success message
      alert(`Camera "${camera_name.trim()}" has been added successfully!`);

    } catch (error) {
      console.error("Error adding camera:", error);
      alert(`Failed to add camera: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return (
          <WizardStep
            icon={<Camera className="w-6 h-6 text-purple-600" />}
            title="Camera Name"
            instruction="Give your camera a unique name (e.g., 'Front Door' or 'Office Hallway'). This helps you easily identify it later."
          >
            <input
              type="text"
              value={camera_name}
              onChange={(e) => setCameraName(e.target.value)}
              placeholder="e.g. Front Door Cam"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              autoFocus
            />
          </WizardStep>
        );
      case 2:
        return (
          <WizardStep
            icon={<MapPin className="w-6 h-6 text-blue-600" />}
            title="Location"
            instruction="Assign the camera to a location zone. This is used for organizing cameras and setting area-specific rules."
          >
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="">-- Select Location --</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="closure">Closure</option>
              <option value="vault">Vault</option>
            </select>
          </WizardStep>
        );
      case 3:
        return (
          <WizardStep
            icon={<Smartphone className="w-6 h-6 text-green-600" />}
            title="Camera Brand"
            instruction="Select your camera's brand from the list, or choose 'Other' to enter a custom brand name."
          >
            <div className="space-y-4">
              <select
                value={isCustomBrand ? "other" : cameraBrand}
                onChange={(e) => {
                  if (e.target.value === "other") {
                    setIsCustomBrand(true);
                    setCameraBrand("");
                  } else {
                    setIsCustomBrand(false);
                    setCameraBrand(e.target.value);
                    setCustomBrand("");
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">-- Select Camera Brand --</option>
                {cameraBrands.map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label}
                  </option>
                ))}
                <option value="other">Other (Type custom brand)</option>
              </select>
              
              {isCustomBrand && (
                <input
                  type="text"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  placeholder="Enter camera brand name"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  autoFocus
                />
              )}
              
              {!isCustomBrand && cameraBrand && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <strong>Stream Pattern:</strong> {cameraBrands.find(b => b.value === cameraBrand)?.streamPattern}
                </div>
              )}
            </div>
          </WizardStep>
        );
      case 4:
        return (
          <WizardStep
            icon={<Globe className="w-6 h-6 text-cyan-600" />}
            title="Camera Address & Credentials"
            instruction="Enter the camera's local IP address and login credentials. The system will automatically construct the stream URL based on the brand."
          >
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Globe className="w-4 h-4" />IP Address
                </label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.1.120:8080"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <User className="w-4 h-4" />Username
                  </label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <Lock className="w-4 h-4" />Password
                  </label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
                  />
                </div>
              </div>
            </div>
          </WizardStep>
        );
      case 5:
        return (
          <WizardStep
            icon={<Eye className="w-6 h-6 text-cyan-500" />}
            title="Test Connection & Review"
            instruction="Let's test the connection and review your camera details. A successful test is required to complete the setup."
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50">
                <video ref={videoRef} controls className="w-full max-h-48 rounded-lg bg-black"></video>
                <div className="mt-3 text-xs text-gray-500 break-all">URL: {constructedStreamUrl || "(none)"}</div>
              </div>
              
              {testSuccess && <div className="flex items-center gap-2 text-emerald-500"><CheckCircle2 className="w-5 h-5" /> Connection successful!</div>}
              {!!testError && <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="w-5 h-5" /> {testError}</div>}
              
              <button 
                onClick={handleTestConnection} 
                disabled={isLoading || !constructedStreamUrl} 
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50"
              >
                {isLoading ? "Testing..." : "Test Connection"}
              </button>

              {testSuccess && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
                  <div><span className="font-semibold text-gray-600 dark:text-gray-400">Name:</span> {camera_name}</div>
                  <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {zone}</div>
                  <div><span className="font-semibold text-gray-600 dark:text-gray-400">Brand:</span> {isCustomBrand ? customBrand : cameraBrands.find(b => b.value === cameraBrand)?.label}</div>
                  <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP Address:</span> {ipAddress}</div>
                </div>
              )}
            </div>
          </WizardStep>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add New Camera</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="min-h-[300px]">
          {renderCurrentStep()}
        </div>

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < TOTAL_STEPS && (
              <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === TOTAL_STEPS && (
              <button onClick={handleFinishSave} disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                {isLoading ? "Saving..." : "Finish & Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}