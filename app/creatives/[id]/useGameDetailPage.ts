"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, ApiBuild } from "@/lib/api";
import { can, canOnResource } from "@/lib/auth/permissions";
import { swrKeys } from "@/lib/api/swr-keys";
import { routes } from "@/lib/routes";

const POLL_INTERVAL_MS = 3000;

function isInFlight(build: ApiBuild): boolean {
  return build.status === "PENDING" || build.status === "PROCESSING";
}

export function useGameDetailPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const session = useRequireAuth();
  const router = useRouter();

  const { data: game, error: gameError } = useSWR(session ? swrKeys.game(gameId) : null, () =>
    api.getGame(session!.accessToken, gameId),
  );

  const {
    data: builds,
    error: buildsError,
    mutate: mutateBuilds,
  } = useSWR(session ? swrKeys.builds(gameId) : null, () => api.listBuilds(session!.accessToken, gameId), {
    // Poll trong lúc còn concept đang PENDING/PROCESSING (BullMQ job chạy nền,
    // không có websocket ở bản MVP này) — tự tắt poll ngay khi không còn build nào đang chạy.
    refreshInterval: (data) => (data?.some(isInFlight) ? POLL_INTERVAL_MS : 0),
  });

  const { data: games } = useSWR(session ? swrKeys.games() : null, () => api.listGames(session!.accessToken));

  const firstError = gameError ?? buildsError;
  const error = firstError ? (firstError instanceof Error ? firstError.message : String(firstError)) : null;

  const canCreate = can(session?.permissions ?? null, "concept:create");

  const canEditBuild = (build: ApiBuild) =>
    canOnResource(session?.permissions ?? null, "concept", "edit", build.createdById, session?.user.id);
  const canDeleteBuild = (build: ApiBuild) =>
    canOnResource(session?.permissions ?? null, "concept", "delete", build.createdById, session?.user.id);

  const deleteBuild = async (buildId: string) => {
    if (!session) return;
    await api.deleteBuild(session.accessToken, buildId);
    mutateBuilds((prev) => prev?.filter((b) => b.id !== buildId), { revalidate: false });
  };

  const renameBuild = async (buildId: string, name: string) => {
    if (!session) return;
    const updated = await api.renameBuild(session.accessToken, buildId, name);
    mutateBuilds((prev) => prev?.map((b) => (b.id === buildId ? updated : b)), { revalidate: false });
  };

  const moveBuild = async (buildId: string, targetGameId: string) => {
    if (!session) return;
    await api.moveBuild(session.accessToken, buildId, targetGameId);
    // Concept chuyển sang game khác không còn thuộc danh sách này nữa — bỏ khỏi cache ngay, không chờ revalidate.
    mutateBuilds((prev) => prev?.filter((b) => b.id !== buildId), { revalidate: false });
  };

  /** Nhân bản build lại từ đầu nên trả về ngay với status PENDING — điều hướng sang trang concept mới để tự poll, giống lúc upload. */
  const duplicateBuild = async (buildId: string) => {
    if (!session) return;
    const created = await api.duplicateBuild(session.accessToken, buildId);
    router.push(routes.build(created.id));
  };

  return {
    session,
    gameId,
    game: game ?? null,
    builds: builds ?? null,
    games: games ?? [],
    error,
    canCreate,
    canEditBuild,
    canDeleteBuild,
    deleteBuild,
    renameBuild,
    moveBuild,
    duplicateBuild,
  };
}
