"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { Breadcrumb, Button, Card, Checkbox, Dialog, PromptDialog, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/common";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading, Spinner } from "@/components/Spinner";
import {
  ChevronRightIcon,
  DuplicateIcon,
  EditIcon,
  LayersIcon,
  MoveIcon,
  PlusIcon,
  RocketIcon,
  TrashIcon,
  UploadCloudIcon,
} from "@/components/icons";
import type { FieldDiffChange, FieldDiffEntry } from "@/lib/cocos/fieldsRegistryDiff";
import { routes } from "@/lib/routes";
import { useBuildDetailPage, type ReuploadPngMode } from "./useBuildDetailPage";

const REUPLOAD_PNG_MODES: { value: ReuploadPngMode; label: string }[] = [
  { value: "off", label: "Tắt — giữ nguyên ảnh gốc" },
  { value: "palette", label: "Palette PNG — nén vừa, giữ định dạng PNG" },
  { value: "webp", label: "WebP — nén mạnh nhất, đổi định dạng ảnh" },
];

const DIFF_STATUS_PILL: Record<"added" | "removed" | "changed", string> = {
  added:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  removed: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  changed: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
};

const DIFF_STATUS_LABEL: Record<"added" | "removed" | "changed", string> = { added: "Mới", removed: "Bị xoá", changed: "Đổi kiểu" };

function fieldDetail(entry: FieldDiffEntry): string {
  const { match } = entry;
  return match.kind === "asset" ? `asset${match.assetKind ? `: ${match.assetKind}` : ""}` : match.fieldType?.type ?? "?";
}

function changeDetail(change: FieldDiffChange): string {
  const beforeType = change.before.fieldType?.type ?? change.before.kind;
  const afterType = change.after.fieldType?.type ?? change.after.kind;
  if (beforeType !== afterType) return `${beforeType} → ${afterType}`;
  const beforeSection = change.before.options.section ?? "—";
  const afterSection = change.after.options.section ?? "—";
  if (beforeSection !== afterSection) return `Section: "${beforeSection}" → "${afterSection}"`;
  return "Cấu hình thay đổi";
}

type RenameTarget = { kind: "build" } | { kind: "variant"; id: string; name: string };

export default function BuildDetailPage() {
  const router = useRouter();
  const {
    session,
    buildId,
    build,
    game,
    variants,
    error,
    canCreateVariant,
    canCreateConcept,
    canExport,
    canEditThisBuild,
    canDeleteThisBuild,
    canEditVariant,
    canDeleteVariant,
    networks,
    selectedNetworks,
    toggleNetwork,
    allNetworksSelected,
    toggleAllNetworks,
    selectedVariantIds,
    toggleVariant,
    allVariantsSelected,
    toggleAllVariants,
    copyingVariantId,
    copiedVariantId,
    copyLinkError,
    handleCopyVariantShareLink,
    exporting,
    exportError,
    handleExport,
    deleteVariant,
    renameVariant,
    duplicateVariant,
    deleteBuild,
    renameBuild,
    moveBuild,
    duplicateBuild,
    games,
    reuploadDialogOpen,
    reuploadStep,
    reuploadFile,
    setReuploadFile,
    reuploadPngMode,
    setReuploadPngMode,
    reuploadDiff,
    reuploadAffectedVariants,
    reuploadError,
    openReuploadDialog,
    handleReuploadDialogOpenChange,
    handlePreviewReupload,
    handleConfirmReupload,
    handleCancelReupload,
  } = useBuildDetailPage();

  const [deletingBuild, setDeletingBuild] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [duplicatingVariantId, setDuplicatingVariantId] = useState<string | null>(null);
  const [duplicatingBuild, setDuplicatingBuild] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetGameId, setMoveTargetGameId] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const handleDeleteBuild = async () => {
    if (!build || !confirm(`Xoá concept "${build.name}"? Mọi biến thể và bản build của nó cũng sẽ bị xoá.`)) return;
    setDeletingBuild(true);
    try {
      await deleteBuild();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDeletingBuild(false);
    }
  };

  const handleDuplicateBuild = async () => {
    setDuplicatingBuild(true);
    try {
      await duplicateBuild();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setDuplicatingBuild(false);
    }
  };

  const openMoveDialog = () => {
    setMoveError(null);
    setMoveTargetGameId("");
    setMoveDialogOpen(true);
  };

  const handleMoveSubmit = async () => {
    if (!moveTargetGameId) return;
    setMoving(true);
    setMoveError(null);
    try {
      await moveBuild(moveTargetGameId);
      setMoveDialogOpen(false);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(false);
    }
  };

  const handleDeleteVariant = async (variantId: string, name: string) => {
    if (!confirm(`Xoá biến thể "${name}"?`)) return;
    setDeletingVariantId(variantId);
    try {
      await deleteVariant(variantId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingVariantId(null);
    }
  };

  const handleDuplicateVariant = async (variantId: string) => {
    setDuplicatingVariantId(variantId);
    try {
      await duplicateVariant(variantId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDuplicatingVariantId(null);
    }
  };

  const handleRenameSubmit = (name: string) => {
    if (!renameTarget) return Promise.resolve();
    return renameTarget.kind === "build" ? renameBuild(name) : renameVariant(renameTarget.id, name);
  };

  if (!session) return <PageLoading />;
  if (!build && !error) return <PageLoading />;
  if (!build) {
    return (
      <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
        <p className="mx-auto w-full max-w-4xl text-sm text-red-600 dark:text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: "Creatives", href: routes.creatives },
              { label: game?.name ?? "...", href: routes.creative(build.gameId) },
              { label: build.name },
            ]}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{build.name}</h1>
            <StatusBadge status={build.status} />
            {canEditThisBuild && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setRenameTarget({ kind: "build" })}
                className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
                title="Đổi tên concept"
              >
                <EditIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {build.engineVersion} · Cập nhật {new Date(build.updatedAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateConcept && (
            <Button variant="secondary" size="sm" onClick={handleDuplicateBuild} loading={duplicatingBuild}>
              <DuplicateIcon className="h-4 w-4" />
              Nhân bản
            </Button>
          )}
          {canEditThisBuild && (
            <Button variant="secondary" size="sm" onClick={openMoveDialog}>
              <MoveIcon className="h-4 w-4" />
              Chuyển game
            </Button>
          )}
          {canEditThisBuild && (
            <Button variant="secondary" size="sm" onClick={openReuploadDialog}>
              <UploadCloudIcon className="h-4 w-4" />
              Upload lại
            </Button>
          )}
          {canDeleteThisBuild && (
            <Button variant="danger" size="sm" onClick={handleDeleteBuild} loading={deletingBuild}>
              <TrashIcon className="h-4 w-4" />
              Xoá concept
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {build.status === "PROCESSING" || build.status === "PENDING" ? (
          <Card className="flex items-center gap-3">
            <Spinner className="h-5 w-5" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Đang build concept này, trang sẽ tự cập nhật khi xong...</p>
          </Card>
        ) : null}

        {build.status === "FAILED" && build.errorMessage && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-sm text-red-800 dark:text-red-200">{build.errorMessage}</p>
          </Card>
        )}

        {build.status === "SUCCESS" && networks.length > 0 && canExport && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Export cho ad network</h2>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">Dùng config của (gộp chung vào 1 lần export)</span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  <Checkbox className="h-3.5 w-3.5" checked={allVariantsSelected} onChange={toggleAllVariants} />
                  Chọn tất cả
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {(variants ?? []).map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedVariantIds.includes(v.id)
                        ? "border-primary/30 bg-primary-soft text-primary-hover dark:text-orange-300"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                    }`}
                  >
                    <Checkbox className="hidden" checked={selectedVariantIds.includes(v.id)} onChange={() => toggleVariant(v.id)} />
                    {v.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Ad network</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Checkbox className="h-3.5 w-3.5" checked={allNetworksSelected} onChange={toggleAllNetworks} />
                Chọn tất cả
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {networks.map((network) => (
                <label
                  key={network}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedNetworks.includes(network)
                      ? "border-primary/30 bg-primary-soft text-primary-hover dark:text-orange-300"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  <Checkbox className="hidden" checked={selectedNetworks.includes(network)} onChange={() => toggleNetwork(network)} />
                  {network}
                </label>
              ))}
            </div>

            {exportError && <p className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={selectedNetworks.length === 0 || selectedVariantIds.length === 0}
              loading={exporting}
              className="self-start"
            >
              {exporting
                ? "Đang build..."
                : `Export (${selectedNetworks.length || 0} network × ${selectedVariantIds.length || 0} config)`}
            </Button>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayersIcon className="h-5 w-5 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Biến thể</h2>
            </div>
            {canCreateVariant && build.status === "SUCCESS" && (
              <Link
                href={routes.buildVariantNew(buildId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-orange-900/10 hover:bg-primary-hover"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Biến thể
              </Link>
            )}
          </div>

          {!variants && !error && (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          )}

          {variants && variants.length === 0 && (
            <EmptyState
              icon={<LayersIcon className="h-8 w-8" />}
              title="Chưa có biến thể nào"
              description="Tạo biến thể để thử nhiều bộ config khác nhau trên cùng concept này."
            />
          )}

          {variants && variants.length > 0 && (
            <Card padding="sm" className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead>Cập nhật</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow
                      key={variant.id}
                      onClick={() => router.push(routes.buildVariant(buildId, variant.id))}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <TableCell>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{variant.name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">{variant.createdBy.name || variant.createdBy.email}</TableCell>
                      <TableCell className="text-xs text-zinc-500">{new Date(variant.updatedAt).toLocaleString("vi-VN")}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyVariantShareLink(variant)}
                          loading={copyingVariantId === variant.id}
                        >
                          {copiedVariantId === variant.id ? "Đã copy" : "Copy link"}
                        </Button>
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canCreateVariant && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicateVariant(variant.id)}
                              disabled={duplicatingVariantId === variant.id}
                              className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
                              title="Nhân bản biến thể"
                            >
                              {duplicatingVariantId === variant.id ? <Spinner className="h-4 w-4" /> : <DuplicateIcon className="h-4 w-4" />}
                            </Button>
                          )}
                          {canEditVariant(variant) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setRenameTarget({ kind: "variant", id: variant.id, name: variant.name })}
                              className="text-zinc-400! hover:bg-zinc-100! hover:text-zinc-700! dark:hover:bg-zinc-800! dark:hover:text-zinc-200!"
                              title="Đổi tên biến thể"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteVariant(variant) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteVariant(variant.id, variant.name)}
                              disabled={deletingVariantId === variant.id}
                              className="text-zinc-400! hover:bg-red-50! hover:text-red-600! dark:hover:bg-red-950/40! dark:hover:text-red-400!"
                              title="Xoá biến thể"
                            >
                              {deletingVariantId === variant.id ? <Spinner className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
                            </Button>
                          )}
                          <ChevronRightIcon className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {copyLinkError && <p className="px-2 pb-1 pt-2 text-xs text-red-600 dark:text-red-400">{copyLinkError}</p>}
            </Card>
          )}
        </div>
      </div>

      <PromptDialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title={renameTarget?.kind === "build" ? "Đổi tên concept" : "Đổi tên biến thể"}
        label={renameTarget?.kind === "build" ? "Tên concept" : "Tên biến thể"}
        initialValue={renameTarget?.kind === "build" ? build.name : (renameTarget?.name ?? "")}
        onSubmit={handleRenameSubmit}
      />

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen} title="Chuyển concept sang game khác">
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
                .filter((g) => g.id !== build.gameId)
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

      <Dialog open={reuploadDialogOpen} onOpenChange={handleReuploadDialogOpenChange} title="Upload lại — đè lên concept này" size="lg">
        {reuploadStep === "pick" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-zinc-500">
              Chọn zip web-mobile mới. Concept giữ nguyên tên/id — biến thể và link Share hiện có vẫn dùng được sau khi đè.
            </p>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                File .zip của thư mục build <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">web-mobile</code>
              </span>
              <label
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors ${
                  reuploadFile
                    ? "border-primary/40 bg-primary-soft"
                    : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <UploadCloudIcon className={`h-7 w-7 ${reuploadFile ? "text-primary" : "text-zinc-400"}`} />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {reuploadFile ? reuploadFile.name : <>Kéo thả hoặc <span className="font-medium text-primary">chọn file</span></>}
                </span>
                <input type="file" accept=".zip" onChange={(e) => setReuploadFile(e.target.files?.[0] ?? null)} className="hidden" />
              </label>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Nén ảnh</span>
              <select
                value={reuploadPngMode}
                onChange={(e) => setReuploadPngMode(e.target.value as ReuploadPngMode)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {REUPLOAD_PNG_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            {reuploadError && <p className="text-sm text-red-600 dark:text-red-400">{reuploadError}</p>}

            <Button type="button" onClick={handlePreviewReupload} disabled={!reuploadFile} className="self-start">
              Xem thay đổi
            </Button>
          </div>
        )}

        {reuploadStep === "previewing" && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner className="h-4 w-4" />
            Đang tải lên và quét config...
          </div>
        )}

        {reuploadStep === "diff" && reuploadDiff && (
          <div className="flex flex-col gap-4">
            {reuploadDiff.added.length === 0 && reuploadDiff.removed.length === 0 && reuploadDiff.changed.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Không có thay đổi nào về config so với bản hiện tại.</p>
            ) : (
              <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reuploadDiff.added.map((entry) => (
                      <TableRow key={`added-${entry.key}`}>
                        <TableCell className="px-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIFF_STATUS_PILL.added}`}>
                            {DIFF_STATUS_LABEL.added}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 font-mono text-xs">
                          {entry.className}.{entry.propName}
                        </TableCell>
                        <TableCell className="px-3 text-xs text-zinc-500">{fieldDetail(entry)}</TableCell>
                      </TableRow>
                    ))}
                    {reuploadDiff.changed.map((change) => (
                      <TableRow key={`changed-${change.key}`}>
                        <TableCell className="px-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIFF_STATUS_PILL.changed}`}>
                            {DIFF_STATUS_LABEL.changed}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 font-mono text-xs">
                          {change.className}.{change.propName}
                        </TableCell>
                        <TableCell className="px-3 text-xs text-zinc-500">{changeDetail(change)}</TableCell>
                      </TableRow>
                    ))}
                    {reuploadDiff.removed.map((entry) => {
                      const affected = reuploadAffectedVariants.find((a) => a.key === entry.key);
                      return (
                        <TableRow key={`removed-${entry.key}`}>
                          <TableCell className="px-3 align-top">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DIFF_STATUS_PILL.removed}`}>
                              {DIFF_STATUS_LABEL.removed}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 align-top font-mono text-xs">
                            {entry.className}.{entry.propName}
                          </TableCell>
                          <TableCell className="px-3 align-top text-xs text-zinc-500">
                            {fieldDetail(entry)}
                            {affected && (
                              <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                Biến thể đang dùng: {affected.variantNames.join(", ")} — override field này sẽ hết tác dụng sau khi đè.
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {reuploadError && <p className="text-sm text-red-600 dark:text-red-400">{reuploadError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleCancelReupload}>
                Huỷ
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleConfirmReupload}>
                Xác nhận đè bản build mới
              </Button>
            </div>
          </div>
        )}

        {reuploadStep === "confirming" && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner className="h-4 w-4" />
            Đang xác nhận...
          </div>
        )}
      </Dialog>
    </main>
  );
}
