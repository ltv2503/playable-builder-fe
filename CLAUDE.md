@AGENTS.md

# playable-tool

Frontend Next.js 16 (App Router) + React 19 + Tailwind 4 để quản lý playable ads: game → concept → biến thể, chỉnh playgroundConfig và export theo ad network. Backend là `../playable-builder` (NestJS, port 3001).

## Lệnh

- `npm run dev` (port 3000), `npm run build`, `npm run lint`
- Env: `.env.local.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_*`)
- Không có test suite; kiểm tra bằng `npm run lint` và `npm run build`.

## Bỏ qua khi tìm kiếm

`node_modules/`, `.next/`, `package-lock.json`, `tsconfig.tsbuildinfo`, `Demo/`, `public/`.

## Cấu trúc

```
app/                         mỗi route = page.tsx (chỉ render) + useXxxPage.ts (state, SWR, handler)
  login/                     đăng nhập Google qua Firebase
  games/, games/[id]/        danh sách game, chi tiết game (danh sách concept)
  games/[id]/concepts/new/   upload web-mobile zip -> tạo concept (Build)
  builds/[id]/               chi tiết concept, export
  builds/[id]/variants/...   tạo / sửa biến thể (playgroundConfig editor + live preview)
  admin/                     quản lý user/role + ma trận phân quyền (chỉ ADMIN)
  api/preview, api/export    route handler chạy server: shell ra ../playable-builder/dist/cli-*.js
components/                  UI dùng chung; components/common (Button, Card, Input, PromptDialog)
lib/
  api/axios.ts               axios instance: gắn Bearer token từ cookie, 401 -> logout về /login
  api/index.ts               typed client cho mọi endpoint backend + kiểu Api*
  api/swr-keys.ts            key SWR tập trung — luôn dùng swrKeys, không tự đặt key
  auth/                      Firebase client, zustand store, context, permissions (PermKey)
  cocos/                     xử lý build Cocos phía client: sceneInspector (đọc/sửa scene trong iframe),
                             playgroundConfig, buildPreviewBlob, zip helpers
  server/serverBuild.ts      helper cho app/api/*: ghi FormData ra thư mục tạm, chạy CLI
constants/
```

## Khái niệm domain

- **Concept** = 1 lần upload web-mobile = `Build` ở backend. **Biến thể** = `PlaygroundConfigPreset`.
- **playgroundConfig**: `Record<section, Record<field, value>>`. Build đã bọc mọi `@playgroundField` đọc từ `window.__playgroundConfig`, nên live preview chỉ inject lại script đó rồi reboot iframe, không build lại. `@playgroundAsset` (sprite/audio) sửa trực tiếp trên instance đang chạy (`sceneInspector.ts`).

## Quy ước / lưu ý

- Next.js bản này có breaking changes, đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem AGENTS.md).
- Backend không có prefix `/api`; `app/api/*` là route riêng của Next, không phải proxy tới backend.
- CRUD JSON đi qua `lib/api/axios.ts`; tải blob (artifact/export/preview) dùng `fetch` thẳng để đọc được message lỗi JSON.
- Upload `FormData`: interceptor tự bỏ `Content-Type`, đừng set tay.
- `app/api/*` phụ thuộc `../playable-builder/dist` → cần `npm run build` bên builder trước.
- Permission key trong `lib/auth/permissions.ts` phải khớp 1-1 với `../playable-builder/src/config/permission-keys.ts`.
- Text UI và comment viết tiếng Việt; style theo token Tailwind sẵn có (`bg-primary`, `hover:bg-primary-hover`, `dark:` variant).
