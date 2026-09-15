import { ACCESS_TOKEN_KEY } from "@/constants/auth";
import { parseCookies, setCookie, destroyCookie } from "nookies";

export const getToken = () => {
  const cookies = parseCookies();
  return cookies[ACCESS_TOKEN_KEY];
};

export const setTokenCookie = (token: string) => {
  setCookie(null, ACCESS_TOKEN_KEY, token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
};

export const removeToken = () => {
  destroyCookie(null, ACCESS_TOKEN_KEY, {
    path: "/",
  });
};
