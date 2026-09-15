"use client";

import { useMemo } from "react";
import type { PlaygroundConfig, PlaygroundFieldsRegistry, PlaygroundMatch } from "@/lib/api";

function groupKey(match: PlaygroundMatch): string {
  // Phải khớp playgroundGroupKey() ở playable-builder/src/pipeline/playgroundFields.ts
  return match.options.section || match.className;
}

interface Options {
  fieldsRegistry: PlaygroundFieldsRegistry | null;
  config: PlaygroundConfig;
  onChange: (config: PlaygroundConfig) => void;
}

/** Controlled: page cha giữ state `config` (để vừa render form vừa dựng live preview), form chỉ đọc/ghi qua onChange. */
export function usePlaygroundConfigForm({ fieldsRegistry, config, onChange }: Options) {
  const allMatches = fieldsRegistry?.matches ?? [];
  const fieldMatches = useMemo(() => allMatches.filter((m) => m.kind === "field"), [allMatches]);
  const assetCount = allMatches.length - fieldMatches.length;

  const groups = useMemo(() => {
    const map = new Map<string, PlaygroundMatch[]>();
    for (const match of fieldMatches) {
      const key = groupKey(match);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(match);
    }
    return map;
  }, [fieldMatches]);

  const setValue = (group: string, prop: string, value: string | number | boolean) => {
    onChange({ ...config, [group]: { ...config[group], [prop]: value } });
  };

  const getValue = (group: string, match: PlaygroundMatch) => config[group]?.[match.propName] ?? match.defaultLiteral?.value;

  return { groups, assetCount, setValue, getValue };
}
