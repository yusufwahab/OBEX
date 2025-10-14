import React, { useState, useRef, useEffect } from 'react';
import { mlAnalysisAPI } from '../services/api';

const ZoneDrawer = ({ cameraId, isActive, onZoneSet, onClose }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  useEffect(() => {
    if (isActive && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match video
      const video = document.getElementById(`video-${cameraId}`);
      if (video) {
        canvas.width = video.offsetWidth;
        canvas.height = video.offsetHeight;
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw existing zones if any
      drawZones(ctx);
    }
  }, [isActive, points]);

  const drawZones = (ctx) => {
    if (points.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw current path while drawing
    if (currentPath.length > 0) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      
      ctx.stroke();
    }
  };

  const handleMouseDown = (e) => {
    if (!isActive) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setCurrentPath([{ x, y }]);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isActive) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentPath(prev => [...prev, { x, y }]);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    drawZones(ctx);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    setPoints(currentPath);
    setCurrentPath([]);
  };

  const handleSaveZone = async () => {
    if (points.length < 3) {
      alert('Please draw a zone with at least 3 points');
      return;
    }
    
    try {
      // Convert points to the format expected by the API
      const zoneCoords = points.flatMap(point => [point.x, point.y]);
      
      await mlAnalysisAPI.setZone(cameraId, zoneCoords);
      console.log('✅ Zone saved successfully');
      
      if (onZoneSet) {
        onZoneSet(zoneCoords);
      }
      
      onClose();
    } catch (error) {
      console.error('❌ Failed to save zone:', error);
      alert('Failed to save detection zone');
    }
  };

  const handleClearZone = () => {
    setPoints([]);
    setCurrentPath([]);
    
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-10">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={handleClearZone}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleSaveZone}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          Save Zone
        </button>
        <button
          onClick={onClose}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
      
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm">
        Click and drag to draw detection zone
      </div>
    </div>
  );
};

export default ZoneDrawer;