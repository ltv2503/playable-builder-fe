"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { useAuthStore } from "@/lib/auth/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  return (
    <SWRConfig
      value={{
        // Mặc định không tự revalidate khi: focus lại tab, reconnect mạng, hay
        // mount lại 1 key ĐÃ có cache (vd rời trang rồi quay lại) — dữ liệu
        // (game/build/variant/permissions) không đổi liên tục, tự gọi lại API
        // mỗi lần chỉ tốn request không cần thiết. Cache chỉ cập nhật khi: (a)
        // key đó CHƯA từng fetch, (b) code chủ động gọi mutate() sau khi
        // tạo/sửa/xoá (xem các hook use*Page.ts), hoặc (c) chỗ cần cập nhật
        // gần-real-time tự bật refreshInterval riêng (build đang PENDING/PROCESSING
        // — xem useGameDetailPage.ts / useBuildDetailPage.ts).
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
