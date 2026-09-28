import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Khởi tạo lười — không gọi initializeApp/getAuth() ở module scope, vì
 * getAuth() validate apiKey ngay lập tức và sẽ throw ("auth/invalid-api-key")
 * khi Next.js prerender các trang trong lúc build (SSR, chưa có
 * NEXT_PUBLIC_FIREBASE_* thật) hoặc trong lúc dev chưa cấu hình .env.local.
 * Chỉ gọi hàm này từ client, bên trong event handler (xem lib/auth-context.tsx).
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
}

export const googleProvider = new GoogleAuthProvider();
