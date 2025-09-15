# Camera API Integration

This document explains how the camera management system is integrated with the backend API.

## Overview

The application now connects to the backend API endpoints for camera management. When you click the "Add Camera" button in the popup modal, it will:

1. Collect camera information from the form
2. Send a POST request to the backend API
3. Add the camera card to the dashboard with a unique ID
4. Refresh the camera list from the backend

## API Endpoints Used

### Get All Cameras
- **Endpoint**: `GET /cameras/`
- **Authentication**: Required (Bearer token)
- **Response**: List of all cameras for the authenticated user

### Add New Camera
- **Endpoint**: `POST /cameras/add`
- **Authentication**: Required (Bearer token)
- **Payload Structure**:
```json
{
  "name": "Front Door Camera",
  "cameraType": "IP",
  "streamUrl": "rtsp://example.com/stream",
  "isActive": true,
  "zoneName": "Front Door",
  "recordingEnabled": true,
  "motionSensitivity": 70,
  "offlineAlertEnabled": true,
  "lastStreamCheck": "2025-07-10T12:00:00.000Z"
}
```

### Delete Camera
- **Endpoint**: `DELETE /cameras/:id`
- **Authentication**: Required (Bearer token)

## How It Works

### 1. Adding a Camera
1. User clicks "Add Camera" button on dashboard
2. PopupModal opens with form fields
3. User fills in:
   - Camera Name
   - Stream URL (must start with rtsp://, http://, or https://)
   - Zone Category
4. User clicks "Save Camera"
5. Form validates input
6. Camera data is sent to backend API
7. On success, camera is added to dashboard with unique ID
8. Camera list is refreshed from API

### 2. Data Flow
```
PopupModal → Dashboard → CameraStore → Backend API
```

### 3. Error Handling
- Form validation for required fields
- Stream URL format validation
- API error messages displayed to user
- Authentication errors redirect to login

## Files Modified

### 1. `src/store/camera-store.js`
- Updated to use API endpoints
- Added proper error handling and loading states
- Integrated with backend API for CRUD operations

### 2. `src/PopupModal.jsx`
- Added stream URL field with validation
- Updated to work with API integration
- Added loading states and error handling

### 3. `src/Dashboard.jsx`
- Updated to work with new camera store
- Added error display and loading states
- Added refresh functionality

## Testing the Integration

1. **Login**: Ensure you're logged in (token stored in localStorage)
2. **Add Camera**: Click "Add Camera" button
3. **Fill Form**: Enter camera details
4. **Save**: Click "Save Camera"
5. **Verify**: Camera should appear in dashboard with unique ID
6. **Check Network**: Verify API calls in browser dev tools

## Troubleshooting

### Common Issues

1. **Authentication Error**
   - Ensure you're logged in
   - Check if token exists in localStorage
   - Try logging out and back in

2. **API Connection Error**
   - Check network connectivity
   - Verify API endpoint is accessible
   - Check browser console for errors

3. **Validation Errors**
   - Ensure all required fields are filled
   - Stream URL must start with valid protocol
   - Check error messages in alerts

### Debug Information

- Check browser console for detailed error logs
- Network tab shows API request/response details
- Camera store logs successful operations

## Camera ID System

Each camera gets a unique `_id` from the backend API response:
- Format: MongoDB ObjectId (e.g., "607f1f77bcf86cd799439012")
- Used for identification and deletion
- Automatically assigned by the backend
- Stored in the camera store for local operations

## Future Enhancements

- Real-time camera status updates
- Camera settings configuration
- Bulk camera operations
- Camera health monitoring
- Stream quality indicators
