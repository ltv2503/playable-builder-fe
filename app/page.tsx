"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { injectOverrides } from "@/lib/buildPreviewBlob";
import { collectFromDataTransferItems, collectFromFileList, type CollectedFile } from "@/lib/collectFiles";
import { injectPlaygroundConfig, type PlaygroundConfigOverride } from "@/lib/playgroundConfig";
import {
  applyLiveEdit,
  applyLiveAudioEdit,
  applyLiveImageEdit,
  fileToDataUrl,
  scanScene,
  waitForSceneReady,
  type ComponentInfo,
  type LiveRef,
  type NodeInfo,
  type OverrideEntry,
  type PlayableWindow,
  type PropertyInfo,
} from "@/lib/sceneInspector";

type Status =
  | { kind: "idle" }
  | { kind: "packing" }
  | { kind: "ready"; fileCount: number; rawBytes: number }
  | { kind: "error"; message: string };

type InspectorStatus = "idle" | "waiting" | "ready" | "empty" | "error";

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function parseComponentIndex(key: string): number {
  return Number(key.split("#")[1]);
}

function updateTreeProperty(
  tree: NodeInfo[],
  componentKey: string,
  propKey: string,
  updater: (p: PropertyInfo) => PropertyInfo,
): NodeInfo[] {
  return tree.map((node) => ({
    ...node,
    components: node.components.map((comp): ComponentInfo =>
      comp.key !== componentKey
        ? comp
        : { ...comp, properties: comp.properties.map((p) => (p.key !== propKey ? p : updater(p))) },
    ),
  }));
}

const NO_SECTION = "__none__";

interface SectionItem {
  node: NodeInfo;
  comp: ComponentInfo;
  prop: PropertyInfo;
}

/**
 * Flattens the whole node/component tree into a plain list of sections —
 * matching how overrides are actually keyed now (by section, falling back to
 * class name — see splitOverrides), the node/component a field happens to
 * live on isn't something the person editing needs to see.
 */
function groupAllBySection(tree: NodeInfo[]): Array<{ section: string | null; items: SectionItem[] }> {
  const order: string[] = [];
  const groups = new Map<string, SectionItem[]>();
  for (const node of tree) {
    for (const comp of node.components) {
      for (const prop of comp.properties) {
        const key = prop.section ?? NO_SECTION;
        if (!groups.has(key)) {
          groups.set(key, []);
          order.push(key);
        }
        groups.get(key)!.push({ node, comp, prop });
      }
    }
  }
  return order.map((key) => ({ section: key === NO_SECTION ? null : key, items: groups.get(key)! }));
}

function filesToFormData(files: CollectedFile[]): FormData {
  const form = new FormData();
  for (const { path, file } of files) form.append(path, file, path);
  return form;
}

/**
 * All override kinds (boolean/number/string *and* spriteFrame) go through
 * window.__playgroundConfig (see lib/playgroundConfig.ts) whenever we can
 * resolve which component class they belong to — every @playgroundField AND
 * @playgroundAsset default in the built html already reads from there (see
 * src/pipeline/playgroundFields.ts's makePlaygroundFieldsConfigurable /
 * PLAYGROUND_APPLY_ASSET_FN), so this is a pure client-side script swap +
 * reboot, no server round-trip, and it persists into Export too. Only when
 * the class can't be resolved (rare — e.g. registry not populated yet) do we
 * fall back to the older live-instance-mutation script injection.
 */
function splitOverrides(
  overrides: OverrideEntry[],
  registry: Map<string, LiveRef> | null,
): { configOverrides: PlaygroundConfigOverride[]; fallbackOverrides: OverrideEntry[] } {
  const configOverrides: PlaygroundConfigOverride[] = [];
  const fallbackOverrides: OverrideEntry[] = [];
  for (const o of overrides) {
    const componentKey = `${o.path.join("/")}#${o.componentIndex}`;
    const className = registry?.get(componentKey)?.comp.constructor.name;
    if (className) {
      // Must match src/pipeline/playgroundFields.ts's playgroundGroupKey() exactly:
      // section (a human-friendly, NOT necessarily unique, UI-grouping label) when
      // present, else the component's class name.
      const value = o.kind === "spriteFrame" ? o.imageDataUrl : o.kind === "audioClip" ? o.audioDataUrl : o.value;
      configOverrides.push({ groupKey: o.section || className, propName: o.propKey, value });
    } else {
      fallbackOverrides.push(o);
    }
  }
  return { configOverrides, fallbackOverrides };
}

function upsertOverride(list: OverrideEntry[], entry: OverrideEntry): OverrideEntry[] {
  const idx = list.findIndex(
    (o) => o.path.join(",") === entry.path.join(",") && o.componentIndex === entry.componentIndex && o.propKey === entry.propKey,
  );
  if (idx === -1) return [...list, entry];
  const copy = list.slice();
  copy[idx] = entry;
  return copy;
}

export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filesState, setFilesState] = useState<CollectedFile[] | null>(null);
  const [exportStatus, setExportStatus] = useState<
    { kind: "idle" } | { kind: "exporting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [inspectorStatus, setInspectorStatus] = useState<InspectorStatus>("idle");
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [tree, setTree] = useState<NodeInfo[]>([]);
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [usingRegistry, setUsingRegistry] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const registryRef = useRef<Map<string, LiveRef> | null>(null);
  const winRef = useRef<PlayableWindow | null>(null);
  /** The built HTML from the last full build (no overrides) — reload just re-injects onto this. */
  const baseHtmlRef = useRef<string | null>(null);
  /**
   * True for the one iframe load caused by *our own* debounced reboot-after-edit
   * (see the `overrides` effect below), as opposed to a fresh project upload.
   * The edit panel is the source of truth for what the user set — the html/game
   * just needs to catch up to it, never the other way around — so onIframeLoad
   * must NOT re-seed `tree` from the freshly-booted scene's values on a reboot
   * (that would silently revert/clobber edits, including panel-only display
   * state like an image's previewUrl that the live scene has no concept of).
   */
  const isRebootRef = useRef(false);

  const setPreviewHtml = useCallback((html: string) => {
    const blob = new Blob([html], { type: "text/html" });
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }, []);

  const pack = useCallback(
    async (files: CollectedFile[]) => {
      setStatus({ kind: "packing" });
      try {
        // Build via the server's dist/cli-single-html.js (src/pipeline/builder.ts's
        // buildSingleHtml()) instead of a client-side reimplementation, so the
        // preview matches the real single-html output exactly (same obfuscation,
        // cc.adapter.js injection, watermarking, ...).
        const res = await fetch("/api/preview", { method: "POST", body: filesToFormData(files) });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Build preview thất bại (HTTP ${res.status})`);
        }
        const html = await res.text();
        baseHtmlRef.current = html;
        setPreviewHtml(html);
        const rawBytes = files.reduce((sum, f) => sum + f.file.size, 0);
        setStatus({ kind: "ready", fileCount: files.length, rawBytes });
        setFilesState(files);
        setInspectorStatus("waiting");
        setInspectorError(null);
        setTree([]);
        setOverrides([]);
        registryRef.current = null;
        isRebootRef.current = false;
      } catch (e) {
        setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [setPreviewHtml],
  );

  const handleExport = useCallback(async () => {
    if (!filesState) return;
    setExportStatus({ kind: "exporting" });
    try {
      // @playgroundField and @playgroundAsset edits (bool/number/string/image)
      // are carried over — see app/api/export/route.ts, which injects
      // window.__playgroundConfig into every output file/zip after building.
      const { configOverrides } = splitOverrides(overrides, registryRef.current);
      const form = filesToFormData(filesState);
      if (configOverrides.length > 0) form.append("overrides", JSON.stringify(configOverrides));

      const res = await fetch("/api/export", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export thất bại (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playable-export.zip";
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus({ kind: "idle" });
    } catch (e) {
      setExportStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [filesState, overrides]);

  // Auto-reboot the game whenever an override changes: some properties (e.g. a
  // flag only read once in a component's start()) only take effect if set
  // *before* boot, not by mutating an already-running instance. Debounced so
  // typing in a text/number field doesn't reload on every keystroke.
  //
  // All override kinds are pure client-side script swaps on the *same*
  // already-built base html — no server round-trip needed. Both
  // @playgroundField (bool/number/string) and @playgroundAsset (spriteFrame)
  // fields already read from window.__playgroundConfig in the build (see
  // lib/playgroundConfig.ts); only overrides whose class couldn't be
  // resolved fall back to the older live-instance-mutation script injection.
  useEffect(() => {
    if (!baseHtmlRef.current || overrides.length === 0) return;
    const timer = setTimeout(() => {
      if (!baseHtmlRef.current) return;
      const { configOverrides, fallbackOverrides } = splitOverrides(overrides, registryRef.current);
      let html = injectPlaygroundConfig(baseHtmlRef.current, configOverrides);
      if (fallbackOverrides.length > 0) html = injectOverrides(html, fallbackOverrides);
      isRebootRef.current = true;
      setPreviewHtml(html);
    }, 500);
    return () => clearTimeout(timer);
  }, [overrides, setPreviewHtml]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list || list.length === 0) return;
      pack(collectFromFileList(list));
      e.target.value = "";
    },
    [pack],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;
      setStatus({ kind: "packing" });
      try {
        const files = await collectFromDataTransferItems(items);
        await pack(files);
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      }
    },
    [pack],
  );

  const onIframeLoad = useCallback(async () => {
    const win = iframeRef.current?.contentWindow as PlayableWindow | null;
    if (!win) return;
    winRef.current = win;
    const isReboot = isRebootRef.current;
    isRebootRef.current = false;
    if (!isReboot) {
      setInspectorStatus("waiting");
      setInspectorError(null);
    }
    try {
      const scene = await waitForSceneReady(win, { settleMs: 500 });
      // Node/component structure (paths + component order) is identical across
      // reboots of the same project — only values differ — so this fresh
      // registry's keys line up with whatever `tree` already has, reboot or not.
      const { tree: scanned, registry, usingPlaygroundFieldRegistry } = scanScene(scene, win);
      registryRef.current = registry;
      if (!isReboot) {
        setTree(scanned);
        setUsingRegistry(usingPlaygroundFieldRegistry);
        setInspectorStatus(scanned.length ? "ready" : "empty");
      }
      // On a reboot we caused ourselves (see the `overrides` effect above),
      // deliberately leave `tree` untouched: the panel already reflects what
      // the user set, and the new boot was built to match it (config
      // injection + fallback script) — re-seeding from the rescan here would
      // just be the html clobbering the panel instead of following it.
    } catch (err) {
      if (!isReboot) {
        setInspectorStatus("error");
        setInspectorError(err instanceof Error ? err.message : String(err));
      } else {
        console.error("[reboot rescan] scanScene thất bại sau khi reload do chỉnh sửa:", err);
      }
    }
  }, []);

  const onBooleanChange = (node: NodeInfo, comp: ComponentInfo, prop: PropertyInfo & { kind: "boolean" }) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.checked;
    try {
      applyLiveEdit(registryRef.current!, comp.key, prop.key, value);
    } catch (err) {
      setInspectorError(err instanceof Error ? err.message : String(err));
    }
    setTree((t) => updateTreeProperty(t, comp.key, prop.key, (p) => ({ ...p, value }) as PropertyInfo));
    setOverrides((o) =>
      upsertOverride(o, { path: node.path, componentIndex: parseComponentIndex(comp.key), propKey: prop.key, section: prop.section, kind: "boolean", value }),
    );
  };

  const onNumberChange = (node: NodeInfo, comp: ComponentInfo, prop: PropertyInfo & { kind: "number" }) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.valueAsNumber;
    if (Number.isNaN(value)) return;
    try {
      applyLiveEdit(registryRef.current!, comp.key, prop.key, value);
    } catch (err) {
      setInspectorError(err instanceof Error ? err.message : String(err));
    }
    setTree((t) => updateTreeProperty(t, comp.key, prop.key, (p) => ({ ...p, value }) as PropertyInfo));
    setOverrides((o) =>
      upsertOverride(o, { path: node.path, componentIndex: parseComponentIndex(comp.key), propKey: prop.key, section: prop.section, kind: "number", value }),
    );
  };

  const onStringChange = (node: NodeInfo, comp: ComponentInfo, prop: PropertyInfo & { kind: "string" }) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    try {
      applyLiveEdit(registryRef.current!, comp.key, prop.key, value);
    } catch (err) {
      setInspectorError(err instanceof Error ? err.message : String(err));
    }
    setTree((t) => updateTreeProperty(t, comp.key, prop.key, (p) => ({ ...p, value }) as PropertyInfo));
    setOverrides((o) =>
      upsertOverride(o, { path: node.path, componentIndex: parseComponentIndex(comp.key), propKey: prop.key, section: prop.section, kind: "string", value }),
    );
  };

  const onImageChange = (node: NodeInfo, comp: ComponentInfo, prop: PropertyInfo & { kind: "spriteFrame" }) => async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!winRef.current) throw new Error("Preview chưa sẵn sàng.");
      await applyLiveImageEdit(winRef.current, registryRef.current!, comp.key, prop.key, dataUrl);
      setTree((t) =>
        updateTreeProperty(t, comp.key, prop.key, (p) => ({ ...p, assetLabel: file.name, previewUrl: dataUrl }) as PropertyInfo),
      );
      setOverrides((o) =>
        upsertOverride(o, {
          path: node.path,
          componentIndex: parseComponentIndex(comp.key),
          propKey: prop.key,
          section: prop.section,
          kind: "spriteFrame",
          imageDataUrl: dataUrl,
        }),
      );
    } catch (err) {
      setInspectorError(err instanceof Error ? err.message : String(err));
    }
    e.target.value = "";
  };

  const onAudioChange = (node: NodeInfo, comp: ComponentInfo, prop: PropertyInfo & { kind: "audioClip" }) => async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (!winRef.current) throw new Error("Preview chưa sẵn sàng.");
      await applyLiveAudioEdit(winRef.current, registryRef.current!, comp.key, prop.key, dataUrl);
      setTree((t) => updateTreeProperty(t, comp.key, prop.key, (p) => ({ ...p, assetLabel: file.name }) as PropertyInfo));
      setOverrides((o) =>
        upsertOverride(o, {
          path: node.path,
          componentIndex: parseComponentIndex(comp.key),
          propKey: prop.key,
          section: prop.section,
          kind: "audioClip",
          audioDataUrl: dataUrl,
        }),
      );
    } catch (err) {
      setInspectorError(err instanceof Error ? err.message : String(err));
    }
    e.target.value = "";
  };

  const isPacking = status.kind === "packing";

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-6xl flex-col gap-6 py-12 px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Playable Preview Tool</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upload thư mục build web-mobile của Cocos Creator để xem preview (build qua cli-single-html.js) và chỉnh
            sửa property/ảnh ngay trong trình duyệt.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? "border-primary bg-primary-soft" : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Kéo thả thư mục <code className="rounded bg-black/[.06] px-1 py-0.5 dark:bg-white/[.08]">web-mobile</code> vào
            đây, hoặc
          </p>
          <button
            type="button"
            disabled={isPacking}
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm shadow-orange-900/10 transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {isPacking ? "Đang xử lý..." : "Chọn thư mục"}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            // @ts-expect-error -- webkitdirectory is not in the TS DOM lib yet
            webkitdirectory=""
            directory=""
            multiple
            onChange={onInputChange}
          />
        </div>

        {status.kind === "packing" && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Đang dựng preview...</div>
        )}

        {status.kind === "error" && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {status.message}
          </div>
        )}

        {status.kind === "ready" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>
                Đã load {status.fileCount} file, tổng {formatMB(status.rawBytes)}
              </span>
              <div className="flex items-center gap-3">
                {exportStatus.kind === "error" && (
                  <span className="text-xs text-red-600 dark:text-red-400">{exportStatus.message}</span>
                )}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportStatus.kind === "exporting"}
                  className="rounded-full border border-zinc-400 px-4 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
                >
                  {exportStatus.kind === "exporting" ? "Đang export..." : "Export (cli-ad-networks.js)"}
                </button>
              </div>
            </div>
            {(() => {
              const fallbackCount = splitOverrides(overrides, registryRef.current).fallbackOverrides.length;
              return (
                fallbackCount > 0 && (
                  <p className="text-right text-xs text-amber-600 dark:text-amber-400">
                    Lưu ý: {fallbackCount} chỉnh sửa không xác định được component (registry chưa sẵn sàng?) — chưa
                    được áp vào file export.
                  </p>
                )
              );
            })()}
          </div>
        )}

        {previewUrl && (
          <div className="flex flex-1 gap-6">
            <div className="flex-1 overflow-hidden rounded-xl border border-zinc-300 bg-black dark:border-zinc-700">
              <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={onIframeLoad}
                className="h-[720px] w-full"
                title="Playable preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>

            <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-300 p-4 dark:border-zinc-700 h-[720px]">
              <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Chỉnh sửa</h2>
              {(inspectorStatus === "ready" || inspectorStatus === "empty") && (
                <p className="text-[11px] text-zinc-400">
                  {usingRegistry
                    ? "Nguồn: @playgroundField/@playgroundAsset (chỉ field được đánh dấu)"
                    : "Nguồn: suy đoán theo kiểu dữ liệu (không thấy @playgroundField/@playgroundAsset)"}
                </p>
              )}

              {inspectorStatus === "waiting" && (
                <p className="text-xs text-zinc-500">Đang chờ scene load để quét property...</p>
              )}
              {inspectorStatus === "empty" && (
                <p className="text-xs text-zinc-500">
                  Không tìm thấy property nào có thể sửa (component không có field public khác `_`).
                </p>
              )}
              {inspectorStatus === "error" && inspectorError && (
                <p className="text-xs text-red-600 dark:text-red-400">{inspectorError}</p>
              )}
              {inspectorStatus === "ready" && inspectorError && (
                <p className="text-xs text-red-600 dark:text-red-400">{inspectorError}</p>
              )}

              {groupAllBySection(tree).map((group) => (
                <div key={group.section ?? "__none__"} className="flex flex-col gap-1">
                  {group.section && (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{group.section}</div>
                  )}
                  {group.items.map(({ node, comp, prop }) => {
                    if (prop.kind === "spriteFrame") {
                      return (
                        <div key={`${comp.key}:${prop.key}`} className="flex flex-col gap-1.5 pb-1">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{prop.key}</span>
                          <label
                            className="group relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-zinc-300 bg-[repeating-conic-gradient(#e4e4e7_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:border-zinc-700 dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)]"
                            title={prop.assetLabel}
                          >
                            {prop.previewUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={prop.previewUrl} alt={prop.assetLabel} className="h-full w-full object-contain" />
                            ) : (
                              <span className="px-2 text-center text-xs text-zinc-500">{prop.assetLabel}</span>
                            )}
                            <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-sm font-medium text-white group-hover:flex">
                              Chọn ảnh mới
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={onImageChange(node, comp, prop)}
                            />
                          </label>
                        </div>
                      );
                    }
                    if (prop.kind === "audioClip") {
                      return (
                        <div key={`${comp.key}:${prop.key}`} className="flex flex-col gap-1.5 pb-1">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{prop.key}</span>
                          <label className="group relative flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-zinc-300 bg-zinc-100 px-2 dark:border-zinc-700 dark:bg-zinc-800">
                            <span className="text-2xl leading-none">🎵</span>
                            <span className="max-w-full truncate text-xs text-zinc-500" title={prop.assetLabel}>
                              {prop.assetLabel}
                            </span>
                            <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-sm font-medium text-white group-hover:flex">
                              Chọn audio mới
                            </span>
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={onAudioChange(node, comp, prop)}
                            />
                          </label>
                        </div>
                      );
                    }
                    return (
                      <label key={`${comp.key}:${prop.key}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">{prop.key}</span>
                        {prop.kind === "boolean" && (
                          <input type="checkbox" checked={prop.value} onChange={onBooleanChange(node, comp, prop)} />
                        )}
                        {prop.kind === "number" && (
                          <input
                            type="number"
                            value={prop.value}
                            onChange={onNumberChange(node, comp, prop)}
                            className="w-24 rounded border border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        )}
                        {prop.kind === "string" && (
                          <input
                            type="text"
                            value={prop.value}
                            onChange={onStringChange(node, comp, prop)}
                            className="w-32 rounded border border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
