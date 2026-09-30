"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, exportBuild, openOrDownloadArtifact, type ApiSharedPreviewLink, type ApiVariant } from "@/lib/api";
import { can, canOnResource } from "@/lib/auth/permissions";
import { swrKeys } from "@/lib/api/swr-keys";

const POLL_INTERVAL_MS = 3000;

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

  const firstError = buildError ?? variantsError;
  const error = firstError ? (firstError instanceof Error ? firstError.message : String(firstError)) : null;

  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  /** "" = "Mặc định (engine)" — cùng danh sách chọn với các biến thể thật, xem toggleVariant()/handleExport(). */
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([""]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [shareLink, setShareLink] = useState<ApiSharedPreviewLink | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const perms = session?.permissions ?? null;
  const userId = session?.user.id;
  const canCreateVariant = can(perms, "variant:create");
  const canExport = can(perms, "export");
  const canShare = can(perms, "share");
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

  /** +1 vì "" (Mặc định engine) luôn là 1 lựa chọn riêng, cạnh các biến thể thật. */
  const totalVariantOptions = (variants?.length ?? 0) + 1;
  const allVariantsSelected = selectedVariantIds.length === totalVariantOptions;

  const toggleAllVariants = () => {
    setSelectedVariantIds((prev) => (prev.length === totalVariantOptions ? [] : ["", ...(variants ?? []).map((v) => v.id)]));
  };

  const handleDownloadSingle = async () => {
    if (!session || !build) return;
    setDownloadError(null);
    try {
      const single = build.artifacts.find((a) => a.channelName === "single");
      if (single) await openOrDownloadArtifact(session.accessToken, single);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreateShareLink = async () => {
    if (!session) return;
    setSharing(true);
    setShareError(null);
    try {
      const link = await api.createShareLink(session.accessToken, buildId);
      setShareLink(link);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!session) return;
    setSharing(true);
    setShareError(null);
    try {
      await api.revokeShareLink(session.accessToken, buildId);
      setShareLink(null);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
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
    router.push(`/games/${build?.gameId}`);
  };

  const renameBuild = async (name: string) => {
    if (!session) return;
    const updated = await api.renameBuild(session.accessToken, buildId, name);
    mutateBuild(updated, { revalidate: false });
  };

  return {
    session,
    buildId,
    build: build ?? null,
    variants: variants ?? null,
    error,
    canCreateVariant,
    canExport,
    canShare,
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
    downloadError,
    handleDownloadSingle,
    shareLink,
    sharing,
    shareError,
    handleCreateShareLink,
    handleRevokeShareLink,
    exporting,
    exportError,
    handleExport,
    deleteVariant,
    renameVariant,
    duplicateVariant,
    deleteBuild,
    renameBuild,
  };
}
