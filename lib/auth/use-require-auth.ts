"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./context";

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
// TEMP: yêu cầu login đang bị tắt tạm thời (theo yêu cầu người dùng).
// Để bật lại: khôi phục bản gốc từ git (redirect sang /login khi !loading && !user).
const AUTH_DISABLED = false;

export function useRequireAuth() {
  const { user, accessToken, permissions, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!AUTH_DISABLED && !loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const session = useMemo(
    () => (user && accessToken ? { user, accessToken, permissions } : null),
    [user, accessToken, permissions],
  );

  if (loading) return null;
  return session;
}
