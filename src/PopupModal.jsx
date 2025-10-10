import { useMemo, useState } from "react";
import { useEventStore } from "./store/history-store";
import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

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
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;

  // Form fields
  const [location_name, setLocationName] = useState("");
  const [ip_address, setIpAddress] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [port, setPort] = useState("554");
  const [extra_path, setExtraPath] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const addEvent = useEventStore((state) => state.addEvent);

  // Construct RTSP URL in real-time
  const rtspUrl = useMemo(() => {
    if (!ip_address.trim()) return "";
    
    const user = username.trim() || "admin";
    const pass = password || "";
    const ipOrDomain = ip_address.trim();
    const p = port.trim() || "554";
    const path = extra_path.trim();
    
    const formattedPath = path && !path.startsWith('/') ? `/${path}` : path;
    
    return `rtsp://${user}:${pass}@${ipOrDomain}:${p}${formattedPath}`;
  }, [ip_address, username, password, port, extra_path]);

  // Validation helpers
  const isValidIP = (value) => {
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(value)) return false;
    const octets = value.split('.');
    return octets.every(octet => {
      const num = parseInt(octet);
      return num >= 0 && num <= 255;
    });
  };

  const isValidDomain = (value) => {
    // Domain pattern (supports subdomains)
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    // Hostname pattern (for local networks)
    const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
    return domainPattern.test(value) || hostnamePattern.test(value);
  };

  const isValidIPOrDomain = (value) => {
    return isValidIP(value) || isValidDomain(value);
  };

  const getAddressType = (value) => {
    if (!value) return '';
    if (isValidIP(value)) return 'IP Address';
    if (isValidDomain(value)) return 'Domain Name';
    return '';
  };

  // Validation for each step
  const isStepValid = useMemo(() => {
    switch (step) {
      case 1: 
        return location_name.trim().length >= 3;
      case 2: {
        const portNum = parseInt(port);
        return (
          ip_address.trim() !== '' && 
          isValidIPOrDomain(ip_address.trim()) &&
          !isNaN(portNum) && 
          portNum >= 1 && 
          portNum <= 65535
        );
      }
      case 3: 
        return username.trim() !== '' && password.trim() !== '';
      default: 
        return false;
    }
  }, [step, location_name, ip_address, port, username, password]);

  // Validation messages
  const getValidationMessage = () => {
    switch (step) {
      case 1:
        if (!location_name.trim()) return "Location name is required";
        if (location_name.trim().length < 3) return "Location name must be at least 3 characters";
        return "";
      case 2:
        if (!ip_address.trim()) return "IP address or domain name is required";
        if (!isValidIPOrDomain(ip_address.trim())) {
          return "Invalid format. Use IP (192.168.1.100) or domain (camera.example.com)";
        }
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) return "Port must be between 1 and 65535";
        return "";
      case 3:
        if (!username.trim()) return "Username is required";
        if (!password.trim()) return "Password is required";
        return "";
      default:
        return "";
    }
  };

  function handleNext() {
    if (isStepValid) {
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }
  
  async function handleFinishSave() {
    if (!isStepValid) {
      const validationMsg = getValidationMessage();
      alert(validationMsg || "Please fill in all required fields correctly.");
      return;
    }

    setIsLoading(true);
    
    try {
      let formattedExtraPath = extra_path.trim();
      if (formattedExtraPath && !formattedExtraPath.startsWith('/')) {
        formattedExtraPath = `/${formattedExtraPath}`;
      }

      const cleanedData = {
        camera_name: location_name.trim(),
        location_name: location_name.trim(),
        ip_address: ip_address.trim(),
        username: username.trim(),
        password: password,
        port: port.trim(),
        extra_path: formattedExtraPath,
        brand: "generic",
        rtsp_url: rtspUrl
      };

      console.log("✅ PopupModal: Camera data prepared:", {
        ...cleanedData,
        password: '****',
        rtsp_url: rtspUrl.replace(/:[^:@]+@/, ':****@'),
        address_type: getAddressType(cleanedData.ip_address)
      });

      // Validation
      const errors = [];
      
      if (!cleanedData.location_name || cleanedData.location_name.length < 3) {
        errors.push("Location name must be at least 3 characters");
      }
      
      if (!isValidIPOrDomain(cleanedData.ip_address)) {
        errors.push("Invalid IP address or domain name format");
      }
      
      if (!cleanedData.username) {
        errors.push("Username is required");
      }
      
      if (!cleanedData.password) {
        errors.push("Password is required");
      }
      
      const portNum = parseInt(cleanedData.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.push("Port must be between 1 and 65535");
      }
      
      if (!cleanedData.rtsp_url || !cleanedData.rtsp_url.startsWith('rtsp://')) {
        errors.push("Invalid RTSP URL format");
      }

      if (errors.length > 0) {
        throw new Error(`Validation failed:\n${errors.join('\n')}`);
      }

      addEvent({
        camera_name: cleanedData.location_name,
        zone_name: "Default",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        streamUrl: rtspUrl,
        type: "ADDED",
        timestamp: new Date().toISOString(),
        description: `Camera "${cleanedData.location_name}" added at ${cleanedData.ip_address}:${cleanedData.port}`,
      });

      if (onSave) {
        await onSave(cleanedData);
      }

      console.log("✅ PopupModal: Camera saved successfully");

    } catch (error) {
      console.error("❌ PopupModal: Error saving camera:", error);
      alert(`Failed to save camera:\n\n${error.message}\n\nPlease check your input and try again.`);
      setIsLoading(false);
    }
  }

  const renderCurrentStep = () => {
    const validationMsg = getValidationMessage();
    const addressType = getAddressType(ip_address);
    
    switch (step) {
      case 1:
        return (
          <WizardStep
            icon={<Camera className="w-6 h-6 text-purple-600" />}
            title="Camera Location Name"
            instruction="Give your camera a descriptive location name (minimum 3 characters)"
          >
            <input
              type="text"
              value={location_name}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Front Entrance, Parking Lot A"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
              autoFocus
              maxLength={100}
              minLength={3}
            />
            {validationMsg && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <span>⚠️</span> {validationMsg}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {location_name.length}/100 characters {location_name.length >= 3 && '✓'}
            </p>
          </WizardStep>
        );
      case 2:
        return (
          <WizardStep
            icon={<Server className="w-6 h-6 text-blue-600" />}
            title="Network Configuration"
            instruction="Enter IP address or domain name, port, and optional stream path"
          >
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Globe className="w-4 h-4" />IP Address or Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={ip_address}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.100 or camera.example.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">
                    Examples: 192.168.1.100, camera.example.com, staging.ai.avzdax.com
                  </p>
                  {addressType && (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      ✓ {addressType}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <Server className="w-4 h-4" />Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="554"
                    min="1"
                    max="65535"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Standard: 554</p>
                </div>
                <div>
                  <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <MapPin className="w-4 h-4" />Stream Path
                  </label>
                  <input
                    type="text"
                    value={extra_path}
                    onChange={(e) => setExtraPath(e.target.value)}
                    placeholder="/h264/ch1/main/av_stream"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional</p>
                </div>
              </div>
              {validationMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <span>⚠️</span> {validationMsg}
                  </p>
                </div>
              )}
              {rtspUrl && !validationMsg && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Generated RTSP URL:</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{rtspUrl.replace(/:[^:@]+@/, ':****@')}</p>
                  {addressType && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Type: {addressType}
                    </p>
                  )}
                </div>
              )}
            </div>
          </WizardStep>
        );
      case 3:
        return (
          <WizardStep
            icon={<Lock className="w-6 h-6 text-green-600" />}
            title="Authentication & Review"
            instruction="Enter camera credentials and verify all settings"
          >
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <User className="w-4 h-4" />Username <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="admin"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all" 
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Lock className="w-4 h-4" />Password <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter password"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all" 
                  autoComplete="current-password"
                  required
                />
              </div>
              
              {validationMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <span>⚠️</span> {validationMsg}
                  </p>
                </div>
              )}
              
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span>📋</span> Camera Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> 
                    <span className="text-gray-800 dark:text-gray-200">{location_name || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Address:</span> 
                    <span className="text-gray-800 dark:text-gray-200">{ip_address || 'Not set'}</span>
                  </div>
                  {getAddressType(ip_address) && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Type:</span> 
                      <span className="text-green-600 dark:text-green-400 font-semibold">{getAddressType(ip_address)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Port:</span> 
                    <span className="text-gray-800 dark:text-gray-200">{port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> 
                    <span className="text-gray-800 dark:text-gray-200">{username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Password:</span> 
                    <span className="text-gray-800 dark:text-gray-200">{'*'.repeat(password.length || 0)}</span>
                  </div>
                  {extra_path && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-600 dark:text-gray-400">Stream Path:</span> 
                      <span className="text-gray-800 dark:text-gray-200 truncate max-w-[200px]" title={extra_path}>{extra_path}</span>
                    </div>
                  )}
                </div>
                {rtspUrl && (
                  <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-gray-600 dark:text-gray-400 block mb-2">RTSP URL:</span>
                    <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
                      {rtspUrl.replace(/:[^:@]+@/, ':****@')}
                    </p>
                  </div>
                )}
              </div>
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
          <button 
            onClick={onCancel} 
            disabled={isLoading} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  i <= step 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[300px]">
          {renderCurrentStep()}
        </div>

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            {step > 1 && (
              <button 
                onClick={handleBack} 
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < TOTAL_STEPS && (
              <button 
                onClick={handleNext} 
                disabled={!isStepValid} 
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:from-cyan-600 hover:to-blue-700 transition-all"
                title={!isStepValid ? getValidationMessage() : "Continue to next step"}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === TOTAL_STEPS && (
              <button 
                onClick={handleFinishSave} 
                disabled={!isStepValid || isLoading} 
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:from-emerald-600 hover:to-green-700 transition-all"
                title={!isStepValid ? getValidationMessage() : "Save camera"}
              >
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


















































// import { useMemo, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Construct RTSP URL in real-time
//   const rtspUrl = useMemo(() => {
//     if (!ip_address.trim()) return "";
    
//     const user = username.trim() || "admin";
//     const pass = password || "";
//     const ip = ip_address.trim();
//     const p = port.trim() || "554";
//     const path = extra_path.trim();
    
//     // Add leading slash to path if it doesn't have one and isn't empty
//     const formattedPath = path && !path.startsWith('/') ? `/${path}` : path;
    
//     return `rtsp://${user}:${pass}@${ip}:${p}${formattedPath}`;
//   }, [ip_address, username, password, port, extra_path]);

//   // Validation for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: 
//         return location_name.trim().length >= 3; // At least 3 characters
//       case 2: {
//         // Basic IP validation
//         // const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
//         const portNum = parseInt(port);
//         return (
//           ip_address.trim() !== '' && 
//           //ipPattern.test(ip_address.trim()) &&
//           !isNaN(portNum) && 
//           portNum >= 1 && 
//           portNum <= 65535
//         );
//       }
//       case 3: 
//         return username.trim() !== '' && password.trim() !== '';
//       default: 
//         return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   // Validation messages
//   const getValidationMessage = () => {
//     switch (step) {
//       case 1:
//         if (!location_name.trim()) return "Location name is required";
//         if (location_name.trim().length < 3) return "Location name must be at least 3 characters";
//         return "";
//       case 2:
//         if (!ip_address.trim()) return "IP address is required";
//         const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
//         if (!ipPattern.test(ip_address.trim())) return "Invalid IP address format (e.g., 192.168.1.100)";
//         const portNum = parseInt(port);
//         if (isNaN(portNum) || portNum < 1 || portNum > 65535) return "Port must be between 1 and 65535";
//         return "";
//       case 3:
//         if (!username.trim()) return "Username is required";
//         if (!password.trim()) return "Password is required";
//         return "";
//       default:
//         return "";
//     }
//   };

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     if (!isStepValid) {
//       const validationMsg = getValidationMessage();
//       alert(validationMsg || "Please fill in all required fields correctly.");
//       return;
//     }

//     setIsLoading(true);
    
//     try {
//       // Format extra_path - ensure it starts with / if not empty
//       let formattedExtraPath = extra_path.trim();
//       if (formattedExtraPath && !formattedExtraPath.startsWith('/')) {
//         formattedExtraPath = `/${formattedExtraPath}`;
//       }

//       // Prepare data in the exact format expected by backend
//       const cleanedData = {
//         camera_name: location_name.trim(),
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         username: username.trim(),
//         password: password, // Don't trim - might have intentional spaces
//         port: port.trim(),
//         extra_path: formattedExtraPath,
//         brand: "generic",
//         rtsp_url: rtspUrl
//       };

//       console.log("✅ PopupModal: Camera data prepared:", {
//         ...cleanedData,
//         password: '****',
//         rtsp_url: rtspUrl.replace(/:[^:@]+@/, ':****@')
//       });

//       // Final comprehensive validation
//       const errors = [];
      
//       if (!cleanedData.location_name || cleanedData.location_name.length < 3) {
//         errors.push("Location name must be at least 3 characters");
//       }
      
//       // const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
//       // if (!ipPattern.test(cleanedData.ip_address)) {
//       //   errors.push("Invalid IP address format");
//       // } else {
//       //   // Validate IP octets are 0-255
//       //   const octets = cleanedData.ip_address.split('.');
//       //   if (octets.some(octet => parseInt(octet) > 255)) {
//       //     errors.push("IP address octets must be between 0 and 255");
//       //   }
//       // }
      
//       if (!cleanedData.username) {
//         errors.push("Username is required");
//       }
      
//       if (!cleanedData.password) {
//         errors.push("Password is required");
//       }
      
//       const portNum = parseInt(cleanedData.port);
//       if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
//         errors.push("Port must be between 1 and 65535");
//       }
      
//       if (!cleanedData.rtsp_url || !cleanedData.rtsp_url.startsWith('rtsp://')) {
//         errors.push("Invalid RTSP URL format");
//       }

//       if (errors.length > 0) {
//         throw new Error(`Validation failed:\n${errors.join('\n')}`);
//       }

//       // Add event to history
//       addEvent({
//         camera_name: cleanedData.location_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cleanedData.location_name}" added at ${cleanedData.ip_address}:${cleanedData.port}`,
//       });

//       // Call parent's onSave with the constructed camera data
//       if (onSave) {
//         await onSave(cleanedData);
//       }

//       console.log("✅ PopupModal: Camera saved successfully");

//     } catch (error) {
//       console.error("❌ PopupModal: Error saving camera:", error);
      
//       // Show detailed error message
//       const errorMsg = error.message || "Unknown error occurred";
//       alert(`Failed to save camera:\n\n${errorMsg}\n\nPlease check your input and try again.`);
      
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     const validationMsg = getValidationMessage();
    
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (minimum 3 characters)"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance, Parking Lot A"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
//               autoFocus
//               maxLength={100}
//               minLength={3}
//             />
//             {validationMsg && (
//               <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
//                 <span>⚠️</span> {validationMsg}
//               </p>
//             )}
//             <p className="text-xs text-gray-500 mt-2">
//               {location_name.length}/100 characters {location_name.length >= 3 && '✓'}
//             </p>
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's network details"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="192.168.1.100"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
//                   // pattern="^(\d{1,3}\.){3}\d{1,3}$"
//                 />
//                 <p className="text-xs text-gray-500 mt-1">Format: 192.168.1.100</p>
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="number"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     min="1"
//                     max="65535"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
//                   />
//                   <p className="text-xs text-gray-500 mt-1">Default: 554</p>
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Stream Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
//                   />
//                   <p className="text-xs text-gray-500 mt-1">Optional</p>
//                 </div>
//               </div>
//               {validationMsg && (
//                 <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
//                   <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
//                     <span>⚠️</span> {validationMsg}
//                   </p>
//                 </div>
//               )}
//               {rtspUrl && !validationMsg && (
//                 <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
//                   <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Generated RTSP URL:</p>
//                   <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{rtspUrl.replace(/:[^:@]+@/, ':****@')}</p>
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter camera credentials and verify all settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username <span className="text-red-500">*</span>
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all" 
//                   autoComplete="username"
//                   required
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password <span className="text-red-500">*</span>
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all" 
//                   autoComplete="current-password"
//                   required
//                 />
//               </div>
              
//               {validationMsg && (
//                 <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
//                   <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
//                     <span>⚠️</span> {validationMsg}
//                   </p>
//                 </div>
//               )}
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
//                   <span>📋</span> Camera Summary
//                 </h4>
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{location_name || 'Not set'}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">IP Address:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{ip_address || 'Not set'}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Port:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{port}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{username}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Password:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{'*'.repeat(password.length || 0)}</span>
//                   </div>
//                   {extra_path && (
//                     <div className="flex justify-between">
//                       <span className="font-semibold text-gray-600 dark:text-gray-400">Stream Path:</span> 
//                       <span className="text-gray-800 dark:text-gray-200">{extra_path}</span>
//                     </div>
//                   )}
//                 </div>
//                 {rtspUrl && (
//                   <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400 block mb-2">RTSP URL:</span>
//                     <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
//                       {rtspUrl.replace(/:[^:@]+@/, ':****@')}
//                     </p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add New Camera</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button 
//             onClick={onCancel} 
//             disabled={isLoading} 
//             className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
//           >
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         {/* Progress Bar */}
//         <div className="mb-6">
//           <div className="flex gap-2">
//             {[1, 2, 3].map((i) => (
//               <div 
//                 key={i} 
//                 className={`flex-1 h-2 rounded-full transition-all duration-300 ${
//                   i <= step 
//                     ? 'bg-gradient-to-r from-cyan-500 to-blue-600' 
//                     : 'bg-gray-200 dark:bg-gray-700'
//                 }`}
//               />
//             ))}
//           </div>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button 
//                 onClick={handleBack} 
//                 disabled={isLoading}
//                 className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
//               >
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button 
//                 onClick={handleNext} 
//                 disabled={!isStepValid} 
//                 className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:from-cyan-600 hover:to-blue-700 transition-all"
//                 title={!isStepValid ? getValidationMessage() : "Continue to next step"}
//               >
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button 
//                 onClick={handleFinishSave} 
//                 disabled={!isStepValid || isLoading} 
//                 className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:from-emerald-600 hover:to-green-700 transition-all"
//                 title={!isStepValid ? getValidationMessage() : "Save camera"}
//               >
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }






























// import { useMemo, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Construct RTSP URL in real-time
//   const rtspUrl = useMemo(() => {
//     if (!ip_address.trim()) return "";
    
//     const user = username.trim() || "admin";
//     const pass = password || "";
//     const ip = ip_address.trim();
//     const p = port.trim() || "554";
//     const path = extra_path.trim();
    
//     // Add leading slash to path if it doesn't have one and isn't empty
//     const formattedPath = path && !path.startsWith('/') ? `/${path}` : path;
    
//     return `rtsp://${user}:${pass}@${ip}:${p}${formattedPath}`;
//   }, [ip_address, username, password, port, extra_path]);

//   // Validation for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     if (!isStepValid) {
//       alert("Please fill in all required fields.");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       // Format extra_path - ensure it starts with / if not empty
//       let formattedExtraPath = extra_path.trim();
//       if (formattedExtraPath && !formattedExtraPath.startsWith('/')) {
//         formattedExtraPath = `/${formattedExtraPath}`;
//       }

//       // Prepare data in the exact format expected by backend
//       const cleanedData = {
//         camera_name: location_name.trim(),      // Required by backend
//         location_name: location_name.trim(),    // Required by backend
//         ip_address: ip_address.trim(),          // Required
//         username: username.trim(),              // Required
//         password: password,                      // Required (don't trim - might have spaces)
//         port: port.trim(),                      // Required as STRING
//         extra_path: formattedExtraPath,         // Required (can be empty string)
//         brand: "generic",                       // Optional but good to include
//         rtsp_url: rtspUrl                       // Optional - backend will construct if not provided
//       };

//       console.log("PopupModal: Prepared camera data:", {
//         ...cleanedData,
//         password: '***', // Hide password in logs
//         rtsp_url: rtspUrl
//       });

//       // Final validation
//       if (!cleanedData.location_name) {
//         throw new Error("Location name is required");
//       }
//       if (!cleanedData.ip_address) {
//         throw new Error("IP address is required");
//       }
//       if (!cleanedData.username) {
//         throw new Error("Username is required");
//       }
//       if (!cleanedData.password) {
//         throw new Error("Password is required");
//       }
//       if (!cleanedData.port) {
//         throw new Error("Port is required");
//       }

//       // Validate IP address format (basic check)
//       // const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
//       // if (!ipPattern.test(cleanedData.ip_address)) {
//       //   throw new Error("Invalid IP address format. Use format: 192.168.1.100");
//       // }

//       // Validate port is numeric
//       const portNum = parseInt(cleanedData.port);
//       if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
//         throw new Error("Port must be a number between 1 and 65535");
//       }

//       // Add event to history
//       addEvent({
//         camera_name: cleanedData.location_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cleanedData.location_name}" added at ${cleanedData.ip_address}:${cleanedData.port}`,
//       });

//       // Call parent's onSave with the constructed camera data
//       if (onSave) {
//         await onSave(cleanedData);
//       }

//       console.log("PopupModal: Camera saved successfully with RTSP URL:", rtspUrl);

//     } catch (error) {
//       console.error("PopupModal: Error saving camera:", error);
      
//       // Show detailed error message
//       const errorMsg = error.message || "Unknown error occurred";
//       alert(`Failed to save camera:\n\n${errorMsg}\n\nPlease check the console for more details.`);
      
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//               maxLength={100}
//             />
//             <p className="text-xs text-gray-500 mt-2">This will be used as the camera identifier</p>
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address <span className="text-red-500">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   pattern="^(\d{1,3}\.){3}\d{1,3}$"
//                 />
//                 <p className="text-xs text-gray-500 mt-1">Format: 192.168.1.100</p>
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                     pattern="[0-9]+"
//                   />
//                   <p className="text-xs text-gray-500 mt-1">Default: 554</p>
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                   <p className="text-xs text-gray-500 mt-1">Optional</p>
//                 </div>
//               </div>
//               {rtspUrl && (
//                 <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
//                   <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Generated RTSP URL:</p>
//                   <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{rtspUrl}</p>
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username <span className="text-red-500">*</span>
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                   autoComplete="username"
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password <span className="text-red-500">*</span>
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                   autoComplete="current-password"
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{location_name || 'Not set'}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">IP Address:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{ip_address || 'Not set'}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Port:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{port}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> 
//                     <span className="text-gray-800 dark:text-gray-200">{username}</span>
//                   </div>
//                   {extra_path && (
//                     <div className="flex justify-between">
//                       <span className="font-semibold text-gray-600 dark:text-gray-400">Stream Path:</span> 
//                       <span className="text-gray-800 dark:text-gray-200">{extra_path}</span>
//                     </div>
//                   )}
//                 </div>
//                 {rtspUrl && (
//                   <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400 block mb-2">RTSP URL:</span>
//                     <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">{rtspUrl}</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button 
//             onClick={onCancel} 
//             disabled={isLoading} 
//             className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
//           >
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button 
//                 onClick={handleBack} 
//                 disabled={isLoading}
//                 className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
//               >
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button 
//                 onClick={handleNext} 
//                 disabled={!isStepValid} 
//                 className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2 hover:from-cyan-600 hover:to-blue-700 transition-all"
//               >
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button 
//                 onClick={handleFinishSave} 
//                 disabled={!isStepValid || isLoading} 
//                 className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2 hover:from-emerald-600 hover:to-green-700 transition-all"
//               >
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }






























//THE ACTUAL CODE I WAS USING FOR BEFORE MATCHING
// import { useMemo, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Construct RTSP URL in real-time
//   const rtspUrl = useMemo(() => {
//     if (!ip_address.trim()) return "";
    
//     const user = username.trim() || "admin";
//     const pass = password || "";
//     const ip = ip_address.trim();
//     const p = port.trim() || "554";
//     const path = extra_path.trim();
    
//     return `rtsp://${user}:${pass}@${ip}:${p}${path}`;
//   }, [ip_address, username, password, port, extra_path]);

//   // Validation for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     if (!rtspUrl) {
//       alert("Cannot construct RTSP URL. Please check all fields.");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       // Clean and validate data
//       const cleanedData = {
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         port: port.trim(),
//         username: username.trim(),
//         password: password, // Don't trim password (might have intentional spaces)
//         extra_path: extra_path.trim() || "",
//         rtsp_url: rtspUrl
//       };

//       console.log("PopupModal: Prepared camera data:", {
//         ...cleanedData,
//         password: '***' // Hide password in logs
//       });

//       // Validate required fields
//       if (!cleanedData.location_name) {
//         throw new Error("Location name is required");
//       }
//       if (!cleanedData.ip_address) {
//         throw new Error("IP address is required");
//       }
//       if (!cleanedData.username) {
//         throw new Error("Username is required");
//       }
//       if (!cleanedData.password) {
//         throw new Error("Password is required");
//       }

//       addEvent({
//         camera_name: cleanedData.location_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cleanedData.location_name}" added at ${cleanedData.ip_address}:${cleanedData.port}`,
//       });

//       // Call parent's onSave with the constructed camera data
//       if (onSave) {
//         await onSave(cleanedData);
//       }

//       console.log("PopupModal: Camera saved successfully with RTSP URL:", rtspUrl);

//     } catch (error) {
//       console.error("PopupModal: Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1 (optional)"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//               </div>
//               {rtspUrl && (
//                 <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
//                   <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Generated RTSP URL:</p>
//                   <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{rtspUrl}</p>
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP:</span> {ip_address || 'Not set'}:{port}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                 {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//                 {rtspUrl && (
//                   <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">RTSP URL:</span>
//                     <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono mt-1">{rtspUrl}</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!isStepValid || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

















































// import { useMemo, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields - matching backend schema
//   const [camera_name, setCameraName] = useState("");
//   const [location_name, setLocationName] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Validation for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!camera_name.trim() && !!location_name.trim();
//       case 2: return !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, camera_name, location_name, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     setIsLoading(true);
//     try {
//       // Clean and validate data - matching backend schema exactly
//       const cleanedData = {
//         camera_name: camera_name.trim(),
//         location_name: location_name.trim(),
//         port: port.trim(),
//         username: username.trim(),
//         password: password, // Don't trim password
//         extra_path: extra_path.trim() || ""
//       };

//       console.log("PopupModal: Prepared camera data:", {
//         ...cleanedData,
//         password: '***' // Hide password in logs
//       });

//       // Validate required fields
//       if (!cleanedData.camera_name) {
//         throw new Error("Camera name is required");
//       }
//       if (!cleanedData.location_name) {
//         throw new Error("Location name is required");
//       }
//       if (!cleanedData.username) {
//         throw new Error("Username is required");
//       }
//       if (!cleanedData.password) {
//         throw new Error("Password is required");
//       }

//       addEvent({
//         camera_name: cleanedData.camera_name,
//         zone_name: "Default",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${cleanedData.camera_name}" at "${cleanedData.location_name}" added`,
//       });

//       // Call parent's onSave with the cleaned data
//       if (onSave) {
//         await onSave(cleanedData);
//       }

//       console.log("PopupModal: Camera saved successfully");

//     } catch (error) {
//       console.error("PopupModal: Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Information"
//             instruction="Provide the camera name and location details"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Camera className="w-4 h-4" />Camera Name
//                 </label>
//                 <input
//                   type="text"
//                   value={camera_name}
//                   onChange={(e) => setCameraName(e.target.value)}
//                   placeholder="e.g. Camera-01"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   autoFocus
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <MapPin className="w-4 h-4" />Location Name
//                 </label>
//                 <input
//                   type="text"
//                   value={location_name}
//                   onChange={(e) => setLocationName(e.target.value)}
//                   placeholder="e.g. Front Entrance"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the port and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Server className="w-4 h-4" />Port
//                 </label>
//                 <input
//                   type="text"
//                   value={port}
//                   onChange={(e) => setPort(e.target.value)}
//                   placeholder="554"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <MapPin className="w-4 h-4" />Extra Path (Optional)
//                 </label>
//                 <input
//                   type="text"
//                   value={extra_path}
//                   onChange={(e) => setExtraPath(e.target.value)}
//                   placeholder="/stream1"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//                 <p className="text-xs text-gray-500 mt-2">Leave empty if not required</p>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Camera Name:</span> {camera_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Port:</span> {port}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                 {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!isStepValid || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


























































// import { useMemo, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Construct RTSP URL in real-time
//   const rtspUrl = useMemo(() => {
//     if (!ip_address.trim()) return "";
    
//     const user = username.trim() || "admin";
//     const pass = password || "";
//     const ip = ip_address.trim();
//     const p = port.trim() || "554";
//     const path = extra_path.trim();
    
//     return `rtsp://${user}:${pass}@${ip}:${p}${path}`;
//   }, [ip_address, username, password, port, extra_path]);

//   // Validation for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     if (!rtspUrl) {
//       alert("Cannot construct RTSP URL. Please check all fields.");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const cameraData = {
//         id: Date.now().toString(),
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         port: port.trim(),
//         username: username.trim(),
//         password: password,
//         extra_path: extra_path.trim() || "",
//         rtsp_url: rtspUrl,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         status: 'inactive',
//         // Additional fields for compatibility
//         camera_name: location_name.trim(),
//         streamUrl: rtspUrl,
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         threatLevel: 'Low',
//         zoneCategory: 'Default'
//       };

//       console.log("Saving camera data:", cameraData);

//       addEvent({
//         camera_name: location_name.trim(),
//         zone_name: "Default",
//         date: cameraData.date,
//         time: cameraData.time,
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${location_name.trim()}" added at ${ip_address}:${port}`,
//       });

//       // Call parent's onSave with the constructed camera data
//       if (onSave) {
//         await onSave(cameraData);
//       }

//       console.log("Camera saved successfully with RTSP URL:", rtspUrl);

//     } catch (error) {
//       console.error("Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1 (optional)"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//               </div>
//               {rtspUrl && (
//                 <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
//                   <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Generated RTSP URL:</p>
//                   <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono">{rtspUrl}</p>
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP:</span> {ip_address || 'Not set'}:{port}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                 {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//                 {rtspUrl && (
//                   <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
//                     <span className="font-semibold text-gray-600 dark:text-gray-400">RTSP URL:</span>
//                     <p className="text-xs text-blue-600 dark:text-blue-400 break-all font-mono mt-1">{rtspUrl}</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!isStepValid || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }




























// import { useEffect, useMemo, useRef, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { useCameraStore } from "./store/camera-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// // Helper component for consistent step layout
// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields matching backend schema
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   // UX states
//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);
//   const { addCamera } = useCameraStore();

//   // Validation logic for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     setIsLoading(true);
//     try {
//       // Construct RTSP URL
//       const rtspUrl = `rtsp://${username.trim()}:${password}@${ip_address.trim()}:${port.trim()}${extra_path.trim()}`;
      
//       // Create camera data locally (skip backend validation for now)
//       const cameraData = {
//         id: Date.now().toString(),
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         port: port.trim(),
//         username: username.trim(),
//         password: password,
//         extra_path: extra_path.trim() || "",
//         rtsp_url: rtspUrl,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         status: 'inactive'
//       };

//       console.log("Saving camera locally:", cameraData);

//       // Add to camera store using setCameraStreams
//       const { setCameraStreams, CameraStreams } = useCameraStore.getState();
//       setCameraStreams([...(CameraStreams || []), cameraData]);

//       addEvent({
//         camera_name: location_name.trim(),
//         zone_name: "N/A",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${location_name.trim()}" saved locally at ${ip_address}:${port}`,
//       });

//       // Call onSave callback
//       if (onSave) {
//         onSave(cameraData);
//       }

//       // Close modal - camera will appear in dashboard
//       onCancel();

//     } catch (error) {
//       console.error("Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1 (optional)"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP:</span> {ip_address || 'Not set'}:{port}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                 {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!isStepValid || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }








































// REMOVED THE BACKEND AUTOMATIC TESTING BEFORE ADDING CAMERA
// import { useEffect, useMemo, useRef, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { useCameraStore } from "./store/camera-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, Lock, User, Server } from "lucide-react";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// // Helper component for consistent step layout
// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 3;

//   // Form fields matching backend schema
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   // UX states
//   const [isLoading, setIsLoading] = useState(false);

//   const addEvent = useEventStore((state) => state.addEvent);
//   const { addCamera } = useCameraStore();

//   // Validation logic for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }
  
//   async function handleFinishSave() {
//     setIsLoading(true);
//     try {
//       // Construct RTSP URL
//       const rtspUrl = `rtsp://${username.trim()}:${password}@${ip_address.trim()}:${port.trim()}${extra_path.trim()}`;
      
//       // Create camera data locally (skip backend validation for now)
//       const cameraData = {
//         id: Date.now().toString(),
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         port: port.trim(),
//         username: username.trim(),
//         password: password,
//         extra_path: extra_path.trim() || "",
//         rtsp_url: rtspUrl,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString(),
//         status: 'inactive'
//       };

//       console.log("Saving camera locally:", cameraData);

//       // Add to camera store
//       const { setCameraStreams, CameraStreams } = useCameraStore.getState();
//       setCameraStreams([...(CameraStreams || []), cameraData]);

//       addEvent({
//         camera_name: location_name.trim(),
//         zone_name: "N/A",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${location_name.trim()}" saved locally at ${ip_address}:${port}`,
//       });

//       // Call onSave callback
//       if (onSave) {
//         await onSave(cameraData);
//       }

//       alert(`Camera "${location_name.trim()}" has been saved locally! Go to Stream Client to test the connection.`);

//     } catch (error) {
//       console.error("Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1 (optional)"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication & Review"
//             instruction="Enter the camera's login credentials and review your settings"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
              
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2 mt-4">
//                 <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name || 'Not set'}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP:</span> {ip_address || 'Not set'}:{port}</div>
//                 <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                 {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//               </div>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!isStepValid || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }




































































// REMOVED THE HANDLE TEST CONNECTION
// import { useEffect, useMemo, useRef, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Eye, Lock, User, Server } from "lucide-react";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// // Helper component for consistent step layout
// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 4;

//   // Form fields matching backend schema
//   const [location_name, setLocationName] = useState("");
//   const [ip_address, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("");
//   const [port, setPort] = useState("554");
//   const [extra_path, setExtraPath] = useState("");

//   // UX states
//   const [isLoading, setIsLoading] = useState(false);
//   const [testError, setTestError] = useState("");
//   const [testSuccess, setTestSuccess] = useState(false);
//   const [rtspUrl, setRtspUrl] = useState("");

//   const addEvent = useEventStore((state) => state.addEvent);

//   // Get auth token from localStorage
//   const getAuthToken = () => {
//     return localStorage.getItem('primusLiteToken') || '';
//   };

//   // Validation logic for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!location_name.trim();
//       case 2: return !!ip_address.trim() && !!port.trim();
//       case 3: return !!username.trim() && !!password.trim();
//       case 4: return testSuccess; // Must have successful test
//       default: return false;
//     }
//   }, [step, location_name, ip_address, port, username, password, testSuccess]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }

//   async function handleTestConnection() {
//     setIsLoading(true);
//     setTestError("");
//     setTestSuccess(false);
    
//     try {
//       const token = getAuthToken();
//       if (!token) {
//         throw new Error("Authentication token not found. Please login again.");
//       }

//       console.log("Testing camera connection:", {
//         location_name: location_name.trim(),
//         ip_address: ip_address.trim(),
//         username: username.trim(),
//         port: port.trim(),
//         extra_path: extra_path.trim() || ""
//       });

//       // Call backend to add camera
//       const response = await fetch(`${BASE_URL}/api/cameras/add`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           location_name: location_name.trim(),
//           ip_address: ip_address.trim(),
//           username: username.trim(),
//           password: password,
//           port: port.trim(),
//           extra_path: extra_path.trim() || ""
//         })
//       });

//       const data = await response.json();
//       console.log("Backend response:", data);

//       if (!response.ok) {
//         let errorMessage = `Failed to add camera: ${response.status}`;
        
//         // Handle specific error cases
//         if (data.error || data.message) {
//           errorMessage = `${data.error || 'Error'}: ${data.message || 'Unknown error'}`;
          
//           // Add helpful hints for RTSP connection errors
//           if (data.message && data.message.includes('RTSP connection')) {
//             errorMessage += "\n\nTroubleshooting:\n";
//             errorMessage += "• Verify the camera IP address and port are correct\n";
//             errorMessage += "• Check that username and password are valid\n";
//             errorMessage += "• Ensure the camera supports RTSP streaming\n";
//             errorMessage += "• Confirm the backend server can reach the camera (no firewall blocking)\n";
//             errorMessage += "• Try testing RTSP URL manually: rtsp://" + username + ":***@" + ip_address + ":" + port + extra_path;
//           }
//         } else if (data.detail) {
//           if (Array.isArray(data.detail)) {
//             errorMessage = data.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
//           } else if (typeof data.detail === 'string') {
//             errorMessage = data.detail;
//           }
//         }
        
//         throw new Error(errorMessage);
//       }

//       // Success - extract RTSP URL
//       const rtspUrlFromBackend = data.stream_details?.rtsp_url || 
//                                  `rtsp://${username}:${password}@${ip_address}:${port}${extra_path || ''}`;
      
//       setRtspUrl(rtspUrlFromBackend);
//       setTestSuccess(true);
      
//       addEvent({
//         camera_name: location_name.trim(),
//         zone_name: "N/A",
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         streamUrl: rtspUrlFromBackend,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Camera "${location_name.trim()}" added successfully at ${ip_address}:${port}`,
//       });
      
//     } catch (err) {
//       console.error("Test connection error:", err);
//       setTestError(err?.message || "Connection test failed");
//       setTestSuccess(false);
//     } finally {
//       setIsLoading(false);
//     }
//   }
  
//   async function handleFinishSave() {
//     if (!testSuccess) {
//       alert("Please test the connection first before saving.");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       // Camera was already added during test, just close modal
//       if (onSave) {
//         await onSave({
//           location_name: location_name.trim(),
//           ip_address: ip_address.trim(),
//           username: username.trim(),
//           password: password,
//           port: port.trim(),
//           extra_path: extra_path.trim(),
//           rtsp_url: rtspUrl
//         });
//       }

//       alert(`Camera "${location_name.trim()}" has been added successfully to Stream Client!`);
      
//     } catch (error) {
//       console.error("Error saving camera:", error);
//       alert(`Failed to save camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Location Name"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot A')"
//           >
//             <input
//               type="text"
//               value={location_name}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Server className="w-6 h-6 text-blue-600" />}
//             title="Network Configuration"
//             instruction="Enter the camera's IP address, port, and optional stream path"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ip_address}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Server className="w-4 h-4" />Port
//                   </label>
//                   <input
//                     type="text"
//                     value={port}
//                     onChange={(e) => setPort(e.target.value)}
//                     placeholder="554"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <MapPin className="w-4 h-4" />Extra Path
//                   </label>
//                   <input
//                     type="text"
//                     value={extra_path}
//                     onChange={(e) => setExtraPath(e.target.value)}
//                     placeholder="/stream1 (optional)"
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   />
//                 </div>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication"
//             instruction="Enter the camera's login credentials"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   placeholder="admin"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   placeholder="Enter password"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 4:
//         return (
//           <WizardStep
//             icon={<Eye className="w-6 h-6 text-cyan-500" />}
//             title="Test Connection & Review"
//             instruction="Test the camera connection before completing setup"
//           >
//             <div className="space-y-4">
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50">
//                 <div className="text-sm space-y-2">
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {location_name}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP:</span> {ip_address}:{port}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                   {extra_path && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Path:</span> {extra_path}</div>}
//                 </div>
//               </div>
              
//               {testSuccess && (
//                 <div className="flex items-center gap-2 text-emerald-500">
//                   <CheckCircle2 className="w-5 h-5" /> 
//                   Connection successful! Camera added to backend.
//                 </div>
//               )}
//               {testSuccess && rtspUrl && (
//                 <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-blue-50 dark:bg-blue-900/20">
//                   <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
//                     <strong>RTSP URL:</strong> {rtspUrl}
//                   </div>
//                 </div>
//               )}
//               {!!testError && (
//                 <div className="flex items-center gap-2 text-red-500">
//                   <AlertTriangle className="w-5 h-5" /> {testError}
//                 </div>
//               )}
              
//               <button 
//                 onClick={handleTestConnection} 
//                 disabled={isLoading || testSuccess} 
//                 className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50"
//               >
//                 {isLoading ? "Testing..." : testSuccess ? "Test Successful ✓" : "Test Connection"}
//               </button>
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera to Stream</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={!testSuccess || isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Add to Stream"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }























































// import { useEffect, useMemo, useRef, useState } from "react";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Eye, Lock, User } from "lucide-react";

// // Helper component for consistent step layout
// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   const BASE_URL = "https://obex-backend-1.onrender.com";
  
//   // Wizard state - 4 steps
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 4;

//   // Form fields matching backend schema
//   const [locationName, setLocationName] = useState("");
//   const [ipAddress, setIpAddress] = useState("");
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("admin");
//   const [port, setPort] = useState("554");
//   const [extraPath, setExtraPath] = useState("");

//   // UX states
//   const [isLoading, setIsLoading] = useState(false);
//   const [testError, setTestError] = useState("");
//   const [testSuccess, setTestSuccess] = useState(false);
//   const [testStreamUrl, setTestStreamUrl] = useState("");

//   const videoRef = useRef(null);

//   // Validation logic for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!locationName.trim();
//       case 2: return !!ipAddress.trim();
//       case 3: return !!username.trim() && !!password && !!port.trim();
//       case 4: return testSuccess; // Must have successful test
//       default: return false;
//     }
//   }, [step, locationName, ipAddress, username, password, port, testSuccess]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }

//   async function handleTestConnection() {
//     setIsLoading(true);
//     setTestError("");
//     setTestSuccess(false);
//     setTestStreamUrl("");

//     try {
//       // Get JWT token from localStorage
//       const token = localStorage.getItem('primusLiteToken');
//       if (!token) {
//         throw new Error("Authentication required. Please log in again.");
//       }

//       // Call backend to get RTSP URL
//       const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           brand: "generic", // or determine from extraPath
//           ip: ipAddress.trim(),
//           username: username.trim(),
//           password: password,
//           port: parseInt(port) || 554,
//           channel: 1,
//           subtype: 0
//         })
//       });

//       if (!response.ok) {
//         // Attempt to parse error data, but be robust
//         let errorMsg = `HTTP ${response.status}: Failed to get RTSP URL`;
//         try {
//           const errorData = await response.json();
//           // Check if errorData.detail is a string or an object, and handle accordingly
//           if (typeof errorData.detail === 'string') {
//             errorMsg = errorData.detail;
//           } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
//             // If it's an object, stringify it or pick specific properties
//             errorMsg = JSON.stringify(errorData.detail);
//           } else if (errorData.message) { // Fallback for common error property 'message'
//             errorMsg = errorData.message;
//           }
//         } catch (jsonError) {
//           // If response is not JSON, use the default message
//           console.error("Failed to parse error response JSON:", jsonError);
//         }
//         throw new Error(errorMsg);
//       }

//       const data = await response.json();
      
//       if (data.rtsp_url) {
//         setTestStreamUrl(data.rtsp_url);
//         setTestSuccess(true);
        
//         // Try to preview if possible (RTSP might not work in browser directly)
//         if (videoRef.current) {
//           videoRef.current.src = data.rtsp_url;
//         }
//       } else {
//         throw new Error("No RTSP URL returned from server");
//       }

//     } catch (err) {
//       setTestError(err?.message || "Connection test failed");
//       setTestSuccess(false);
//     } finally {
//       setIsLoading(false);
//     }
//   }
  
//   async function handleFinishSave() {
//     setIsLoading(true);
//     try {
//       const token = localStorage.getItem('primusLiteToken');
//       if (!token) {
//         throw new Error("Authentication required. Please log in again.");
//       }

//       // Prepare camera data matching backend schema
//       const cameraData = {
//         location_name: locationName.trim(),
//         ip_address: ipAddress.trim(),
//         username: username.trim(),
//         password: password,
//         port: port.trim(),
//         extra_path: extraPath.trim() || ""
//       };

//       // POST to backend
//       const response = await fetch(`${BASE_URL}/api/cameras/add`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify(cameraData)
//       });

//       if (!response.ok) {
//         let errorMsg = `HTTP ${response.status}: Failed to add camera`;
//         try {
//           const errorData = await response.json();
//           // Check if errorData.detail is a string or an object, and handle accordingly
//           if (typeof errorData.detail === 'string') {
//             errorMsg = errorData.detail;
//           } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
//             // If it's an object, stringify it or pick specific properties
//             // For example, if detail is { "ip_address": ["Field required"] }, you might want to display that.
//             errorMsg = JSON.stringify(errorData.detail); 
//           } else if (errorData.message) { // Fallback for common error property 'message'
//             errorMsg = errorData.message;
//           }
//         } catch (jsonError) {
//           console.error("Failed to parse error response JSON:", jsonError);
//         }
//         throw new Error(errorMsg);
//       }

//       const result = await response.json();
      
//       console.log("Camera added successfully:", result);

//       // Call parent's onSave with the result
//       // This should trigger adding a StreamClient instead of a camera card
//       if (onSave) {
//         await onSave({
//           ...result.camera,
//           stream_details: result.stream_details,
//           rtsp_url: testStreamUrl
//         });
//       }

//       alert(`Camera "${locationName.trim()}" has been added successfully!`);

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       // Ensure error.message is always a string for the alert
//       alert(`Failed to add camera: ${error instanceof Error ? error.message : String(error)}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<MapPin className="w-6 h-6 text-purple-600" />}
//             title="Camera Location"
//             instruction="Give your camera a descriptive location name (e.g., 'Front Entrance', 'Parking Lot', 'Server Room')"
//           >
//             <input
//               type="text"
//               value={locationName}
//               onChange={(e) => setLocationName(e.target.value)}
//               placeholder="e.g. Front Entrance Camera"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<Globe className="w-6 h-6 text-blue-600" />}
//             title="Network Address"
//             instruction="Enter the camera's IP address and optional port (e.g., 192.168.1.100 or 192.168.1.100:8080)"
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ipAddress}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.100"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   Port (Optional)
//                 </label>
//                 <input
//                   type="text"
//                   value={port}
//                   onChange={(e) => setPort(e.target.value)}
//                   placeholder="554 (RTSP default)"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   Extra Path (Optional)
//                 </label>
//                 <input
//                   type="text"
//                   value={extraPath}
//                   onChange={(e) => setExtraPath(e.target.value)}
//                   placeholder="e.g. /stream or /live/ch00_0"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//                 <p className="text-xs text-gray-500 mt-1">Custom stream path if your camera requires it</p>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Lock className="w-6 h-6 text-green-600" />}
//             title="Authentication"
//             instruction="Enter the camera's login credentials. These are typically 'admin/admin' by default."
//           >
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <User className="w-4 h-4" />Username
//                 </label>
//                 <input 
//                   type="text" 
//                   value={username} 
//                   onChange={(e) => setUsername(e.target.value)} 
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Lock className="w-4 h-4" />Password
//                 </label>
//                 <input 
//                   type="password" 
//                   value={password} 
//                   onChange={(e) => setPassword(e.target.value)} 
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                 />
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 4:
//         return (
//           <WizardStep
//             icon={<Eye className="w-6 h-6 text-cyan-500" />}
//             title="Test Connection & Review"
//             instruction="Test the camera connection to ensure everything is configured correctly before saving."
//           >
//             <div className="space-y-4">
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50">
//                 <video 
//                   ref={videoRef} 
//                   controls 
//                   className="w-full max-h-48 rounded-lg bg-black"
//                   poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Preview%3C/text%3E%3C/svg%3E"
//                 ></video>
//                 {testStreamUrl && (
//                   <div className="mt-3 text-xs text-gray-500 break-all">
//                     <strong>Stream URL:</strong> {testStreamUrl}
//                   </div>
//                 )}
//               </div>
              
//               {testSuccess && (
//                 <div className="flex items-center gap-2 text-emerald-500">
//                   <CheckCircle2 className="w-5 h-5" /> Connection successful!
//                 </div>
//               )}
//               {!!testError && (
//                 <div className="flex items-center gap-2 text-red-500">
//                   <AlertTriangle className="w-5 h-5" /> {testError}
//                 </div>
//               )}
              
//               <button 
//                 onClick={handleTestConnection} 
//                 disabled={isLoading || !ipAddress.trim()} 
//                 className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50"
//               >
//                 {isLoading ? "Testing..." : "Test Connection"}
//               </button>

//               {testSuccess && (
//                 <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2">
//                   <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {locationName}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP Address:</span> {ipAddress}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Port:</span> {port}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Username:</span> {username}</div>
//                   {extraPath && <div><span className="font-semibold text-gray-600 dark:text-gray-400">Extra Path:</span> {extraPath}</div>}
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add New Camera</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={isLoading || !testSuccess} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }






















































// import { useEffect, useMemo, useRef, useState } from "react";
// import { useEventStore } from "./store/history-store";
// import { Camera, Globe, MapPin, X, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Eye, Lock, User, Smartphone } from "lucide-react";
// import { cameraAPI } from "./services/api";

// // Helper component for consistent step layout
// function WizardStep({ icon, title, instruction, children }) {
//   return (
//     <div className="space-y-4 animate-fade-in">
//       <div className="flex items-center gap-3">
//         {icon}
//         <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h3>
//       </div>
//       <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
//         {instruction}
//       </p>
//       <div>{children}</div>
//     </div>
//   );
// }

// export default function PopupModal({ onSave, onCancel }) {
//   // Wizard state - now with 5 steps instead of 6
//   const [step, setStep] = useState(1);
//   const TOTAL_STEPS = 5;

//   // Form fields
//   const [camera_name, setCameraName] = useState("");
//   const [zone, setZone] = useState("");
//   const [ipAddress, setIpAddress] = useState("");
//   const [cameraBrand, setCameraBrand] = useState("");
//   const [customBrand, setCustomBrand] = useState("");
//   const [isCustomBrand, setIsCustomBrand] = useState(false);
//   const [username, setUsername] = useState("admin");
//   const [password, setPassword] = useState("admin");

//   // Timestamps
//   const [currentDate, setCurrentDate] = useState("");
//   const [currentTime, setCurrentTime] = useState("");

//   // UX states
//   const [isLoading, setIsLoading] = useState(false);
//   const [testError, setTestError] = useState("");
//   const [testSuccess, setTestSuccess] = useState(false);

//   const videoRef = useRef(null);
//   const addEvent = useEventStore((state) => state.addEvent);

//   // Camera brands with their common stream URL patterns
//   const cameraBrands = [
//     { value: "hikvision", label: "Hikvision", streamPattern: "/ISAPI/Streaming/channels/1/picture" },
//     { value: "dahua", label: "Dahua", streamPattern: "/cam/realmonitor?channel=1&subtype=0" },
//     { value: "axis", label: "Axis", streamPattern: "/axis-cgi/mjpg/video.cgi" },
//     { value: "foscam", label: "Foscam", streamPattern: "/cgi-bin/CGIStream.cgi?cmd=GetMJStream" },
//     { value: "tp-link", label: "TP-Link", streamPattern: "/stream.cgi" },
//     { value: "reolink", label: "Reolink", streamPattern: "/cgi-bin/api.cgi?cmd=Snap&channel=0&rs=wuuPhkmUCeI9WG7C&user=" },
//     { value: "generic", label: "Generic/Other", streamPattern: "/video" }
//   ];

//   useEffect(() => {
//     const updateDateTime = () => {
//       const now = new Date();
//       setCurrentDate(now.toISOString().split('T')[0]);
//       setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
//     };
//     updateDateTime();
//     const interval = setInterval(updateDateTime, 60000);
//     return () => clearInterval(interval);
//   }, []);

//   // Construct stream URL based on brand and IP for frontend flow
//   const constructedStreamUrl = useMemo(() => {
//     if (!ipAddress) return "";
    
//     let streamPattern = "/video"; // default
//     const finalBrand = isCustomBrand ? customBrand : cameraBrand;
    
//     if (!isCustomBrand && cameraBrand) {
//       const brand = cameraBrands.find(b => b.value === cameraBrand);
//       streamPattern = brand?.streamPattern || "/video";
//     }
    
//     const withAuth = username || password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : "";
//     return `http://${withAuth}${ipAddress}${streamPattern}`;
//   }, [ipAddress, cameraBrand, customBrand, isCustomBrand, username, password]);

//   // Validation logic for each step
//   const isStepValid = useMemo(() => {
//     switch (step) {
//       case 1: return !!camera_name.trim();
//       case 2: return !!zone;
//       case 3: return !!cameraBrand || (isCustomBrand && !!customBrand.trim());
//       case 4: return !!ipAddress.trim();
//       case 5: return testSuccess; // Must have a successful test to proceed
//       default: return false;
//     }
//   }, [step, camera_name, zone, cameraBrand, ipAddress, testSuccess]);

//   function handleNext() {
//     if (isStepValid) {
//       setStep((s) => Math.min(TOTAL_STEPS, s + 1));
//     }
//   }

//   function handleBack() {
//     setStep((s) => Math.max(1, s - 1));
//   }

//   async function handleTestConnection() {
//     setIsLoading(true);
//     setTestError("");
//     setTestSuccess(false);
//     try {
//       const urlToTest = constructedStreamUrl;
//       if (!urlToTest) {
//         throw new Error("Cannot construct stream URL. Please check IP address and brand selection.");
//       }

//       // Try HTTP stream first (frontend testing)
//       await new Promise((resolve, reject) => {
//         const video = videoRef.current;
//         if (!video) return reject(new Error("Preview element not ready."));
//         let settled = false;
//         const timeout = setTimeout(() => {
//           if (!settled) {
//             settled = true;
//             cleanup();
//             reject(new Error("Connection timeout. Check IP address, credentials, or camera brand."));
//           }
//         }, 10000); // 10 second timeout
        
//         const onCanPlay = () => { 
//           if (!settled) { 
//             settled = true; 
//             cleanup(); 
//             clearTimeout(timeout);
//             resolve(); 
//           } 
//         };
//         const onError = () => { 
//           if (!settled) { 
//             settled = true; 
//             cleanup(); 
//             clearTimeout(timeout);
//             reject(new Error("Cannot play stream. Check IP address, credentials, or camera brand.")); 
//           } 
//         };
//         const cleanup = () => {
//           video.removeEventListener("canplay", onCanPlay);
//           video.removeEventListener("error", onError);
//         };
//         video.addEventListener("canplay", onCanPlay);
//         video.addEventListener("error", onError);
//         video.src = urlToTest;
//         video.load();
//       });
//       setTestSuccess(true);
//     } catch (err) {
//       setTestError(err?.message || "Connection test failed");
//       setTestSuccess(false);
//     } finally {
//       setIsLoading(false);
//     }
//   }
  
//   async function handleFinishSave() {
//     setIsLoading(true);
//     try {
//       const finalBrand = isCustomBrand ? customBrand.trim() : cameraBrand;
//       const brandLabel = isCustomBrand ? customBrand.trim() : cameraBrands.find(b => b.value === cameraBrand)?.label;
      
//       const cameraData = {
//         camera_name: camera_name.trim(),
//         cameraType: "IP",
//         streamUrl: constructedStreamUrl,
//         zoneCategory: zone,
//         date: currentDate,
//         time: currentTime,
//         ipAddress: ipAddress.trim(),
//         cameraBrand: finalBrand,
//         username: username.trim(),
//         password,
//       };

//       addEvent({
//         camera_name: camera_name.trim(),
//         zone_name: zone,
//         date: currentDate,
//         time: currentTime,
//         streamUrl: constructedStreamUrl,
//         type: "ADDED",
//         timestamp: new Date().toISOString(),
//         description: `Added ${brandLabel} camera "${camera_name.trim()}" in ${zone} zone.`,
//       });

//       // Simulate saving (no backend) - just call onSave with the data
//       console.log("Camera data to save:", cameraData);
      
//       // Call onSave callback (parent component handles the actual saving)
//       if (onSave) {
//         await onSave(cameraData);
//       }

//       // Show success message
//       alert(`Camera "${camera_name.trim()}" has been added successfully!`);

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       alert(`Failed to add camera: ${error.message || "Unknown error"}`);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   const renderCurrentStep = () => {
//     switch (step) {
//       case 1:
//         return (
//           <WizardStep
//             icon={<Camera className="w-6 h-6 text-purple-600" />}
//             title="Camera Name"
//             instruction="Give your camera a unique name (e.g., 'Front Door' or 'Office Hallway'). This helps you easily identify it later."
//           >
//             <input
//               type="text"
//               value={camera_name}
//               onChange={(e) => setCameraName(e.target.value)}
//               placeholder="e.g. Front Door Cam"
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               autoFocus
//             />
//           </WizardStep>
//         );
//       case 2:
//         return (
//           <WizardStep
//             icon={<MapPin className="w-6 h-6 text-blue-600" />}
//             title="Location"
//             instruction="Assign the camera to a location zone. This is used for organizing cameras and setting area-specific rules."
//           >
//             <select
//               value={zone}
//               onChange={(e) => setZone(e.target.value)}
//               className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//             >
//               <option value="">-- Select Location --</option>
//               <option value="public">Public</option>
//               <option value="private">Private</option>
//               <option value="closure">Closure</option>
//               <option value="vault">Vault</option>
//             </select>
//           </WizardStep>
//         );
//       case 3:
//         return (
//           <WizardStep
//             icon={<Smartphone className="w-6 h-6 text-green-600" />}
//             title="Camera Brand"
//             instruction="Select your camera's brand from the list, or choose 'Other' to enter a custom brand name."
//           >
//             <div className="space-y-4">
//               <select
//                 value={isCustomBrand ? "other" : cameraBrand}
//                 onChange={(e) => {
//                   if (e.target.value === "other") {
//                     setIsCustomBrand(true);
//                     setCameraBrand("");
//                   } else {
//                     setIsCustomBrand(false);
//                     setCameraBrand(e.target.value);
//                     setCustomBrand("");
//                   }
//                 }}
//                 className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//               >
//                 <option value="">-- Select Camera Brand --</option>
//                 {cameraBrands.map((brand) => (
//                   <option key={brand.value} value={brand.value}>
//                     {brand.label}
//                   </option>
//                 ))}
//                 <option value="other">Other (Type custom brand)</option>
//               </select>
              
//               {isCustomBrand && (
//                 <input
//                   type="text"
//                   value={customBrand}
//                   onChange={(e) => setCustomBrand(e.target.value)}
//                   placeholder="Enter camera brand name"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                   autoFocus
//                 />
//               )}
              
//               {!isCustomBrand && cameraBrand && (
//                 <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
//                   <strong>Stream Pattern:</strong> {cameraBrands.find(b => b.value === cameraBrand)?.streamPattern}
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       case 4:
//         return (
//           <WizardStep
//             icon={<Globe className="w-6 h-6 text-cyan-600" />}
//             title="Camera Address & Credentials"
//             instruction="Enter the camera's local IP address and login credentials. The system will automatically construct the stream URL based on the brand."
//           >
//             <div className="space-y-4">
//               <div>
//                 <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                   <Globe className="w-4 h-4" />IP Address
//                 </label>
//                 <input
//                   type="text"
//                   value={ipAddress}
//                   onChange={(e) => setIpAddress(e.target.value)}
//                   placeholder="e.g. 192.168.1.120:8080"
//                   className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
//                 />
//               </div>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <User className="w-4 h-4" />Username
//                   </label>
//                   <input 
//                     type="text" 
//                     value={username} 
//                     onChange={(e) => setUsername(e.target.value)} 
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                   />
//                 </div>
//                 <div>
//                   <label className="flex items-center gap-2 mb-2 text-sm font-medium">
//                     <Lock className="w-4 h-4" />Password
//                   </label>
//                   <input 
//                     type="password" 
//                     value={password} 
//                     onChange={(e) => setPassword(e.target.value)} 
//                     className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white" 
//                   />
//                 </div>
//               </div>
//             </div>
//           </WizardStep>
//         );
//       case 5:
//         return (
//           <WizardStep
//             icon={<Eye className="w-6 h-6 text-cyan-500" />}
//             title="Test Connection & Review"
//             instruction="Let's test the connection and review your camera details. A successful test is required to complete the setup."
//           >
//             <div className="space-y-4">
//               <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50">
//                 <video ref={videoRef} controls className="w-full max-h-48 rounded-lg bg-black"></video>
//                 <div className="mt-3 text-xs text-gray-500 break-all">URL: {constructedStreamUrl || "(none)"}</div>
//               </div>
              
//               {testSuccess && <div className="flex items-center gap-2 text-emerald-500"><CheckCircle2 className="w-5 h-5" /> Connection successful!</div>}
//               {!!testError && <div className="flex items-center gap-2 text-red-500"><AlertTriangle className="w-5 h-5" /> {testError}</div>}
              
//               <button 
//                 onClick={handleTestConnection} 
//                 disabled={isLoading || !constructedStreamUrl} 
//                 className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50"
//               >
//                 {isLoading ? "Testing..." : "Test Connection"}
//               </button>

//               {testSuccess && (
//                 <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white/50 dark:bg-slate-800/50 text-sm space-y-2">
//                   <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Camera Summary:</h4>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Name:</span> {camera_name}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Location:</span> {zone}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">Brand:</span> {isCustomBrand ? customBrand : cameraBrands.find(b => b.value === cameraBrand)?.label}</div>
//                   <div><span className="font-semibold text-gray-600 dark:text-gray-400">IP Address:</span> {ipAddress}</div>
//                 </div>
//               )}
//             </div>
//           </WizardStep>
//         );
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
//       <div className="relative w-[90vw] max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center gap-3">
//             <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
//               <Camera className="w-6 h-6 text-white" />
//             </div>
//             <div>
//               <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add New Camera</h2>
//               <p className="text-sm text-gray-500 dark:text-gray-400">Step {step} of {TOTAL_STEPS}</p>
//             </div>
//           </div>
//           <button onClick={onCancel} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
//             <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
//           </button>
//         </div>

//         <div className="min-h-[300px]">
//           {renderCurrentStep()}
//         </div>

//         <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
//           <button
//             onClick={onCancel}
//             disabled={isLoading}
//             className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <div className="flex gap-3">
//             {step > 1 && (
//               <button onClick={handleBack} className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 flex items-center gap-2 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
//                 <ChevronLeft className="w-4 h-4" /> Back
//               </button>
//             )}
//             {step < TOTAL_STEPS && (
//               <button onClick={handleNext} disabled={!isStepValid} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 Next <ChevronRight className="w-4 h-4" />
//               </button>
//             )}
//             {step === TOTAL_STEPS && (
//               <button onClick={handleFinishSave} disabled={isLoading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2">
//                 {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
//                 {isLoading ? "Saving..." : "Finish & Save"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }