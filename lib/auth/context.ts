"use client";

/**
 * Giữ lại `useAuth()` như 1 lớp vỏ mỏng — state thật nằm ở lib/auth/store.ts
 * (Zustand), khởi tạo 1 lần ở components/Providers.tsx thay vì Context Provider.
 */
import { useAuthStore } from "./store";

export function useAuth() {
  return useAuthStore();
}
