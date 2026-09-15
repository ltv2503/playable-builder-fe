"use client";

import Link from "next/link";
import { ChevronRightIcon, GamesIcon, LogoutIcon, PreviewIcon } from "./icons";
import { useSidebar, type SidebarNavItem } from "./useSidebar";

const ICONS: Record<SidebarNavItem["id"], typeof PreviewIcon> = {
  preview: PreviewIcon,
  games: GamesIcon,
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export function Sidebar() {
  const { user, navItems, isActive, handleLogout, collapsed, toggleCollapsed } = useSidebar();

  const displayName = user?.name ?? "User";
  const email = user?.email ?? "";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? "Mở rộng" : "Thu gọn"}
        className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-colors hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-200"
      >
        <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>

      <div className={`flex items-center gap-2.5 p-5 ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-bold text-white shadow-sm shadow-orange-900/20">
          P
        </div>
        {!collapsed && <h1 className="truncate text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Playable Tool</h1>}
      </div>

      <nav className="mt-2 flex-1 px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = ICONS[item.id];
            const active = isActive(item.href);
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
                    collapsed ? "justify-center px-0" : "px-3"
                  } ${
                    active
                      ? "bg-primary-soft font-medium text-primary-hover dark:text-orange-300"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary" />}
                  <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-600"}`} />
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`border-t border-zinc-200 p-4 dark:border-zinc-800 ${collapsed ? "flex flex-col items-center gap-3" : ""}`}>
        <div className={`flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={displayName}
              title={collapsed ? displayName : undefined}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-zinc-950"
            />
          ) : (
            <div
              title={collapsed ? displayName : undefined}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-sm font-semibold text-white"
            >
              {initial}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">{user ? (ROLE_LABEL[user.role] ?? user.role) : email}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => handleLogout()}
            title="Đăng xuất"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
