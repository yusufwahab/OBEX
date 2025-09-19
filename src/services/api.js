import axios from 'axios';

// API base configuration using your confirmed URL
const API_BASE_URL = 'https://obex-backend-1.onrender.com/api';

console.log('Using API Base URL:', API_BASE_URL);

// Create axios instance with extended timeout for cold starts
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // 60 seconds for Render cold starts
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token and logging
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('primusLiteToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        console.log('Request payload:', config.data);
        
        return config;
    },
    (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        console.log('Response data:', response.data);
        return response;
    },
    (error) => {
        const config = error.config;
        const response = error.response;
        
        console.error('API Error Details:', {
            status: response?.status,
            statusText: response?.statusText,
            url: `${config?.baseURL}${config?.url}`,
            method: config?.method?.toUpperCase(),
            timeout: error.code === 'ECONNABORTED',
            message: error.message,
            responseData: response?.data
        });

        // Add user-friendly error messages
        if (error.code === 'ECONNABORTED') {
            error.userMessage = 'Request timeout. The server might be starting up, please try again in a moment.';
        } else if (response?.status === 401) {
            localStorage.removeItem('primusLiteToken');
            window.location.href = '/login';
        } else if (response?.status === 404) {
            error.userMessage = 'API endpoint not found. Please check your backend configuration.';
        } else if (!response) {
            error.userMessage = 'Unable to connect to server. Please check your internet connection.';
        }

        return Promise.reject(error);
    }
);

// Users API functions
export const usersAPI = {
    signup: async (payload, retryCount = 0) => {
        const maxRetries = 2;
        
        try {
            console.log('Signup attempt with payload:', payload);
            
            const response = await api.post('/users/signup', payload);
            
            // Handle empty response object from your backend
            if (!response.data || Object.keys(response.data).length === 0) {
                return { 
                    message: "Account created successfully! Please check your email for verification.",
                    success: true 
                };
            }
            
            return response.data;
            
        } catch (error) {
            // Retry on timeout errors
            if (error.code === 'ECONNABORTED' && retryCount < maxRetries) {
                console.log(`Retrying signup (attempt ${retryCount + 1}/${maxRetries + 1})`);
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
};

// Camera API functions
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
        console.log('Adding camera with data:', cameraData);
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
            const message = error?.response?.data?.message || error.message || 'Test connection failed';
            throw new Error(message);
        }
    },
};

export default api;