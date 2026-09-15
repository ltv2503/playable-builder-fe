/**
 * Typed client cho playable-builder (NestJS backend). Mọi route trừ
 * /auth/firebase đều cần Bearer token — xem lib/auth-context.tsx.
 *
 * CRUD (JSON) đi qua lib/api/axios.ts (axios + interceptor: tự đính token từ
 * cookie, tự logout khi 401). Các hàm tải blob (artifact/export/preview) vẫn
 * dùng fetch thẳng — axios với responseType:"blob" sẽ không đọc được message
 * lỗi JSON từ backend khi request thất bại, nên giữ nguyên fetch cho nhóm này.
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "./api/axios";

export { ApiError } from "./api/api-error";

export type Role = "ADMIN" | "EDITOR" | "VIEWER";

export interface ApiUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  avatarUrl: string | null;
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
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
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

/** Khớp PlaygroundMatch ở playable-builder/src/pipeline/playgroundFields.ts. */
export interface PlaygroundMatch {
  kind: "field" | "asset";
  file: string;
  className: string;
  propName: string;
  options: { section?: string; [key: string]: unknown };
  defaultLiteral: { start: number; end: number; value: unknown } | null;
  assetKind: string | null;
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

export interface ApiVariant {
  id: string;
  buildId: string;
  name: string;
  config: PlaygroundConfig;
  createdById: string;
  createdAt: string;
  updatedAt: string;
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
  createGame: (
    token: string,
    data: { name: string; slug: string; androidUrl?: string; iosUrl?: string; icon?: File },
  ) => {
    const form = new FormData();
    form.append("name", data.name);
    form.append("slug", data.slug);
    if (data.androidUrl) form.append("androidUrl", data.androidUrl);
    if (data.iosUrl) form.append("iosUrl", data.iosUrl);
    if (data.icon) form.append("icon", data.icon);
    return apiPost<ApiGame>("/games", form, authHeader(token));
  },
  getGame: (token: string, id: string) => apiGet<ApiGame>(`/games/${id}`, authHeader(token)),
  updateGame: (token: string, id: string, data: Partial<{ name: string; androidUrl: string; iosUrl: string }>) =>
    apiPatch<ApiGame>(`/games/${id}`, data, authHeader(token)),

  listBuilds: (token: string, gameId: string) => apiGet<ApiBuild[]>(`/games/${gameId}/builds`, authHeader(token)),
  getBuild: (token: string, id: string) => apiGet<ApiBuild>(`/builds/${id}`, authHeader(token)),
  uploadBuild: (token: string, gameId: string, name: string, file: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    return apiPost<ApiBuild>(`/games/${gameId}/builds`, form, authHeader(token));
  },

  listNetworks: (token: string) => apiGet<string[]>("/meta/networks", authHeader(token)),

  listVariants: (token: string, buildId: string) => apiGet<ApiVariant[]>(`/builds/${buildId}/variants`, authHeader(token)),
  createVariant: (token: string, buildId: string, name: string) =>
    apiPost<ApiVariant>(`/builds/${buildId}/variants`, { name }, authHeader(token)),
  getVariant: (token: string, id: string) => apiGet<ApiVariant>(`/variants/${id}`, authHeader(token)),
  updateVariantConfig: (token: string, id: string, config: PlaygroundConfig) =>
    apiPatch<ApiVariant>(`/variants/${id}`, { config }, authHeader(token)),
  deleteVariant: (token: string, id: string) => apiDelete<void>(`/variants/${id}`, authHeader(token)),
};

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

/**
 * Lấy icon + tên app thẳng từ link Google Play (backend đọc trang Play Store)
 * — dùng để tự điền icon/tên khi user vừa dán link Android lúc tạo/sửa game,
 * đỡ phải tự tìm ảnh/gõ tên tay. `file` dùng lại đúng luồng upload icon hiện
 * có (api.createGame's `icon`); `name` đọc từ header "X-App-Name" (backend
 * trả icon dạng binary nên không gửi tên qua JSON được).
 */
export async function fetchIconFromAndroidUrl(
  token: string,
  androidUrl: string,
): Promise<{ file: File; name: string | null }> {
  const res = await fetch(`${API_URL}/games/icon-from-url?url=${encodeURIComponent(androidUrl)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Không lấy được icon (HTTP ${res.status})`);
  }
  const rawName = res.headers.get("X-App-Name");
  const name = rawName ? decodeURIComponent(rawName) : null;
  const blob = await res.blob();
  const ext = blob.type.split("/")[1]?.split("+")[0] || "png";
  const file = new File([blob], `icon.${ext}`, { type: blob.type });
  return { file, name };
}
