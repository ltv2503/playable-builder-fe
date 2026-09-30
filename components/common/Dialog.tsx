"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** "sm" (mặc định, max-w-sm) hoặc "lg" (max-w-2xl) — dùng cho nội dung rộng hơn 1 form đơn giản, vd bảng diff. */
  size?: "sm" | "lg";
}

const SIZE_CLASS: Record<NonNullable<DialogProps["size"]>, string> = { sm: "max-w-sm", lg: "max-w-2xl" };

/** Dialog chung (bọc Radix) cho nội dung tuỳ ý — dùng khi PromptDialog (chỉ 1 input text) không đủ. */
export function Dialog({ open, onOpenChange, title, children, size = "sm" }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
        <RadixDialog.Content
          className={`fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] ${SIZE_CLASS[size]} -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900`}
        >
          <RadixDialog.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</RadixDialog.Title>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
