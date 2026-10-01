import Link from "next/link";
import { ChevronRightIcon } from "../icons";

export interface BreadcrumbItem {
  label: string;
  /** Bỏ trống ở item cuối (trang hiện tại) — item đó render dạng text thường, không phải link. */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={`flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 ${className ?? ""}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRightIcon className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-zinc-700 dark:hover:text-zinc-300">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-zinc-700 dark:text-zinc-300" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
