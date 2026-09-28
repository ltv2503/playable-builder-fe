// Module thuần, không phụ thuộc Node/DOM — dùng để tính relPath của 1 entry
// trong file zip build Cocos giống hệt cách server tính (xem zip.util.ts's
// resolveInputDir ở playable-builder): tìm thư mục chứa index.html làm gốc.

export interface ZipEntryLike {
  name: string;
  dir: boolean;
}

/**
 * Tìm thư mục gốc thực sự của build Cocos bên trong zip (dựa vào vị trí nông
 * nhất của index.html) — hỗ trợ cả zip có index.html ở gốc lẫn zip có 1 thư
 * mục bọc ngoài (vd zip cả thư mục `web-mobile/`).
 * Trả về "" nếu index.html ở gốc zip, hoặc null nếu không tìm thấy index.html.
 */
export function detectZipRootPrefix<T extends ZipEntryLike>(entries: T[]): string | null {
  const indexEntry = entries
    .filter((f) => !f.dir && f.name.toLowerCase().endsWith("index.html"))
    .sort((a, b) => a.name.split("/").length - b.name.split("/").length)[0];
  if (!indexEntry) return null;

  const parts = indexEntry.name.split("/");
  return parts.slice(0, -1).join("/"); // "" nếu index.html ở gốc zip
}

/** relPath của 1 entry sau khi bóc prefix thư mục gốc (rootPrefix từ detectZipRootPrefix). "" nếu entry nằm ngoài thư mục gốc hoặc trùng chính thư mục gốc. */
export function stripZipRootPrefix(entryName: string, rootPrefix: string): string {
  const prefixWithSlash = rootPrefix ? rootPrefix + "/" : "";
  if (prefixWithSlash && !entryName.startsWith(prefixWithSlash)) return "";
  return prefixWithSlash ? entryName.slice(prefixWithSlash.length) : entryName;
}
