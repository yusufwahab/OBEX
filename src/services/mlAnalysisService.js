import { mlAnalysisAPI } from './api';
import { useNotificationStore } from '../store/notification-store';

class MLAnalysisService {
  constructor() {
    this.pollingIntervals = new Map();
    this.isPolling = false;
    this.alertCallbacks = new Map();
  }

  // Start ML analysis with detection enabled
  async startAnalysis(cameraId, cameraName, rtspUrl = null, options = {}) {
    try {
      const payload = {
        detection_enabled: true,
        confidence_threshold: options.confidence_threshold || 0.7,
        overlap_threshold: options.overlap_threshold || 0.5,
        zone_coords: options.zone_coords || [],
        zone_polygon: options.zone_polygon || []
      };

      const result = await mlAnalysisAPI.start(cameraId, payload);

      console.log(`✅ ML Analysis started for ${cameraName}`);

      // Start polling for threats
      this.startThreatPolling(cameraId, cameraName);

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

  // Set detection zone (legacy method)
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

  // Set detection zone polygon (new preferred method)
  async setDetectionZonePolygon(cameraId, zonePolygon, cameraName) {
    try {
      const result = await mlAnalysisAPI.setZonePolygon(cameraId, zonePolygon);

      console.log(`✅ Detection zone polygon set for ${cameraName}`);

      const { addNotification } = useNotificationStore.getState();
      addNotification({
        type: 'info',
        level: 'Low',
        title: 'Detection Zone Configured',
        message: `Detection zone polygon has been set for camera ${cameraName}`,
        priority: 'normal'
      });

      return result;
    } catch (error) {
      console.error(`❌ Failed to set detection zone polygon for ${cameraName}:`, error);
      throw error;
    }
  }

  // Start polling for threats
  startThreatPolling(cameraId, cameraName) {
    if (this.pollingIntervals.has(cameraId)) {
      return; // Already polling
    }

    const pollThreats = async () => {
      try {
        // Poll all threat types
        const [intrusions, loitering, theft, suspicious] = await Promise.allSettled([
          mlAnalysisAPI.getIntrusionAlerts(cameraId, 5),
          mlAnalysisAPI.getLoiteringAlerts(cameraId, 5),
          mlAnalysisAPI.getTheftAlerts(cameraId, 5),
          mlAnalysisAPI.getSuspiciousBehaviorAlerts(cameraId, 5)
        ]);

        // Process intrusion alerts
        if (intrusions.status === 'fulfilled' && intrusions.value?.length > 0) {
          this.processThreats(intrusions.value, 'intrusion', cameraId, cameraName);
        }

        // Process loitering alerts
        if (loitering.status === 'fulfilled' && loitering.value?.length > 0) {
          this.processThreats(loitering.value, 'loitering', cameraId, cameraName);
        }

        // Process theft alerts
        if (theft.status === 'fulfilled' && theft.value?.length > 0) {
          this.processThreats(theft.value, 'theft', cameraId, cameraName);
        }

        // Process suspicious behavior alerts
        if (suspicious.status === 'fulfilled' && suspicious.value?.length > 0) {
          this.processThreats(suspicious.value, 'suspicious', cameraId, cameraName);
        }

      } catch (error) {
        console.error(`❌ Error polling threats for ${cameraName}:`, error);
      }
    };

    // Poll every 5 seconds
    const intervalId = setInterval(pollThreats, 5000);
    this.pollingIntervals.set(cameraId, intervalId);

    console.log(`🔄 Started threat polling for ${cameraName}`);
  }

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
        timestamp: threat.timestamp || new Date().toISOString(),
        threatType: type,
        threatData: threat
      };

      addNotification(threatNotification);

      // Notify alert callbacks
      this.notifyAlertCallbacks(cameraId, threatNotification);

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

  // Get all alerts for a camera
  async getAllAlerts(cameraId, limit = 50) {
    try {
      const [intrusions, loitering, theft, suspicious] = await Promise.allSettled([
        mlAnalysisAPI.getIntrusionAlerts(cameraId, limit),
        mlAnalysisAPI.getLoiteringAlerts(cameraId, limit),
        mlAnalysisAPI.getTheftAlerts(cameraId, limit),
        mlAnalysisAPI.getSuspiciousBehaviorAlerts(cameraId, limit)
      ]);

      return {
        intrusions: intrusions.status === 'fulfilled' ? intrusions.value : [],
        loitering: loitering.status === 'fulfilled' ? loitering.value : [],
        theft: theft.status === 'fulfilled' ? theft.value : [],
        suspicious: suspicious.status === 'fulfilled' ? suspicious.value : []
      };
    } catch (error) {
      console.error(`❌ Failed to get all alerts for camera ${cameraId}:`, error);
      throw error;
    }
  }

  // Get all videos for a camera
  async getAllVideos(cameraId, limit = 50) {
    try {
      const [loitering, intrusion, weapon, suspicious] = await Promise.allSettled([
        mlAnalysisAPI.getLoiteringVideos(cameraId, limit),
        mlAnalysisAPI.getIntrusionVideos(cameraId, limit),
        mlAnalysisAPI.getWeaponVideos(cameraId, limit),
        mlAnalysisAPI.getSuspiciousVideos(cameraId, limit)
      ]);

      return {
        loitering: loitering.status === 'fulfilled' ? loitering.value : [],
        intrusion: intrusion.status === 'fulfilled' ? intrusion.value : [],
        weapon: weapon.status === 'fulfilled' ? weapon.value : [],
        suspicious: suspicious.status === 'fulfilled' ? suspicious.value : []
      };
    } catch (error) {
      console.error(`❌ Failed to get all videos for camera ${cameraId}:`, error);
      throw error;
    }
  }

  // Get all loitering videos across all cameras
  async getAllLoiteringVideos(limit = 100) {
    try {
      return await mlAnalysisAPI.getAllLoiteringVideos(limit);
    } catch (error) {
      console.error(`❌ Failed to get all loitering videos:`, error);
      throw error;
    }
  }

  // Get all cameras with active ML analysis
  async getMLCameras() {
    try {
      return await mlAnalysisAPI.getMLCameras();
    } catch (error) {
      console.error(`❌ Failed to get ML cameras:`, error);
      throw error;
    }
  }

  // Get ML model status
  async getModelStatus() {
    try {
      return await mlAnalysisAPI.getModelStatus();
    } catch (error) {
      console.error(`❌ Failed to get ML model status:`, error);
      throw error;
    }
  }

  // Add alert callback for real-time notifications
  addAlertCallback(cameraId, callback) {
    if (!this.alertCallbacks.has(cameraId)) {
      this.alertCallbacks.set(cameraId, []);
    }
    this.alertCallbacks.get(cameraId).push(callback);
  }

  // Remove alert callback
  removeAlertCallback(cameraId, callback) {
    if (this.alertCallbacks.has(cameraId)) {
      const callbacks = this.alertCallbacks.get(cameraId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify alert callbacks
  notifyAlertCallbacks(cameraId, alertData) {
    if (this.alertCallbacks.has(cameraId)) {
      this.alertCallbacks.get(cameraId).forEach(callback => {
        try {
          callback(alertData);
        } catch (error) {
          console.error('Error in alert callback:', error);
        }
      });
    }
  }

  // Cleanup all polling intervals
  cleanup() {
    this.pollingIntervals.forEach((intervalId, cameraId) => {
      clearInterval(intervalId);
      console.log(`🧹 Cleaned up polling for camera ${cameraId}`);
    });
    this.pollingIntervals.clear();
    this.alertCallbacks.clear();
  }
}

export const mlAnalysisService = new MLAnalysisService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    mlAnalysisService.cleanup();
  });
}