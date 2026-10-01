"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { Button, Card, Checkbox, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/common";
import { PageLoading, Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { AndroidIcon, AppleIcon, DriveIcon, EditIcon, GamesIcon, GithubIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useAllGamesPage } from "./useAllGamesPage";

const CHECK_COLUMNS = [
  { key: "androidUrl", label: "Android", Icon: AndroidIcon, activeClass: "text-emerald-600 dark:text-emerald-400" },
  { key: "iosUrl", label: "iOS", Icon: AppleIcon, activeClass: "text-zinc-700 dark:text-zinc-300" },
  { key: "driveUrl", label: "Drive", Icon: DriveIcon, activeClass: "text-amber-500 dark:text-amber-400" },
  { key: "githubPlayableUrl", label: "GH Playable", Icon: GithubIcon, activeClass: "text-zinc-900 dark:text-zinc-100" },
  { key: "githubProductUrl", label: "GH Product", Icon: GithubIcon, activeClass: "text-zinc-900 dark:text-zinc-100" },
] as const;

export default function AllGamesPage() {
  const {
    session,
    isLoading,
    canManage,
    canDelete,
    search,
    setSearch,
    filteredCatalog,
    totalCount,
    listError,
    dialogOpen,
    setDialogOpen,
    editingId,
    openAdd,
    openEdit,
    form,
    setField,
    handleAndroidUrlChange,
    fetchIconFromAndroidUrl,
    fetchingIcon,
    submitting,
    error,
    handleSubmit,
    handleDelete,
  } = useAllGamesPage();

  if (!session || isLoading) return <PageLoading />;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">All Games</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {filteredCatalog.length}
            {search ? ` / ${totalCount}` : ""} game{totalCount !== 1 ? "s" : ""} của công ty — nguồn để chọn khi thêm game ở trang Games.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openAdd}>
            <PlusIcon className="h-4 w-4" />
            Thêm game
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc package name..." className="max-w-sm" />

        {listError && <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>}

        {filteredCatalog.length === 0 && (
          <EmptyState
            icon={<GamesIcon className="h-10 w-10" />}
            title={search ? "Không tìm thấy game nào" : "Chưa có game nào"}
            description={search ? "Thử từ khoá khác." : canManage ? 'Bấm "Thêm game" để bắt đầu.' : undefined}
          />
        )}

        {filteredCatalog.length > 0 && (
          <Card padding="sm" className="overflow-x-auto">
            <Table className="min-w-225">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-12">Icon</TableHead>
                  <TableHead>Game</TableHead>
                  {CHECK_COLUMNS.map((c) => (
                    <TableHead key={c.key} align="center" className="w-20">
                      {c.label}
                    </TableHead>
                  ))}
                  <TableHead align="center" className="w-24">
                    Trạng thái
                  </TableHead>
                  {(canManage || canDelete) && <TableHead align="right" className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCatalog.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs font-semibold text-zinc-400">{index + 1}</TableCell>
                    <TableCell>
                      {entry.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.iconUrl} alt={entry.name} className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-400 dark:bg-zinc-800">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{entry.name}</span>
                        {entry.shortName && <span className="text-[11px] font-semibold text-primary">({entry.shortName})</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500">{entry.packageName}</p>
                    </TableCell>
                    {CHECK_COLUMNS.map((c) => {
                      const url = entry[c.key];
                      return (
                        <TableCell key={c.key} align="center">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={c.label}
                              className={`inline-flex rounded-lg p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${c.activeClass}`}
                            >
                              <c.Icon className="h-6 w-6" />
                            </a>
                          ) : (
                            <span title={c.label} className="inline-flex p-1 text-zinc-300 dark:text-zinc-700">
                              <c.Icon className="h-6 w-6" />
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          entry.inhouse
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        }`}
                      >
                        {entry.inhouse ? "Inhouse" : "Publish"}
                      </span>
                    </TableCell>
                    {(canManage || canDelete) && (
                      <TableCell align="right">
                        <div className="flex justify-end gap-1">
                          {canManage && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Sửa"
                              onClick={() => openEdit(entry)}
                              className="text-zinc-400! hover:bg-zinc-100! hover:text-primary! dark:hover:bg-zinc-800!"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Xoá"
                              onClick={() => handleDelete(entry)}
                              className="text-zinc-400! hover:bg-red-50! hover:text-red-600! dark:hover:bg-red-950/40!"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <RadixDialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
          <RadixDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900">
            <RadixDialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {editingId ? "Sửa game" : "Thêm game"}
            </RadixDialog.Title>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {form.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.iconUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 text-lg font-bold text-zinc-300 dark:border-zinc-700">
                      {form.name.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  {fetchingIcon && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-zinc-950/50">
                      <Spinner className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                <label className="flex flex-1 flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Link Google Play</span>
                  <Input
                    type="url"
                    value={form.androidUrl}
                    onChange={(e) => handleAndroidUrlChange(e.target.value)}
                    onBlur={(e) => fetchIconFromAndroidUrl(e.target.value)}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                  />
                  <span className="text-xs text-zinc-400">Dán link Play Store để tự lấy package name + icon.</span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Tên game *</span>
                  <Input required value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="vd: Brick Jam" />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Package name *</span>
                  <Input
                    required
                    value={form.packageName}
                    onChange={(e) => setField("packageName", e.target.value)}
                    placeholder="com.company.game"
                    className="font-mono"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Short name</span>
                  <Input value={form.shortName} onChange={(e) => setField("shortName", e.target.value)} placeholder="vd: Brick" />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Priority</span>
                  <Input
                    type="number"
                    value={form.priority ?? ""}
                    onChange={(e) => setField("priority", e.target.value === "" ? undefined : Number(e.target.value))}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Link iOS (App Store)</span>
                  <Input type="url" value={form.iosUrl} onChange={(e) => setField("iosUrl", e.target.value)} placeholder="https://apps.apple.com/app/..." />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Link Drive</span>
                  <Input type="url" value={form.driveUrl} onChange={(e) => setField("driveUrl", e.target.value)} placeholder="https://drive.google.com/..." />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Github Playable</span>
                  <Input value={form.githubPlayableUrl} onChange={(e) => setField("githubPlayableUrl", e.target.value)} placeholder="https://github.com/..." />
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Github Product</span>
                  <Input value={form.githubProductUrl} onChange={(e) => setField("githubProductUrl", e.target.value)} placeholder="https://github.com/..." />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.inhouse ?? true}
                  onChange={(e) => setField("inhouse", e.target.checked)}
                  className="h-3.5! w-3.5!"
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Inhouse</span>
              </label>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="mt-2 flex justify-end gap-2">
                <RadixDialog.Close asChild>
                  <Button type="button" variant="secondary">
                    Huỷ
                  </Button>
                </RadixDialog.Close>
                <Button type="submit" loading={submitting}>
                  {submitting ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm vào All Games"}
                </Button>
              </div>
            </form>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </main>
  );
}
