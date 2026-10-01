"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiBuild } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading, Spinner } from "@/components/Spinner";
import {
  Breadcrumb,
  Button,
  Card,
  Dialog,
  PromptDialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/common";
import {
  ChevronRightIcon,
  DuplicateIcon,
  EditIcon,
  ExternalLinkIcon,
  LayersIcon,
  MoveIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { GameIcon } from "@/components/GameIcon";
import { routes } from "@/lib/routes";
import { useGameDetailPage } from "./useGameDetailPage";

function ConceptRow({
  build,
  canEdit,
  canDelete,
  canDuplicate,
  onOpen,
  onDelete,
  onRequestRename,
  onDuplicate,
  onRequestMove,
}: {
  build: ApiBuild;
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  onOpen: () => void;
  onDelete: (id: string) => Promise<void>;
  onRequestRename: (build: ApiBuild) => void;
  onDuplicate: (id: string) => Promise<void>;
  onRequestMove: (build: ApiBuild) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Xoá concept "${build.name}"? Mọi biến thể và bản build của nó cũng sẽ bị xoá.`)) return;
    setDeleting(true);
    try {
      await onDelete(build.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  const handleDuplicateClick = async () => {
    setDuplicating(true);
    try {
      await onDuplicate(build.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDuplicating(false);
    }
  };

  return (
    <TableRow onClick={onOpen} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
      <TableCell className="font-medium text-zinc-900 dark:text-zinc-50">{build.name}</TableCell>
      <TableCell className="text-xs text-zinc-500">{build.engineVersion}</TableCell>
      <TableCell>
        <StatusBadge status={build.status} />
      </TableCell>
      <TableCell className="text-xs text-zinc-500">{new Date(build.updatedAt).toLocaleString("vi-VN")}</TableCell>
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDuplicateClick}
              disabled={duplicating}
              className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
              title="Nhân bản concept"
            >
              {duplicating ? <Spinner className="h-4 w-4" /> : <DuplicateIcon className="h-4 w-4" />}
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRequestMove(build)}
              className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
              title="Chuyển sang game khác"
            >
              <MoveIcon className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRequestRename(build)}
              className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
              title="Đổi tên concept"
            >
              <EditIcon className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={deleting}
              className="text-zinc-400! hover:bg-red-50! hover:text-red-600! dark:hover:bg-red-950/40! dark:hover:text-red-400!"
              title="Xoá concept"
            >
              {deleting ? <Spinner className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
            </Button>
          )}
          <ChevronRightIcon className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function GameDetailPage() {
  const router = useRouter();
  const {
    session,
    gameId,
    game,
    builds,
    games,
    error,
    canCreate,
    canEditBuild,
    canDeleteBuild,
    deleteBuild,
    renameBuild,
    moveBuild,
    duplicateBuild,
  } = useGameDetailPage();
  const [renameTarget, setRenameTarget] = useState<ApiBuild | null>(null);
  const [moveTarget, setMoveTarget] = useState<ApiBuild | null>(null);
  const [moveTargetGameId, setMoveTargetGameId] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const handleRequestMove = (build: ApiBuild) => {
    setMoveError(null);
    setMoveTargetGameId("");
    setMoveTarget(build);
  };

  const handleMoveSubmit = async () => {
    if (!moveTarget || !moveTargetGameId) return;
    setMoving(true);
    setMoveError(null);
    try {
      await moveBuild(moveTarget.id, moveTargetGameId);
      setMoveTarget(null);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(false);
    }
  };

  if (!session) return <PageLoading />;
  if (!game && !error) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb items={[{ label: "Creatives", href: routes.creatives }, { label: game?.name ?? "..." }]} />
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
            href={routes.creativeConceptNew(gameId)}
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

          {!builds && !error && (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {builds && builds.length === 0 && (
            <EmptyState
              icon={<LayersIcon className="h-9 w-9" />}
              title="Chưa có concept nào"
              description="Upload thư mục build web-mobile để tạo concept đầu tiên."
              action={
                canCreate ? (
                  <Link href={routes.creativeConceptNew(gameId)} className="text-sm font-medium text-primary hover:underline">
                    + Concept
                  </Link>
                ) : undefined
              }
            />
          )}

          {builds && builds.length > 0 && (
            <Card padding="sm" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Engine</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {builds.map((build) => (
                    <ConceptRow
                      key={build.id}
                      build={build}
                      canEdit={canEditBuild(build)}
                      canDelete={canDeleteBuild(build)}
                      canDuplicate={canCreate}
                      onOpen={() => router.push(routes.build(build.id))}
                      onDelete={deleteBuild}
                      onRequestRename={setRenameTarget}
                      onDuplicate={duplicateBuild}
                      onRequestMove={handleRequestMove}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
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

      <Dialog open={moveTarget !== null} onOpenChange={(open) => !open && setMoveTarget(null)} title="Chuyển concept sang game khác">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Game đích</span>
            <select
              value={moveTargetGameId}
              onChange={(e) => setMoveTargetGameId(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="">Chọn game...</option>
              {games
                .filter((g) => g.id !== gameId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </label>

          {moveError && <p className="text-sm text-red-600 dark:text-red-400">{moveError}</p>}

          <Button type="button" onClick={handleMoveSubmit} disabled={!moveTargetGameId} loading={moving} className="self-start">
            Chuyển concept
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
