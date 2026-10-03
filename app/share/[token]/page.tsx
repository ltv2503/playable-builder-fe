import { Card } from "@/components/common";
import { resolveSharedPreviewLink, type ResolvedSharedPreview } from "@/lib/api";

/**
 * Route public (không cần đăng nhập playable-tool — xem useAuthGate.ts's PUBLIC_ROUTE_PREFIXES) — nút
 * "Share" ở builds/[id] và variant editor tạo ra link dạng /share/<token>. Server Component: resolve
 * token ở server (không qua fetch()/CORS phía client) ra 1 presigned URL (đã vá sẵn config nếu là share
 * biến thể — xem SharedPreviewLinksService.resolve()), rồi nhúng thẳng vào <iframe src>. Trang
 * /share/[token] vẫn ở domain playable-tool, chỉ nội dung BÊN TRONG iframe tải từ domain storage.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let resolved: ResolvedSharedPreview;
  try {
    resolved = await resolveSharedPreviewLink(token);
  } catch (e) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <Card variant="default" padding="lg" className="w-full max-w-md text-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Không thể mở link xem</h1>
          <p className="mt-2 text-sm text-zinc-500">{e instanceof Error ? e.message : "Đã có lỗi xảy ra."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950">
      <iframe src={resolved.url} title={resolved.buildName} sandbox="allow-scripts allow-same-origin" className="h-full w-full flex-1 border-0" />
    </div>
  );
}
