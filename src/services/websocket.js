import { useNotificationStore } from '../store/notification-store';

class ThreatWebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isConnected = false;
    this.onThreatCallback = null;
  }

  connect() {
    try {
      const wsUrl = 'wss://teletraan-backend.avzdax.com/stream/ws/streams';
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected for threat detection');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle threat detection messages
          if (message.type === 'threat_detected' || message.type === 'ml_alert') {
            console.log('🚨 Threat detected via WebSocket:', message.data);
            this.handleThreatDetection(message.data);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  handleThreatDetection(threatData) {
    const { addNotification } = useNotificationStore.getState();
    
    // Create notification
    const notification = {
      type: 'threat',
      level: threatData.severity || 'High',
      title: `${threatData.type?.toUpperCase()} Alert`,
      message: threatData.description || `${threatData.type} detected in ${threatData.cameraName}`,
      priority: 'urgent',
      cameraId: threatData.cameraId,
      cameraName: threatData.cameraName,
      zone: threatData.zone,
      timestamp: threatData.timestamp || new Date().toISOString()
    };
    
    addNotification(notification);
    
    // Trigger alert modal callback if set
    if (this.onThreatCallback) {
      this.onThreatCallback(threatData);
    }
  }

  setThreatCallback(callback) {
    this.onThreatCallback = callback;
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max WebSocket reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  // Simulate threat for testing
  simulateThreat(type = 'intrusion') {
    const mockThreat = {
      type,
      severity: 'High',
      description: `Simulated ${type} detected for testing purposes`,
      cameraId: 'test-camera-1',
      cameraName: 'Test Camera',
      zone: 'Zone A',
      timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Simulating threat:', mockThreat);
    this.handleThreatDetection(mockThreat);
  }
}

export const threatWebSocket = new ThreatWebSocketService();