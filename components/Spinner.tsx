export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-zinc-200 border-t-primary dark:border-zinc-800 ${className}`} />;
}

export function PageLoading() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </main>
  );
}
