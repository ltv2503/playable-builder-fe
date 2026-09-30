"use client";

import { Button, Card, Checkbox } from "@/components/common";
import { PageLoading } from "@/components/Spinner";
import type { Role } from "@/lib/api";
import { useAdminPage } from "./useAdminPage";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  DEVELOP: "Develop",
  UA: "UA",
  VIEWER: "Viewer",
};

const ALL_ROLES: Role[] = ["ADMIN", "DEVELOP", "UA", "VIEWER"];

export default function AdminPage() {
  const {
    session,
    isAdmin,
    users,
    usersError,
    savingUserId,
    updateUserRole,
    defs,
    editableRoles,
    matrix,
    matrixLoaded,
    matrixError,
    togglePermission,
    savingMatrix,
    savedMatrix,
    saveMatrix,
  } = useAdminPage();

  if (!session) return <PageLoading />;

  if (!isAdmin) {
    return (
      <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
        <p className="text-sm text-zinc-500">Chỉ Admin mới truy cập được trang này.</p>
      </main>
    );
  }

  const groups = [...new Set(defs.map((d) => d.group))];

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Quản trị</h1>
        <p className="mt-1 text-xs text-zinc-500">Quản lý role của user và bật/tắt quyền cho từng role.</p>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Người dùng</h2>
          {usersError && <p className="text-sm text-red-600 dark:text-red-400">{usersError}</p>}
          {users && (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4 border-b border-zinc-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <span>Tên</span>
                <span>Email</span>
                <span>Role</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((u) => (
                  <div key={u.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-3 text-sm">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">{u.name}</span>
                    <span className="truncate text-xs text-zinc-500">{u.email}</span>
                    <select
                      value={u.role}
                      disabled={savingUserId === u.id || u.id === session.user.id}
                      onChange={(e) => updateUserRole(u.id, e.target.value as Role)}
                      title={u.id === session.user.id ? "Không thể tự đổi role của chính mình" : undefined}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Phân quyền theo role</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Admin luôn có toàn bộ quyền, không hiện ở đây.</p>
            </div>
            <div className="flex items-center gap-2">
              {savedMatrix && <span className="text-xs text-green-600 dark:text-green-400">Đã lưu</span>}
              <Button size="sm" onClick={saveMatrix} loading={savingMatrix} disabled={!matrixLoaded}>
                Lưu
              </Button>
            </div>
          </div>
          {matrixError && <p className="text-sm text-red-600 dark:text-red-400">{matrixError}</p>}

          {matrixLoaded && (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
              <div
                className="grid items-center gap-4 border-b border-zinc-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800"
                style={{ gridTemplateColumns: `1fr repeat(${editableRoles.length}, 80px)` }}
              >
                <span>Quyền</span>
                {editableRoles.map((role) => (
                  <span key={role} className="text-center">
                    {ROLE_LABEL[role]}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {groups.map((group) => (
                  <div key={group}>
                    <div className="bg-zinc-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800/50">
                      {group}
                    </div>
                    {defs
                      .filter((d) => d.group === group)
                      .map((def) => (
                        <div
                          key={def.key}
                          className="grid items-center gap-4 px-4 py-2.5 text-sm"
                          style={{ gridTemplateColumns: `1fr repeat(${editableRoles.length}, 80px)` }}
                        >
                          <span className="text-zinc-700 dark:text-zinc-300">{def.label}</span>
                          {editableRoles.map((role) => (
                            <span key={role} className="flex justify-center">
                              <Checkbox
                                checked={(matrix[role] ?? []).includes(def.key)}
                                onChange={() => togglePermission(role, def.key)}
                              />
                            </span>
                          ))}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
