"use client";

import { Suspense } from "react";
import { Button, Card } from "@/components/common";
import { GoogleIcon } from "@/components/icons";
import useLogin from "./hook";

function LoginContent() {
  const { loading, isSigningIn, error, handleGoogleSignIn } = useLogin();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-orange-200 via-amber-100 to-orange-300">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-orange-200 via-amber-100 to-orange-300 px-4">
      <Card variant="default" padding="lg" className="w-full max-w-md shadow-2xl">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-500">
            <span className="text-2xl font-bold text-white">P</span>
          </div>
          <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">Playable Builder</h1>
          <p className="text-center text-sm text-gray-600">Đăng nhập để tiếp tục</p>
        </div>

        <div className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <Button type="button" variant="outline" size="lg" className="w-full" loading={isSigningIn} onClick={handleGoogleSignIn}>
            <GoogleIcon />
            Continue with Google
          </Button>

          <p className="text-center text-xs text-gray-400">By signing in, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-orange-200 via-amber-100 to-orange-300">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-100 border-t-orange-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
