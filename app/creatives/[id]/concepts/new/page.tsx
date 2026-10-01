"use client";

import Link from "next/link";
import { Button, Card, Checkbox, Input } from "@/components/common";
import { ArrowLeftIcon, UploadCloudIcon } from "@/components/icons";
import { PageLoading } from "@/components/Spinner";
import { routes } from "@/lib/routes";
import { useNewConceptPage, type PngMode } from "./useNewConceptPage";

function formatKb(bytes: number): string {
  return (bytes / 1024).toFixed(0) + " KB";
}

const PNG_MODES: { value: PngMode; label: string }[] = [
  { value: "off", label: "Tắt — giữ nguyên ảnh gốc" },
  { value: "palette", label: "Palette PNG — nén vừa, giữ định dạng PNG" },
  { value: "webp", label: "WebP — nén mạnh nhất, đổi định dạng ảnh" },
];

export default function NewConceptPage() {
  const {
    session,
    gameId,
    name,
    setName,
    file,
    setFile,
    uploading,
    error,
    handleSubmit,
    pngMode,
    setPngMode,
    pngImages,
    isScanningZip,
    togglePngCompress,
    toggleAllPngCompress,
  } = useNewConceptPage();

  if (!session) return <PageLoading />;

  const compressCount = pngImages.filter((img) => img.compress).length;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href={routes.creative(gameId)}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Quay lại
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Concept mới</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <Card padding="lg" className="flex w-full flex-col gap-4 lg:max-w-lg">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Tên concept</span>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: MazeRescue2" />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              File .zip của thư mục build <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">web-mobile</code>
            </span>
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                file
                  ? "border-primary/40 bg-primary-soft"
                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <UploadCloudIcon className={`h-8 w-8 ${file ? "text-primary" : "text-zinc-400"}`} />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {file ? file.name : <>Kéo thả hoặc <span className="font-medium text-primary">chọn file</span></>}
              </span>
              <input required type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Nén ảnh</span>
            <select
              value={pngMode}
              onChange={(e) => setPngMode(e.target.value as PngMode)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {PNG_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={uploading} disabled={!file} className="mt-2 self-start">
            {uploading ? "Đang upload..." : "Tạo concept"}
          </Button>
        </Card>

        {(isScanningZip || pngImages.length > 0) && pngMode !== "off" && (
          <Card padding="lg" className="flex w-full flex-col gap-3 lg:flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isScanningZip ? "Đang quét ảnh trong zip..." : `Ảnh PNG (${compressCount}/${pngImages.length} sẽ được nén)`}
              </span>
              {pngImages.length > 0 && (
                <div className="flex gap-2 text-xs">
                  <button type="button" onClick={() => toggleAllPngCompress(true)} className="text-primary hover:underline">
                    Chọn tất cả
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700">/</span>
                  <button type="button" onClick={() => toggleAllPngCompress(false)} className="text-primary hover:underline">
                    Bỏ chọn tất cả
                  </button>
                </div>
              )}
            </div>

            {pngImages.length > 0 && (
              <div className="grid max-h-[560px] grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5 overflow-y-auto pr-1">
                {pngImages.map((img) => (
                  <label
                    key={img.path}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                      img.compress
                        ? "border-primary/40 bg-primary-soft"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Checkbox checked={img.compress} onChange={() => togglePngCompress(img.path)} className="h-3.5! w-3.5!" />
                      <span className="text-[10px] text-zinc-400">{formatKb(img.size)}</span>
                    </div>
                    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded bg-[repeating-conic-gradient(#8883_0%_25%,transparent_0%_50%)] bg-[length:10px_10px]">
                      {img.dataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.dataUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <span className="w-full truncate text-[11px] text-zinc-600 dark:text-zinc-400">{img.path.split("/").pop()}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        )}
      </form>
    </main>
  );
}
