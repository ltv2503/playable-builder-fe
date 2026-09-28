"use client";

import { useEffect, useRef, useState } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import Button from "./Button";
import Input from "./Input";

interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  initialValue: string;
  submitLabel?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => Promise<void> | void;
}

/**
 * Modal nhập 1 dòng text (thay cho window.prompt) — dùng cho các thao tác đổi
 * tên (concept/biến thể). Radix Dialog lo focus-trap/Escape/click-outside;
 * phần còn lại chỉ là style theo đúng token của app (xem globals.css).
 */
export function PromptDialog({ open, title, label, initialValue, submitLabel = "Lưu", onOpenChange, onSubmit }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialValue) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm" />
        <RadixDialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.select();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <RadixDialog.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</RadixDialog.Title>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-1.5">
            {label && <label className="text-xs font-medium text-zinc-500">{label}</label>}
            <Input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} />
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <RadixDialog.Close asChild>
                <Button type="button" variant="secondary" size="sm">
                  Huỷ
                </Button>
              </RadixDialog.Close>
              <Button type="submit" size="sm" loading={submitting} disabled={!value.trim() || value.trim() === initialValue}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
