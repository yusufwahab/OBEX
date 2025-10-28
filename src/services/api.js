import axios from 'axios';

// ✅ Vite-compatible + No trailing space + Safe fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.trim()
  : 'https://obex-backend-1.onrender.com/api'; // ← NO TRAILING SPACE

console.log('✅ Using API Base URL:', API_BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('primusLiteToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    if (config.data) {
      console.log('📦 Request Payload:', JSON.stringify(config.data, null, 2));
    }
    console.log('📝 Request Headers:', config.headers);

    return config;
  },
  (error) => {
    console.error('❌ Request setup failed:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Success [${response.status}]: ${response.config.method?.toUpperCase()} ${response.config.url}`);
    console.log('📥 Response Headers:', response.headers);
    if (response.data) {
      console.log('📥 Response Data:', JSON.stringify(response.data, null, 2));
    }
    return response;
  },
  (error) => {
    const config = error.config;
    const response = error.response;

    console.error('🚨 API Error Details:', {
      status: response?.status,
      url: config?.url,
      method: config?.method?.toUpperCase(),
      timeout: error.code === 'ECONNABORTED',
      message: error.message,
      serverMessage: response?.data?.message || response?.data?.detail,
      payload: config?.data,
    });

    // Attach user-friendly messages
    if (error.code === 'ECONNABORTED') {
      error.userMessage = '⏳ Request timed out. Server might be waking up. Please try again.';
    } else if (response?.status === 401) {
      // Don't redirect or set userMessage for login requests - let Login.jsx handle it
      if (!config.url.includes('/users/login')) {
        localStorage.removeItem('primusLiteToken');
        window.location.href = '/login';
        error.userMessage = 'Session expired. Please log in again.';
      }
    } else if (response?.status === 404) {
      error.userMessage = '🔍 API endpoint not found. Check backend routes.';
    } else if (!response) {
      error.userMessage = '🌐 Network error. Check your internet or server status.';
    } else if (response?.status === 422) {
      const messages = Array.isArray(response.data.detail)
        ? response.data.detail.map(e => e.msg).join(', ')
        : 'Validation failed.';
      error.userMessage = `⚠️ ${messages}`;
    } else if (response?.data?.message) {
      error.userMessage = response.data.message;
    }

    return Promise.reject(error);
  }
);

// ======================
// USERS API
// ======================
export const usersAPI = {
  signup: async (payload, retryCount = 0) => {
    const maxRetries = 2;

    try {
      console.log('🔐 Attempting signup...', payload);
      const response = await api.post('/users/signup', payload);

      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          success: true,
          message: 'Account created! Please check your email for verification.',
        };
      }

      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED' && retryCount < maxRetries) {
        console.log(`🔁 Retrying signup (attempt ${retryCount + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return usersAPI.signup(payload, retryCount + 1);
      }
      throw error;
    }
  },

  login: async (payload) => {
    const response = await api.post('/users/login', payload);
    return response.data;
  },

  verifyEmail: async (payload) => {
    const response = await api.post('/users/verify-email', payload);
    return response.data;
  },

  resendCode: async (payload) => {
    const response = await api.post('/users/resend-code', payload);
    return response.data;
  },

  forgotPassword: async (payload) => {
    const response = await api.post('/users/forgot-password', payload);
    return response.data;
  },

  resetPassword: async (payload) => {
    const response = await api.post('/users/reset-password', payload);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/users/');
    return response.data;
  },

  updateProfile: async (payload) => {
    const response = await api.put('/users/update', payload);
    return response.data;
  }
};









// ======================
// CAMERA API
// ======================
export const cameraAPI = {
  getAllCameras: async () => {
    const response = await api.get('/cameras');
    return response.data;
  },

  getSingleCamera: async (cameraId) => {
    const response = await api.get(`/cameras/${cameraId}`);
    return response.data;
  },

  addCamera: async (cameraData) => {
    console.log('📹 Adding camera:', cameraData);
    const response = await api.post('/cameras', cameraData);
    return response.data;
  },

  updateCamera: async (cameraId, updates) => {
    const response = await api.put(`/cameras/${cameraId}`, updates);
    return response.data;
  },

  deleteCamera: async (cameraId) => {
    const response = await api.delete(`/cameras/${cameraId}`);
    return response.data;
  },

  testConnection: async ({ ipAddress, username, password, streamUrl }) => {
    try {
      const response = await api.post('/cameras/test', {
        ipAddress,
        username,
        password,
        streamUrl,
      });
      return response.data;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        'Failed to test camera connection.';
      throw new Error(message);
    }
  },
};

// ======================
// ML ANALYSIS API
// ======================
export const mlAnalysisAPI = {
  // Start ML analysis with detection enabled
  start: async (cameraId, payload = {
    detection_enabled: true,
    confidence_threshold: 1,
    overlap_threshold: 1,
    zone_coords: [],
    zone_polygon: []
  }) => {
    try {
      const response = await api.post(`/ml-analysis/cameras/${cameraId}/ml-analysis/start`, payload);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'ML analysis service is currently unavailable. The backend ML service may not be running or configured properly.';
      }
      throw error;
    }
  },

  // Stop ML analysis
  stop: async (cameraId) => {
    try {
      const response = await api.delete(`/ml-analysis/cameras/${cameraId}/ml-analysis/stop`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'Failed to stop ML analysis. The service may already be stopped.';
      }
      throw error;
    }
  },

  // Set detection zone (legacy)
  setZone: async (cameraId, zoneCoords) => {
    try {
      const response = await api.put(`/ml-analysis/cameras/${cameraId}/ml-analysis/zone`, { zone_coords: zoneCoords });
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'Failed to set detection zone. Please try again.';
      }
      throw error;
    }
  },

  // Set detection zone polygon (new preferred method)
  setZonePolygon: async (cameraId, zonePolygon) => {
    try {
      const response = await api.put(`/ml-analysis/cameras/${cameraId}/ml-analysis/zone_polygon`, {
        zone_polygon: zonePolygon
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'Failed to set detection zone polygon. Please try again.';
      }
      throw error;
    }
  },

  // Get current detections
  getDetections: async (cameraId) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/detections`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'Failed to retrieve detections. ML analysis may not be running.';
      }
      throw error;
    }
  },

  // Get intrusion alerts
  getIntrusionAlerts: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/intrusion-alerts?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get intrusion alerts for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get loitering alerts
  getLoiteringAlerts: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/loitering-alerts?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get loitering alerts for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get theft alerts
  getTheftAlerts: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/theft-alerts?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get theft alerts for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get suspicious behavior alerts
  getSuspiciousBehaviorAlerts: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/suspicious-behavior?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get suspicious behavior alerts for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get ML analysis status
  getStatus: async (cameraId) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/status`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        error.userMessage = 'Failed to get ML analysis status. Service may not be running.';
      }
      throw error;
    }
  },

  // Get loitering videos for specific camera
  getLoiteringVideos: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/loitering-videos?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get loitering videos for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get intrusion videos for specific camera
  getIntrusionVideos: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/intrusion-videos?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get intrusion videos for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get weapon detection videos for specific camera
  getWeaponVideos: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/weapon-videos?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get weapon videos for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get suspicious object videos for specific camera
  getSuspiciousVideos: async (cameraId, limit = 50) => {
    try {
      const response = await api.get(`/ml-analysis/cameras/${cameraId}/ml-analysis/suspicious-videos?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get suspicious videos for camera ${cameraId}:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get all loitering videos across all cameras for user
  getAllLoiteringVideos: async (limit = 100) => {
    try {
      const response = await api.get(`/ml-analysis/ml-analysis/loitering-videos-all?limit=${limit}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get all loitering videos:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get all cameras with active ML analysis for user
  getMLCameras: async () => {
    try {
      const response = await api.get(`/ml-analysis/ml-analysis/cameras`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get ML cameras:`, error.message);
        return [];
      }
      throw error;
    }
  },

  // Get ML model status and configuration
  getModelStatus: async () => {
    try {
      const response = await api.get(`/ml-analysis/ml-analysis/model-status`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 500) {
        console.warn(`Failed to get ML model status:`, error.message);
        return null;
      }
      throw error;
    }
  },
};

export default api;
