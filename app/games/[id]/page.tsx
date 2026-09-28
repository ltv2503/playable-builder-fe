"use client";

import Link from "next/link";
import { useState } from "react";
import type { ApiBuild } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading, Spinner } from "@/components/Spinner";
import { PromptDialog } from "@/components/common";
import { ArrowLeftIcon, ChevronRightIcon, EditIcon, ExternalLinkIcon, LayersIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { GameIcon } from "@/components/GameIcon";
import { useGameDetailPage } from "./useGameDetailPage";

function ConceptRow({
  build,
  canEdit,
  canDelete,
  onDelete,
  onRequestRename,
}: {
  build: ApiBuild;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: string) => Promise<void>;
  onRequestRename: (build: ApiBuild) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Xoá concept "${build.name}"? Mọi biến thể và bản build của nó cũng sẽ bị xoá.`)) return;
    setDeleting(true);
    try {
      await onDelete(build.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRequestRename(build);
  };

  return (
    <div className="group relative grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
      <Link href={`/builds/${build.id}`} className="absolute inset-0" aria-label={build.name} />
      <span className="pointer-events-none truncate font-medium text-zinc-900 dark:text-zinc-50">{build.name}</span>
      <span className="pointer-events-none text-xs text-zinc-500">{build.engineVersion}</span>
      <span className="pointer-events-none">
        <StatusBadge status={build.status} />
      </span>
      <span className="pointer-events-none text-xs text-zinc-500">{new Date(build.updatedAt).toLocaleString("vi-VN")}</span>
      <ChevronRightIcon className="pointer-events-none h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
      {canEdit && (
        <button
          type="button"
          onClick={handleRenameClick}
          className="relative z-10 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="Đổi tên concept"
        >
          <EditIcon className="h-4 w-4" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="relative z-10 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          title="Xoá concept"
        >
          {deleting ? <Spinner className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

export default function GameDetailPage() {
  const { session, gameId, game, builds, error, canCreate, canEditBuild, canDeleteBuild, deleteBuild, renameBuild } = useGameDetailPage();
  const [renameTarget, setRenameTarget] = useState<ApiBuild | null>(null);

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/games" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Games
          </Link>
          {game && (
            <div className="mt-2 flex items-center gap-3">
              <GameIcon game={game} className="h-12 w-12 rounded-xl text-lg" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{game.name}</h1>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono dark:bg-zinc-800">{game.slug}</span>
                  {game.androidUrl && (
                    <a
                      href={game.androidUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      Android <ExternalLinkIcon />
                    </a>
                  )}
                  {game.iosUrl && (
                    <a
                      href={game.iosUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                    >
                      iOS <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {canCreate && (
          <Link
            href={`/games/${gameId}/concepts/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm shadow-orange-900/10 transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="h-4 w-4" />
            Concept
          </Link>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Concepts</h2>

          {builds && builds.length === 0 && (
            <EmptyState
              icon={<LayersIcon className="h-9 w-9" />}
              title="Chưa có concept nào"
              description="Upload thư mục build web-mobile để tạo concept đầu tiên."
              action={
                canCreate ? (
                  <Link href={`/games/${gameId}/concepts/new`} className="text-sm font-medium text-primary hover:underline">
                    + Concept
                  </Link>
                ) : undefined
              }
            />
          )}

          {builds && builds.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 border-b border-zinc-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <span>Tên</span>
                <span>Engine</span>
                <span>Trạng thái</span>
                <span>Cập nhật</span>
                <span />
                <span />
                <span />
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {builds.map((build) => (
                  <ConceptRow
                    key={build.id}
                    build={build}
                    canEdit={canEditBuild(build)}
                    canDelete={canDeleteBuild(build)}
                    onDelete={deleteBuild}
                    onRequestRename={setRenameTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <PromptDialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Đổi tên concept"
        label="Tên concept"
        initialValue={renameTarget?.name ?? ""}
        onSubmit={(name) => renameBuild(renameTarget!.id, name)}
      />
    </main>
  );
}
