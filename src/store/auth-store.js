import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => {
        localStorage.setItem('primusLiteToken', token);
        if (user?._id) {
          localStorage.setItem('primusLiteUserId', user._id);
        }
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('primusLiteToken');
        localStorage.removeItem('primusLiteUserId');
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (userData) => {
        set(state => ({ user: { ...state.user, ...userData } }));
      },

      checkAuth: () => {
        const token = localStorage.getItem('primusLiteToken');
        if (token) {
          set({ token, isAuthenticated: true });
          return true;
        }
        return false;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

export default useAuthStore;