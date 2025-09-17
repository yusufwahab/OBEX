import axios from 'axios';

// API base configuration
const API_BASE_URL = 'https://primus-lite.onrender.com/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('primusLiteToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
        return config;
    },
    (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
    (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`, response.data);
        return response;
    },
    (error) => {
        console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
        });

        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('primusLiteToken');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Camera API functions
export const cameraAPI = {
    // Get all cameras
    getAllCameras: async () => {
        const response = await api.get('/cameras');
        return response.data;
    },

    // Get single camera
    getSingleCamera: async (cameraId) => {
        const response = await api.post(`/cameras/${cameraId}`);
        return response.data;
    },

    // Add new camera
    addCamera: async (cameraData) => {
        console.log('📷 Adding camera with data:', cameraData);
        const response = await api.post('/cameras/add', cameraData);
        return response.data;
    },

    // Update camera
    updateCamera: async (cameraId, updates) => {
        const response = await api.put(`/cameras/${cameraId}`, updates);
        return response.data;
    },

    // Delete camera
    deleteCamera: async (cameraId) => {
        const response = await api.delete(`/cameras/${cameraId}`);
        return response.data;
    },

    // Test camera connection (expects backend endpoint support)
    testConnection: async ({ ipAddress, username, password, streamUrl }) => {
        try {
            const response = await api.post('/cameras/test', {
                ipAddress,
                username,
                password,
                streamUrl,
            });
            return response.data; // { success: boolean, snapshotUrl?: string, message?: string }
        } catch (error) {
            // Bubble up with normalized message
            const message = error?.response?.data?.message || error.message || 'Test connection failed';
            throw new Error(message);
        }
    },
};

export default api;
