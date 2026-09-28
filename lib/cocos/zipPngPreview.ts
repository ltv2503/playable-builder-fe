// Chạy hoàn toàn ở client (browser) bằng JSZip — chỉ để liệt kê ảnh PNG cho
// người dùng chọn có nén hay không TRƯỚC khi submit upload thật. Dùng chung
// logic dò root-folder (zipRoot.ts) với server (xem zip.util.ts's
// resolveInputDir ở playable-builder) để relPath tính ra khớp với key mà
// server dùng trong resCache.
import JSZip from "jszip";
import { detectZipRootPrefix, stripZipRootPrefix } from "./zipRoot";

export interface ZipPngEntry {
  /** relPath đã chuẩn hoá, khớp với key resCache phía server. */
  path: string;
  size: number;
  /** data-uri để hiện thumbnail demo — undefined nếu ảnh quá lớn (bỏ qua để đỡ tốn bộ nhớ trình duyệt). */
  dataUrl?: string;
}

// Ảnh lớn hơn mức này thì không sinh data-uri demo (đỡ nặng), chỉ hiện tên/size.
const MAX_PREVIEW_SIZE = 3 * 1024 * 1024; // 3MB

export async function listPngImagesInZip(file: File): Promise<ZipPngEntry[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((f) => !f.dir);

  const rootPrefix = detectZipRootPrefix(entries);
  if (rootPrefix === null) return [];

  const pngEntries = entries.filter((f) => f.name.toLowerCase().endsWith(".png")).filter((f) => stripZipRootPrefix(f.name, rootPrefix) !== "");

  const results = await Promise.all(
    pngEntries.map(async (f) => {
      const path = stripZipRootPrefix(f.name, rootPrefix);
      const data = await f.async("uint8array");
      const dataUrl = data.length <= MAX_PREVIEW_SIZE ? `data:image/png;base64,${await f.async("base64")}` : undefined;
      return { path, size: data.length, dataUrl };
    }),
  );

  return results.sort((a, b) => a.path.localeCompare(b.path));
}
