"use client";

import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { swrKeys } from "@/lib/api/swr-keys";

export function useGamesPage() {
  const session = useRequireAuth();

  const { data: games, error: swrError } = useSWR(
    session ? swrKeys.games() : null,
    () => api.listGames(session!.accessToken),
  );

  const canCreate = can(session?.permissions ?? null, "game:manage");
  const error = swrError ? (swrError instanceof Error ? swrError.message : String(swrError)) : null;

  return { session, games: games ?? null, error, canCreate };
}
