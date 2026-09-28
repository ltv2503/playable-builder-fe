"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRequireAuth } from "@/lib/auth/use-require-auth";
import { api, type ApiGameCatalogEntry, type CreateGameCatalogEntryInput } from "@/lib/api";
import { swrKeys } from "@/lib/api/swr-keys";

const EMPTY_FORM: CreateGameCatalogEntryInput = {
  name: "",
  packageName: "",
  shortName: "",
  iconUrl: "",
  androidUrl: "",
  iosUrl: "",
  driveUrl: "",
  githubPlayableUrl: "",
  githubProductUrl: "",
  priority: undefined,
  inhouse: true,
};

function extractPackageName(url: string): string | null {
  try {
    return new URL(url).searchParams.get("id");
  } catch {
    return null;
  }
}

/** Field rỗng ("") không hợp lệ với @IsUrl()/@IsInt() optional ở backend — đổi thành undefined trước khi gửi. */
function toPayload(form: CreateGameCatalogEntryInput): CreateGameCatalogEntryInput {
  return {
    name: form.name.trim(),
    packageName: form.packageName.trim(),
    shortName: form.shortName?.trim() || undefined,
    iconUrl: form.iconUrl?.trim() || undefined,
    androidUrl: form.androidUrl?.trim() || undefined,
    iosUrl: form.iosUrl?.trim() || undefined,
    driveUrl: form.driveUrl?.trim() || undefined,
    githubPlayableUrl: form.githubPlayableUrl?.trim() || undefined,
    githubProductUrl: form.githubProductUrl?.trim() || undefined,
    priority: form.priority,
    inhouse: form.inhouse,
  };
}

export function useAllGamesPage() {
  const session = useRequireAuth();
  const isAdmin = session?.user.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateGameCatalogEntryInput>(EMPTY_FORM);
  const [fetchingIcon, setFetchingIcon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: catalog, error: swrError } = useSWR(session ? swrKeys.gameCatalog() : null, () => api.listGameCatalog(session!.accessToken));

  const filteredCatalog = useMemo(() => {
    const list = catalog ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (entry) => entry.name.toLowerCase().includes(q) || entry.packageName.toLowerCase().includes(q) || entry.shortName?.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const listError = swrError ? (swrError instanceof Error ? swrError.message : String(swrError)) : null;

  const setField = <K extends keyof CreateGameCatalogEntryInput>(key: K, value: CreateGameCatalogEntryInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (entry: ApiGameCatalogEntry) => {
    setForm({
      name: entry.name,
      packageName: entry.packageName,
      shortName: entry.shortName ?? "",
      iconUrl: entry.iconUrl ?? "",
      androidUrl: entry.androidUrl ?? "",
      iosUrl: entry.iosUrl ?? "",
      driveUrl: entry.driveUrl ?? "",
      githubPlayableUrl: entry.githubPlayableUrl ?? "",
      githubProductUrl: entry.githubProductUrl ?? "",
      priority: entry.priority ?? undefined,
      inhouse: entry.inhouse,
    });
    setEditingId(entry.id);
    setError(null);
    setDialogOpen(true);
  };

  /** Dán link Play Store -> tự lấy packageName từ query "id", rồi tự lấy icon + tên (khi blur khỏi ô). */
  const handleAndroidUrlChange = (value: string) => {
    setField("androidUrl", value);
    const pkg = extractPackageName(value);
    if (pkg) setField("packageName", pkg);
  };

  const fetchIconFromAndroidUrl = async (androidUrl: string) => {
    if (!session || !androidUrl.trim()) return;
    setFetchingIcon(true);
    try {
      const { iconUrl, name } = await api.fetchGameCatalogIconMeta(session.accessToken, androidUrl);
      setForm((prev) => ({ ...prev, iconUrl, name: prev.name.trim() ? prev.name : (name ?? prev.name) }));
    } catch {
      // lấy không được thì im lặng, không chặn form — user vẫn có thể tự điền iconUrl tay
    } finally {
      setFetchingIcon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (editingId) await api.updateGameCatalogEntry(session.accessToken, editingId, payload);
      else await api.createGameCatalogEntry(session.accessToken, payload);
      await mutate(swrKeys.gameCatalog(), () => api.listGameCatalog(session.accessToken));
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: ApiGameCatalogEntry) => {
    if (!session) return;
    if (!confirm(`Xoá "${entry.name}" khỏi All Games?`)) return;
    try {
      await api.deleteGameCatalogEntry(session.accessToken, entry.id);
      await mutate(swrKeys.gameCatalog(), () => api.listGameCatalog(session.accessToken));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return {
    session,
    isAdmin,
    search,
    setSearch,
    filteredCatalog,
    totalCount: catalog?.length ?? 0,
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
  };
}
