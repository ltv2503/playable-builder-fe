/**
 * Typed client cho playable-builder (NestJS backend). Mọi route trừ
 * /auth/firebase đều cần Bearer token — xem lib/auth/context.ts.
 *
 * CRUD (JSON) đi qua lib/api/axios.ts (axios + interceptor: tự đính token từ
 * cookie, tự logout khi 401). Các hàm tải blob (artifact/export/preview) vẫn
 * dùng fetch thẳng — axios với responseType:"blob" sẽ không đọc được message
 * lỗi JSON từ backend khi request thất bại, nên giữ nguyên fetch cho nhóm này.
 */
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./axios";
import type { PermissionKeyDef } from "../auth/permissions";

export { ApiError } from "./api-error";

export type Role = "ADMIN" | "DEVELOP" | "UA" | "VIEWER";

export interface ApiUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Phương thức đăng nhập Firebase, vd "google.com"; null với user cũ chưa đăng nhập lại. */
  provider: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface ApiGame {
  id: string;
  name: string;
  slug: string;
  androidUrl: string | null;
  iosUrl: string | null;
  packageName: string | null;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** 1 row "tất cả game của công ty" (import từ file JSON export ngoài, xem playable-builder/src/scripts/seed-game-catalog.ts). */
export interface ApiGameCatalogEntry {
  id: string;
  externalId: string | null;
  name: string;
  shortName: string | null;
  packageName: string;
  iconUrl: string | null;
  androidUrl: string | null;
  iosUrl: string | null;
  driveUrl: string | null;
  githubPlayableUrl: string | null;
  githubProductUrl: string | null;
  priority: number | null;
  inhouse: boolean;
  sourceCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameCatalogEntryInput {
  name: string;
  packageName: string;
  shortName?: string;
  iconUrl?: string;
  androidUrl?: string;
  iosUrl?: string;
  driveUrl?: string;
  githubPlayableUrl?: string;
  githubProductUrl?: string;
  priority?: number;
  inhouse?: boolean;
}

export type ArtifactKind = "HTML" | "ZIP";

export interface ApiBuildArtifact {
  id: string;
  buildId: string;
  channelName: string;
  kind: ArtifactKind;
  storageKey: string;
  publishedKey: string | null;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
}

/** Khớp PlaygroundFieldType/PlaygroundFieldTypeInfo ở playable-builder/src/pipeline/playgroundFields.ts. */
export type PlaygroundFieldType = "boolean" | "integer" | "float" | "number" | "string" | "color";

export interface PlaygroundFieldTypeInfo {
  type: PlaygroundFieldType;
  slider?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

/** Khớp PlaygroundMatch ở playable-builder/src/pipeline/playgroundFields.ts. */
export interface PlaygroundMatch {
  kind: "field" | "asset";
  file: string;
  className: string;
  propName: string;
  options: { section?: string; [key: string]: unknown };
  defaultLiteral: { start: number; end: number; value: unknown } | null;
  assetKind: string | null;
  /** Chỉ có ở kind "field" (null ở "asset") — dùng để PlaygroundConfigForm dựng đúng input. */
  fieldType: PlaygroundFieldTypeInfo | null;
}

export interface PlaygroundFieldsRegistry {
  matches: PlaygroundMatch[];
  hooks: unknown[];
}

export type PlaygroundConfig = Record<string, Record<string, string | number | boolean>>;

export type BuildStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface ApiBuild {
  id: string;
  name: string;
  gameId: string;
  engineVersion: "V24X" | "V34X";
  status: BuildStatus;
  sourceZipKey: string;
  fieldsRegistry: PlaygroundFieldsRegistry | null;
  playgroundConfig: PlaygroundConfig;
  errorMessage: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  artifacts: ApiBuildArtifact[];
}

/** Trả về từ POST /builds/:id/reupload/preview — fieldsRegistry của zip mới, chưa build/đè gì cả. */
export interface ApiReuploadPreview {
  pendingUploadId: string;
  fieldsRegistry: PlaygroundFieldsRegistry;
}

export interface ApiVariant {
  id: string;
  buildId: string;
  name: string;
  config: PlaygroundConfig;
  createdById: string;
  createdBy: { name: string; email: string };
  createdAt: string;
  updatedAt: string;
  /** Token của share link còn sống (chưa revoke) của biến thể này — null nếu chưa có/đã bị thu hồi. */
  shareToken: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** authHeader(token) truyền tường minh theo từng call — độc lập với cookie mà interceptor tự đọc, nhưng luôn cùng giá trị nên không xung đột. */
function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const api = {
  loginWithFirebase: (idToken: string) => apiPost<{ accessToken: string; user: ApiUser }>("/auth/firebase", { idToken }),
  me: (token: string) => apiGet<ApiUser>("/auth/me", authHeader(token)),

  listGames: (token: string) => apiGet<ApiGame[]>("/games", authHeader(token)),
  getGame: (token: string, id: string) => apiGet<ApiGame>(`/games/${id}`, authHeader(token)),
  updateGame: (token: string, id: string, data: Partial<{ name: string; androidUrl: string; iosUrl: string }>) =>
    apiPatch<ApiGame>(`/games/${id}`, data, authHeader(token)),

  listGameCatalog: (token: string) => apiGet<ApiGameCatalogEntry[]>("/game-catalog", authHeader(token)),
  createGameFromCatalog: (token: string, catalogEntryId: string) =>
    apiPost<ApiGame>("/games/from-catalog", { catalogEntryId }, authHeader(token)),
  /** Các hàm dưới đây chỉ Admin gọi được (RolesGuard phía backend) — trang "All Games". */
  createGameCatalogEntry: (token: string, data: CreateGameCatalogEntryInput) =>
    apiPost<ApiGameCatalogEntry>("/game-catalog", data, authHeader(token)),
  updateGameCatalogEntry: (token: string, id: string, data: Partial<CreateGameCatalogEntryInput>) =>
    apiPatch<ApiGameCatalogEntry>(`/game-catalog/${id}`, data, authHeader(token)),
  deleteGameCatalogEntry: (token: string, id: string) => apiDelete<void>(`/game-catalog/${id}`, authHeader(token)),
  /** Đọc icon URL + tên thẳng từ link Play Store (JSON, không tải bytes) — auto-fill form Thêm/Sửa ở All Games. */
  fetchGameCatalogIconMeta: (token: string, androidUrl: string) =>
    apiGet<{ iconUrl: string; name: string | null }>(`/game-catalog/icon-from-url?url=${encodeURIComponent(androidUrl)}`, authHeader(token)),

  listBuilds: (token: string, gameId: string) => apiGet<ApiBuild[]>(`/games/${gameId}/builds`, authHeader(token)),
  getBuild: (token: string, id: string) => apiGet<ApiBuild>(`/builds/${id}`, authHeader(token)),
  deleteBuild: (token: string, id: string) => apiDelete<void>(`/builds/${id}`, authHeader(token)),
  renameBuild: (token: string, id: string, name: string) => apiPatch<ApiBuild>(`/builds/${id}`, { name }, authHeader(token)),
  uploadBuild: (
    token: string,
    gameId: string,
    name: string,
    file: File,
    options?: { pngMode?: "off" | "palette" | "webp"; noCompressPaths?: string[] },
  ) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    if (options?.pngMode) form.append("pngMode", options.pngMode);
    if (options?.noCompressPaths?.length) form.append("noCompressPaths", JSON.stringify(options.noCompressPaths));
    return apiPost<ApiBuild>(`/games/${gameId}/builds`, form, authHeader(token));
  },
  /** Bước 1/2 "Upload lại" (đè lên concept có sẵn) — quét fieldsRegistry của zip mới, KHÔNG build/đè gì cả. */
  previewReupload: (
    token: string,
    buildId: string,
    file: File,
    options?: { pngMode?: "off" | "palette" | "webp"; noCompressPaths?: string[] },
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.pngMode) form.append("pngMode", options.pngMode);
    if (options?.noCompressPaths?.length) form.append("noCompressPaths", JSON.stringify(options.noCompressPaths));
    return apiPost<ApiReuploadPreview>(`/builds/${buildId}/reupload/preview`, form, authHeader(token));
  },
  /** Bước 2/2 — user đã xem diff config và xác nhận đè. */
  confirmReupload: (token: string, buildId: string, pendingUploadId: string) =>
    apiPost<ApiBuild>(`/builds/${buildId}/reupload/${pendingUploadId}/confirm`, {}, authHeader(token)),
  /** User huỷ sau khi xem diff (hoặc đóng popup) — dọn pending upload, build gốc không đổi gì. */
  cancelReupload: (token: string, buildId: string, pendingUploadId: string) =>
    apiDelete<void>(`/builds/${buildId}/reupload/${pendingUploadId}`, authHeader(token)),

  listNetworks: (token: string) => apiGet<string[]>("/meta/networks", authHeader(token)),

  listVariants: (token: string, buildId: string) => apiGet<ApiVariant[]>(`/builds/${buildId}/variants`, authHeader(token)),
  createVariant: (token: string, buildId: string, name: string) =>
    apiPost<ApiVariant>(`/builds/${buildId}/variants`, { name }, authHeader(token)),
  getVariant: (token: string, id: string) => apiGet<ApiVariant>(`/variants/${id}`, authHeader(token)),
  updateVariantConfig: (token: string, id: string, config: PlaygroundConfig) =>
    apiPatch<ApiVariant>(`/variants/${id}`, { config }, authHeader(token)),
  renameVariant: (token: string, id: string, name: string) => apiPatch<ApiVariant>(`/variants/${id}`, { name }, authHeader(token)),
  deleteVariant: (token: string, id: string) => apiDelete<void>(`/variants/${id}`, authHeader(token)),
  duplicateVariant: (token: string, id: string) => apiPost<ApiVariant>(`/variants/${id}/duplicate`, {}, authHeader(token)),

  getMyPermissions: (token: string) => apiGet<{ isAdmin: boolean; keys: string[] }>("/auth/me/permissions", authHeader(token)),

  listUsers: (token: string) => apiGet<ApiUser[]>("/users", authHeader(token)),
  updateUserRole: (token: string, id: string, role: Role) => apiPatch<ApiUser>(`/users/${id}/role`, { role }, authHeader(token)),

  getPermissionsMatrix: (token: string) =>
    apiGet<{ defs: PermissionKeyDef[]; editableRoles: Role[]; matrix: Record<string, string[]> }>(
      "/admin/permissions",
      authHeader(token),
    ),
  updatePermissionsMatrix: (token: string, matrix: Record<string, string[]>) =>
    apiPut<{ ok: boolean }>("/admin/permissions", { matrix }, authHeader(token)),

  /** Tạo (hoặc tái dùng link còn sống) link xem công khai cho bản single-html gốc — xem nút "Share" ở builds/[id]. */
  createShareLink: (token: string, buildId: string) => apiPost<ApiSharedPreviewLink>(`/builds/${buildId}/share`, {}, authHeader(token)),
  revokeShareLink: (token: string, buildId: string) => apiDelete<void>(`/builds/${buildId}/share`, authHeader(token)),
  /** Như trên nhưng cho đúng 1 biến thể (đã vá playgroundConfig) — xem nút "Share" ở variant editor. */
  createVariantShareLink: (token: string, variantId: string) =>
    apiPost<ApiSharedPreviewLink>(`/variants/${variantId}/share`, {}, authHeader(token)),
  revokeVariantShareLink: (token: string, variantId: string) => apiDelete<void>(`/variants/${variantId}/share`, authHeader(token)),
};

export interface ApiSharedPreviewLink {
  token: string;
  /** null = không hết hạn (mọi link tạo mới đều vậy). */
  expiresAt: string | null;
}

export type ResolvedSharedPreview = { buildName: string } & ({ kind: "url"; url: string } | { kind: "html"; html: string });

/**
 * Route public (không cần token) — gọi từ Server Component app/share/[token]/page.tsx. Bản gốc trả về
 * `{ kind: "url" }` (presigned URL của storage, chưa vá config nào); bản biến thể trả `{ kind: "html" }`
 * (nội dung html đã vá playgroundConfig sẵn ở backend, vì không có object đã-vá nào trên storage để
 * presign) — xem SharedPreviewLinksService.resolve() ở backend.
 */
export async function resolveSharedPreviewLink(token: string): Promise<ResolvedSharedPreview> {
  const res = await fetch(`${API_URL}/share/${encodeURIComponent(token)}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Link xem không hợp lệ hoặc đã hết hạn.");
  }
  return res.json();
}

/**
 * Endpoint download yêu cầu JWT (RolesGuard) nhưng redirect (302) sang
 * presigned URL của storage — điều hướng bằng <a href> thẳng sẽ không gắn
 * được Authorization header, nên phải fetch thủ công rồi tự mở/tải blob.
 */
export async function fetchArtifactBlob(token: string, buildId: string, artifactId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/builds/${buildId}/artifacts/${artifactId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Tải file thất bại (HTTP ${res.status})`);
  return res.blob();
}

export async function openOrDownloadArtifact(token: string, artifact: ApiBuildArtifact): Promise<void> {
  const blob = await fetchArtifactBlob(token, artifact.buildId, artifact.id);
  const url = URL.createObjectURL(blob);
  if (artifact.kind === "HTML") {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.channelName}.zip`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Build on-demand cho 1/nhiều network được chọn (không lưu lại trên server —
 * xem builds.service.ts's exportBuild) rồi tải thẳng về máy. 1 network trả
 * đúng file đó (html mở tab mới để xem trước khi tải, zip tải luôn); nhiều
 * network server tự gộp thành 1 export.zip, luôn tải file. `variantId` tuỳ
 * chọn: vá config của biến thể đó vào trước khi export.
 */
export async function exportBuild(token: string, buildId: string, networks: string[], variantId?: string): Promise<void> {
  const params = new URLSearchParams({ networks: networks.join(",") });
  if (variantId) params.set("variantId", variantId);
  const res = await fetch(`${API_URL}/builds/${buildId}/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Export thất bại (HTTP ${res.status})`);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const fileNameMatch = disposition.match(/filename="([^"]+)"/);
  const fileName = fileNameMatch?.[1] || "export";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (networks.length === 1 && fileName.endsWith(".html")) {
    window.open(url, "_blank");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Mở tab mới xem bản single-html gốc đã vá config của 1 variant — dùng cho nút "Xem nhanh" ở danh sách biến thể. */
export async function openVariantPreview(token: string, variantId: string): Promise<void> {
  const res = await fetch(`${API_URL}/variants/${variantId}/preview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Xem preview thất bại (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

