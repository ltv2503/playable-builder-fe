/**
 * Reflects over a running Cocos Creator scene inside a same-origin iframe and
 * exposes a small, generic property editor over it. Release builds strip all
 * CCClass/editor metadata, so by default we can only infer "what type is this
 * property" from the live runtime value (typeof / duck-typing).
 *
 * If the project uses a `@playgroundField({ section })` / `@playgroundAsset({
 * section })` decorator (paired with `@property`) to mark fields for this
 * tool, its compiled output leaves behind `PlaygroundFieldRegistry` /
 * `PlaygroundAssetRegistry` exports — plain objects keyed by component class
 * name listing exactly the decorated field names (see
 * findPlaygroundFieldRegistry / findPlaygroundAssetRegistry; both come from
 * the *same* underlying registry factory in the project's own source, so
 * they're two independent instances of an identical shape). When either is
 * present, that's the source of truth for which fields to show (merged
 * together); the value-based heuristic below is only a fallback for projects
 * using neither.
 */

export type PropKind = "boolean" | "number" | "string" | "spriteFrame" | "audioClip";

export type PropertyInfo =
  | { key: string; kind: "boolean"; value: boolean; section?: string }
  | { key: string; kind: "number"; value: number; section?: string }
  | { key: string; kind: "string"; value: string; section?: string }
  | { key: string; kind: "spriteFrame"; assetLabel: string; previewUrl?: string; section?: string }
  | { key: string; kind: "audioClip"; assetLabel: string; section?: string };

export type PlaygroundFieldMeta = { section?: string };
/** class name -> field name -> decorator options */
export type PlaygroundFieldRegistry = Record<string, Record<string, PlaygroundFieldMeta>>;

export type ComponentInfo = {
  /** Stable-for-this-boot address: "<dfs child path>#<component index>" */
  key: string;
  label: string;
  properties: PropertyInfo[];
};

export type NodeInfo = {
  path: number[];
  name: string;
  depth: number;
  components: ComponentInfo[];
};

export type OverrideEntry =
  | { path: number[]; componentIndex: number; propKey: string; section?: string; kind: "boolean"; value: boolean }
  | { path: number[]; componentIndex: number; propKey: string; section?: string; kind: "number"; value: number }
  | { path: number[]; componentIndex: number; propKey: string; section?: string; kind: "string"; value: string }
  | { path: number[]; componentIndex: number; propKey: string; section?: string; kind: "spriteFrame"; imageDataUrl: string }
  | { path: number[]; componentIndex: number; propKey: string; section?: string; kind: "audioClip"; audioDataUrl: string };

/** Minimal shape of the Cocos runtime objects we touch. Everything else is `unknown`. */
export interface CocosComponent {
  constructor: { name: string };
  [key: string]: unknown;
}
export interface CocosNode {
  name: string;
  parent: CocosNode | null;
  children: CocosNode[];
  components: CocosComponent[];
}
export interface MutableSpriteFrame {
  texture: unknown;
  rect?: unknown;
  originalSize?: unknown;
  name?: string;
  uuid?: string;
}
export interface CocosAudioClipLike {
  name?: string;
  uuid?: string;
  getDuration: () => number;
  playOneShot: (volume?: number) => void;
}
/** What we set on a freshly-`new`'d cc.AudioClip to make it playable — see applyLiveAudioEdit. */
export interface MutableAudioClip {
  _nativeAsset?: { url: string; duration?: number };
}
export interface CocosNamespace {
  director?: { getScene?: () => CocosNode | null };
  ImageAsset?: new (source: HTMLImageElement) => unknown;
  Texture2D?: new () => { image: unknown };
  SpriteFrame?: new () => MutableSpriteFrame;
  Rect?: new (x: number, y: number, width: number, height: number) => unknown;
  Size?: new (width: number, height: number) => unknown;
  AudioClip?: new () => MutableAudioClip;
}
interface SystemJSInstance {
  entries?: () => Iterable<[string, Record<string, unknown>]>;
}
export interface PlayableWindow extends Window {
  cc?: CocosNamespace;
  System?: SystemJSInstance;
  Image: typeof Image;
  Audio: typeof Audio;
  URL: typeof URL;
}

/**
 * Searches every module SystemJS has instantiated for one exporting
 * `PlaygroundFieldRegistry` (the project's own decorator convention — see the
 * file header). We deliberately don't hardcode a module id/path since that's
 * whatever the project happened to name the decorator's source file.
 */
export function findPlaygroundFieldRegistry(win: PlayableWindow): PlaygroundFieldRegistry | null {
  return findNamedRegistryExport(win, "PlaygroundFieldRegistry");
}

/** Same idea as findPlaygroundFieldRegistry, for @playgroundAsset (image/audio) fields. */
export function findPlaygroundAssetRegistry(win: PlayableWindow): PlaygroundFieldRegistry | null {
  return findNamedRegistryExport(win, "PlaygroundAssetRegistry");
}

function findNamedRegistryExport(win: PlayableWindow, exportName: string): PlaygroundFieldRegistry | null {
  const entries = win.System?.entries;
  if (typeof entries !== "function") return null;
  try {
    for (const [, mod] of entries.call(win.System)) {
      if (mod && typeof mod === "object" && exportName in mod) {
        return (mod as Record<string, unknown>)[exportName] as PlaygroundFieldRegistry;
      }
    }
  } catch {
    return null;
  }
  return null;
}

const BLOCKLIST = new Set([
  "node",
  "uuid",
  "name",
  "enabled",
  "enabledInHierarchy",
  "active",
  "activeInHierarchy",
  "tag",
  "type",
  "__scriptAsset",
  "isValid",
  "constructor",
]);

function isPlainAssignableComponent(comp: unknown): comp is CocosComponent {
  return typeof comp === "object" && comp !== null;
}

function looksLikeSpriteFrame(value: unknown): value is MutableSpriteFrame {
  if (typeof value !== "object" || value === null) return false;
  return "texture" in value && "rect" in value;
}

function looksLikeAudioClip(value: unknown): value is CocosAudioClipLike {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.getDuration === "function" && typeof v.playOneShot === "function";
}

function candidateKeys(comp: CocosComponent): string[] {
  const keys = new Set<string>();
  for (const k in comp) keys.add(k);
  const proto = Object.getPrototypeOf(comp) as object | null;
  if (proto) for (const k of Object.getOwnPropertyNames(proto)) keys.add(k);
  return Array.from(keys).filter((k) => !k.startsWith("_") && !BLOCKLIST.has(k));
}

/**
 * `allowedFields`, when given, comes from PlaygroundFieldRegistry for this exact
 * component class — we then ONLY consider those keys (strict allow-list) instead
 * of the broader `_`-prefix/blocklist heuristic. The runtime-type check (below)
 * still applies either way, since we only know how to render a handful of kinds.
 */
export function extractEditableProps(
  comp: CocosComponent,
  allowedFields?: Record<string, PlaygroundFieldMeta>,
): PropertyInfo[] {
  const out: PropertyInfo[] = [];
  const keys = allowedFields ? Object.keys(allowedFields) : candidateKeys(comp);
  for (const key of keys) {
    let value: unknown;
    try {
      value = comp[key];
    } catch {
      continue;
    }
    const section = allowedFields?.[key]?.section;
    if (typeof value === "function") continue;
    if (typeof value === "boolean") out.push({ key, kind: "boolean", value, section });
    else if (typeof value === "number") out.push({ key, kind: "number", value, section });
    else if (typeof value === "string") out.push({ key, kind: "string", value, section });
    else if (looksLikeSpriteFrame(value))
      out.push({ key, kind: "spriteFrame", assetLabel: value.name || value.uuid || "(unnamed)", section });
    else if (looksLikeAudioClip(value))
      out.push({ key, kind: "audioClip", assetLabel: value.name || value.uuid || "(unnamed)", section });
  }
  return out;
}

export function labelForComponent(comp: CocosComponent): string {
  const name = comp.constructor?.name;
  if (name && name.length > 1 && name !== "Object") return name;
  return "Component";
}

/**
 * Built-in engine components (cc.Sprite, cc.Camera, cc.DirectionalLight...) are
 * registered as named exports on `window.cc` — a custom game script never is. That
 * makes this a reliable way to scan only user scripts and skip the dozens of
 * unrelated technical properties every built-in component carries.
 */
export function isBuiltinComponent(cc: CocosNamespace | undefined, comp: CocosComponent): boolean {
  const name = comp.constructor?.name;
  if (!cc || !name) return false;
  const exported = (cc as unknown as Record<string, unknown>)[name];
  return exported === comp.constructor;
}

export function getNodePath(node: CocosNode): number[] {
  const path: number[] = [];
  let cur: CocosNode | null = node;
  while (cur && cur.parent) {
    const idx = cur.parent.children.indexOf(cur);
    path.unshift(idx);
    cur = cur.parent;
  }
  return path;
}

export function resolveNodeByPath(scene: CocosNode, path: number[]): CocosNode | null {
  let cur: CocosNode = scene;
  for (const idx of path) {
    const next: CocosNode | undefined = cur.children?.[idx];
    if (!next) return null;
    cur = next;
  }
  return cur;
}

export type LiveRef = { node: CocosNode; comp: CocosComponent; componentIndex: number };

export function scanScene(
  scene: CocosNode,
  win?: PlayableWindow,
): { tree: NodeInfo[]; registry: Map<string, LiveRef>; usingPlaygroundFieldRegistry: boolean } {
  const tree: NodeInfo[] = [];
  const registry = new Map<string, LiveRef>();
  const cc = win?.cc;
  const fieldRegistry = win ? findPlaygroundFieldRegistry(win) : null;
  const assetRegistry = win ? findPlaygroundAssetRegistry(win) : null;
  const usingRegistry = fieldRegistry !== null || assetRegistry !== null;

  function walk(node: CocosNode, path: number[], depth: number) {
    const components: ComponentInfo[] = [];
    (node.components || []).forEach((comp, ci) => {
      if (!isPlainAssignableComponent(comp)) return;
      let properties: PropertyInfo[];
      if (usingRegistry) {
        // Strict mode: a project using @playgroundField/@playgroundAsset only
        // exposes fields it explicitly marked with either — merge both
        // registries' entries for this class into one allow-list.
        const className = comp.constructor?.name ?? "";
        const allowed = { ...fieldRegistry?.[className], ...assetRegistry?.[className] };
        if (Object.keys(allowed).length === 0) return;
        properties = extractEditableProps(comp, allowed);
      } else {
        if (isBuiltinComponent(cc, comp)) return;
        properties = extractEditableProps(comp);
      }
      if (properties.length === 0) return;
      const key = `${path.join("/")}#${ci}`;
      registry.set(key, { node, comp, componentIndex: ci });
      components.push({ key, label: labelForComponent(comp), properties });
    });
    if (components.length > 0) tree.push({ path, name: node.name, depth, components });
    (node.children || []).forEach((child, i) => walk(child, [...path, i], depth + 1));
  }

  (scene.children || []).forEach((child, i) => walk(child, [i], 0));
  return { tree, registry, usingPlaygroundFieldRegistry: usingRegistry };
}

export async function waitForSceneReady(
  win: PlayableWindow,
  opts: { timeoutMs?: number; settleMs?: number } = {},
): Promise<CocosNode> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const settleMs = opts.settleMs ?? 300;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const scene = win.cc?.director?.getScene?.();
      if (scene && scene.children && scene.children.length > 0) {
        setTimeout(() => resolve(scene), settleMs);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Timeout: game không khởi động scene trong thời gian chờ (kiểm tra console iframe)."));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

export function applyLiveEdit(registry: Map<string, LiveRef>, key: string, propKey: string, value: unknown) {
  const ref = registry.get(key);
  if (!ref) throw new Error("Component không còn tồn tại (scene đã đổi) — thử reload preview.");
  ref.comp[propKey] = value;
}

/**
 * Loads `imageDataUrl` and applies it to the SpriteFrame currently held at
 * `comp[propKey]`.
 *
 * Deliberately mutates that SAME SpriteFrame object instead of building a new
 * one and reassigning `comp[propKey]` — this property is often only *read* once
 * (e.g. a custom script's own start()), so anything else already holding a
 * reference to the original SpriteFrame (like the SpriteRenderer/Sprite it was
 * copied into) would never see a plain reassignment. Mutating in place means
 * every existing holder picks up the change automatically, live, no reload
 * needed. To avoid corrupting a shared texture atlas (this SpriteFrame's rect
 * may be a small crop of a texture other frames also use), we still give it its
 * OWN new Texture2D rather than touching the atlas texture itself, and reset
 * rect/originalSize to the full new image.
 */
export async function applyLiveImageEdit(
  win: PlayableWindow,
  registry: Map<string, LiveRef>,
  key: string,
  propKey: string,
  imageDataUrl: string,
): Promise<void> {
  const ref = registry.get(key);
  if (!ref) throw new Error("Component không còn tồn tại (scene đã đổi) — thử reload preview.");
  const current = ref.comp[propKey];
  if (!looksLikeSpriteFrame(current)) {
    throw new Error(`Giá trị hiện tại của "${propKey}" không phải SpriteFrame hợp lệ.`);
  }
  const cc = win.cc;
  if (!cc?.ImageAsset || !cc.Texture2D) {
    throw new Error("Không tìm thấy cc.ImageAsset/Texture2D trên window của iframe.");
  }
  const img = new win.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Không load được ảnh vừa upload."));
    img.src = imageDataUrl;
  });
  const imageAsset = new cc.ImageAsset(img);
  const texture = new cc.Texture2D();
  texture.image = imageAsset;
  current.texture = texture;
  if (cc.Rect) current.rect = new cc.Rect(0, 0, img.naturalWidth, img.naturalHeight);
  if (cc.Size) current.originalSize = new cc.Size(img.naturalWidth, img.naturalHeight);
}

/**
 * True for anything that looks like an AudioSource component (duck-typed —
 * NOT `comp.constructor === cc.AudioSource`, since it needs to match across
 * whatever component actually holds the reference, and `cc.AudioSource` may
 * not always be resolvable the same way `isBuiltinComponent` resolves other
 * classes). `clip`/`playing` as data members plus `play`/`stop` as methods is
 * specific enough in practice — nothing else in a Cocos component surface
 * carries all four.
 */
function looksLikeAudioSourceComponent(
  comp: CocosComponent,
): comp is CocosComponent & { clip: unknown; playing: boolean; play: () => void; stop: () => void } {
  return (
    typeof (comp as Record<string, unknown>).play === "function" &&
    typeof (comp as Record<string, unknown>).stop === "function" &&
    "clip" in comp &&
    "playing" in comp
  );
}

function* walkComponents(node: CocosNode): Generator<CocosComponent> {
  for (const comp of node.components || []) {
    if (isPlainAssignableComponent(comp)) yield comp;
  }
  for (const child of node.children || []) yield* walkComponents(child);
}

/** Converts a data: URI to a blob: URL scoped to `win` (must be created via that
 * window's own URL/Blob, not the parent page's, so it stays fetchable from
 * inside that iframe's realm). */
async function dataUrlToBlobUrl(win: PlayableWindow, dataUrl: string): Promise<string> {
  const res = await win.fetch(dataUrl);
  const blob = await res.blob();
  return win.URL.createObjectURL(blob);
}

/**
 * Best-effort audio duration via a plain HTMLAudioElement — used only for
 * AudioClip.getDuration()'s benefit, never required for playback itself (see
 * applyLiveAudioEdit). Resolves to 0 rather than throwing if anything about
 * this fails; a wrong/zero duration is harmless.
 *
 * Deliberately NOT using Web Audio's AudioContext.decodeAudioData for this
 * (an earlier version did): spinning up a second AudioContext just to read a
 * duration and closing it right after is a known landmine on several mobile
 * WebViews, which only reliably support a single *active* AudioContext —
 * doing so can silently suspend the game's own shared one, and closing ours
 * doesn't un-suspend it, leaving the whole game silent afterward. A plain
 * <audio> element is a completely separate API surface with none of that risk.
 */
async function decodeAudioDuration(win: PlayableWindow, blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const audioEl = new win.Audio();
      audioEl.preload = "metadata";
      audioEl.onloadedmetadata = () => resolve(Number.isFinite(audioEl.duration) ? audioEl.duration : 0);
      audioEl.onerror = () => resolve(0);
      audioEl.src = blobUrl;
    } catch {
      resolve(0);
    }
  });
}

/**
 * Builds a fresh, real `cc.AudioClip` from `audioDataUrl` and installs it at
 * `comp[propKey]`.
 *
 * Earlier attempts routed this through `cc.assetManager.loadRemote` — the
 * public API Cocos itself uses for remote audio — but its bundle/downloader
 * pipeline turned out to crash on ad-hoc runtime URLs regardless of whether
 * they were `data:` or `blob:` ("Cannot read properties of undefined
 * (reading 'substring')" deep inside the compiled engine, unrelated to URL
 * shape). Constructing the clip directly sidesteps that pipeline entirely:
 * `new cc.AudioClip()` is public API, and only `_nativeAsset.url` actually
 * matters for playback — `AudioSource._syncPlayer()` reloads independently
 * from that url every time `.clip` is (re)assigned rather than reusing
 * whatever `player` we might put here, via the engine's own much simpler
 * XHR + decodeAudioData path (not the buggy pipeline). `duration` is set on
 * a best-effort basis purely for `getDuration()`'s benefit; leaving it 0 (or
 * wrong) doesn't affect playback at all.
 *
 * This REPLACES `comp[propKey]` with the new clip instance rather than
 * mutating the existing one in place: an AudioSource's `.clip` setter only
 * re-syncs its internal player when handed a *new* clip reference, so an
 * in-place mutation would silently not take effect for the common
 * `audioSource.clip = this.someClip` pattern.
 *
 * That cuts both ways, though: if some OTHER component (very often the same
 * one, via a separate `@property(AudioSource)` field alongside the clip
 * field) already read the OLD clip into its own `.clip` earlier in this same
 * boot — typically once, in onLoad, long before the user gets a chance to
 * edit anything — replacing `comp[propKey]` alone is invisible to it: nothing
 * re-reads the property afterward to notice the swap. So after building the
 * new clip, sweep every live AudioSource-like component in the whole scene
 * (not just this one) and re-point any of them still holding the OLD clip
 * reference at the new one — restarting playback if it was already playing —
 * so the edit is heard immediately instead of only after the next full
 * reboot (which re-runs onLoad from scratch and picks it up "for free").
 */
export async function applyLiveAudioEdit(
  win: PlayableWindow,
  registry: Map<string, LiveRef>,
  key: string,
  propKey: string,
  audioDataUrl: string,
): Promise<void> {
  const ref = registry.get(key);
  if (!ref) throw new Error("Component không còn tồn tại (scene đã đổi) — thử reload preview.");
  const AudioClipCtor = win.cc?.AudioClip;
  if (!AudioClipCtor) {
    throw new Error("Không tìm thấy cc.AudioClip trên window của iframe.");
  }
  const res = await win.fetch(audioDataUrl);
  const blob = await res.blob();
  // Deliberately never revoke this blob: URL: AudioSource._syncPlayer()
  // re-fetches clip._nativeAsset.url from scratch every time .clip is
  // reassigned (not just once at load time), so it must stay valid for the
  // clip's whole lifetime, not just this call.
  const blobUrl = win.URL.createObjectURL(blob);
  const duration = await decodeAudioDuration(win, blobUrl);
  const oldClip = ref.comp[propKey];
  const clip = new AudioClipCtor();
  clip._nativeAsset = { url: blobUrl, duration };
  ref.comp[propKey] = clip;

  if (oldClip) {
    const scene = win.cc?.director?.getScene?.();
    if (scene) {
      for (const comp of walkComponents(scene)) {
        if (!looksLikeAudioSourceComponent(comp) || comp.clip !== oldClip) continue;
        const wasPlaying = !!comp.playing;
        comp.clip = clip;
        if (wasPlaying) {
          try {
            comp.play();
          } catch {
            // Best-effort: leave silent if the engine/browser autoplay policy rejects it.
          }
        }
      }
    }
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được file."));
    reader.readAsDataURL(file);
  });
}
