import { useNotificationStore } from '../store/notification-store';
import useAuthStore from '../store/auth-store';

class AlertWebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.alertCallbacks = new Set();
  }

  connect() {
    if (this.ws && this.isConnected) return;

    try {
      const userId = useAuthStore.getState().user?._id || localStorage.getItem('primusLiteUserId');
      if (!userId) {
        console.error('❌ No user ID found for WebSocket connection');
        return;
      }
      console.log('🔍 Using user ID for WebSocket:', userId);
      
      const wsUrl = `wss://obex-backend.onrender.com/ws/alerts/${userId}`;
      console.log('🔌 Connecting to Alert WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Alert WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const alertData = JSON.parse(event.data);
          console.log('🚨 Alert received:', alertData);
          this.handleAlert(alertData);
        } catch (error) {
          console.error('❌ Error parsing alert message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 Alert WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ Alert WebSocket error:', error);
        console.log('💡 Trying alternative connection method...');
        // Try alternative URL format
        // Connection failed, will retry in onclose
      };
      
    } catch (error) {
      console.error('❌ Failed to connect Alert WebSocket:', error);
      this.attemptReconnect();
    }
  }

  handleAlert(alertData) {
    const { addNotification } = useNotificationStore.getState();
    
    // Create notification from alert data
    const notification = {
      type: 'threat',
      level: alertData.severity || alertData.level || 'High',
      title: alertData.title || `${alertData.type || 'Security'} Alert`,
      message: alertData.message || alertData.description || 'Alert detected',
      priority: alertData.priority || 'urgent',
      cameraId: alertData.cameraId || alertData.camera_id,
      cameraName: alertData.cameraName || alertData.camera_name,
      timestamp: alertData.timestamp || new Date().toISOString()
    };
    
    addNotification(notification);
    
    // Notify all registered callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alertData);
      } catch (error) {
        console.error('❌ Error in alert callback:', error);
      }
    });
  }

  addAlertCallback(callback) {
    this.alertCallbacks.add(callback);
  }

  removeAlertCallback(callback) {
    this.alertCallbacks.delete(callback);
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect Alert WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max Alert WebSocket reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  // Test method to simulate an alert
  simulateAlert(cameraId = 'test-camera') {
    const mockAlert = {
      type: 'intrusion',
      severity: 'High',
      title: 'Intrusion Detected',
      message: 'Unauthorized person detected in restricted area',
      cameraId: cameraId,
      cameraName: 'Test Camera',
      timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Simulating alert:', mockAlert);
    this.handleAlert(mockAlert);
  }
}

export const alertWebSocket = new AlertWebSocketService();