"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

/**
 * Redirect sang /login nếu chưa đăng nhập. Trả về null trong lúc đang tải/redirect — page nên render loading cho tới khi có user.
 *
 * useMemo ở đây bắt buộc phải có: nếu trả thẳng `{ user, accessToken }` (object
 * literal mới mỗi lần render) thì mọi useEffect/useCallback nhận `session` làm
 * dependency sẽ chạy lại ở MỌI render — vì React so sánh dependency bằng
 * reference, object mới luôn bị coi là "đã đổi". Hệ quả: gọi API lặp vô hạn
 * (mỗi lần setState xong lại re-render -> session mới -> effect chạy lại ->
 * setState...). Giữ nguyên reference khi user/accessToken không đổi mới an toàn.
 */
export function useRequireAuth() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const session = useMemo(() => (user && accessToken ? { user, accessToken } : null), [user, accessToken]);

  if (loading) return null;
  return session;
}
