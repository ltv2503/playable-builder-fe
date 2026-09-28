"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

export interface SidebarNavItem {
  id: "preview" | "games" | "admin";
  label: string;
  href: string;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "preview", label: "Preview local", href: "/" },
  { id: "games", label: "Games", href: "/games" },
];

const ADMIN_NAV_ITEM: SidebarNavItem = { id: "admin", label: "Quản trị", href: "/admin" };

/** Riêng của trình duyệt người dùng đó, không cần đồng bộ server — localStorage là đủ. */
const COLLAPSE_STORAGE_KEY = "playable_sidebar_collapsed";

export function useSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Đọc sau khi mount (không đọc trong useState initializer) để tránh lệch hydration.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // private mode / storage bị chặn -> cứ mặc định mở rộng
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isActive = (href: string): boolean => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const navItems = user?.role === "ADMIN" ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return { user, navItems, isActive, handleLogout, collapsed, toggleCollapsed };
}
