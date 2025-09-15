# Camera API Integration Testing Guide

## Overview
This guide will help you test the camera API integration to ensure cameras can be added, fetched, and deleted properly.

## Prerequisites
1. **Authentication**: Make sure you're logged in to the application
2. **Token**: Verify that `primusLiteToken` exists in localStorage
3. **Network**: Ensure you have internet connection to reach the API

## Testing Steps

### 1. Test Adding a Camera

1. **Open the Dashboard**
   - Navigate to the main dashboard
   - You should see "No Cameras Connected" message initially

2. **Add a Camera**
   - Click the "Add Camera" button (blue button with plus icon)
   - Fill in the form:
     - **Camera Name**: "Test Camera 1"
     - **Stream URL**: "rtsp://192.168.1.100:554/stream"
     - **Zone Category**: Select any zone (e.g., "public")
   - Click "Save Camera"

3. **Expected Results**
   - ✅ Camera should be added to the dashboard
   - ✅ Console should show "Camera added successfully"
   - ✅ Camera should have a unique ID from the backend

### 2. Test Loading Cameras from API

1. **Load Cameras**
   - Click the "Load Cameras" button (green button with sync icon)
   - This will fetch cameras from the backend API

2. **Expected Results**
   - ✅ Any cameras previously added should appear
   - ✅ Console should show "Cameras loaded from API"
   - ✅ Loading spinner should appear during fetch

### 3. Test Error Handling

1. **Test Invalid Stream URL**
   - Try adding a camera with invalid stream URL (e.g., "invalid-url")
   - Should show validation error

2. **Test Missing Fields**
   - Try adding a camera with empty required fields
   - Should show "Please fill in all required fields"

3. **Test Network Issues**
   - Disconnect internet and try adding a camera
   - Should show appropriate error message

## Console Debugging

### Check Authentication
```javascript
// In browser console
console.log("Token exists:", !!localStorage.getItem("primusLiteToken"));
console.log("Token preview:", localStorage.getItem("primusLiteToken")?.substring(0, 20) + "...");
```

### Check API Calls
Look for these console messages:
- 🌐 Sending camera payload: {...}
- 🔑 Token exists: true
- Camera added successfully: {...}
- Cameras loaded from API: [...]

### Check for Errors
Look for these error messages:
- ❌ Error adding camera: {...}
- 📊 Response status: 400/401/500
- 📝 Full error object: {...}

## API Endpoints Tested

### POST /cameras/add
- **Purpose**: Add new camera
- **Authentication**: Required
- **Payload**: Camera data with required fields

### GET /cameras/
- **Purpose**: Fetch all cameras
- **Authentication**: Required
- **Response**: Array of camera objects

### DELETE /cameras/:id
- **Purpose**: Delete specific camera
- **Authentication**: Required
- **Parameter**: Camera ID

## Troubleshooting

### Common Issues

1. **400 Bad Request**
   - Check payload structure matches API requirements
   - Verify all required fields are present
   - Check field names (camelCase vs snake_case)

2. **401 Unauthorized**
   - Verify token exists in localStorage
   - Check if token is expired
   - Try logging out and back in

3. **404 Not Found**
   - Verify API endpoint URL is correct
   - Check if backend service is running

4. **Network Errors**
   - Check internet connection
   - Verify API base URL is accessible
   - Check CORS settings

### Debug Steps

1. **Check Browser Network Tab**
   - Look for failed API requests
   - Check request/response details
   - Verify headers and payload

2. **Check Console Logs**
   - Look for error messages
   - Check payload being sent
   - Verify token information

3. **Test API Directly**
   - Use Postman or curl to test endpoints
   - Verify API is responding correctly
   - Check authentication works

## Success Criteria

✅ **Camera Addition**: Can add cameras via form
✅ **API Integration**: Cameras saved to backend
✅ **Unique IDs**: Each camera has unique identifier
✅ **Error Handling**: Proper error messages displayed
✅ **Loading States**: Loading indicators work
✅ **Manual Refresh**: Can load cameras on demand
✅ **No Auto-fetch**: Cameras don't load automatically

## Next Steps

Once testing is complete:
1. Add more cameras to test bulk operations
2. Test camera deletion functionality
3. Test camera updates (if implemented)
4. Test with different stream URL formats
5. Test with various zone categories

