import { create } from "zustand";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "./firebase";
import { getToken, removeToken, setTokenCookie } from "../api/cookies";
import { api, ApiUser } from "../api";
import { EffectivePermissions } from "./permissions";

interface AuthState {
  user: ApiUser | null;
  accessToken: string | null;
  permissions: EffectivePermissions | null;
  /** true khi đang khôi phục phiên đăng nhập từ cookie lúc load trang. */
  loading: boolean;
  /** Gọi đúng 1 lần lúc app mount (xem components/Providers.tsx) — khôi phục phiên từ cookie nếu có. */
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

async function fetchPermissions(token: string): Promise<EffectivePermissions | null> {
  try {
    const res = await api.getMyPermissions(token);
    return { isAdmin: res.isAdmin, keys: new Set(res.keys) };
  } catch {
    return null;
  }
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  permissions: null,
  loading: true,

  initialize: async () => {
    if (initialized) return;
    initialized = true;
    const stored = getToken();
    if (!stored) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api.me(stored);
      const permissions = await fetchPermissions(stored);
      set({ user, accessToken: stored, permissions, loading: false });
    } catch {
      removeToken();
      set({ loading: false });
    }
  },

  loginWithGoogle: async () => {
    const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const idToken = await cred.user.getIdToken();
    const { accessToken: token, user } = await api.loginWithFirebase(idToken);
    setTokenCookie(token);
    const permissions = await fetchPermissions(token);
    set({ user, accessToken: token, permissions });
  },

  logout: async () => {
    removeToken();
    set({ user: null, accessToken: null, permissions: null });
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // no-op: chỉ dọn phiên Firebase, JWT của backend đã bị xoá ở trên rồi
    }
  },
}));
