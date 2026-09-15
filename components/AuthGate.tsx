"use client";

import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useAuthGate } from "./useAuthGate";

/**
 * Chặn toàn bộ hệ thống sau đăng nhập: bọc ở root layout, quanh mọi trang
 * trừ /login. Sidebar (header) cũng chỉ render ở đây — sau khi đã xác nhận
 * đăng nhập — nên /login không bao giờ thấy nó.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, isPublicRoute } = useAuthGate();

  if (!ready) {
    return <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">Đang tải...</main>;
  }

  if (isPublicRoute) return <>{children}</>;

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
