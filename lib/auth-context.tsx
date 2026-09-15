"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "./firebase";
import { getToken, removeToken, setTokenCookie } from "./api/cookies";
import { api, ApiUser } from "./api";

interface AuthContextValue {
  user: ApiUser | null;
  accessToken: string | null;
  /** true khi đang khôi phục phiên đăng nhập từ cookie lúc load trang. */
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    api
      .me(stored)
      .then((u) => {
        setAccessToken(stored);
        setUser(u);
      })
      .catch(() => removeToken())
      .finally(() => setLoading(false));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const idToken = await cred.user.getIdToken();
    const { accessToken: token, user: apiUser } = await api.loginWithFirebase(idToken);
    setTokenCookie(token);
    setAccessToken(token);
    setUser(apiUser);
  }, []);

  const logout = useCallback(async () => {
    removeToken();
    setAccessToken(null);
    setUser(null);
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // no-op: chỉ dọn phiên Firebase, JWT của backend đã bị xoá ở trên rồi
    }
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, loading, loginWithGoogle, logout }),
    [user, accessToken, loading, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải được gọi bên trong <AuthProvider>");
  return ctx;
}
