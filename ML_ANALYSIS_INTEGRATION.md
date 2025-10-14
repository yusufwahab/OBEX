# ML Analysis Integration Documentation

## Overview
This document describes the complete ML analysis integration for the OBEX camera surveillance system, including threat detection, zone management, and real-time alerts.

## Features Implemented

### 1. ML Analysis API Integration
- **Start/Stop ML Analysis**: Toggle ML analysis for individual cameras
- **Detection Configuration**: Automatic setup with confidence_threshold: 1, overlap_threshold: 1
- **Zone Management**: Draw and set detection zones on camera feeds
- **Threat Detection**: Monitor for intrusion, loitering, theft, suspicious behavior, and weapons

### 2. Real-time Threat Detection
- **WebSocket Integration**: Real-time threat alerts via WebSocket connection
- **Polling Fallback**: HTTP polling every 5 seconds for threat detection
- **Multiple Threat Types**: 
  - Intrusion alerts
  - Loitering detection
  - Theft alerts
  - Suspicious behavior
  - Weapon detection

### 3. User Interface Components

#### CameraCard Enhancements
- **ML Analysis Toggle**: Start/Stop button with visual status indicators
- **Zone Drawing**: Interactive zone drawing tool with canvas overlay
- **Threat Simulation**: Development-only button for testing alerts
- **Status Indicators**: Visual feedback for ML analysis status

#### Threat Alert Modal
- **Animated Alerts**: Blinking triangular warning symbol
- **Threat Details**: Camera name, time, type, severity, and description
- **Acknowledge System**: Close alert after acknowledgment

#### Zone Drawing Tool
- **Interactive Canvas**: Click and drag to draw detection zones
- **Visual Feedback**: Real-time zone preview while drawing
- **Save/Cancel**: Options to save or discard drawn zones

### 4. Notification System Integration
- **Store Integration**: Automatic notification creation for threats
- **Priority Levels**: Urgent priority for threat alerts
- **Persistent Storage**: Notifications saved across sessions
- **Global Alerts**: System-wide threat alert modal

## API Endpoints Used

### ML Analysis Endpoints
```
POST /api/ml-analysis/cameras/{camera_id}/ml-analysis/start
DELETE /api/ml-analysis/cameras/{camera_id}/ml-analysis/stop
PUT /api/ml-analysis/cameras/{camera_id}/ml-analysis/zone
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/detections
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/intrusion-alerts
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/loitering-alerts
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/theft-alerts
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/suspicious-behavior
GET /api/ml-analysis/cameras/{camera_id}/ml-analysis/status
```

### WebSocket Endpoint
```
wss://obex-backend-1.onrender.com/ws/threats
```

## Configuration

### Environment Variables
```env
VITE_API_BASE_URL=https://obex-backend-1.onrender.com/api
VITE_WS_URL=wss://obex-backend-1.onrender.com/ws/threats
```

### ML Analysis Parameters
```javascript
{
  detection_enabled: true,
  confidence_threshold: 1,
  overlap_threshold: 1
}
```

## Usage Instructions

### Starting ML Analysis
1. Ensure camera stream is active
2. Click "Start ML" button on camera card
3. ML analysis begins with automatic threat detection
4. Status indicator shows "ML Active" when running

### Setting Detection Zones
1. Start camera stream
2. Click "Set Zone" button
3. Draw detection area by clicking and dragging
4. Click "Save Zone" to apply
5. Zone coordinates are sent to backend

### Threat Alerts
1. Threats are detected automatically when ML analysis is active
2. Alert modal appears with blinking warning icon
3. Notification is added to notification system
4. Click "Acknowledge Alert" to dismiss

### Testing (Development Mode)
- Use "Simulate Threat" button to test alert system
- Available in both CameraCard and Notification page
- Generates mock intrusion alert for testing

## File Structure

```
src/
├── components/
│   ├── ThreatAlertModal.jsx     # Threat alert popup component
│   └── ZoneDrawer.jsx           # Zone drawing canvas component
├── services/
│   ├── api.js                   # Updated with ML analysis endpoints
│   ├── websocket.js             # WebSocket service for real-time alerts
│   └── mlAnalysisService.js     # ML analysis service with polling
├── pages/
│   └── Notification.jsx         # Updated with threat alert integration
└── CameraCard.jsx               # Updated with ML analysis features
```

## Technical Implementation

### WebSocket Service
- Automatic reconnection with exponential backoff
- Threat callback system for camera-specific alerts
- Connection status monitoring
- Graceful error handling

### ML Analysis Service
- Polling-based threat detection
- Multiple threat type monitoring
- Automatic notification creation
- Cleanup on component unmount

### Zone Drawing
- HTML5 Canvas for interactive drawing
- Real-time path preview
- Coordinate conversion for API
- Visual feedback during drawing

## Error Handling
- Network error recovery with retry logic
- User-friendly error messages
- Fallback to polling if WebSocket fails
- Graceful degradation for missing features

## Performance Considerations
- Efficient polling intervals (5 seconds)
- Canvas optimization for zone drawing
- Memory cleanup for intervals and listeners
- Minimal re-renders with proper state management

## Security Features
- Token-based API authentication
- Secure WebSocket connections (WSS)
- Input validation for zone coordinates
- Rate limiting considerations for API calls

## Future Enhancements
- Real-time video analysis overlay
- Advanced threat classification
- Historical threat analytics
- Multi-zone detection support
- Custom alert thresholds per camera