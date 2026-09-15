"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api, exportBuild, openOrDownloadArtifact, type ApiBuild, type ApiVariant } from "@/lib/api";

export function useBuildDetailPage() {
  const { id: buildId } = useParams<{ id: string }>();
  const session = useRequireAuth();

  const [build, setBuild] = useState<ApiBuild | null>(null);
  const [variants, setVariants] = useState<ApiVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [networks, setNetworks] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const [b, v] = await Promise.all([api.getBuild(session.accessToken, buildId), api.listVariants(session.accessToken, buildId)]);
    setBuild(b);
    setVariants(v);
  }, [session, buildId]);

  useEffect(() => {
    if (!session) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [session, refresh]);

  useEffect(() => {
    if (!session || build?.status !== "SUCCESS") return;
    api
      .listNetworks(session.accessToken)
      .then(setNetworks)
      .catch(() => undefined);
  }, [session, build?.status]);

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "EDITOR";

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

  return {
    session,
    buildId,
    build,
    variants,
    error,
    canEdit,
    networks,
    selectedNetworks,
    toggleNetwork,
    selectedVariantId,
    setSelectedVariantId,
    downloadError,
    handleDownloadSingle,
    exporting,
    exportError,
    handleExport,
  };
}
