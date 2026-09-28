/**
 * Gathers uploaded/dropped files into {path, file} pairs. Pure file-collection —
 * no packing/encoding concern, shared by whichever preview/export builder needs it.
 */

export type CollectedFile = { path: string; file: File };

/** Strips the common top-level folder segment webkitdirectory/entry uploads include. */
export function stripRoot(paths: string[]): string {
  if (paths.length === 0) return "";
  const first = paths[0].split("/")[0];
  const allShareRoot = paths.every((p) => p.split("/")[0] === first);
  return allShareRoot ? first + "/" : "";
}

/** Reads a FileList produced by <input webkitdirectory> into {path, file} pairs. */
export function collectFromFileList(list: FileList): CollectedFile[] {
  const files = Array.from(list);
  const rawPaths = files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
  const root = stripRoot(rawPaths);
  return files.map((file, i) => ({
    path: rawPaths[i].startsWith(root) ? rawPaths[i].slice(root.length) : rawPaths[i],
    file,
  }));
}

/** Recursively walks a dropped folder via the (webkit) DataTransferItem FileSystemEntry API. */
export async function collectFromDataTransferItems(items: DataTransferItemList): Promise<CollectedFile[]> {
  type FSEntry = {
    isFile: boolean;
    isDirectory: boolean;
    fullPath: string;
    file(cb: (f: File) => void, errCb: (e: unknown) => void): void;
    createReader(): { readEntries(cb: (entries: FSEntry[]) => void, errCb: (e: unknown) => void): void };
  };
  const entries: FSEntry[] = [];
  for (const item of Array.from(items)) {
    const getAsEntry = (item as unknown as { webkitGetAsEntry?: () => FSEntry | null }).webkitGetAsEntry;
    const entry = getAsEntry?.call(item);
    if (entry) entries.push(entry);
  }

  const out: CollectedFile[] = [];

  async function readAllEntries(reader: ReturnType<FSEntry["createReader"]>): Promise<FSEntry[]> {
    const all: FSEntry[] = [];
    for (;;) {
      const batch: FSEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      all.push(...batch);
    }
    return all;
  }

  async function walk(entry: FSEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
      out.push({ path: entry.fullPath.replace(/^\/+/, ""), file });
    } else if (entry.isDirectory) {
      const children = await readAllEntries(entry.createReader());
      for (const child of children) await walk(child);
    }
  }

  for (const entry of entries) await walk(entry);

  const root = stripRoot(out.map((f) => f.path));
  return out.map((f) => ({ ...f, path: f.path.startsWith(root) ? f.path.slice(root.length) : f.path }));
}
