"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api } from "@/lib/api";
import { swrKeys } from "@/lib/api/swr-keys";
import { routes } from "@/lib/routes";

/**
 * Chọn từ "All Games" (tất cả game của công ty, xem app/all-games) — không còn
 * cho tự nhập tay nữa, game phải có sẵn trong danh sách đó mới thêm được. Ai
 * cần bổ sung game chưa có trong danh sách thì vào All Games (chỉ Admin thêm được).
 */
export function useNewGamePage() {
  const session = useRequireAuth();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const { data: catalog, error: catalogSwrError } = useSWR(session ? swrKeys.gameCatalog() : null, () =>
    api.listGameCatalog(session!.accessToken),
  );
  const { data: games } = useSWR(session ? swrKeys.games() : null, () => api.listGames(session!.accessToken));

  /** packageName của game đã có trong danh sách của mình — ẩn khỏi bảng chọn (đã thêm rồi thì thôi). */
  const addedPackageNames = useMemo(() => new Set((games ?? []).map((g) => g.packageName).filter((p): p is string => !!p)), [games]);

  const filteredCatalog = useMemo(() => {
    const list = (catalog ?? []).filter((entry) => !addedPackageNames.has(entry.packageName));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (entry) => entry.name.toLowerCase().includes(q) || entry.packageName.toLowerCase().includes(q) || entry.shortName?.toLowerCase().includes(q),
    );
  }, [catalog, addedPackageNames, search]);

  const handleAddFromCatalog = async (catalogEntryId: string) => {
    if (!session) return;
    setAddingId(catalogEntryId);
    setCatalogError(null);
    try {
      const game = await api.createGameFromCatalog(session.accessToken, catalogEntryId);
      // Trang này rồi sẽ điều hướng đi ngay — truyền fetcher để mutate() chắc chắn
      // lấy lại được dữ liệu mới dù subscriber (useSWR ở trên) có unmount trước
      // khi revalidate xong hay không (xem cùng pattern ở useNewConceptPage.ts).
      await mutate(swrKeys.games(), () => api.listGames(session.accessToken));
      router.push(routes.creative(game.id));
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : String(e));
      setAddingId(null);
    }
  };

  const catalogErrorMessage =
    catalogError ?? (catalogSwrError ? (catalogSwrError instanceof Error ? catalogSwrError.message : String(catalogSwrError)) : null);

  return {
    session,
    search,
    setSearch,
    filteredCatalog,
    catalogLoading: !!session && !catalog && !catalogSwrError,
    catalogError: catalogErrorMessage,
    addingId,
    handleAddFromCatalog,
  };
}
