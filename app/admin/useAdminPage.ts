"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, type Role } from "@/lib/api";
import { swrKeys } from "@/lib/api/swr-keys";

export function useAdminPage() {
  const session = useRequireAuth();
  const isAdmin = session?.user.role === "ADMIN";

  const {
    data: users,
    error: usersSwrError,
    mutate: mutateUsers,
  } = useSWR(session && isAdmin ? swrKeys.users() : null, () => api.listUsers(session!.accessToken));
  const usersError = usersSwrError ? (usersSwrError instanceof Error ? usersSwrError.message : String(usersSwrError)) : null;
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const {
    data: matrixData,
    error: matrixSwrError,
    mutate: mutateMatrixData,
  } = useSWR(session && isAdmin ? swrKeys.permissionsMatrix() : null, () => api.getPermissionsMatrix(session!.accessToken));
  const matrixLoaded = !!matrixData;
  const defs = matrixData?.defs ?? [];
  const editableRoles = matrixData?.editableRoles ?? [];
  /** Ma trận đang chỉnh trên UI — chỉ ghi thật xuống server khi bấm Lưu. */
  const [localMatrix, setLocalMatrix] = useState<Record<string, string[]> | null>(null);
  const matrix = localMatrix ?? matrixData?.matrix ?? {};
  const [matrixSaveError, setMatrixSaveError] = useState<string | null>(null);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savedMatrix, setSavedMatrix] = useState(false);
  const matrixError = matrixSaveError ?? (matrixSwrError ? (matrixSwrError instanceof Error ? matrixSwrError.message : String(matrixSwrError)) : null);

  const updateUserRole = async (userId: string, role: Role) => {
    if (!session) return;
    setSavingUserId(userId);
    try {
      const updated = await api.updateUserRole(session.accessToken, userId, role);
      mutateUsers((prev) => prev?.map((u) => (u.id === userId ? updated : u)), { revalidate: false });
    } catch (e) {
      // Giữ nguyên usersError qua SWR sẽ không phản ánh lỗi PATCH này — hiện tạm bằng alert đơn giản
      // (chỉ 1 hành động lỗi, không cần state riêng).
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingUserId(null);
    }
  };

  const togglePermission = (role: string, key: string) => {
    setSavedMatrix(false);
    setLocalMatrix((prev) => {
      const base = prev ?? matrixData?.matrix ?? {};
      const current = base[role] ?? [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...base, [role]: next };
    });
  };

  const saveMatrix = async () => {
    if (!session) return;
    setSavingMatrix(true);
    setMatrixSaveError(null);
    setSavedMatrix(false);
    try {
      await api.updatePermissionsMatrix(session.accessToken, matrix);
      mutateMatrixData((prev) => (prev ? { ...prev, matrix } : prev), { revalidate: false });
      setLocalMatrix(null);
      setSavedMatrix(true);
    } catch (e) {
      setMatrixSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingMatrix(false);
    }
  };

  return {
    session,
    isAdmin,
    users: users ?? null,
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
  };
}
