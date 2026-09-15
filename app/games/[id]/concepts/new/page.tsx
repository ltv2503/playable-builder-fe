"use client";

import Link from "next/link";
import { Button, Card, Input } from "@/components/common";
import { ArrowLeftIcon, UploadCloudIcon } from "@/components/icons";
import { PageLoading } from "@/components/Spinner";
import { useNewConceptPage } from "./useNewConceptPage";

export default function NewConceptPage() {
  const { session, gameId, name, setName, file, setFile, uploading, error, handleSubmit } = useNewConceptPage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href={`/games/${gameId}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Quay lại
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Concept mới</h1>
      </div>

      <Card padding="lg" className="mx-auto w-full max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={uploading} disabled={!file} className="mt-2 self-start">
            {uploading ? "Đang upload..." : "Tạo concept"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
