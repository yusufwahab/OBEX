// // 1. ZUSTAND STORE (event-store.js)
// // store/useEventStore.js
// // store/useEventStore.js
// // src/store/history-store.js
// // src/store/history-store.js

import { create } from "zustand";
import { persist } from "zustand/middleware";
import axios from "axios";

export const useEventStore = create(
    persist(
        (set, get) => ({
            events: [],

            setEvents: (events) => set({ events }),

            addEvent: async (event) => {
                const token = localStorage.getItem("primusLiteToken");

                if (!token) {
                    console.error("No token found. Please log in first.");
                    // Still add to local store even without token
                    set((state) => ({ events: [...state.events, event] }));
                    return;
                }

                // ✅ REQUIRED FIELDS for camera endpoint using new structure
                const requiredFields = {
                    name: event.camera_name || "",
                    cameraType: "IP",
                    streamUrl: event.stream_url || `rtsp://${event.ipAddress || '192.168.1.100'}:554/stream`,
                    isActive: true,
                    zoneName: event.zone_name || event.zoneCategory || "Default Zone",
                };

                // ✅ OPTIONAL FIELDS with defaults
                const optionalFields = {
                    recordingEnabled: true,
                    motionSensitivity: 50,
                    offlineAlertEnabled: false,
                    lastStreamCheck: new Date().toISOString(),
                };

                // ✅ Build payload for camera API
                const payload = {
                    ...optionalFields,
                    ...requiredFields,
                    // Override with any specific values from the event
                    name: event.camera_name || event.name || requiredFields.name,
                    zoneName: event.zoneCategory || event.zone_name || requiredFields.zoneName,
                    streamUrl: event.url || event.stream_url || requiredFields.streamUrl,
                };

                // Add to local store
                set((state) => ({ events: [...state.events, event] }));

                // Disabled duplicate API call - now handled by camera store
                // Only sync to backend if this is a camera-related event AND not handled by camera store
                // DISABLED: Camera API calls are now handled by camera-store.js
                /*
                if (event.type === 'ADDED' && event.camera_name && !event.skipBackendSync) {
                    try {
                        const res = await axios.post(
                            "https://primus-lite.onrender.com/api/cameras/add",
                            payload,
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                },
                            }
                        );
                        console.log("✅ Camera synced to backend:", res.data);

                        // Update the event with the actual camera ID from the response
                        set((state) => ({
                            events: state.events.map(e =>
                                e === event ? { ...e, cameraId: res.data.data._id } : e
                            )
                        }));
                    } catch (error) {
                        console.error("❌ Error syncing camera to backend:", error.response?.data || error);
                    }
                }
                */
            },

            // Add method to remove events
            removeEvent: (eventId) => {
                set((state) => ({
                    events: state.events.filter(event => event.id !== eventId)
                }));
            },

            // Add method to clear all events
            clearEvents: () => {
                set({ events: [] });
            },

            // Add method to get events by type
            getEventsByType: (type) => {
                const { events } = get();
                return events.filter(event => event.type === type);
            },

            // Add method to get recent events
            getRecentEvents: (limit = 10) => {
                const { events } = get();
                return events
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limit);
            }
        }),
        { name: "history-storage" }
    )
);




// // store / useEventStore.js
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
// import axios from 'axios';

// export const useEventStore = create(
//     persist(
//         (set, get) => ({
//             events: [],

//             // Replace all events (e.g. from backend)
//             setEvents: (events) => set({ events }),

//             // Add event and sync to backend
//             addEvent: async (event) => {
//                 set((state) => ({ events: [...state.events, event] }));
//                 try {
//                     await axios.post('https://primus-lite.onrender.com/api//cameras/add', event);
//                 } catch (error) {
//                     console.error('Error syncing to backend:', error);
//                 }
//             },
//         }),
//         {
//             name: 'event-storage',
//         }
//     )
// );











// // import { create } from 'zustand';
// // import { persist } from 'zustand/middleware';

// // // Assume you get userId from your auth provider or auth context
// // const userId = localStorage.getItem('userId') || 'guest';

// // export const useEventStore = create(
// //   persist(
// //     (set) => ({
// //       events: [],

// //       setEvents: (events) => set({ events }),

// //       addEvent: (newEvent) =>
// //         set((state) => ({ events: [newEvent, ...state.events] })),

// //       updateEvent: (id, updatedFields) =>
// //         set((state) => ({
// //           events: state.events.map((event) =>
// //             event.id === id ? { ...event, ...updatedFields } : event
// //           ),
// //         })),

// //       deleteEvent: (id) =>
// //         set((state) => ({
// //           events: state.events.filter((event) => event.id !== id),
// //         })),

// //       clearEvents: () => set({ events: [] }),
// //     }),
// //     {
// //       name: `event-store-${userId}`, // store separate per user
// //       partialize: (state) => ({ events: state.events }),
// //     }
// //   )
// // );





















// // store/useEventStore.js

// // export const useEventStore = create((set) => ({
// //   events: [],
// //   setEvents: (events) => set({ events }),
// // }));




















// // const useEventStore = create((set) => ({
// //   events: [],
// //   filters: {
// //     camera: '',
// //     type: '',
// //     dateRange: { from: '', to: '' },
// //     search: '',
// //   },
// //   setEvents: (data) => set({ events: data }),
// //   setFilter: (key, value) =>
// //     set((state) => ({ filters: { ...state.filters, [key]: value } })),
// // }));

// // export default useEventStore;














// // import { create } from 'zustand';

// // const useEventStore = create((set) => ({
// //   events: [],
// //   filters: {
// //     camera: '',
// //     type: '',
// //     dateRange: { from: '', to: '' },
// //     search: '',
// //   },
// //   setEvents: (data) => set({ events: data }),
// //   setFilter: (key, value) =>
// //     set((state) => ({ filters: { ...state.filters, [key]: value } })),
// // }));

// // export default useEventStore;