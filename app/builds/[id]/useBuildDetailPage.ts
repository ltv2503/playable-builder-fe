"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, exportBuild, openOrDownloadArtifact, type ApiVariant } from "@/lib/api";
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
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const perms = session?.permissions ?? null;
  const userId = session?.user.id;
  const canCreateVariant = can(perms, "variant:create");
  const canExport = can(perms, "export");
  const canEditThisBuild = !!build && canOnResource(perms, "concept", "edit", build.createdById, userId);
  const canDeleteThisBuild = !!build && canOnResource(perms, "concept", "delete", build.createdById, userId);
  const canEditVariant = (variant: ApiVariant) => canOnResource(perms, "variant", "edit", variant.createdById, userId);
  const canDeleteVariant = (variant: ApiVariant) => canOnResource(perms, "variant", "delete", variant.createdById, userId);

  const toggleNetwork = (name: string) => {
    setSelectedNetworks((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
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

  const handleExport = async () => {
    if (!session || selectedNetworks.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportBuild(session.accessToken, buildId, selectedNetworks, selectedVariantId || undefined);
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
    canEditThisBuild,
    canDeleteThisBuild,
    canEditVariant,
    canDeleteVariant,
    networks: networks ?? [],
    selectedNetworks,
    toggleNetwork,
    selectedVariantId,
    setSelectedVariantId,
    downloadError,
    handleDownloadSingle,
    exporting,
    exportError,
    handleExport,
    deleteVariant,
    renameVariant,
    deleteBuild,
    renameBuild,
  };
}
