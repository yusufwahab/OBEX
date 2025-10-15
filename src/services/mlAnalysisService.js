import { mlAnalysisAPI } from './api';
import { useNotificationStore } from '../store/notification-store';

class MLAnalysisService {
  constructor() {
    this.pollingIntervals = new Map();
    this.isPolling = false;
  }

  // Start ML analysis with detection enabled
  async startAnalysis(cameraId, cameraName) {
    try {
      const result = await mlAnalysisAPI.start(cameraId, {
        detection_enabled: true,
        confidence_threshold: 1,
        overlap_threshold: 1
      });
      
      console.log(`✅ ML Analysis started for ${cameraName}`);
      
      // Start polling for threats
      // this.startThreatPolling(cameraId, cameraName);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to start ML analysis for ${cameraName}:`, error);
      throw error;
    }
  }

  // Stop ML analysis
  async stopAnalysis(cameraId, cameraName) {
    try {
      const result = await mlAnalysisAPI.stop(cameraId);
      
      console.log(`✅ ML Analysis stopped for ${cameraName}`);
      
      // Stop polling for threats
      this.stopThreatPolling(cameraId);
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to stop ML analysis for ${cameraName}:`, error);
      throw error;
    }
  }

  // Set detection zone
  async setDetectionZone(cameraId, zoneCoords, cameraName) {
    try {
      const result = await mlAnalysisAPI.setZone(cameraId, zoneCoords);
      
      console.log(`✅ Detection zone set for ${cameraName}`);
      
      const { addNotification } = useNotificationStore.getState();
      addNotification({
        type: 'info',
        level: 'Low',
        title: 'Detection Zone Configured',
        message: `Detection zone has been set for camera ${cameraName}`,
        priority: 'normal'
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to set detection zone for ${cameraName}:`, error);
      throw error;
    }
  }

  // Start polling for threats
  // startThreatPolling(cameraId, cameraName) {
  //   if (this.pollingIntervals.has(cameraId)) {
  //     return; // Already polling
  //   }

  //   const pollThreats = async () => {
  //     try {
  //       // Poll all threat types
  //       const [intrusions, loitering, theft, suspicious] = await Promise.allSettled([
  //         mlAnalysisAPI.getIntrusionAlerts(cameraId, 5),
  //         mlAnalysisAPI.getLoiteringAlerts(cameraId, 5),
  //         mlAnalysisAPI.getTheftAlerts(cameraId, 5),
  //         mlAnalysisAPI.getSuspiciousBehaviorAlerts(cameraId, 5)
  //       ]);

  //       // Process intrusion alerts
  //       if (intrusions.status === 'fulfilled' && intrusions.value?.length > 0) {
  //         this.processThreats(intrusions.value, 'intrusion', cameraId, cameraName);
  //       }

  //       // Process loitering alerts
  //       if (loitering.status === 'fulfilled' && loitering.value?.length > 0) {
  //         this.processThreats(loitering.value, 'loitering', cameraId, cameraName);
  //       }

  //       // Process theft alerts
  //       if (theft.status === 'fulfilled' && theft.value?.length > 0) {
  //         this.processThreats(theft.value, 'theft', cameraId, cameraName);
  //       }

  //       // Process suspicious behavior alerts
  //       if (suspicious.status === 'fulfilled' && suspicious.value?.length > 0) {
  //         this.processThreats(suspicious.value, 'suspicious', cameraId, cameraName);
  //       }

  //     } catch (error) {
  //       console.error(`❌ Error polling threats for ${cameraName}:`, error);
  //     }
  //   };

  //   // Poll every 5 seconds
  //   const intervalId = setInterval(pollThreats, 5000);
  //   this.pollingIntervals.set(cameraId, intervalId);
    
  //   console.log(`🔄 Started threat polling for ${cameraName}`);
  // }

  // Stop polling for threats
  stopThreatPolling(cameraId) {
    const intervalId = this.pollingIntervals.get(cameraId);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(cameraId);
      console.log(`⏹️ Stopped threat polling for camera ${cameraId}`);
    }
  }

  // Process threat alerts
  processThreats(threats, type, cameraId, cameraName) {
    const { addNotification } = useNotificationStore.getState();
    
    threats.forEach(threat => {
      // Check if this is a new threat (you might want to implement a more sophisticated check)
      const threatNotification = {
        type: 'threat',
        level: threat.severity || 'High',
        title: `${type.toUpperCase()} DETECTED`,
        message: threat.description || `${type} detected in ${cameraName}`,
        priority: 'urgent',
        cameraId,
        cameraName,
        zone: threat.zone,
        timestamp: threat.timestamp || new Date().toISOString()
      };

      addNotification(threatNotification);
      
      console.log(`🚨 ${type.toUpperCase()} threat detected:`, threat);
    });
  }

  // Get ML analysis status
  async getAnalysisStatus(cameraId) {
    try {
      return await mlAnalysisAPI.getStatus(cameraId);
    } catch (error) {
      console.error(`❌ Failed to get ML analysis status:`, error);
      throw error;
    }
  }

  // Get current detections
  async getCurrentDetections(cameraId) {
    try {
      return await mlAnalysisAPI.getDetections(cameraId);
    } catch (error) {
      console.error(`❌ Failed to get current detections:`, error);
      throw error;
    }
  }

  // Cleanup all polling intervals
  cleanup() {
    this.pollingIntervals.forEach((intervalId, cameraId) => {
      clearInterval(intervalId);
      console.log(`🧹 Cleaned up polling for camera ${cameraId}`);
    });
    this.pollingIntervals.clear();
  }
}

export const mlAnalysisService = new MLAnalysisService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    mlAnalysisService.cleanup();
  });
}