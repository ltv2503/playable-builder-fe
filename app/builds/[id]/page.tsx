"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, Card } from "@/components/common";
import { EmptyState } from "@/components/EmptyState";
import { PageLoading, Spinner } from "@/components/Spinner";
import { ArrowLeftIcon, ChevronRightIcon, LayersIcon, PlusIcon, PreviewIcon, RocketIcon } from "@/components/icons";
import { useBuildDetailPage } from "./useBuildDetailPage";

export default function BuildDetailPage() {
  const {
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
  } = useBuildDetailPage();

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
      <div>
        <Link
          href={`/games/${build.gameId}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Quay lại game
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{build.name}</h1>
          <StatusBadge status={build.status} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {build.engineVersion} · Cập nhật {new Date(build.updatedAt).toLocaleString("vi-VN")}
        </p>
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

        {build.status === "SUCCESS" && (
          <Card className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <PreviewIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Bản single.html</p>
                <p className="text-xs text-zinc-500">Xem thử nhanh, chưa vá config nào</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleDownloadSingle}>
              Xem
            </Button>
          </Card>
        )}
        {downloadError && <p className="text-xs text-red-600 dark:text-red-400">{downloadError}</p>}

        {build.status === "SUCCESS" && networks.length > 0 && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Export cho ad network</h2>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="font-medium text-zinc-500">Dùng config của</span>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                <option value="">Mặc định (engine)</option>
                {variants?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>

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
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={selectedNetworks.includes(network)}
                    onChange={() => toggleNetwork(network)}
                  />
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
              disabled={selectedNetworks.length === 0}
              loading={exporting}
              className="self-start"
            >
              {exporting ? "Đang build..." : `Export (${selectedNetworks.length || 0})`}
            </Button>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayersIcon className="h-5 w-5 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Biến thể</h2>
            </div>
            {canEdit && build.status === "SUCCESS" && (
              <Link
                href={`/builds/${buildId}/variants/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-orange-900/10 hover:bg-primary-hover"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Biến thể
              </Link>
            )}
          </div>

          {variants && variants.length === 0 && (
            <EmptyState
              icon={<LayersIcon className="h-8 w-8" />}
              title="Chưa có biến thể nào"
              description="Tạo biến thể để thử nhiều bộ config khác nhau trên cùng concept này."
            />
          )}

          {variants && variants.length > 0 && (
            <div className="flex flex-col divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {variants.map((variant) => (
                <Link
                  key={variant.id}
                  href={`/builds/${buildId}/variants/${variant.id}`}
                  className="group flex items-center justify-between px-4 py-3.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{variant.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{new Date(variant.updatedAt).toLocaleString("vi-VN")}</span>
                    <ChevronRightIcon className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
