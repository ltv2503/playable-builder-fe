"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, ApiBuild } from "@/lib/api";
import { can, canOnResource } from "@/lib/auth/permissions";
import { swrKeys } from "@/lib/api/swr-keys";

const POLL_INTERVAL_MS = 3000;

function isInFlight(build: ApiBuild): boolean {
  return build.status === "PENDING" || build.status === "PROCESSING";
}

export function useGameDetailPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const session = useRequireAuth();

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

  return {
    session,
    gameId,
    game: game ?? null,
    builds: builds ?? null,
    error,
    canCreate,
    canEditBuild,
    canDeleteBuild,
    deleteBuild,
    renameBuild,
  };
}
