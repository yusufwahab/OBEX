import React, { useState, useRef, useEffect } from 'react';
import { useCameraStore } from '../store/camera-store';

const ZoneDrawer = ({ cameraId, isActive, isFullscreen, onZoneSet, onZonePolygonSet, onClose }) => {
  const { setDetectionZone } = useCameraStore();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [zoneType, setZoneType] = useState('rectangle'); // 'rectangle' or 'polygon'
  const [startPoint, setStartPoint] = useState(null);

  useEffect(() => {
    if (isActive && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas size based on fullscreen mode
      let width, height;
      if (isFullscreen) {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw existing zones if any
      drawZones(ctx);
    }
  }, [isActive, points, currentPath, isFullscreen]);

  // Clear zones when switching zone type
  useEffect(() => {
    setPoints([]);
    setCurrentPath([]);
    setStartPoint(null);
    setIsDrawing(false);
  }, [zoneType]);

  const drawZones = (ctx) => {
    // Draw completed zones
    if (points.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';

      if (zoneType === 'rectangle' && points.length === 2) {
        // Draw rectangle
        const [p1, p2] = points;
        const width = p2.x - p1.x;
        const height = p2.y - p1.y;

        ctx.fillRect(p1.x, p1.y, width, height);
        ctx.strokeRect(p1.x, p1.y, width, height);
      } else if (zoneType === 'polygon') {
        // Draw polygon
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw current path while drawing
    if (currentPath.length > 0) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (zoneType === 'rectangle' && currentPath.length === 2) {
        // Draw preview rectangle
        const [p1, p2] = currentPath;
        const width = p2.x - p1.x;
        const height = p2.y - p1.y;

        ctx.strokeRect(p1.x, p1.y, width, height);
      } else if (zoneType === 'polygon') {
        // Draw preview polygon
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);

        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }

        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw points for polygon
    if (zoneType === 'polygon') {
      [...points, ...currentPath].forEach((point, index) => {
        ctx.fillStyle = index < points.length ? '#00ff00' : '#ffff00';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    if (!isActive || !canvasRef.current) return;

    e.preventDefault();
    const { x, y } = getMousePos(e);

    console.log(`🖱️ Mouse down at (${x}, ${y}) - Zone type: ${zoneType}`);

    if (zoneType === 'rectangle') {
      if (!isDrawing) {
        // Start drawing rectangle
        console.log('📐 Starting rectangle drawing');
        setIsDrawing(true);
        setStartPoint({ x, y });
        setCurrentPath([{ x, y }]);
      }
    } else {
      // For polygon, add point on click
      console.log(`🔺 Adding polygon point at (${x}, ${y})`);
      setPoints(prev => [...prev, { x, y }]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isActive || !canvasRef.current) return;

    const { x, y } = getMousePos(e);

    if (zoneType === 'rectangle' && isDrawing && startPoint) {
      // Update rectangle preview
      setCurrentPath([startPoint, { x, y }]);
    } else if (zoneType === 'polygon' && points.length > 0) {
      // Show preview line to current mouse position
      setCurrentPath([...points, { x, y }]);
    }
  };

  const handleMouseUp = (e) => {
    if (!isActive || !canvasRef.current) return;

    if (zoneType === 'rectangle' && isDrawing) {
      const { x, y } = getMousePos(e);

      console.log(`📐 Completing rectangle at (${x}, ${y})`);

      // Complete rectangle
      setPoints([startPoint, { x, y }]);
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPath([]);
    }
  };

  const handleDoubleClick = () => {
    if (zoneType === 'polygon' && points.length >= 3) {
      // Complete polygon on double click
      handleSaveZone();
    }
  };

  const handleSaveZone = async () => {
    if (points.length !== 2) {
      alert('Please draw a rectangle zone');
      return;
    }

    try {
      // Convert to [x1, y1, x2, y2] format for rectangle
      const [p1, p2] = points;
      const zoneCoords = [
        Math.round(Math.min(p1.x, p2.x)), // left
        Math.round(Math.min(p1.y, p2.y)), // top
        Math.round(Math.max(p1.x, p2.x)), // right
        Math.round(Math.max(p1.y, p2.y))  // bottom
      ];

      console.log('🎯 Saving zone coordinates:', zoneCoords);
      await setDetectionZone(cameraId, zoneCoords);
      console.log('✅ Zone saved successfully!');

      if (onZoneSet) {
        onZoneSet(zoneCoords);
      }

      onClose();
    } catch (error) {
      console.error('❌ Failed to save zone:', error);
      alert(`Failed to save detection zone: ${error.message || 'Unknown error'}`);
    }
  };

  const handleClearZone = () => {
    setPoints([]);
    setCurrentPath([]);
    setStartPoint(null);
    setIsDrawing(false);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  if (!isActive) return null;

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 ${isFullscreen ? 'z-[60]' : 'z-10'}`}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full cursor-crosshair ${
          isFullscreen ? 'fixed' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ touchAction: 'none' }}
      />

      <div className="absolute top-4 left-4 flex gap-2">
        <div className="bg-black/70 text-white px-3 py-1 rounded text-sm border border-gray-600">
          Rectangle Zone
        </div>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={handleClearZone}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleSaveZone}
          disabled={points.length === 0}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm font-medium transition-colors"
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

      <div className="absolute top-16 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm max-w-md">
        Click and drag to draw rectangle zone
        {points.length > 0 && (
          <div className="mt-1 text-xs text-gray-300">
            Points: {points.length} / 2
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoneDrawer;