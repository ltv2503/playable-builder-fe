"use client";

import Link from "next/link";
import { Button, Card, Input } from "@/components/common";
import { ArrowLeftIcon, UploadCloudIcon } from "@/components/icons";
import { PageLoading, Spinner } from "@/components/Spinner";
import { useNewGamePage } from "./useNewGamePage";

export default function NewGamePage() {
  const {
    session,
    name,
    slug,
    androidUrl,
    iosUrl,
    icon,
    iconPreview,
    fetchingIcon,
    handleIconFileChange,
    submitting,
    error,
    handleNameChange,
    handleSlugChange,
    setAndroidUrl,
    setIosUrl,
    handleSubmit,
  } = useNewGamePage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/games" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Games
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Tạo game mới</h1>
      </div>

      <Card padding="lg" className="mx-auto w-full max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Icon</span>
            <label
              className={`relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
                icon
                  ? "border-primary/40 bg-primary-soft"
                  : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              {fetchingIcon ? (
                <Spinner className="h-6 w-6" />
              ) : iconPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconPreview} alt="Icon preview" className="h-full w-full object-cover" />
              ) : (
                <UploadCloudIcon className="h-7 w-7 text-zinc-400" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleIconFileChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {fetchingIcon && <span className="text-xs text-zinc-500">Đang lấy icon từ Google Play...</span>}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Tên game</span>
            <Input required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="vd: Brick Jam" />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug</span>
            <Input required value={slug} onChange={(e) => handleSlugChange(e.target.value)} pattern="[a-z0-9-]+" className="font-mono" />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Link Android (Google Play)</span>
            <Input
              type="url"
              value={androidUrl}
              onChange={(e) => setAndroidUrl(e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
            <span className="text-xs text-zinc-400">Dán link Play Store để tự lấy icon app.</span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Link iOS (App Store)</span>
            <Input type="url" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} placeholder="https://apps.apple.com/app/..." />
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit" loading={submitting} className="mt-2 self-start">
            {submitting ? "Đang tạo..." : "Tạo game"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
