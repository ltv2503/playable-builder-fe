"use client";

import Link from "next/link";
import { Button, Card, Input } from "@/components/common";
import { ArrowLeftIcon } from "@/components/icons";
import { PageLoading } from "@/components/Spinner";
import { useNewVariantPage } from "./useNewVariantPage";

export default function NewVariantPage() {
  const { session, buildId, name, setName, creating, error, handleSubmit } = useNewVariantPage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href={`/builds/${buildId}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Quay lại
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Biến thể mới</h1>
      </div>

      <Card padding="lg" className="mx-auto w-full max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Tên biến thể</span>
            <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: sale_version, test_A" />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={creating} className="mt-2 self-start">
            {creating ? "Đang tạo..." : "Tạo & chỉnh config"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
