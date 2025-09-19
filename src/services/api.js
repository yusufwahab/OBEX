import axios from 'axios';

// ✅ FIXED: Removed trailing space + added .trim() for safety
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL 
  ? process.env.REACT_APP_API_BASE_URL.trim() 
  : 'https://obex-backend-1.onrender.com/api';

console.log('✅ Using API Base URL:', API_BASE_URL);

// Create axios instance with extended timeout for Render cold starts
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for Render free tier cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor — Add token & log requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('primusLiteToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data) {
      console.log('📦 Payload:', config.data);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request setup failed:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor — Handle errors globally & log responses
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Success [${response.status}]: ${response.config.url}`);
    if (response.data) {
      console.log('📥 Response data:', response.data);
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
      localStorage.removeItem('primusLiteToken');
      window.location.href = '/login';
      error.userMessage = 'Session expired. Please log in again.';
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

      // Handle empty 201 response (common in some FastAPI setups)
      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          success: true,
          message: 'Account created! Please check your email for verification.',
        };
      }

      return response.data;
    } catch (error) {
      // Auto-retry on timeout
      if (error.code === 'ECONNABORTED' && retryCount < maxRetries) {
        console.log(`🔁 Retrying signup (attempt ${retryCount + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return usersAPI.signup(payload, retryCount + 1);
      }

      throw error; // Let UI handle it
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

export default api;