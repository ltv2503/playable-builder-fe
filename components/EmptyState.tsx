import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
      {icon && <div className="text-zinc-300 dark:text-zinc-700">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
