/**
 * Key SWR tập trung 1 chỗ — tránh mỗi hook tự đặt key theo ý mình rồi vô tình
 * KHÔNG khớp nhau giữa 2 nơi cùng đọc 1 resource (vd useBuildDetailPage và
 * useVariantEditorPage cùng gọi getBuild(buildId) — key phải giống hệt để SWR
 * dedupe/share cache, không phải fetch lại).
 */
export const swrKeys = {
  games: () => "games",
  game: (id: string) => `game:${id}`,
  gameCatalog: () => "game-catalog",
  builds: (gameId: string) => `builds:${gameId}`,
  build: (id: string) => `build:${id}`,
  variants: (buildId: string) => `variants:${buildId}`,
  variant: (id: string) => `variant:${id}`,
  networks: () => "networks",
  users: () => "users",
  permissionsMatrix: () => "admin:permissions",
};
