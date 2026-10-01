"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, exportBuild, type ApiReuploadPreview, type ApiVariant } from "@/lib/api";
import { can, canOnResource } from "@/lib/auth/permissions";
import { swrKeys } from "@/lib/api/swr-keys";
import { diffFieldsRegistry, variantsAffectedByRemoval, type FieldsRegistryDiff } from "@/lib/cocos/fieldsRegistryDiff";
import { routes } from "@/lib/routes";

const POLL_INTERVAL_MS = 3000;

export type ReuploadPngMode = "off" | "palette" | "webp";
export type ReuploadStep = "pick" | "previewing" | "diff" | "confirming";

export function useBuildDetailPage() {
  const { id: buildId } = useParams<{ id: string }>();
  const session = useRequireAuth();
  const router = useRouter();

  const {
    data: build,
    error: buildError,
    mutate: mutateBuild,
  } = useSWR(session ? swrKeys.build(buildId) : null, () => api.getBuild(session!.accessToken, buildId), {
    // Trang này expose "sẽ tự cập nhật khi xong" — tự poll trong lúc build chưa xong, tắt ngay khi SUCCESS/FAILED.
    refreshInterval: (data) => (data?.status === "PENDING" || data?.status === "PROCESSING" ? POLL_INTERVAL_MS : 0),
  });

  const {
    data: variants,
    error: variantsError,
    mutate: mutateVariants,
  } = useSWR(session ? swrKeys.variants(buildId) : null, () => api.listVariants(session!.accessToken, buildId));

  const { data: networks } = useSWR(session && build?.status === "SUCCESS" ? swrKeys.networks() : null, () =>
    api.listNetworks(session!.accessToken),
  );

  const { data: games } = useSWR(session ? swrKeys.games() : null, () => api.listGames(session!.accessToken));

  const firstError = buildError ?? variantsError;
  const error = firstError ? (firstError instanceof Error ? firstError.message : String(firstError)) : null;

  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [copyingVariantId, setCopyingVariantId] = useState<string | null>(null);
  const [copiedVariantId, setCopiedVariantId] = useState<string | null>(null);
  const [copyLinkError, setCopyLinkError] = useState<string | null>(null);

  const [reuploadDialogOpen, setReuploadDialogOpen] = useState(false);
  const [reuploadStep, setReuploadStep] = useState<ReuploadStep>("pick");
  const [reuploadFile, setReuploadFile] = useState<File | null>(null);
  const [reuploadPngMode, setReuploadPngMode] = useState<ReuploadPngMode>("palette");
  const [reuploadPreview, setReuploadPreview] = useState<ApiReuploadPreview | null>(null);
  const [reuploadDiff, setReuploadDiff] = useState<FieldsRegistryDiff | null>(null);
  const [reuploadError, setReuploadError] = useState<string | null>(null);

  const perms = session?.permissions ?? null;
  const userId = session?.user.id;
  const canCreateVariant = can(perms, "variant:create");
  const canCreateConcept = can(perms, "concept:create");
  const canExport = can(perms, "export");
  const canEditThisBuild = !!build && canOnResource(perms, "concept", "edit", build.createdById, userId);
  const canDeleteThisBuild = !!build && canOnResource(perms, "concept", "delete", build.createdById, userId);
  const canEditVariant = (variant: ApiVariant) => canOnResource(perms, "variant", "edit", variant.createdById, userId);
  const canDeleteVariant = (variant: ApiVariant) => canOnResource(perms, "variant", "delete", variant.createdById, userId);

  const toggleNetwork = (name: string) => {
    setSelectedNetworks((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const allNetworksSelected = (networks?.length ?? 0) > 0 && selectedNetworks.length === networks?.length;

  const toggleAllNetworks = () => {
    setSelectedNetworks((prev) => (prev.length === (networks?.length ?? 0) ? [] : [...(networks ?? [])]));
  };

  const toggleVariant = (id: string) => {
    setSelectedVariantIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const totalVariantOptions = variants?.length ?? 0;
  const allVariantsSelected = totalVariantOptions > 0 && selectedVariantIds.length === totalVariantOptions;

  const toggleAllVariants = () => {
    setSelectedVariantIds((prev) => (prev.length === totalVariantOptions ? [] : (variants ?? []).map((v) => v.id)));
  };

  /**
   * Mỗi biến thể tự có share link không hết hạn ngay từ lúc tạo (VariantsService.create) nên bình
   * thường chỉ cần copy `variant.shareToken` sẵn có — chỉ gọi API tạo lại khi null (bị thu hồi thủ công
   * ở variant editor trước đó).
   */
  const handleCopyVariantShareLink = async (variant: ApiVariant) => {
    if (!session) return;
    setCopyLinkError(null);
    let token = variant.shareToken;
    if (!token) {
      setCopyingVariantId(variant.id);
      try {
        const link = await api.createVariantShareLink(session.accessToken, variant.id);
        token = link.token;
        mutateVariants((prev) => prev?.map((v) => (v.id === variant.id ? { ...v, shareToken: token } : v)), { revalidate: false });
      } catch (e) {
        setCopyLinkError(e instanceof Error ? e.message : String(e));
        setCopyingVariantId(null);
        return;
      }
      setCopyingVariantId(null);
    }
    await navigator.clipboard.writeText(`${window.location.origin}${routes.share(token)}`);
    setCopiedVariantId(variant.id);
    setTimeout(() => setCopiedVariantId((id) => (id === variant.id ? null : id)), 2000);
  };

  const resetReuploadState = () => {
    setReuploadStep("pick");
    setReuploadFile(null);
    setReuploadPreview(null);
    setReuploadDiff(null);
    setReuploadError(null);
  };

  const openReuploadDialog = () => {
    resetReuploadState();
    setReuploadDialogOpen(true);
  };

  /** Bước 1/2: upload zip mới, backend chỉ quét fieldsRegistry (không build/đè gì) rồi trả về để diff với bản hiện tại. */
  const handlePreviewReupload = async () => {
    if (!session || !reuploadFile || !build) return;
    setReuploadStep("previewing");
    setReuploadError(null);
    try {
      const preview = await api.previewReupload(session.accessToken, buildId, reuploadFile, { pngMode: reuploadPngMode });
      setReuploadPreview(preview);
      setReuploadDiff(diffFieldsRegistry(build.fieldsRegistry, preview.fieldsRegistry));
      setReuploadStep("diff");
    } catch (e) {
      setReuploadError(e instanceof Error ? e.message : String(e));
      setReuploadStep("pick");
    }
  };

  /** Bước 2/2: user đã xem diff, bấm xác nhận đè. Build chuyển PENDING — polling sẵn có (refreshInterval ở trên) tự lo phần còn lại. */
  const handleConfirmReupload = async () => {
    if (!session || !reuploadPreview) return;
    setReuploadStep("confirming");
    setReuploadError(null);
    try {
      const updated = await api.confirmReupload(session.accessToken, buildId, reuploadPreview.pendingUploadId);
      mutateBuild(updated, { revalidate: false });
      setReuploadDialogOpen(false);
      resetReuploadState();
    } catch (e) {
      setReuploadError(e instanceof Error ? e.message : String(e));
      setReuploadStep("diff");
    }
  };

  /** Huỷ ở bước diff (hoặc đóng dialog giữa chừng) — dọn pending upload trên server, build gốc không đổi gì. */
  const handleCancelReupload = async () => {
    if (!session) return;
    const pendingUploadId = reuploadPreview?.pendingUploadId;
    setReuploadDialogOpen(false);
    resetReuploadState();
    if (!pendingUploadId) return;
    try {
      await api.cancelReupload(session.accessToken, buildId, pendingUploadId);
    } catch {
      // best-effort — server tự dọn pending rác này khi user upload lại lần sau hoặc lúc xoá concept
    }
  };

  /** onOpenChange của Dialog — bấm X/Escape/click ra ngoài cũng phải dọn pending y hệt bấm nút Huỷ. */
  const handleReuploadDialogOpenChange = (open: boolean) => {
    if (open) setReuploadDialogOpen(true);
    else void handleCancelReupload();
  };

  /** Mỗi biến thể đã chọn export riêng 1 file/zip (tải tuần tự, không dồn hết vào 1 file) — chọn "Mặc định (engine)" ("") thì export thêm 1 bản không vá config nào. */
  const handleExport = async () => {
    if (!session || selectedNetworks.length === 0 || selectedVariantIds.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      for (const variantId of selectedVariantIds) {
        await exportBuild(session.accessToken, buildId, selectedNetworks, variantId || undefined);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const deleteVariant = async (variantId: string) => {
    if (!session) return;
    await api.deleteVariant(session.accessToken, variantId);
    mutateVariants((prev) => prev?.filter((v) => v.id !== variantId), { revalidate: false });
  };

  const renameVariant = async (variantId: string, name: string) => {
    if (!session) return;
    const updated = await api.renameVariant(session.accessToken, variantId, name);
    mutateVariants((prev) => prev?.map((v) => (v.id === variantId ? updated : v)), { revalidate: false });
  };

  const duplicateVariant = async (variantId: string) => {
    if (!session) return;
    const created = await api.duplicateVariant(session.accessToken, variantId);
    mutateVariants((prev) => [created, ...(prev ?? [])], { revalidate: false });
  };

  const deleteBuild = async () => {
    if (!session) return;
    await api.deleteBuild(session.accessToken, buildId);
    if (build) router.push(routes.creative(build.gameId));
  };

  const renameBuild = async (name: string) => {
    if (!session) return;
    const updated = await api.renameBuild(session.accessToken, buildId, name);
    mutateBuild(updated, { revalidate: false });
  };

  const moveBuild = async (gameId: string) => {
    if (!session) return;
    const updated = await api.moveBuild(session.accessToken, buildId, gameId);
    mutateBuild(updated, { revalidate: false });
  };

  /** Nhân bản cả concept (kèm toàn bộ biến thể) — build lại từ đầu nên trả về ngay với status PENDING, điều hướng sang trang concept mới để tự poll như lúc upload. */
  const duplicateBuild = async () => {
    if (!session) return;
    const created = await api.duplicateBuild(session.accessToken, buildId);
    router.push(routes.build(created.id));
  };

  const game = (games ?? []).find((g) => g.id === build?.gameId) ?? null;

  return {
    session,
    buildId,
    build: build ?? null,
    game,
    variants: variants ?? null,
    error,
    canCreateVariant,
    canCreateConcept,
    canExport,
    canEditThisBuild,
    canDeleteThisBuild,
    canEditVariant,
    canDeleteVariant,
    networks: networks ?? [],
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
    games: games ?? [],
    reuploadDialogOpen,
    reuploadStep,
    reuploadFile,
    setReuploadFile,
    reuploadPngMode,
    setReuploadPngMode,
    reuploadDiff,
    reuploadAffectedVariants: reuploadDiff ? variantsAffectedByRemoval(reuploadDiff.removed, variants ?? []) : [],
    reuploadError,
    openReuploadDialog,
    handleReuploadDialogOpenChange,
    handlePreviewReupload,
    handleConfirmReupload,
    handleCancelReupload,
  };
}
