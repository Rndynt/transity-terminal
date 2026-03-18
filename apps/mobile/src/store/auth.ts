import { create } from 'zustand';
import { storage } from '../lib/storage';

interface AppUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
}

interface AuthState {
  user: AppUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: AppUser, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user, token) => {
    await storage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await storage.deleteItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  loadToken: async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (token) {
        const { authApi } = await import('../lib/api');
        const user = await authApi.getMe();
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      await storage.deleteItem('auth_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
