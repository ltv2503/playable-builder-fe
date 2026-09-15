import type { BuildStatus } from "@/lib/api";

const STATUS_STYLE: Record<BuildStatus, string> = {
  PENDING: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  PROCESSING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  SUCCESS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const DOT_STYLE: Record<BuildStatus, string> = {
  PENDING: "bg-zinc-400",
  PROCESSING: "bg-amber-500 animate-pulse",
  SUCCESS: "bg-emerald-500",
  FAILED: "bg-red-500",
};

const STATUS_LABEL: Record<BuildStatus, string> = {
  PENDING: "Đang chờ",
  PROCESSING: "Đang build",
  SUCCESS: "Sẵn sàng",
  FAILED: "Lỗi",
};

export function StatusBadge({ status }: { status: BuildStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLE[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
