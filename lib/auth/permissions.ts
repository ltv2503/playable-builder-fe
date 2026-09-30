/**
 * Permission key phải khớp 1-1 với playable-builder/src/config/permission-keys.ts.
 * "_own"/"_any" chỉ dùng cho action liên quan sở hữu (edit/delete concept/biến thể).
 */
export type PermKey =
  | "game:manage"
  | "game:delete"
  | "concept:create"
  | "concept:edit_own"
  | "concept:edit_any"
  | "concept:delete_own"
  | "concept:delete_any"
  | "variant:create"
  | "variant:edit_own"
  | "variant:edit_any"
  | "variant:delete_own"
  | "variant:delete_any"
  | "export"
  | "share";

export interface EffectivePermissions {
  isAdmin: boolean;
  keys: Set<string>;
}

/** Khớp PERMISSION_DEFS ở playable-builder/src/config/permission-keys.ts — dùng để dựng UI trang admin phân quyền. */
export interface PermissionKeyDef {
  key: PermKey;
  label: string;
  group: string;
}

/** true nếu user hiện tại có quyền `key` — dùng cho action KHÔNG liên quan sở hữu (tạo, export, quản lý game). */
export function can(perms: EffectivePermissions | null, key: PermKey): boolean {
  if (!perms) return false;
  return perms.isAdmin || perms.keys.has(key);
}

/** true nếu user có `${resource}:${action}_any`, hoặc là chủ sở hữu (createdById) và có `${resource}:${action}_own`. */
export function canOnResource(
  perms: EffectivePermissions | null,
  resource: "concept" | "variant",
  action: "edit" | "delete",
  ownerId: string,
  userId: string | undefined,
): boolean {
  if (!perms) return false;
  if (perms.isAdmin) return true;
  if (perms.keys.has(`${resource}:${action}_any`)) return true;
  return !!userId && ownerId === userId && perms.keys.has(`${resource}:${action}_own`);
}
