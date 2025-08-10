import React, { useState, useEffect } from 'react';
import Header from '../Header';
import useLoadingStore from '../store/loading-store';
import { useNotificationStore } from '../store/notification-store';
import { useBackendIntegration } from '../services/backendIntegration';
import LogoLoader from '../LogoLoader';
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  Clock, 
  Trash2, 
  CheckCircle, 
  Filter,
  Search,
  Bell,
  Zap,
  Users,
  Car,
  Package,
  AlertCircle,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react';

export default function Notification() {
    const { isLoading } = useLoadingStore();
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        getNotificationsByType,
        getUnreadNotifications,
        getRecentNotifications,
        addNotification
    } = useNotificationStore();
    
    const { isConnected: backendConnected, getConnectionStatus } = useBackendIntegration();

    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedNotifications, setSelectedNotifications] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Listen for backend threat notifications
    useEffect(() => {
        console.log('Notification page ready to receive backend threats');
        console.log('Backend connection status:', getConnectionStatus());
        
        return () => {
            // Cleanup is handled by the backend integration service
        };
    }, [getConnectionStatus]);

    const getFilteredNotifications = () => {
        let filtered = notifications;

        // Apply type filter
        if (filter !== 'all') {
            filtered = filtered.filter(notification => notification.type === filter);
        }

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(notification =>
                notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                notification.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                notification.zone?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filtered;
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'text-red-600 bg-red-50 border-red-200 ring-red-100';
            case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200 ring-amber-100';
            case 'low': return 'text-blue-600 bg-blue-50 border-blue-200 ring-blue-100';
            default: return 'text-gray-600 bg-gray-50 border-gray-200 ring-gray-100';
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'intrusion': return Users;
            case 'object': return Package;
            case 'vehicle': return Car;
            case 'behavior': return AlertCircle;
            default: return AlertTriangle;
        }
    };

    const handleBulkAction = (action) => {
        if (action === 'mark-read') {
            selectedNotifications.forEach(id => markAsRead(id));
        } else if (action === 'delete') {
            selectedNotifications.forEach(id => deleteNotification(id));
        }
        setSelectedNotifications([]);
    };

    const handleSelectAll = () => {
        const filteredIds = getFilteredNotifications().map(n => n.id);
        setSelectedNotifications(
            selectedNotifications.length === filteredIds.length ? [] : filteredIds
        );
    };

    if (isLoading) {
        return <LogoLoader />;
    }

    const filteredNotifications = getFilteredNotifications();
    const highSeverityCount = notifications.filter(n => n.severity === 'high').length;
    const todayCount = getRecentNotifications().length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <Header />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Enhanced Header Section */}
                <div className="mb-10">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <Bell className="w-6 h-6 text-white" />
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                                            <span className="text-xs font-bold text-white">{unreadCount}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-[16px] sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl  font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                        Threat Notifications
                                    </h1>
                                    <p className="text-gray-400 mt-1 text-lg">
                                        Real-time AI threat detection and security alerts
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="flex items-center gap-3 bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-700">
                                <div className={`w-3 h-3 rounded-full ${backendConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'}`}></div>
                                <span className="text-sm text-gray-300 font-medium">
                                    Backend: {backendConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            
                            <button
                                onClick={markAllAsRead}
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">Mark All Read</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Enhanced Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Total Alerts</p>
                                <p className="text-3xl font-bold text-white mt-2">{notifications.length}</p>
                                <p className="text-xs text-gray-500 mt-1">All time</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                                <AlertTriangle className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Unread</p>
                                <p className="text-3xl font-bold text-red-400 mt-2">{unreadCount}</p>
                                <p className="text-xs text-gray-500 mt-1">Requires attention</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Bell className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">High Severity</p>
                                <p className="text-3xl font-bold text-red-500 mt-2">{highSeverityCount}</p>
                                <p className="text-xs text-gray-500 mt-1">Critical threats</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Today</p>
                                <p className="text-3xl font-bold text-cyan-400 mt-2">{todayCount}</p>
                                <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Activity className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Enhanced Filters and Search */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl mb-8">
                    <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                        <div className="flex flex-wrap gap-3">
                            {[
                                { key: 'all', label: 'All', icon: BarChart3 },
                                { key: 'intrusion', label: 'Intrusion', icon: Users },
                                { key: 'object', label: 'Object', icon: Package },
                                { key: 'vehicle', label: 'Vehicle', icon: Car },
                                { key: 'behavior', label: 'Behavior', icon: AlertCircle }
                            ].map(({ key, label, icon: Icon }) => (
                                <button
                                    key={key}
                                    onClick={() => setFilter(key)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                                        filter === key
                                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                                            : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative w-full lg:w-auto">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search notifications..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full lg:w-80 pl-12 pr-4 py-3 bg-gray-800/50 text-white placeholder-gray-400 border border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Enhanced Bulk Actions */}
                {selectedNotifications.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-6 mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <span className="text-blue-300 font-semibold text-lg">
                                {selectedNotifications.length} notification(s) selected
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleBulkAction('mark-read')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Mark Read
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Enhanced Notifications List */}
                <div className="space-y-4">
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-24 h-24 bg-gradient-to-r from-gray-600 to-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                                <Shield className="w-12 h-12 text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-3">No notifications found</h3>
                            <p className="text-gray-400 text-lg max-w-md mx-auto">
                                {searchTerm || filter !== 'all' 
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'All clear! No threats detected at the moment.'
                                }
                            </p>
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => {
                            const IconComponent = getTypeIcon(notification.type);
                            const isSelected = selectedNotifications.includes(notification.id);
                            
                            return (
                                <div
                                    key={notification.id}
                                    className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
                                        notification.read 
                                            ? 'border-gray-700/50 opacity-75' 
                                            : 'border-red-500/50 bg-red-500/10'
                                    } ${isSelected ? 'ring-2 ring-cyan-500 ring-opacity-50' : ''}`}
                                >
                                    <div className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedNotifications([...selectedNotifications, notification.id]);
                                                        } else {
                                                            setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id));
                                                        }
                                                    }}
                                                    className="mt-2 w-5 h-5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                                                />
                                                
                                                <div className="flex-shrink-0">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                        notification.severity === 'high' ? 'bg-gradient-to-r from-red-500 to-pink-600' :
                                                        notification.severity === 'medium' ? 'bg-gradient-to-r from-yellow-500 to-orange-600' :
                                                        'bg-gradient-to-r from-blue-500 to-cyan-600'
                                                    }`}>
                                                        <IconComponent className="w-6 h-6 text-white" />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <h3 className="text-xl font-bold text-white">
                                                            {notification.title}
                                                        </h3>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(notification.severity)}`}>
                                                            {notification.severity.toUpperCase()}
                                                        </span>
                                                        {!notification.read && (
                                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                                        )}
                                                    </div>
                                                    
                                                    <p className="text-gray-300 text-lg mb-4 leading-relaxed">
                                                        {notification.description}
                                                    </p>
                                                    
                                                    <div className="flex flex-wrap gap-6 text-sm text-gray-400">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="w-4 h-4" />
                                                            <span className="font-medium">{new Date(notification.timestamp).toLocaleString()}</span>
                                                        </div>
                                                        
                                                        {notification.zone && (
                                                            <div className="flex items-center gap-2">
                                                                <Eye className="w-4 h-4" />
                                                                <span className="font-medium">{notification.zone}</span>
                                                            </div>
                                                        )}
                                                        
                                                        {notification.confidence && (
                                                            <div className="flex items-center gap-2">
                                                                <Shield className="w-4 h-4" />
                                                                <span className="font-medium">{notification.confidence}% confidence</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 ml-4">
                                                {!notification.read && (
                                                    <button
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-cyan-400 hover:text-cyan-300 p-2 rounded-lg hover:bg-cyan-500/10 transition-all duration-300"
                                                        title="Mark as read"
                                                    >
                                                        <CheckCircle className="w-5 h-5" />
                                                    </button>
                                                )}
                                                
                                                <button
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all duration-300"
                                                    title="Delete notification"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Enhanced Clear All Button */}
                {notifications.length > 0 && (
                    <div className="mt-12 text-center">
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-red-400 hover:text-red-300 font-semibold text-lg flex items-center gap-3 mx-auto transition-all duration-300 hover:scale-105"
                        >
                            <Trash2 className="w-5 h-5" />
                            Clear All Notifications
                        </button>
                    </div>
                )}
            </div>

            {/* Enhanced Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Confirm Deletion</h3>
                            <p className="text-gray-300 mb-8 leading-relaxed">
                                Are you sure you want to delete {selectedNotifications.length > 0 ? `${selectedNotifications.length} selected notification(s)` : 'all notifications'}? This action cannot be undone.
                            </p>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-6 py-3 text-gray-300 hover:text-white font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedNotifications.length > 0) {
                                            handleBulkAction('delete');
                                        } else {
                                            clearAllNotifications();
                                        }
                                        setShowDeleteConfirm(false);
                                    }}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-300"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}