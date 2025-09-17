# OBEX – Security Monitoring Dashboard (React + Vite)

OBEX is a camera management and security monitoring dashboard. It provides a guided, multi-step workflow to add cameras, test connectivity with preview, and manage zones, history, settings, and notifications.

## Tech Stack
- React 19, Vite 7
- React Router 7
- Tailwind CSS v4 (`@tailwindcss/vite`, `@tailwindcss/postcss`)
- Zustand (with persistence) for state management
- Axios for API calls

## Getting Started

### 1) Install dependencies
```bash
npm install
```

### 2) Run the dev server
```bash
npm run dev
```
Vite starts on an available port (default 5173). The console shows the exact URL, e.g. `http://localhost:5173/`.

### 3) Tailwind CSS v4 setup
- Global stylesheet: `src/index.css` uses the v4 import pattern:
  ```css
  @import "tailwindcss";
  ```
- Vite plugin: `vite.config.js` includes `@tailwindcss/vite`.
- PostCSS: `postcss.config.js` includes `@tailwindcss/postcss`.

If you see a CSS overlay mentioning `@layer base` or Tailwind not loading, ensure you are using Tailwind v4 with the config above, then restart the dev server.

## Core Features

### Multi‑Step “Add Camera” Wizard
Trigger via Dashboard → “Add Camera”. The wizard guides through three steps with Back/Next navigation:

1. Details
   - Camera Name (friendly name)
   - Location (dropdown)
   - IP Address (LAN) with Auto button (placeholder) and manual override
   - Username & Password (defaults to admin/admin)
   - Optional Stream URL override (http/https recommended for browser preview)

2. Test Connection
   - For http/https streams, performs an in‑browser video preview
   - For RTSP streams, calls a backend test endpoint (see below)
   - Clear error messages and Reset option

3. Review & Confirm
   - Summarizes all inputs
   - Finish & Save: persists camera via backend and shows it on the dashboard

### Backend Integration
- Base URL: `https://primus-lite.onrender.com/api`
- Auth: Axios adds `Authorization: Bearer <primusLiteToken>` when present; 401 clears token and redirects to `/login`.
- Camera APIs are used from components and Zustand stores for fetch/add/update/delete.

#### Connection Test Endpoint (optional but recommended)
The UI calls `POST /api/cameras/test` via `cameraAPI.testConnection({ ipAddress, username, password, streamUrl })`.

Expected response shape:
```json
{ "success": true, "snapshotUrl": "optional", "message": "optional" }
```
If your backend does not implement this endpoint yet, the UI will show a helpful error for RTSP tests.

## Project Structure (high‑level)
- `src/App.jsx`: routes
- `src/Dashboard.jsx`: camera dashboard, Add Camera modal entry point
- `src/PopupModal.jsx`: multi‑step Add Camera wizard
- `src/services/api.js`: Axios instance and `cameraAPI` (incl. `testConnection`)
- `src/store/*`: Zustand stores (`camera-store`, `history-store`, `zone-store`, etc.)

## Notes
- Browser preview supports http/https streams directly. RTSP requires a gateway (e.g., RTSP → HLS) or the backend test endpoint.
- Zones are persisted locally via Zustand; camera CRUD syncs with the backend.

## Scripts
- `npm run dev`: start dev server
- `npm run build`: production build
- `npm run preview`: preview production build
