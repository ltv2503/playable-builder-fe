"use client";

import type { PlaygroundConfig, PlaygroundFieldsRegistry } from "@/lib/api";
import { usePlaygroundConfigForm } from "./usePlaygroundConfigForm";

interface Props {
  fieldsRegistry: PlaygroundFieldsRegistry | null;
  config: PlaygroundConfig;
  onChange: (config: PlaygroundConfig) => void;
  readOnly?: boolean;
}

export function PlaygroundConfigForm({ fieldsRegistry, config, onChange, readOnly }: Props) {
  const { groups, assetCount, setValue, getValue } = usePlaygroundConfigForm({ fieldsRegistry, config, onChange });

  if (groups.size === 0) {
    return (
      <p className="text-xs leading-relaxed text-zinc-500">
        Build này không có @playgroundField nào để chỉnh
        {assetCount > 0 ? ` (có ${assetCount} @playgroundAsset — chưa hỗ trợ chỉnh ở giao diện này)` : ""}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {[...groups].map(([group, matches]) => (
        <div key={group} className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{group}</div>
          {matches.map((match) => {
            const defaultValue = match.defaultLiteral?.value;
            const current = getValue(group, match);
            return (
              <label key={match.propName} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">{match.propName}</span>
                {typeof defaultValue === "boolean" && (
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={Boolean(current)}
                    onChange={(e) => setValue(group, match.propName, e.target.checked)}
                    className="h-4 w-4 accent-orange-500 disabled:opacity-50"
                  />
                )}
                {typeof defaultValue === "number" && (
                  <input
                    type="number"
                    disabled={readOnly}
                    value={Number(current)}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      if (!Number.isNaN(v)) setValue(group, match.propName, v);
                    }}
                    className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                )}
                {typeof defaultValue === "string" && (
                  <input
                    type="text"
                    disabled={readOnly}
                    value={String(current ?? "")}
                    onChange={(e) => setValue(group, match.propName, e.target.value)}
                    className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                )}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
