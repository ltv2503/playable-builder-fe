export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  // border-*! (important): globals.css's "* { border-color: ... }" nằm ngoài @layer nên theo cascade
  // layers luôn thắng mọi utility Tailwind (dù utility đứng sau trong source) — thiếu "!" thì 4 cạnh
  // border bị ép về cùng 1 màu, animate-spin vẫn chạy nhưng vòng tròn đồng màu xoay nhìn y hệt đứng yên.
  return <div className={`animate-spin rounded-full border-2 border-zinc-200! border-t-primary! dark:border-zinc-800! ${className}`} />;
}

export function PageLoading() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </main>
  );
}
