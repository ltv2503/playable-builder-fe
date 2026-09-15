"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/lib/use-require-auth";
import { api, fetchArtifactBlob, type ApiBuild, type ApiVariant, type PlaygroundConfig } from "@/lib/api";
import { injectPlaygroundConfig, type PlaygroundConfigOverride } from "@/lib/playgroundConfig";

/** Debounce trước khi reload preview — gõ số/text không bị giật lại mỗi phím. */
const PREVIEW_DEBOUNCE_MS = 500;

function configToOverrides(config: PlaygroundConfig): PlaygroundConfigOverride[] {
  const overrides: PlaygroundConfigOverride[] = [];
  for (const [groupKey, fields] of Object.entries(config)) {
    for (const [propName, value] of Object.entries(fields)) {
      overrides.push({ groupKey, propName, value });
    }
  }
  return overrides;
}

export function useVariantEditorPage() {
  const { id: buildId, variantId } = useParams<{ id: string; variantId: string }>();
  const session = useRequireAuth();

  const [build, setBuild] = useState<ApiBuild | null>(null);
  const [variant, setVariant] = useState<ApiVariant | null>(null);
  const [baseHtml, setBaseHtml] = useState<string | null>(null);
  const [config, setConfig] = useState<PlaygroundConfig>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Tải build (để lấy fieldsRegistry + bản single-html demo) + variant (config hiện tại) — 1 lần lúc vào trang.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      try {
        const [b, v] = await Promise.all([api.getBuild(session.accessToken, buildId), api.getVariant(session.accessToken, variantId)]);
        if (cancelled) return;
        setBuild(b);
        setVariant(v);
        setConfig(v.config);

        const single = b.artifacts.find((a) => a.channelName === "single");
        if (b.status !== "SUCCESS" || !single) {
          setLoadError("Concept chưa build xong hoặc không có bản single-html để preview.");
          return;
        }
        const blob = await fetchArtifactBlob(session.accessToken, buildId, single.id);
        if (cancelled) return;
        setBaseHtml(await blob.text());
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, buildId, variantId]);

  // Mỗi lần config đổi (kể cả lần đầu, sau khi baseHtml về) -> vá lại preview, debounce.
  useEffect(() => {
    if (!baseHtml) return;
    const timer = setTimeout(() => {
      const html = injectPlaygroundConfig(baseHtml, configToOverrides(config));
      const blob = new Blob([html], { type: "text/html" });
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [baseHtml, config]);

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "EDITOR";

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await api.updateVariantConfig(session.accessToken, variantId, config);
      setVariant(updated);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return { session, buildId, build, variant, config, setConfig, previewUrl, loadError, canEdit, saving, saveError, saved, handleSave };
}
