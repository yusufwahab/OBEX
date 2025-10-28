import React, { useState, useEffect } from 'react';
import { mlAnalysisService } from '../services/mlAnalysisService';
import { AlertTriangle, Clock, MapPin, Video, Eye, EyeOff } from 'lucide-react';

const MLAlertsPanel = ({ cameraId, cameraName, isOpen, onClose }) => {
    const [alerts, setAlerts] = useState({
        intrusions: [],
        loitering: [],
        theft: [],
        suspicious: []
    });
    const [videos, setVideos] = useState({
        loitering: [],
        intrusion: [],
        weapon: [],
        suspicious: []
    });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('alerts');
    const [expandedAlert, setExpandedAlert] = useState(null);

    useEffect(() => {
        if (isOpen && cameraId) {
            loadAlertsAndVideos();
        }
    }, [isOpen, cameraId]);

    const loadAlertsAndVideos = async () => {
        setLoading(true);
        try {
            const [alertsData, videosData] = await Promise.all([
                mlAnalysisService.getAllAlerts(cameraId, 20),
                mlAnalysisService.getAllVideos(cameraId, 20)
            ]);

            setAlerts(alertsData);
            setVideos(videosData);
        } catch (error) {
            console.error('Failed to load alerts and videos:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const getAlertIcon = (type) => {
        switch (type) {
            case 'intrusion': return '🚨';
            case 'loitering': return '⏰';
            case 'theft': return '💰';
            case 'suspicious': return '👁️';
            default: return '⚠️';
        }
    };

    const getAlertColor = (type) => {
        switch (type) {
            case 'intrusion': return 'border-red-500 bg-red-50';
            case 'loitering': return 'border-yellow-500 bg-yellow-50';
            case 'theft': return 'border-purple-500 bg-purple-50';
            case 'suspicious': return 'border-orange-500 bg-orange-50';
            default: return 'border-gray-500 bg-gray-50';
        }
    };

    const AlertCard = ({ alert, type }) => (
        <div className={`border-l-4 ${getAlertColor(type)} p-4 mb-3 rounded-r-lg shadow-sm`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">{getAlertIcon(type)}</span>
                    <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 capitalize">{type} Alert</h4>
                        <p className="text-sm text-gray-600 mt-1">
                            {alert.description || `${type} detected in ${cameraName}`}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(alert.timestamp)}
                            </div>
                            {alert.zone && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    Zone {alert.zone}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                    className="text-gray-400 hover:text-gray-600"
                >
                    {expandedAlert === alert.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>

            {expandedAlert === alert.id && (
                <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(alert, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );

    const VideoCard = ({ video, type }) => (
        <div className="border border-gray-200 rounded-lg p-4 mb-3 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center">
                    <Video className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 capitalize">{type} Video</h4>
                    <p className="text-sm text-gray-600 mt-1">
                        {video.description || `${type} detection video`}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(video.timestamp)}
                        </div>
                        {video.duration && (
                            <span>Duration: {video.duration}s</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (video.url) {
                            window.open(video.url, '_blank');
                        }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                    Play
                </button>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">ML Analysis Results</h2>
                        <p className="text-gray-600">{cameraName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className={`px-6 py-3 font-medium ${activeTab === 'alerts'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Alerts ({Object.values(alerts).flat().length})
                    </button>
                    <button
                        onClick={() => setActiveTab('videos')}
                        className={`px-6 py-3 font-medium ${activeTab === 'videos'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Videos ({Object.values(videos).flat().length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : activeTab === 'alerts' ? (
                        <div>
                            {Object.entries(alerts).map(([type, alertList]) => (
                                <div key={type} className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
                                        {type} Alerts ({alertList.length})
                                    </h3>
                                    {alertList.length > 0 ? (
                                        alertList.map((alert, index) => (
                                            <AlertCard key={alert.id || index} alert={alert} type={type} />
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">No {type} alerts found</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            {Object.entries(videos).map(([type, videoList]) => (
                                <div key={type} className="mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
                                        {type} Videos ({videoList.length})
                                    </h3>
                                    {videoList.length > 0 ? (
                                        videoList.map((video, index) => (
                                            <VideoCard key={video.id || index} video={video} type={type} />
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">No {type} videos found</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                    <button
                        onClick={loadAlertsAndVideos}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MLAlertsPanel;

