"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api, ApiBuild, ApiGame } from "@/lib/api";

const POLL_INTERVAL_MS = 3000;

function isInFlight(build: ApiBuild): boolean {
  return build.status === "PENDING" || build.status === "PROCESSING";
}

export function useGameDetailPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const session = useRequireAuth();

  const [game, setGame] = useState<ApiGame | null>(null);
  const [builds, setBuilds] = useState<ApiBuild[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBuilds = useCallback(async () => {
    if (!session) return;
    const list = await api.listBuilds(session.accessToken, gameId);
    setBuilds(list);
  }, [session, gameId]);

  useEffect(() => {
    if (!session) return;
    api
      .getGame(session.accessToken, gameId)
      .then(setGame)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    refreshBuilds().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [session, gameId, refreshBuilds]);

  // Poll trong lúc còn concept đang PENDING/PROCESSING (BullMQ job chạy nền, không có websocket ở bản MVP này).
  useEffect(() => {
    if (!builds?.some(isInFlight)) return;
    const timer = setInterval(() => refreshBuilds().catch(() => undefined), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [builds, refreshBuilds]);

  const canCreate = session?.user.role === "ADMIN" || session?.user.role === "EDITOR";

  return { session, gameId, game, builds, error, canCreate };
}
