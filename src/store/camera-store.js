import { create } from "zustand";
import axios from "axios";

export const useCameraStore = create((set, get) => ({
  CameraStreams: [],
  isLoading: false,
  error: null,

  // Set cameras directly (used when fetching from API)
  setCameraStreams: (cameras) => set({ CameraStreams: cameras }),

  // Set loading state
  setLoading: (loading) => set({ isLoading: loading }),

  // Set error state
  setError: (error) => set({ error }),

  // Fetch cameras from API
  fetchCameras: async () => {
    set({ isLoading: true, error: null });

    try {
      const token = localStorage.getItem("primusLiteToken");

      if (!token) {
        console.log("No authentication found, skipping camera fetch");
        set({ CameraStreams: [], isLoading: false });
        return [];
      }

      const response = await axios.get(
        "https://primus-lite.onrender.com/api/cameras/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data && response.data.data) {
        // Transform API data to match component structure
        const transformedCameras = response.data.data.map(camera => ({
          id: camera._id,
          camera_name: camera.camera_name,
          zoneCategory: camera.zone_name,
          date: new Date(camera.createdAt).toISOString().split('T')[0],
          time: new Date(camera.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }),
          threatLevel: camera.is_active ? 'Low' : 'High',
          status: camera.is_active ? 'active' : 'inactive',
          streamUrl: camera.stream_url,
          cameraType: camera.camera_type,
          recordingEnabled: camera.recording_enabled,
          motionSensitivity: camera.motion_sensitivity,
          offlineAlertEnabled: camera.offline_alert_enabled,
          lastStreamCheck: camera.last_stream_check,
          createdAt: camera.createdAt,
          updatedAt: camera.updatedAt
        }));

        set({ CameraStreams: transformedCameras, isLoading: false });
        console.log("Cameras loaded from API:", transformedCameras);
        return transformedCameras;
      } else {
        set({ CameraStreams: [], isLoading: false });
        return [];
      }
    } catch (error) {
      console.error("Error fetching cameras:", error.response?.data || error);
      set({
        error: error.response?.data?.message || "Failed to fetch cameras",
        isLoading: false,
        CameraStreams: []
      });
      return [];
    }
  },

  // Add camera (only to API, then refresh from API)
  addToCameraStreams: async (cameraData) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (!token) {
        throw new Error("Authentication required. Please log in first.");
      }

      console.log("📥 Received cameraData:", cameraData);

      // ✅ REQUIRED FIELDS for camera endpoint using new structure
      const requiredFields = {
        name: cameraData.camera_name || "",
        cameraType: cameraData.cameraType || "IP",
        streamUrl: cameraData.streamUrl,
        isActive: true,
        zoneName: cameraData.zoneCategory || "Default Zone",
      };

      console.log("🔧 Required fields:", requiredFields);

      // ✅ OPTIONAL FIELDS with defaults (matching working history store)
      const optionalFields = {
        recordingEnabled: true,
        motionSensitivity: 50,
        offlineAlertEnabled: false,
        lastStreamCheck: new Date().toISOString(),
      };

      // ✅ Build payload for camera API (exactly matching API documentation)
      const payload = {
        name: cameraData.camera_name || "",
        cameraType: cameraData.cameraType || "IP",
        streamUrl: cameraData.streamUrl || "",
        isActive: true,
        zoneName: cameraData.zoneCategory || "Default Zone",
        recordingEnabled: true,
        motionSensitivity: 70, // Changed back to 70 to match API docs
        offlineAlertEnabled: true, // Changed back to true to match API docs
        lastStreamCheck: new Date().toISOString(),
      };

      console.log("🌐 Sending camera payload:", payload);
      console.log("🔑 Token exists:", !!token);

      const response = await axios.post(
        "https://primus-lite.onrender.com/api/cameras/add",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Camera added successfully:", response.data);

      // Add the new camera to local store instead of fetching all cameras
      const newCamera = {
        id: response.data.data._id,
        camera_name: response.data.data.camera_name,
        zoneCategory: response.data.data.zone_name,
        date: new Date(response.data.data.createdAt).toISOString().split('T')[0],
        time: new Date(response.data.data.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        threatLevel: response.data.data.is_active ? 'Low' : 'High',
        status: response.data.data.is_active ? 'active' : 'inactive',
        streamUrl: response.data.data.stream_url,
        cameraType: response.data.data.camera_type,
        recordingEnabled: response.data.data.recording_enabled,
        motionSensitivity: response.data.data.motion_sensitivity,
        offlineAlertEnabled: response.data.data.offline_alert_enabled,
        lastStreamCheck: response.data.data.last_stream_check,
        createdAt: response.data.data.createdAt,
        updatedAt: response.data.data.updatedAt
      };

      // Add to local store
      set((state) => ({
        CameraStreams: [...state.CameraStreams, newCamera]
      }));

      return response.data;
    } catch (error) {
      console.error("❌ Error adding camera:", error.response?.data || error);
      console.error("📊 Response status:", error.response?.status);
      console.error("📋 Response headers:", error.response?.headers);
      console.error("📝 Full error object:", error);
      set({ error: error.response?.data?.message || "Failed to add camera" });
      throw error;
    }
  },

  // Remove single camera
  removeFromCameraStreams: async (cameraId) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        await axios.delete(
          `https://primus-lite.onrender.com/api/cameras/${cameraId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Camera deleted from backend");
      }

      // Remove from local store immediately for better UX
      set((state) => ({
        CameraStreams: state.CameraStreams.filter(camera => camera.id !== cameraId)
      }));

    } catch (error) {
      console.error("Error deleting camera:", error.response?.data || error);
      set({ error: error.response?.data?.message || "Failed to delete camera" });
      throw error;
    }
  },

  // Clear all cameras
  clearCameraStreams: async () => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        const { CameraStreams } = get();

        // Delete all cameras from API
        const deletePromises = CameraStreams.map(camera =>
          axios.delete(
            `https://primus-lite.onrender.com/api/cameras/${camera.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          ).catch(error => {
            console.error(`Failed to delete camera ${camera.camera_name}:`, error);
            return null; // Don't fail the entire operation if one deletion fails
          })
        );

        await Promise.allSettled(deletePromises);
        console.log("All cameras deletion attempted");
      }

      // Clear local store
      set({ CameraStreams: [] });

    } catch (error) {
      console.error("Error clearing cameras:", error);
      set({ error: "Failed to clear all cameras" });
      throw error;
    }
  },

  // Update camera
  updateCamera: async (cameraId, updates) => {
    try {
      const token = localStorage.getItem("primusLiteToken");

      if (token) {
        const response = await axios.put(
          `https://primus-lite.onrender.com/api/cameras/${cameraId}`,
          updates,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Camera updated in backend:", response.data);
      }

      // Update local store
      set((state) => ({
        CameraStreams: state.CameraStreams.map(camera =>
          camera.id === cameraId ? { ...camera, ...updates } : camera
        )
      }));

    } catch (error) {
      console.error("Error updating camera:", error.response?.data || error);
      set({ error: error.response?.data?.message || "Failed to update camera" });
      throw error;
    }
  },

  // Clear error
  clearError: () => set({ error: null })
}));