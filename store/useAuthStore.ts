import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, ENDPOINTS } from '../constants/Api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  university?: string | null;
  target_score?: number | null;
  target_exam_date?: string | null;
  target_exam_type?: 'YÖKDİL' | 'YDS' | 'YDT' | null;
  daily_goal_min?: number | null;
}

type ProfilePatch = Partial<Pick<AuthUser, 'name' | 'university' | 'target_score' | 'target_exam_date' | 'target_exam_type' | 'daily_goal_min'>>;

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string[] | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  fetchProfile: () => Promise<void>;
  saveProfile: (patch: ProfilePatch) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res  = await fetch(`${API_BASE}/auth_login.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password }),
          });
          const json = await res.json();
          if (json.success) {
            set({ user: json.user, token: json.token, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: json.errors ?? ['Giriş başarısız'], isLoading: false });
          return false;
        } catch {
          set({ error: ['Bağlantı hatası. Lütfen tekrar dene.'], isLoading: false });
          return false;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res  = await fetch(`${API_BASE}/auth_register.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, email, password }),
          });
          const json = await res.json();
          if (json.success) {
            set({ user: json.user, token: json.token, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: json.errors ?? ['Kayıt başarısız'], isLoading: false });
          return false;
        } catch {
          set({ error: ['Bağlantı hatası. Lütfen tekrar dene.'], isLoading: false });
          return false;
        }
      },

      loginWithGoogle: async (idToken) => {
        set({ isLoading: true, error: null });
        try {
          const res  = await fetch(`${API_BASE}/auth_google.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id_token: idToken }),
          });
          const json = await res.json();
          if (json.success) {
            set({ user: json.user, token: json.token, isAuthenticated: true, isLoading: false });
            return true;
          }
          set({ error: json.errors ?? ['Google girişi başarısız'], isLoading: false });
          return false;
        } catch {
          set({ error: ['Bağlantı hatası. Lütfen tekrar dene.'], isLoading: false });
          return false;
        }
      },

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false, error: null }),

      clearError: () => set({ error: null }),

      fetchProfile: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const res  = await fetch(ENDPOINTS.profileUpdate, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.success) {
            set((s) => ({ user: s.user ? { ...s.user, ...json.data } : s.user }));
          }
        } catch {
          // silently fail — stale data is fine
        }
      },

      saveProfile: async (patch) => {
        const { token } = get();
        if (!token) return false;
        try {
          const res  = await fetch(ENDPOINTS.profileUpdate, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify(patch),
          });
          const json = await res.json();
          if (json.success) {
            set((s) => ({ user: s.user ? { ...s.user, ...json.user } : s.user }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'yokdil-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user:            state.user,
        token:           state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
