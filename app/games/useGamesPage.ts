"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api, ApiGame } from "@/lib/api";

export function useGamesPage() {
  const session = useRequireAuth();
  const [games, setGames] = useState<ApiGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .listGames(session.accessToken)
      .then(setGames)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [session]);

  const canCreate = session?.user.role === "ADMIN" || session?.user.role === "EDITOR";

  return { session, games, error, canCreate };
}
