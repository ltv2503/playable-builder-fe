/**
 * Mọi path của app tập trung ở đây — route đổi tên (như /games -> /creatives) chỉ cần sửa 1 chỗ,
 * không phải lục từng Link/router.push rải rác khắp app/. Khớp 1-1 với cấu trúc thư mục app/ —
 * đổi route nào thì rename thư mục đó rồi sửa đúng hàm/const tương ứng ở đây.
 */
export const routes = {
  home: "/",
  login: "/login",

  creatives: "/creatives",
  creativeNew: "/creatives/new",
  creative: (gameId: string) => `/creatives/${gameId}`,
  creativeConceptNew: (gameId: string) => `/creatives/${gameId}/concepts/new`,

  allGames: "/all-games",
  admin: "/admin",

  build: (buildId: string) => `/builds/${buildId}`,
  buildVariantNew: (buildId: string) => `/builds/${buildId}/variants/new`,
  buildVariant: (buildId: string, variantId: string) => `/builds/${buildId}/variants/${variantId}`,

  /** Prefix dùng để nhận diện route public trong useAuthGate.ts — giữ chung gốc với share() để không lệch nhau. */
  sharePrefix: "/share/",
  share: (token: string) => `/share/${token}`,
};
