"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { routes } from "@/lib/routes";

/** Trang được xem mà không cần đăng nhập. */
const PUBLIC_ROUTES = new Set<string>([routes.login]);
/** Link xem công khai (share ra ngoài tool) — /share/<token>, xem app/share/[token]/page.tsx. */
const PUBLIC_ROUTE_PREFIXES = [routes.sharePrefix];

export function useAuthGate() {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // "Sẵn sàng render" khi: trang public (luôn cho qua), hoặc đã xác nhận có user.
  const ready = isPublicRoute || !loading;
  return { ready, isPublicRoute };
}
