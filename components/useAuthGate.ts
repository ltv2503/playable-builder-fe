"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Trang duy nhất được xem mà không cần đăng nhập. */
const PUBLIC_ROUTES = new Set<string>(["/login"]);

export function useAuthGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, isPublicRoute, pathname, router]);

  // "Sẵn sàng render" khi: trang public (luôn cho qua), hoặc đã xác nhận có user.
  // Còn lại (đang loading, hoặc chưa có user và đang chờ redirect ở effect trên) thì chưa render children.
  const ready = isPublicRoute || (!loading && !!user);
  return { ready, isPublicRoute };
}
