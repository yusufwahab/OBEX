import { create } from "zustand";

const BASE_URL = "https://obex-backend-1.onrender.com";

export const useCameraStore = create((set, get) => ({
  CameraStreams: [],
  isLoading: false,
  error: null,

  setCameraStreams: (cameras) => {
    if (typeof cameras === 'function') {
      set((state) => ({ CameraStreams: cameras(state.CameraStreams) }));
    } else {
      set({ CameraStreams: Array.isArray(cameras) ? cameras : [] });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Helper function to ensure RTSP URL is always constructed
  ensureRtspUrl: (camera) => {
    if (camera.rtsp_url) {
      return camera.rtsp_url;
    }
    
    // Construct RTSP URL if missing
    const username = camera.username || 'admin';
    const password = camera.password || '';
    const ip = camera.ip_address || '';
    const port = camera.port || '554';
    let path = camera.extra_path || '';
    
    // Ensure path starts with /
    if (path && !path.startsWith('/')) {
      path = `/${path}`;
    }
    
    return `rtsp://${username}:${password}@${ip}:${port}${path}`;
  },

  fetchCameras: async () => {
    set({ isLoading: true, error: null });

    try {
      const token = localStorage.getItem("primusLiteToken");

      if (!token) {
        console.log("No authentication found, skipping camera fetch");
        set({ CameraStreams: [], isLoading: false });
        return [];
      }

      const response = await fetch(`${BASE_URL}/api/cameras/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch cameras: ${response.status}`);
      }

      const data = await response.json();
      console.log("Raw backend response:", data);
      
      const camerasArray = Array.isArray(data) ? data : (data.cameras || data.data || []);
      
      // Transform and ensure RTSP URL exists
      const transformedCameras = camerasArray.map(item => {
        const camera = item.camera || item;
        
        // CRITICAL: Ensure RTSP URL is always present
        const rtspUrl = get().ensureRtspUrl(camera);
        
        console.log(`Camera ${camera.location_name || camera.camera_name}:`);
        console.log(`  - IP: ${camera.ip_address}:${camera.port}`);
        console.log(`  - RTSP URL: ${rtspUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
        
        return {
          id: camera.camera_id || camera.id || camera._id || `cam_${Date.now()}_${Math.random()}`,
          location_name: camera.location_name || camera.camera_name || 'Unknown',
          ip_address: camera.ip_address || '',
          port: camera.port || '554',
          username: camera.username || 'admin',
          password: camera.password || '',
          extra_path: camera.extra_path || '',
          rtsp_url: rtspUrl, // CRITICAL: Always ensure this exists
          created_at: camera.created_at,
          updated_at: camera.updated_at,
          status: camera.status || 'inactive',
          camera_name: camera.location_name || camera.camera_name,
          streamUrl: rtspUrl, // Alias for compatibility
          date: camera.created_at ? new Date(camera.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          time: camera.created_at ? new Date(camera.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          threatLevel: camera.threatLevel || camera.threat_level || 'Low',
          zoneCategory: camera.zoneCategory || camera.zone_category || 'Default'
        };
      });

      set({ CameraStreams: transformedCameras, isLoading: false });
      console.log(`✅ Loaded ${transformedCameras.length} cameras from backend`);
      return transformedCameras;

    } catch (error) {
      console.error("Error fetching cameras:", error);
      set({
        error: error.message || "Failed to fetch cameras",
        isLoading: false,
        CameraStreams: []
      });
      return [];
    }
  },

  addCamera: async (cameraData) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (!token) {
        throw new Error("Authentication required. Please log in first.");
      }

      console.log("🎥 Adding camera to backend:", {
        ...cameraData,
        password: '****' // Hide password in logs
      });

      // Ensure RTSP URL is constructed
      const rtspUrl = get().ensureRtspUrl(cameraData);
      
      console.log("📡 Constructed RTSP URL:", rtspUrl.replace(/:[^:@]+@/, ':****@'));

      // Prepare payload for backend
      const payload = {
        cameras: [{
          location_name: cameraData.location_name,
          camera_name: cameraData.location_name,
          ip_address: cameraData.ip_address,
          username: cameraData.username,
          password: cameraData.password,
          port: String(cameraData.port), // Ensure string
          extra_path: cameraData.extra_path || "",
          rtsp_url: rtspUrl, // CRITICAL: Include constructed URL
          brand: cameraData.brand || "generic"
        }]
      };

      console.log("📤 Sending to backend:", {
        ...payload,
        cameras: payload.cameras.map(c => ({
          ...c,
          password: '****',
          rtsp_url: c.rtsp_url.replace(/:[^:@]+@/, ':****@')
        }))
      });

      const response = await fetch(`${BASE_URL}/api/cameras/register-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `Failed to add camera: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error("❌ Backend error response:", errorData);
          
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map(err => 
              `${err.loc.join('.')}: ${err.msg}`
            ).join(', ');
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (typeof errorData.detail === 'object') {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Camera added successfully:", result);

      // Ensure the returned camera has RTSP URL
      const camera = result.camera || result;
      const finalRtspUrl = camera.rtsp_url || get().ensureRtspUrl(camera);

      const newCamera = {
        id: camera.camera_id || camera.id || camera._id || `cam_${Date.now()}`,
        location_name: camera.location_name,
        ip_address: camera.ip_address,
        port: camera.port,
        username: camera.username,
        password: camera.password,
        extra_path: camera.extra_path || '',
        rtsp_url: finalRtspUrl, // CRITICAL: Ensure this is always set
        created_at: camera.created_at,
        updated_at: camera.updated_at,
        status: camera.status || 'inactive',
        camera_name: camera.location_name,
        streamUrl: finalRtspUrl,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        threatLevel: 'Low',
        zoneCategory: 'Default'
      };

      console.log("✅ New camera object with RTSP URL:", {
        ...newCamera,
        password: '****',
        rtsp_url: newCamera.rtsp_url.replace(/:[^:@]+@/, ':****@')
      });

      set((state) => ({
        CameraStreams: [...state.CameraStreams, newCamera]
      }));

      return result;

    } catch (error) {
      console.error("❌ Error adding camera:", error);
      set({ error: error.message || "Failed to add camera" });
      throw error;
    }
  },

  removeCamera: async (cameraId) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to delete camera: ${response.status}`);
        }

        console.log("✅ Camera deleted from backend");
      }

      set((state) => ({
        CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
      }));

    } catch (error) {
      console.error("❌ Error deleting camera:", error);
      set({ error: error.message || "Failed to delete camera" });
      throw error;
    }
  },

  removeFromCameraStreams: async (cameraId) => {
    return get().removeCamera(cameraId);
  },

  clearCameraStreams: async () => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        const { CameraStreams } = get();

        const deletePromises = CameraStreams.map(camera =>
          fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).catch(error => {
            console.error(`Failed to delete camera ${camera.location_name}:`, error);
            return null;
          })
        );

        await Promise.allSettled(deletePromises);
        console.log("All cameras deletion attempted");
      }

      set({ CameraStreams: [] });

    } catch (error) {
      console.error("Error clearing cameras:", error);
      set({ error: "Failed to clear all cameras" });
      throw error;
    }
  },

  updateCamera: async (cameraId, updates) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`Failed to update camera: ${response.status}`);
        }

        const result = await response.json();
        console.log("Camera updated in backend:", result);
      }

      set((state) => ({
        CameraStreams: state.CameraStreams.map(camera =>
          camera.id === cameraId ? { ...camera, ...updates } : camera
        )
      }));

    } catch (error) {
      console.error("Error updating camera:", error);
      set({ error: error.message || "Failed to update camera" });
      throw error;
    }
  },

  getRtspUrl: async (cameraConfig) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brand: cameraConfig.brand || "generic",
          ip: cameraConfig.ip_address,
          username: cameraConfig.username,
          password: cameraConfig.password,
          port: parseInt(cameraConfig.port) || 554,
          channel: cameraConfig.channel || 1,
          subtype: cameraConfig.subtype || 0
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get RTSP URL: ${response.status}`);
      }

      const data = await response.json();
      return data.rtsp_url;

    } catch (error) {
      console.error("Error getting RTSP URL:", error);
      throw error;
    }
  },

  // ML Analysis endpoints
  setDetectionZone: async (cameraId, zoneCoords) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/zone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ zone_coords: zoneCoords })
      });

      if (!response.ok) throw new Error(`Failed to set detection zone: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error setting detection zone:", error);
      throw error;
    }
  },

  getCameraDetections: async (cameraId) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/detections`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get detections: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting detections:", error);
      throw error;
    }
  },

  getIntrusionAlerts: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/intrusion-alerts?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get intrusion alerts: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting intrusion alerts:", error);
      throw error;
    }
  },

  getLoiteringAlerts: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/loitering-alerts?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get loitering alerts: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting loitering alerts:", error);
      throw error;
    }
  },

  getTheftAlerts: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/theft-alerts?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get theft alerts: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting theft alerts:", error);
      throw error;
    }
  },

  getSuspiciousBehaviorAlerts: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/suspicious-behavior?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get suspicious behavior alerts: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting suspicious behavior alerts:", error);
      throw error;
    }
  },

  getCameraMLStatus: async (cameraId) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get ML status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting ML status:", error);
      throw error;
    }
  },

  getLoiteringVideos: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/loitering-videos?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get loitering videos: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting loitering videos:", error);
      throw error;
    }
  },

  getIntrusionVideos: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/intrusion-videos?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get intrusion videos: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting intrusion videos:", error);
      throw error;
    }
  },

  getWeaponVideos: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/weapon-videos?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get weapon videos: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting weapon videos:", error);
      throw error;
    }
  },

  getSuspiciousVideos: async (cameraId, limit = 50) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/cameras/${cameraId}/ml-analysis/suspicious-videos?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get suspicious videos: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting suspicious videos:", error);
      throw error;
    }
  },

  getAllLoiteringVideos: async (limit = 100) => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/ml-analysis/loitering-videos-all?limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get all loitering videos: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting all loitering videos:", error);
      throw error;
    }
  },

  getMLCameras: async () => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/ml-analysis/cameras`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get ML cameras: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting ML cameras:", error);
      throw error;
    }
  },

  getMLModelStatus: async () => {
    try {
      const token = localStorage.getItem("primusLiteToken");
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`${BASE_URL}/api/ml-analysis/ml-analysis/model-status`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to get ML model status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error getting ML model status:", error);
      throw error;
    }
  }
}));





























// import { create } from "zustand";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly
//   setCameraStreams: (cameras) => {
//     // Handle both direct array and function updater
//     if (typeof cameras === 'function') {
//       set((state) => ({ CameraStreams: cameras(state.CameraStreams) }));
//     } else {
//       set({ CameraStreams: Array.isArray(cameras) ? cameras : [] });
//     }
//   },

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Clear error
//   clearError: () => set({ error: null }),

//   // Fetch cameras from backend
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch cameras: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Raw backend response:", data);
      
//       // Handle different response formats
//       const camerasArray = Array.isArray(data) ? data : (data.cameras || data.data || []);
      
//       // Transform backend data to match component structure
//       const transformedCameras = camerasArray.map(item => {
//         const camera = item.camera || item;
//         const streamDetails = item.stream_details || {};
        
//         // CRITICAL: Construct RTSP URL if not provided
//         const rtspUrl = camera.rtsp_url || streamDetails.rtsp_url || 
//                        `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;
        
//         return {
//           id: camera.camera_id || camera.id || camera._id || `cam_${Date.now()}_${Math.random()}`,
//           location_name: camera.location_name || camera.camera_name || 'Unknown',
//           ip_address: camera.ip_address || '',
//           port: camera.port || '554',
//           username: camera.username || 'admin',
//           password: camera.password || '',
//           extra_path: camera.extra_path || '',
//           rtsp_url: rtspUrl, // Essential for streaming
//           created_at: camera.created_at,
//           updated_at: camera.updated_at,
//           status: camera.status || 'inactive',
//           // Additional fields for compatibility
//           camera_name: camera.location_name || camera.camera_name,
//           streamUrl: rtspUrl,
//           date: camera.created_at ? new Date(camera.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//           time: camera.created_at ? new Date(camera.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           threatLevel: camera.threatLevel || camera.threat_level || 'Low',
//           zoneCategory: camera.zoneCategory || camera.zone_category || 'Default'
//         };
//       });

//       set({ CameraStreams: transformedCameras, isLoading: false });
//       console.log("Cameras loaded from backend:", transformedCameras);
//       return transformedCameras;

//     } catch (error) {
//       console.error("Error fetching cameras:", error);
//       set({
//         error: error.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera to backend
//   addCamera: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("Adding camera to backend:", cameraData);

//       // Prepare the payload according to backend expectations
//       const payload = {
//         cameras: [{
//           location_name: cameraData.location_name,
//           camera_name: cameraData.location_name,
//           ip_address: cameraData.ip_address,
//           username: cameraData.username,
//           password: cameraData.password,
//           port: cameraData.port,
//           extra_path: cameraData.extra_path || "",
//           rtsp_url: cameraData.rtsp_url
//         }]
//       };

//       const response = await fetch(`${BASE_URL}/api/cameras/register-proxy`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify(payload)
//       });

//       if (!response.ok) {
//         let errorMessage = `Failed to add camera: ${response.status}`;
//         try {
//           const errorData = await response.json();
//           console.error("Backend error response:", errorData);
          
//           // Handle different error formats
//           if (typeof errorData.detail === 'string') {
//             errorMessage = errorData.detail;
//           } else if (Array.isArray(errorData.detail)) {
//             // Validation errors from FastAPI
//             errorMessage = errorData.detail.map(err => 
//               `${err.loc.join('.')}: ${err.msg}`
//             ).join(', ');
//           } else if (errorData.message) {
//             errorMessage = errorData.message;
//           } else if (typeof errorData.detail === 'object') {
//             errorMessage = JSON.stringify(errorData.detail);
//           }
//         } catch (parseError) {
//           console.error("Could not parse error response:", parseError);
//         }
//         throw new Error(errorMessage);
//       }

//       const result = await response.json();
//       console.log("Camera added successfully:", result);

//       // Transform the response
//       const camera = result.camera || result;
//       const streamDetails = result.stream_details || {};
      
//       // CRITICAL: Construct RTSP URL properly
//       const rtspUrl = camera.rtsp_url || streamDetails.rtsp_url || 
//                      cameraData.rtsp_url ||
//                      `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;

//       const newCamera = {
//         id: camera.camera_id || camera.id || camera._id || cameraData.id || `cam_${Date.now()}`,
//         location_name: camera.location_name,
//         ip_address: camera.ip_address,
//         port: camera.port,
//         username: camera.username,
//         password: camera.password,
//         extra_path: camera.extra_path || '',
//         rtsp_url: rtspUrl, // Ensure this is always present
//         created_at: camera.created_at,
//         updated_at: camera.updated_at,
//         status: camera.status || 'inactive',
//         // Additional fields
//         camera_name: camera.location_name,
//         streamUrl: rtspUrl,
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         threatLevel: 'Low',
//         zoneCategory: 'Default'
//       };

//       console.log("Transformed camera with RTSP URL:", newCamera);

//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return result;

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       set({ error: error.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove camera from backend
//   removeCamera: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'DELETE',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to delete camera: ${response.status}`);
//         }

//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error);
//       set({ error: error.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Alias for compatibility
//   removeFromCameraStreams: async (cameraId) => {
//     return get().removeCamera(cameraId);
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from backend
//         const deletePromises = CameraStreams.map(camera =>
//           fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
//             method: 'DELETE',
//             headers: {
//               'Authorization': `Bearer ${token}`,
//               'Content-Type': 'application/json'
//             }
//           }).catch(error => {
//             console.error(`Failed to delete camera ${camera.location_name}:`, error);
//             return null;
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify(updates)
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to update camera: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log("Camera updated in backend:", result);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error);
//       set({ error: error.message || "Failed to update camera" });
//       throw error;
//     }
//   },

//   // Get RTSP URL from backend (optional - for testing)
//   getRtspUrl: async (cameraConfig) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required");
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           brand: cameraConfig.brand || "generic",
//           ip: cameraConfig.ip_address,
//           username: cameraConfig.username,
//           password: cameraConfig.password,
//           port: parseInt(cameraConfig.port) || 554,
//           channel: cameraConfig.channel || 1,
//           subtype: cameraConfig.subtype || 0
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to get RTSP URL: ${response.status}`);
//       }

//       const data = await response.json();
//       return data.rtsp_url;

//     } catch (error) {
//       console.error("Error getting RTSP URL:", error);
//       throw error;
//     }
//   }
// }));


























// import { create } from "zustand";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly
//   setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Clear error
//   clearError: () => set({ error: null }),

//   // Fetch cameras from backend
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch cameras: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Raw backend response:", data);
      
//       // Transform backend data to match component structure
//       const transformedCameras = (data || []).map(item => {
//         const camera = item.camera || item;
//         const streamDetails = item.stream_details || {};
        
//         // CRITICAL: Construct RTSP URL if not provided
//         const rtspUrl = streamDetails.rtsp_url || 
//                        `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;
        
//         return {
//           id: camera.id || camera.camera_id || Date.now() + Math.random(),
//           location_name: camera.location_name || camera.camera_name || 'Unknown',
//           ip_address: camera.ip_address || '',
//           port: camera.port || '554',
//           username: camera.username || 'admin',
//           password: camera.password || '',
//           extra_path: camera.extra_path || '',
//           rtsp_url: rtspUrl, // Essential for streaming
//           created_at: camera.created_at,
//           updated_at: camera.updated_at,
//           status: 'inactive',
//           // Additional fields for compatibility
//           camera_name: camera.location_name || camera.camera_name,
//           streamUrl: rtspUrl,
//           date: camera.created_at ? new Date(camera.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//           time: camera.created_at ? new Date(camera.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           threatLevel: 'Low',
//           zoneCategory: 'Default'
//         };
//       });

//       set({ CameraStreams: transformedCameras, isLoading: false });
//       console.log("Cameras loaded from backend:", transformedCameras);
//       return transformedCameras;

//     } catch (error) {
//       console.error("Error fetching cameras:", error);
//       set({
//         error: error.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera to backend
//   addCamera: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("Adding camera to backend:", cameraData);

//       const response = await fetch(`${BASE_URL}/api/cameras/register-proxy`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           location_name: cameraData.location_name,
//           ip_address: cameraData.ip_address,
//           username: cameraData.username,
//           password: cameraData.password,
//           port: cameraData.port,
//           extra_path: cameraData.extra_path || ""
//         })
//       });

//       if (!response.ok) {
//         let errorMessage = `Failed to add camera: ${response.status}`;
//         try {
//           const errorData = await response.json();
//           console.error("Backend error response:", errorData);
          
//           // Handle different error formats
//           if (typeof errorData.detail === 'string') {
//             errorMessage = errorData.detail;
//           } else if (Array.isArray(errorData.detail)) {
//             // Validation errors from FastAPI
//             errorMessage = errorData.detail.map(err => 
//               `${err.loc.join('.')}: ${err.msg}`
//             ).join(', ');
//           } else if (errorData.message) {
//             errorMessage = errorData.message;
//           } else if (typeof errorData.detail === 'object') {
//             errorMessage = JSON.stringify(errorData.detail);
//           }
//         } catch (parseError) {
//           console.error("Could not parse error response:", parseError);
//         }
//         throw new Error(errorMessage);
//       }

//       const result = await response.json();
//       console.log("Camera added successfully:", result);

//       // Transform the response
//       const camera = result.camera || result;
//       const streamDetails = result.stream_details || {};
      
//       // CRITICAL: Construct RTSP URL properly
//       const rtspUrl = streamDetails.rtsp_url || 
//                      cameraData.rtsp_url ||
//                      `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;

//       const newCamera = {
//         id: camera.id || camera.camera_id || cameraData.id || Date.now().toString(),
//         location_name: camera.location_name,
//         ip_address: camera.ip_address,
//         port: camera.port,
//         username: camera.username,
//         password: camera.password,
//         extra_path: camera.extra_path,
//         rtsp_url: rtspUrl, // Ensure this is always present
//         created_at: camera.created_at,
//         updated_at: camera.updated_at,
//         status: 'inactive',
//         // Additional fields
//         camera_name: camera.location_name,
//         streamUrl: rtspUrl,
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         threatLevel: 'Low',
//         zoneCategory: 'Default'
//       };

//       console.log("Transformed camera with RTSP URL:", newCamera);

//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return result;

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       set({ error: error.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove camera from backend
//   removeCamera: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'DELETE',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to delete camera: ${response.status}`);
//         }

//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error);
//       set({ error: error.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Alias for compatibility
//   removeFromCameraStreams: async (cameraId) => {
//     return get().removeCamera(cameraId);
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from backend
//         const deletePromises = CameraStreams.map(camera =>
//           fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
//             method: 'DELETE',
//             headers: {
//               'Authorization': `Bearer ${token}`,
//               'Content-Type': 'application/json'
//             }
//           }).catch(error => {
//             console.error(`Failed to delete camera ${camera.location_name}:`, error);
//             return null;
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify(updates)
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to update camera: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log("Camera updated in backend:", result);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error);
//       set({ error: error.message || "Failed to update camera" });
//       throw error;
//     }
//   },

//   // Get RTSP URL from backend (optional - for testing)
//   getRtspUrl: async (cameraConfig) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required");
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           brand: cameraConfig.brand || "generic",
//           ip: cameraConfig.ip_address,
//           username: cameraConfig.username,
//           password: cameraConfig.password,
//           port: parseInt(cameraConfig.port) || 554,
//           channel: cameraConfig.channel || 1,
//           subtype: cameraConfig.subtype || 0
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to get RTSP URL: ${response.status}`);
//       }

//       const data = await response.json();
//       return data.rtsp_url;

//     } catch (error) {
//       console.error("Error getting RTSP URL:", error);
//       throw error;
//     }
//   }
// }));






















// import { create } from "zustand";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly
//   setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Clear error
//   clearError: () => set({ error: null }),

//   // Fetch cameras from backend
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch cameras: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Raw backend response:", data);
      
//       // Transform backend data to match component structure
//       const transformedCameras = (data || []).map(item => {
//         const camera = item.camera || item;
//         const streamDetails = item.stream_details || {};
        
//         // CRITICAL: Construct RTSP URL if not provided
//         const rtspUrl = streamDetails.rtsp_url || 
//                        `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;
        
//         return {
//           id: camera.id || camera.camera_id || Date.now() + Math.random(),
//           location_name: camera.location_name || camera.camera_name || 'Unknown',
//           ip_address: camera.ip_address || '',
//           port: camera.port || '554',
//           username: camera.username || 'admin',
//           password: camera.password || '',
//           extra_path: camera.extra_path || '',
//           rtsp_url: rtspUrl, // Essential for streaming
//           created_at: camera.created_at,
//           updated_at: camera.updated_at,
//           status: 'inactive',
//           // Additional fields for compatibility
//           camera_name: camera.location_name || camera.camera_name,
//           streamUrl: rtspUrl,
//           date: camera.created_at ? new Date(camera.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//           time: camera.created_at ? new Date(camera.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           threatLevel: 'Low',
//           zoneCategory: 'Default'
//         };
//       });

//       set({ CameraStreams: transformedCameras, isLoading: false });
//       console.log("Cameras loaded from backend:", transformedCameras);
//       return transformedCameras;

//     } catch (error) {
//       console.error("Error fetching cameras:", error);
//       set({
//         error: error.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera to backend
//   addCamera: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("Adding camera to backend:", cameraData);

//       const response = await fetch(`${BASE_URL}/api/cameras/add`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           location_name: cameraData.location_name,
//           ip_address: cameraData.ip_address,
//           username: cameraData.username,
//           password: cameraData.password,
//           port: cameraData.port,
//           extra_path: cameraData.extra_path || ""
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || `Failed to add camera: ${response.status}`);
//       }

//       const result = await response.json();
//       console.log("Camera added successfully:", result);

//       // Transform the response
//       const camera = result.camera || result;
//       const streamDetails = result.stream_details || {};
      
//       // CRITICAL: Construct RTSP URL properly
//       const rtspUrl = streamDetails.rtsp_url || 
//                      cameraData.rtsp_url ||
//                      `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;

//       const newCamera = {
//         id: camera.id || camera.camera_id || cameraData.id || Date.now().toString(),
//         location_name: camera.location_name,
//         ip_address: camera.ip_address,
//         port: camera.port,
//         username: camera.username,
//         password: camera.password,
//         extra_path: camera.extra_path,
//         rtsp_url: rtspUrl, // Ensure this is always present
//         created_at: camera.created_at,
//         updated_at: camera.updated_at,
//         status: 'inactive',
//         // Additional fields
//         camera_name: camera.location_name,
//         streamUrl: rtspUrl,
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         threatLevel: 'Low',
//         zoneCategory: 'Default'
//       };

//       console.log("Transformed camera with RTSP URL:", newCamera);

//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return result;

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       set({ error: error.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove camera from backend
//   removeCamera: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'DELETE',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to delete camera: ${response.status}`);
//         }

//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error);
//       set({ error: error.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Alias for compatibility
//   removeFromCameraStreams: async (cameraId) => {
//     return get().removeCamera(cameraId);
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from backend
//         const deletePromises = CameraStreams.map(camera =>
//           fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
//             method: 'DELETE',
//             headers: {
//               'Authorization': `Bearer ${token}`,
//               'Content-Type': 'application/json'
//             }
//           }).catch(error => {
//             console.error(`Failed to delete camera ${camera.location_name}:`, error);
//             return null;
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify(updates)
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to update camera: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log("Camera updated in backend:", result);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error);
//       set({ error: error.message || "Failed to update camera" });
//       throw error;
//     }
//   },

//   // Get RTSP URL from backend (optional - for testing)
//   getRtspUrl: async (cameraConfig) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required");
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           brand: cameraConfig.brand || "generic",
//           ip: cameraConfig.ip_address,
//           username: cameraConfig.username,
//           password: cameraConfig.password,
//           port: parseInt(cameraConfig.port) || 554,
//           channel: cameraConfig.channel || 1,
//           subtype: cameraConfig.subtype || 0
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to get RTSP URL: ${response.status}`);
//       }

//       const data = await response.json();
//       return data.rtsp_url;

//     } catch (error) {
//       console.error("Error getting RTSP URL:", error);
//       throw error;
//     }
//   }
// }));










































// import { create } from "zustand";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly
//   setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Clear error
//   clearError: () => set({ error: null }),

//   // Fetch cameras from backend
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch cameras: ${response.status}`);
//       }

//       const data = await response.json();
//       console.log("Raw backend response:", data);
      
//       // Transform backend data to match component structure
//       const transformedCameras = (data || []).map(item => {
//         const camera = item.camera || item;
//         const streamDetails = item.stream_details || {};
        
//         // Construct RTSP URL if not provided
//         const rtspUrl = streamDetails.rtsp_url || 
//                        `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;
        
//         return {
//           id: camera.id || Date.now() + Math.random(),
//           location_name: camera.location_name || 'Unknown',
//           ip_address: camera.ip_address || '',
//           port: camera.port || '554',
//           username: camera.username || 'admin',
//           password: camera.password || '',
//           extra_path: camera.extra_path || '',
//           rtsp_url: rtspUrl,
//           created_at: camera.created_at,
//           updated_at: camera.updated_at,
//           status: 'inactive',
//           // Additional fields for compatibility
//           camera_name: camera.location_name,
//           streamUrl: rtspUrl,
//           date: camera.created_at ? new Date(camera.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//           time: camera.created_at ? new Date(camera.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//           threatLevel: 'Low',
//           zoneCategory: 'Default'
//         };
//       });

//       set({ CameraStreams: transformedCameras, isLoading: false });
//       console.log("Cameras loaded from backend:", transformedCameras);
//       return transformedCameras;

//     } catch (error) {
//       console.error("Error fetching cameras:", error);
//       set({
//         error: error.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera to backend
//   addCamera: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("Adding camera to backend:", cameraData);

//       const response = await fetch(`${BASE_URL}/api/cameras/add`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           location_name: cameraData.location_name,
//           ip_address: cameraData.ip_address,
//           username: cameraData.username,
//           password: cameraData.password,
//           port: cameraData.port,
//           extra_path: cameraData.extra_path || ""
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || `Failed to add camera: ${response.status}`);
//       }

//       const result = await response.json();
//       console.log("Camera added successfully:", result);

//       // Transform the response
//       const camera = result.camera || result;
//       const streamDetails = result.stream_details || {};
      
//       const rtspUrl = streamDetails.rtsp_url || 
//                      cameraData.rtsp_url ||
//                      `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.extra_path || ''}`;

//       const newCamera = {
//         id: camera.id || cameraData.id || Date.now().toString(),
//         location_name: camera.location_name,
//         ip_address: camera.ip_address,
//         port: camera.port,
//         username: camera.username,
//         password: camera.password,
//         extra_path: camera.extra_path,
//         rtsp_url: rtspUrl,
//         created_at: camera.created_at,
//         updated_at: camera.updated_at,
//         status: 'inactive',
//         // Additional fields
//         camera_name: camera.location_name,
//         streamUrl: rtspUrl,
//         date: new Date().toISOString().split('T')[0],
//         time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
//         threatLevel: 'Low',
//         zoneCategory: 'Default'
//       };

//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return result;

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       set({ error: error.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove camera from backend
//   removeCamera: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'DELETE',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to delete camera: ${response.status}`);
//         }

//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error);
//       set({ error: error.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Alias for compatibility
//   removeFromCameraStreams: async (cameraId) => {
//     return get().removeCamera(cameraId);
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from backend
//         const deletePromises = CameraStreams.map(camera =>
//           fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
//             method: 'DELETE',
//             headers: {
//               'Authorization': `Bearer ${token}`,
//               'Content-Type': 'application/json'
//             }
//           }).catch(error => {
//             console.error(`Failed to delete camera ${camera.location_name}:`, error);
//             return null;
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify(updates)
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to update camera: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log("Camera updated in backend:", result);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error);
//       set({ error: error.message || "Failed to update camera" });
//       throw error;
//     }
//   },

//   // Get RTSP URL from backend (optional - for testing)
//   getRtspUrl: async (cameraConfig) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required");
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/rtsp`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           brand: cameraConfig.brand || "generic",
//           ip: cameraConfig.ip_address,
//           username: cameraConfig.username,
//           password: cameraConfig.password,
//           port: parseInt(cameraConfig.port) || 554,
//           channel: cameraConfig.channel || 1,
//           subtype: cameraConfig.subtype || 0
//         })
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to get RTSP URL: ${response.status}`);
//       }

//       const data = await response.json();
//       return data.rtsp_url;

//     } catch (error) {
//       console.error("Error getting RTSP URL:", error);
//       throw error;
//     }
//   }
// }));































// import { create } from "zustand";

// const BASE_URL = "https://obex-backend-1.onrender.com";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly
//   setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Clear error
//   clearError: () => set({ error: null }),

//   // Fetch cameras from backend
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await fetch(`${BASE_URL}/api/cameras/`, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });

//       if (!response.ok) {
//         throw new Error(`Failed to fetch cameras: ${response.status}`);
//       }

//       const data = await response.json();
      
//       // Transform backend data to match component structure
//       const transformedCameras = (data || []).map(item => ({
//         id: item.camera?.id || Date.now() + Math.random(),
//         location_name: item.camera?.location_name || 'Unknown',
//         ip_address: item.camera?.ip_address || '',
//         port: item.camera?.port || '554',
//         username: item.camera?.username || 'admin',
//         password: item.camera?.password || '',
//         extra_path: item.camera?.extra_path || '',
//         rtsp_url: item.stream_details?.rtsp_url || '',
//         created_at: item.camera?.created_at,
//         updated_at: item.camera?.updated_at,
//         status: 'inactive'
//       }));

//       set({ CameraStreams: transformedCameras, isLoading: false });
//       console.log("Cameras loaded from backend:", transformedCameras);
//       return transformedCameras;

//     } catch (error) {
//       console.error("Error fetching cameras:", error);
//       set({
//         error: error.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera to backend (called by PopupModal during test connection)
//   addCamera: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("Adding camera to backend:", cameraData);

//       const response = await fetch(`${BASE_URL}/api/cameras/add`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${token}`
//         },
//         body: JSON.stringify({
//           location_name: cameraData.location_name,
//           ip_address: cameraData.ip_address,
//           username: cameraData.username,
//           password: cameraData.password,
//           port: cameraData.port,
//           extra_path: cameraData.extra_path || ""
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.detail || `Failed to add camera: ${response.status}`);
//       }

//       const result = await response.json();
//       console.log("Camera added successfully:", result);

//       // Add to local store
//       const newCamera = {
//         id: result.camera?.id || Date.now().toString(),
//         location_name: result.camera?.location_name,
//         ip_address: result.camera?.ip_address,
//         port: result.camera?.port,
//         username: result.camera?.username,
//         password: result.camera?.password,
//         extra_path: result.camera?.extra_path,
//         rtsp_url: result.stream_details?.rtsp_url || '',
//         created_at: result.camera?.created_at,
//         updated_at: result.camera?.updated_at,
//         status: 'inactive'
//       };

//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return result;

//     } catch (error) {
//       console.error("Error adding camera:", error);
//       set({ error: error.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove camera from backend
//   removeCamera: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'DELETE',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           }
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to delete camera: ${response.status}`);
//         }

//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error);
//       set({ error: error.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from backend
//         const deletePromises = CameraStreams.map(camera =>
//           fetch(`${BASE_URL}/api/cameras/${camera.id}`, {
//             method: 'DELETE',
//             headers: {
//               'Authorization': `Bearer ${token}`,
//               'Content-Type': 'application/json'
//             }
//           }).catch(error => {
//             console.error(`Failed to delete camera ${camera.location_name}:`, error);
//             return null;
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await fetch(`${BASE_URL}/api/cameras/${cameraId}`, {
//           method: 'PUT',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify(updates)
//         });

//         if (!response.ok) {
//           throw new Error(`Failed to update camera: ${response.status}`);
//         }

//         const result = await response.json();
//         console.log("Camera updated in backend:", result);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error);
//       set({ error: error.message || "Failed to update camera" });
//       throw error;
//     }
//   }
// }));






































































































// import { create } from "zustand";
// import axios from "axios";
// import api, { cameraAPI } from "../services/api";

// export const useCameraStore = create((set, get) => ({
//   CameraStreams: [],
//   isLoading: false,
//   error: null,

//   // Set cameras directly (used when fetching from API)
//   setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

//   // Set loading state
//   setLoading: (loading) => set({ isLoading: loading }),

//   // Set error state
//   setError: (error) => set({ error }),

//   // Fetch cameras from API
//   fetchCameras: async () => {
//     set({ isLoading: true, error: null });

//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         console.log("No authentication found, skipping camera fetch");
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }

//       const response = await cameraAPI.getAllCameras();

//       if (response) {
//         const list = response.data?.data || response.data || [];
//         // Transform API data to match component structure
//         const transformedCameras = list.map(camera => ({
//           id: camera._id,
//           camera_name: camera.camera_name,
//           zoneCategory: camera.zone_name,
//           date: new Date(camera.createdAt).toISOString().split('T')[0],
//           time: new Date(camera.createdAt).toLocaleTimeString([], {
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: false
//           }),
//           threatLevel: camera.is_active ? 'Low' : 'High',
//           status: camera.is_active ? 'active' : 'inactive',
//           streamUrl: camera.stream_url,
//           cameraType: camera.camera_type,
//           recordingEnabled: camera.recording_enabled,
//           motionSensitivity: camera.motion_sensitivity,
//           offlineAlertEnabled: camera.offline_alert_enabled,
//           lastStreamCheck: camera.last_stream_check,
//           createdAt: camera.createdAt,
//           updatedAt: camera.updatedAt
//         }));

//         set({ CameraStreams: transformedCameras, isLoading: false });
//         console.log("Cameras loaded from API:", transformedCameras);
//         return transformedCameras;
//       } else {
//         set({ CameraStreams: [], isLoading: false });
//         return [];
//       }
//     } catch (error) {
//       console.error("Error fetching cameras:", error.response?.data || error);
//       set({
//         error: error.response?.data?.message || "Failed to fetch cameras",
//         isLoading: false,
//         CameraStreams: []
//       });
//       return [];
//     }
//   },

//   // Add camera (only to API, then refresh from API)
//   addToCameraStreams: async (cameraData) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (!token) {
//         throw new Error("Authentication required. Please log in first.");
//       }

//       console.log("📥 Received cameraData:", cameraData);

//       // ✅ REQUIRED FIELDS for camera endpoint using new structure
//       const requiredFields = {
//         name: cameraData.camera_name || "",
//         cameraType: cameraData.cameraType || "IP",
//         streamUrl: cameraData.streamUrl,
//         isActive: true,
//         zoneName: cameraData.zoneCategory || "Default Zone",
//       };

//       console.log("🔧 Required fields:", requiredFields);

//       // ✅ OPTIONAL FIELDS with defaults (matching working history store)
//       const optionalFields = {
//         recordingEnabled: true,
//         motionSensitivity: 50,
//         offlineAlertEnabled: false,
//         lastStreamCheck: new Date().toISOString(),
//       };

//       // ✅ Build payload for camera API (exactly matching API documentation)
//       const payload = {
//         name: cameraData.camera_name || "",
//         cameraType: cameraData.cameraType || "IP",
//         streamUrl: cameraData.streamUrl || "",
//         isActive: true,
//         zoneName: cameraData.zoneCategory || "Default Zone",
//         recordingEnabled: true,
//         motionSensitivity: 70, // Changed back to 70 to match API docs
//         offlineAlertEnabled: true, // Changed back to true to match API docs
//         lastStreamCheck: new Date().toISOString(),
//       };

//       console.log("🌐 Sending camera payload:", payload);
//       console.log("🔑 Token exists:", !!token);

//       const response = await cameraAPI.addCamera(payload);

//       console.log("Camera added successfully:", response.data);

//       // Add the new camera to local store instead of fetching all cameras
//       const created = response.data?.data || response.data;
//       const newCamera = {
//         id: created._id || created.id,
//         camera_name: created.camera_name || created.name,
//         zoneCategory: created.zone_name || created.zoneName,
//         date: new Date(created.createdAt || Date.now()).toISOString().split('T')[0],
//         time: new Date(created.createdAt || Date.now()).toLocaleTimeString([], {
//           hour: '2-digit',
//           minute: '2-digit',
//           hour12: false
//         }),
//         threatLevel: created.is_active ? 'Low' : 'High',
//         status: created.is_active ? 'active' : 'inactive',
//         streamUrl: created.stream_url || created.streamUrl,
//         cameraType: created.camera_type || created.cameraType,
//         recordingEnabled: created.recording_enabled ?? created.recordingEnabled,
//         motionSensitivity: created.motion_sensitivity ?? created.motionSensitivity,
//         offlineAlertEnabled: created.offline_alert_enabled ?? created.offlineAlertEnabled,
//         lastStreamCheck: created.last_stream_check || created.lastStreamCheck,
//         createdAt: created.createdAt,
//         updatedAt: created.updatedAt
//       };

//       // Add to local store
//       set((state) => ({
//         CameraStreams: [...state.CameraStreams, newCamera]
//       }));

//       return response.data;
//     } catch (error) {
//       console.error("❌ Error adding camera:", error.response?.data || error);
//       console.error("📊 Response status:", error.response?.status);
//       console.error("📋 Response headers:", error.response?.headers);
//       console.error("📝 Full error object:", error);
//       set({ error: error.response?.data?.message || "Failed to add camera" });
//       throw error;
//     }
//   },

//   // Remove single camera
//   removeFromCameraStreams: async (cameraId) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         await cameraAPI.deleteCamera(cameraId);
//         console.log("Camera deleted from backend");
//       }

//       // Remove from local store immediately for better UX
//       set((state) => ({
//         CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
//       }));

//     } catch (error) {
//       console.error("Error deleting camera:", error.response?.data || error);
//       set({ error: error.response?.data?.message || "Failed to delete camera" });
//       throw error;
//     }
//   },

//   // Clear all cameras
//   clearCameraStreams: async () => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const { CameraStreams } = get();

//         // Delete all cameras from API
//         const deletePromises = CameraStreams.map(camera =>
//           axios.delete(
//             `https://primus-lite.onrender.com/api/cameras/${camera.id}`,
//             {
//               headers: {
//                 Authorization: `Bearer ${token}`,
//                 "Content-Type": "application/json",
//               },
//             }
//           ).catch(error => {
//             console.error(`Failed to delete camera ${camera.camera_name}:`, error);
//             return null; // Don't fail the entire operation if one deletion fails
//           })
//         );

//         await Promise.allSettled(deletePromises);
//         console.log("All cameras deletion attempted");
//       }

//       // Clear local store
//       set({ CameraStreams: [] });

//     } catch (error) {
//       console.error("Error clearing cameras:", error);
//       set({ error: "Failed to clear all cameras" });
//       throw error;
//     }
//   },

//   // Update camera
//   updateCamera: async (cameraId, updates) => {
//     try {
//       const token = localStorage.getItem("primusLiteToken");

//       if (token) {
//         const response = await cameraAPI.updateCamera(cameraId, updates);

//         console.log("Camera updated in backend:", response.data);
//       }

//       // Update local store
//       set((state) => ({
//         CameraStreams: state.CameraStreams.map(camera =>
//           camera.id === cameraId ? { ...camera, ...updates } : camera
//         )
//       }));

//     } catch (error) {
//       console.error("Error updating camera:", error.response?.data || error);
//       set({ error: error.response?.data?.message || "Failed to update camera" });
//       throw error;
//     }
//   },

//   // Clear error
//   clearError: () => set({ error: null })
// }));