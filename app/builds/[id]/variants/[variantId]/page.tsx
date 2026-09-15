"use client";

import Link from "next/link";
import { Button } from "@/components/common";
import { ArrowLeftIcon, LayersIcon } from "@/components/icons";
import { PageLoading } from "@/components/Spinner";
import { PlaygroundConfigForm } from "@/components/PlaygroundConfigForm";
import { useVariantEditorPage } from "./useVariantEditorPage";

export default function VariantEditorPage() {
  const { session, buildId, build, variant, config, setConfig, previewUrl, loadError, canEdit, saving, saveError, saved, handleSave } =
    useVariantEditorPage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex flex-1 flex-col gap-4 bg-zinc-50 px-6 py-5 dark:bg-black">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/builds/${buildId}`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {build?.name ?? "Quay lại concept"}
          </Link>
          <div className="mt-0.5 flex items-center gap-2">
            <LayersIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{variant?.name ?? "Biến thể"}</h1>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ Đã lưu</span>}
            {saveError && <span className="text-xs text-red-600 dark:text-red-400">{saveError}</span>}
            <Button type="button" onClick={handleSave} disabled={!previewUrl} loading={saving}>
              {saving ? "Đang lưu..." : "Lưu biến thể"}
            </Button>
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {loadError}
        </div>
      )}

      {previewUrl && (
        <div className="flex flex-1 gap-5">
          <div className="flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-sm">
            <iframe src={previewUrl} className="h-full min-h-[600px] w-full" title="Variant preview" sandbox="allow-scripts allow-same-origin" />
          </div>

          <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Chỉnh sửa</h2>
            {!canEdit && (
              <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Bạn chỉ có quyền xem, không lưu được thay đổi.
              </p>
            )}
            <PlaygroundConfigForm fieldsRegistry={build?.fieldsRegistry ?? null} config={config} onChange={setConfig} readOnly={!canEdit} />
          </div>
        </div>
      )}
    </main>
  );
}
