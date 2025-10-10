import { useEffect } from 'react';
import { useNotificationStore } from '../store/notification-store';

let ws = null;

export const connectWebSocket = (userId) => {
  if (!userId || ws) return; // Prevent multiple connections

  const wsUrl = `wss://obex-backend.onrender.com/ws/alerts/${userId}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected for user:', userId);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Assuming the backend sends notification data in the expected format
      useNotificationStore.getState().addNotification({
        type: data.type || 'threat',
        level: data.level || 'High',
        title: data.title || 'Threat Detected',
        message: data.message || 'A potential threat has been detected.',
        priority: data.priority || 'urgent'
      });
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    ws = null;
    // Optionally reconnect after a delay
    setTimeout(() => connectWebSocket(userId), 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

export const disconnectWebSocket = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
};

// Custom hook to manage WebSocket in components
export const useWebSocket = (userId) => {
  useEffect(() => {
    if (userId) {
      connectWebSocket(userId);
      return () => disconnectWebSocket();
    }
  }, [userId]);
};
