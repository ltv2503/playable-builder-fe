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
  builds/[id]/               chi tiết concept, export, tạo/thu hồi link xem công khai (Share) cho bản gốc
  builds/[id]/variants/...   tạo / sửa biến thể (playgroundConfig editor + live preview) + Share cho đúng biến thể đó
  admin/                     quản lý user/role + ma trận phân quyền (chỉ ADMIN)
  share/[token]/             route PUBLIC (không cần đăng nhập, xem useAuthGate.ts) — resolve link Share rồi redirect sang storage
components/                  UI dùng chung; components/common (Button, Card, Checkbox, ColorInput, Dialog, Input, Slider, Table, PromptDialog)
lib/
  api/axios.ts               axios instance: gắn Bearer token từ cookie, 401 -> logout về /login
  api/index.ts               typed client cho mọi endpoint backend + kiểu Api*
  api/swr-keys.ts            key SWR tập trung — luôn dùng swrKeys, không tự đặt key
  auth/                      Firebase client, zustand store, context, permissions (PermKey)
  cocos/                     playgroundConfig (inject window.__playgroundConfig cho live preview), zipPngPreview/zipRoot
                             (dò root-folder trong zip, dùng lúc upload concept)
constants/
```

## Khái niệm domain

- **Concept** = 1 lần upload web-mobile = `Build` ở backend. **Biến thể** = `PlaygroundConfigPreset`.
- **playgroundConfig**: `Record<section, Record<field, value>>`. Build đã bọc mọi `@playgroundField` đọc từ `window.__playgroundConfig`, nên live preview chỉ inject lại script đó rồi reboot iframe, không build lại.
- **`fieldsRegistry.matches[].fieldType`**: `{ type: "boolean"|"integer"|"float"|"number"|"string"|"color", slider?, min?, max?, step? }`, khớp
  `PlaygroundFieldTypeInfo` ở `../playable-builder/src/pipeline/playgroundFields.ts`. `PlaygroundConfigForm.tsx` dựng input theo field này, toàn bộ
  qua `components/common` — `Checkbox` (boolean), `Input` type=number/text (integer/float/number/string), `Slider` (numeric có `slider:true` + đủ
  `min`/`max`), `ColorInput` (color) — không viết `<input>` thô trong form này; build cũ scan trước khi có field này thì `fieldType` là `null` —
  form tự đoán lại qua `inferFieldType()` (y hệt logic backend) để không vỡ với build cũ.
- **Export chọn nhiều config**: `builds/[id]/page.tsx`'s "Dùng config của" là multi-select (pill giống Ad network, không phải `<select>` đơn nữa)
  — `useBuildDetailPage.ts`'s `selectedVariantIds: string[]` (`""` = "Mặc định (engine)", cùng danh sách chọn với biến thể thật).
  `handleExport()` gọi `exportBuild()` ĐÚNG 1 LẦN với cả `networks` lẫn `selectedVariantIds` — backend (`GET /builds/:id/export?networks=...&variantIds=...`,
  xem `BuildsService.exportBuild`) tự gộp hết network × biến thể vào 1 file/zip duy nhất, phần nặng nhất (tải single-html + nén resource) chỉ làm
  1 lần cho cả batch thay vì lặp lại theo từng biến thể như trước (từng là nguyên nhân export nhiều config bị chậm).
- **Link xem công khai** (nút "Share"): `POST/DELETE /builds/:id/share` (bản gốc, ở `builds/[id]/page.tsx`) hoặc `POST/DELETE
  /variants/:id/share` (đúng 1 biến thể, ở variant editor) — cả 2 cần quyền `"share"`, có Bearer token như mọi route khác, trả về
  `{ token, expiresAt }` — FE tự ráp URL đầy đủ bằng `window.location.origin` (không lưu domain cứng). Người xem mở `/share/[token]/page.tsx` —
  route PUBLIC (không đăng nhập, xem `useAuthGate.ts`'s `PUBLIC_ROUTE_PREFIXES`) — Server Component gọi `resolveSharedPreviewLink(token)` (fetch
  thẳng backend's public `GET /share/:token`, không gắn Authorization — chạy server-side nên không dính CORS), kết quả là `ResolvedSharedPreview`
  dạng union: `{kind:"url"}` (bản gốc, presigned URL) → `<iframe src>`; `{kind:"html"}` (biến thể, html đã vá config sẵn ở backend) →
  `<iframe srcDoc>`. Cả 2 case đều full-page, người xem ở lại đúng domain playable-tool, không bị điều hướng sang domain storage. Token
  invalid/hết hạn thì render 1 Card báo lỗi thay vì crash.

## Quy ước / lưu ý

- Next.js bản này có breaking changes, đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem AGENTS.md).
- CRUD JSON đi qua `lib/api/axios.ts`; tải blob (artifact/export) dùng `fetch` thẳng để đọc được message lỗi JSON.
- Upload `FormData`: interceptor tự bỏ `Content-Type`, đừng set tay.
- Permission key trong `lib/auth/permissions.ts` phải khớp 1-1 với `../playable-builder/src/config/permission-keys.ts`.
- **Không còn phụ thuộc filesystem vào `../playable-builder`** (đã xoá tính năng "Preview local" cùng `app/api/preview`/`app/api/export`, vốn
  shell thẳng ra `../playable-builder/dist/cli-*.js` bằng đường dẫn tương đối — đó là lý do 2 repo từng bắt buộc phải nằm cùng 1 filesystem khi
  deploy). Giờ playable-tool chỉ giao tiếp với backend qua HTTP (`NEXT_PUBLIC_API_URL`) — deploy tách riêng 2 repo lên 2 host khác nhau được.
- Text UI và comment viết tiếng Việt; style theo token Tailwind sẵn có (`bg-primary`, `hover:bg-primary-hover`, `dark:` variant).
- **Mọi UI đều phải dùng qua `components/common`** (Button, Card, Checkbox, ColorInput, Dialog, Input, Slider, Table/TableHeader/TableBody/TableRow/TableHead/TableCell, PromptDialog, ...) — không tự viết thẻ HTML thô (`<table>`, `<button>`, `<input type="checkbox">`, ...) kèm Tailwind rời rạc trong `page.tsx`/feature component. Nếu chưa có component phù hợp, thêm mới vào `components/common` (theo đúng pattern `forwardRef` + variant map như `Button.tsx`/`Card.tsx`) rồi export ở `components/common/index.ts`, thay vì viết inline. Việc tương tác phức tạp (dialog, dropdown...) dùng Radix UI primitive rồi bọc lại thành component trong `components/common`, không import Radix thẳng vào page.
