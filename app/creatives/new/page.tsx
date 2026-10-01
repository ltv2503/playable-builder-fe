"use client";

import Link from "next/link";
import { Breadcrumb, Button, Card, Input } from "@/components/common";
import { GamesIcon } from "@/components/icons";
import { PageLoading, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { routes } from "@/lib/routes";
import { useNewGamePage } from "./useNewGamePage";

export default function NewGamePage() {
  const { session, search, setSearch, filteredCatalog, catalogLoading, catalogError, addingId, handleAddFromCatalog } = useNewGamePage();

  if (!session) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div>
        <Breadcrumb items={[{ label: "Creatives", href: routes.creatives }, { label: "Thêm game" }]} />
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Thêm game</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Chọn từ danh sách{" "}
          <Link href={routes.allGames} className="font-medium text-primary hover:underline">
            All Games
          </Link>{" "}
          của công ty. Chưa thấy game cần thêm? Nhờ Admin thêm vào All Games trước.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc package name..." className="max-w-sm" />

        {catalogError && <p className="text-sm text-red-600 dark:text-red-400">{catalogError}</p>}

        {catalogLoading && (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {!catalogLoading && filteredCatalog.length === 0 && (
          <EmptyState
            icon={<GamesIcon className="h-10 w-10" />}
            title={search ? "Không tìm thấy game nào" : "Không còn game nào để thêm"}
            description={search ? "Thử từ khoá khác." : "Mọi game trong danh sách công ty đã được thêm vào đây rồi."}
          />
        )}

        {filteredCatalog.length > 0 && (
          <Card padding="sm" className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredCatalog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                {entry.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.iconUrl} alt={entry.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-400 dark:bg-zinc-800">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{entry.name}</p>
                  <p className="truncate text-xs text-zinc-500">{entry.packageName}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={addingId === entry.id}
                  disabled={addingId !== null && addingId !== entry.id}
                  onClick={() => handleAddFromCatalog(entry.id)}
                >
                  Thêm
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </main>
  );
}
