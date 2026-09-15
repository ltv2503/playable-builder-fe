"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const useLogin = () => {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirect") ?? "/games";

  // Đã đăng nhập từ trước (JWT còn trong localStorage) thì khỏi ở lại trang login.
  useEffect(() => {
    if (!loading && user) router.replace(redirectTo);
  }, [user, loading, router, redirectTo]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
      // Không cần tự điều hướng ở đây — effect phía trên sẽ chạy khi `user` cập nhật.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập với Google thất bại");
    } finally {
      setIsSigningIn(false);
    }
  };

  return { loading, isSigningIn, error, handleGoogleSignIn };
};

export default useLogin;
