"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

/** Trang duy nhất được xem mà không cần đăng nhập. */
const PUBLIC_ROUTES = new Set<string>(["/login"]);

// TEMP: yêu cầu login đang bị tắt tạm thời (theo yêu cầu người dùng).
// Để bật lại: khôi phục bản gốc từ git (redirect sang /login khi !loading && !user && !isPublicRoute).
const AUTH_DISABLED = false;

export function useAuthGate() {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  // "Sẵn sàng render" khi: trang public (luôn cho qua), auth đang bị tắt tạm thời,
  // hoặc đã xác nhận có user.
  const ready = isPublicRoute || AUTH_DISABLED || !loading;
  return { ready, isPublicRoute };
}
