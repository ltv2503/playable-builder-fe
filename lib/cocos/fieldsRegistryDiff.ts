/**
 * So sánh fieldsRegistry (danh sách @playgroundField/@playgroundAsset quét được — xem
 * lib/api/index.ts's PlaygroundFieldsRegistry) của 2 bản build, dùng cho popup diff lúc "Upload lại"
 * đè lên 1 concept đã có (xem app/builds/[id]/useBuildDetailPage.ts). Pure function, không phụ thuộc
 * React — so khớp field theo `${className}::${propName}` (định danh field, không đổi kể cả khi vị trí
 * trong file đổi giữa 2 lần build).
 */
import type { ApiVariant, PlaygroundConfig, PlaygroundFieldsRegistry, PlaygroundMatch } from "@/lib/api";

function fieldKey(match: PlaygroundMatch): string {
  return `${match.className}::${match.propName}`;
}

/** Phải khớp groupKey() ở components/usePlaygroundConfigForm.ts (chính là playgroundGroupKey() bên backend). */
function groupKey(match: PlaygroundMatch): string {
  return match.options.section || match.className;
}

export interface FieldDiffEntry {
  key: string;
  className: string;
  propName: string;
  match: PlaygroundMatch;
}

export interface FieldDiffChange {
  key: string;
  className: string;
  propName: string;
  before: PlaygroundMatch;
  after: PlaygroundMatch;
}

export interface FieldsRegistryDiff {
  added: FieldDiffEntry[];
  removed: FieldDiffEntry[];
  changed: FieldDiffChange[];
}

/** So sánh phần "shape" của field — bỏ qua defaultLiteral (vị trí trong file, luôn đổi, không phải thay đổi config). */
function shapeSignature(match: PlaygroundMatch): string {
  return JSON.stringify({ kind: match.kind, options: match.options, fieldType: match.fieldType, assetKind: match.assetKind });
}

export function diffFieldsRegistry(oldReg: PlaygroundFieldsRegistry | null, newReg: PlaygroundFieldsRegistry): FieldsRegistryDiff {
  const oldMatches = oldReg?.matches ?? [];
  const oldByKey = new Map(oldMatches.map((m) => [fieldKey(m), m]));
  const newByKey = new Map(newReg.matches.map((m) => [fieldKey(m), m]));

  const added: FieldDiffEntry[] = [];
  const changed: FieldDiffChange[] = [];
  for (const [key, match] of newByKey) {
    const before = oldByKey.get(key);
    if (!before) {
      added.push({ key, className: match.className, propName: match.propName, match });
    } else if (shapeSignature(before) !== shapeSignature(match)) {
      changed.push({ key, className: match.className, propName: match.propName, before, after: match });
    }
  }

  const removed: FieldDiffEntry[] = [];
  for (const [key, match] of oldByKey) {
    if (!newByKey.has(key)) removed.push({ key, className: match.className, propName: match.propName, match });
  }

  return { added, removed, changed };
}

/** Với mỗi field bị xoá, biến thể nào đang set giá trị riêng cho nó thì override đó sẽ hết tác dụng sau khi đè. */
export function variantsAffectedByRemoval(removed: FieldDiffEntry[], variants: ApiVariant[]): { key: string; variantNames: string[] }[] {
  const hasOverride = (config: PlaygroundConfig, entry: FieldDiffEntry) => config[groupKey(entry.match)]?.[entry.propName] !== undefined;

  return removed
    .map((entry) => ({
      key: entry.key,
      variantNames: variants.filter((v) => hasOverride(v.config, entry)).map((v) => v.name),
    }))
    .filter((r) => r.variantNames.length > 0);
}
