"use client";

import Link from "next/link";
import { ChevronRightIcon, GamesIcon, PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading } from "@/components/Spinner";
import { GameIcon } from "@/components/GameIcon";
import { useGamesPage } from "./useGamesPage";

export default function GamesPage() {
  const { session, games, error, canCreate } = useGamesPage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Games</h1>
          <p className="mt-1 text-sm text-zinc-500">Quản lý playable ads theo từng game.</p>
        </div>
        {canCreate && (
          <Link
            href="/games/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-900/10 transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Tạo game
          </Link>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {games && games.length === 0 && (
          <EmptyState
            icon={<GamesIcon className="h-10 w-10" />}
            title="Chưa có game nào"
            description="Tạo game đầu tiên để bắt đầu upload và quản lý playable ads."
            action={
              canCreate ? (
                <Link href="/games/new" className="text-sm font-medium text-primary hover:underline">
                  + Tạo game
                </Link>
              ) : undefined
            }
          />
        )}

        {games && games.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-900/5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <GameIcon game={game} />
                  <ChevronRightIcon className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                </div>
                <div>
                  <h2 className="truncate font-medium text-zinc-900 dark:text-zinc-50">{game.name}</h2>
                  <p className="truncate text-xs text-zinc-500">{game.slug}</p>
                </div>
                {(game.androidUrl || game.iosUrl) && (
                  <div className="flex gap-2">
                    {game.androidUrl && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Android
                      </span>
                    )}
                    {game.iosUrl && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        iOS
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
