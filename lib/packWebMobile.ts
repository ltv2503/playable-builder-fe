/**
 * Browser port of scripts/pack-single-html.js — packs an uploaded Cocos Creator
 * web build folder (index.html + assets) into one self-contained HTML string.
 * Runs entirely client-side (FileReader/DOMParser), no server round-trip.
 */

import type { OverrideEntry } from "./sceneInspector";

export type CollectedFile = { path: string; file: File };

const MIME: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
  ".bin": "application/octet-stream",
  ".cconb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".atlas": "text/plain",
};

function extOf(path: string) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

function mimeOf(path: string) {
  return MIME[extOf(path)] || "application/octet-stream";
}

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

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export type PackProgress = { phase: "reading" | "inlining" | "serializing"; done: number; total: number };

export type PackResult = { html: string; fileCount: number; rawBytes: number; outBytes: number };

export async function buildPlayableHtml(
  files: CollectedFile[],
  onProgress?: (p: PackProgress) => void,
  overrides?: OverrideEntry[],
): Promise<PackResult> {
  const indexEntry = files.find((f) => f.path === "index.html");
  if (!indexEntry) {
    throw new Error("Không tìm thấy index.html ở gốc thư mục đã chọn — thư mục phải là bản build web-mobile của Cocos.");
  }

  const others = files.filter((f) => f.path !== "index.html");
  const resMap: Record<string, { m: string; d: string }> = {};
  let rawBytes = 0;

  for (let i = 0; i < others.length; i++) {
    const { path, file } = others[i];
    const buf = await file.arrayBuffer();
    rawBytes += buf.byteLength;
    resMap[path] = { m: mimeOf(path), d: bufferToBase64(buf) };
    onProgress?.({ phase: "reading", done: i + 1, total: others.length });
  }

  const indexHtml = await indexEntry.file.text();
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");

  const isAbsoluteUrl = (url: string) => /^(https?:)?\/\//.test(url);
  const stripLeading = (url: string) => url.replace(/^\.?\//, "");

  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    const href = el.getAttribute("href");
    if (!href || isAbsoluteUrl(href)) return;
    const rel = stripLeading(href);
    const entry = resMap[rel];
    if (!entry) return;
    const style = doc.createElement("style");
    style.textContent = base64ToUtf8(entry.d);
    el.replaceWith(style);
    delete resMap[rel];
  });

  doc.querySelectorAll("script[src]").forEach((el) => {
    const src = el.getAttribute("src");
    const type = el.getAttribute("type");
    if (!src || isAbsoluteUrl(src)) return;
    if (type === "systemjs-importmap") return;
    const rel = stripLeading(src);
    const entry = resMap[rel];
    if (!entry) return;
    const script = doc.createElement("script");
    script.textContent = base64ToUtf8(entry.d);
    el.replaceWith(script);
    delete resMap[rel];
  });

  doc.querySelectorAll('script[type="systemjs-importmap"]').forEach((el) => {
    const src = el.getAttribute("src");
    if (!src) return;
    const rel = stripLeading(src);
    const entry = resMap[rel];
    if (!entry) return;
    el.removeAttribute("src");
    el.textContent = base64ToUtf8(entry.d);
    delete resMap[rel];
  });

  onProgress?.({ phase: "inlining", done: 1, total: 1 });

  // Loading the packed doc via a blob: URL (or srcdoc) makes `location.href` an
  // opaque/synthetic URL, which breaks relative-URL resolution (both native
  // <script src="..."> loading — e.g. SystemJS — and our own shim below). A
  // <base> tag gives everything a normal, hierarchical URL to resolve against.
  const baseEl = doc.createElement("base");
  baseEl.href = "https://playable.invalid/";
  doc.head.insertBefore(baseEl, doc.head.firstChild);

  const shim = buildRuntimeShim(resMap);
  const shimEl = doc.createElement("script");
  shimEl.textContent = shim;
  doc.head.insertBefore(shimEl, baseEl.nextSibling);

  if (overrides && overrides.length > 0) appendOverrideScript(doc, overrides);

  onProgress?.({ phase: "serializing", done: 1, total: 1 });

  const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  return { html, fileCount: files.length, rawBytes, outBytes: html.length };
}

const OVERRIDE_SCRIPT_MARKER = "data-playable-overrides";

function appendOverrideScript(doc: Document, overrides: OverrideEntry[]) {
  const el = doc.createElement("script");
  el.setAttribute(OVERRIDE_SCRIPT_MARKER, "true");
  el.textContent = buildOverrideScript(overrides);
  doc.body.appendChild(el);
}

/**
 * Cheap re-application of edits onto an already-packed HTML string: swaps just
 * the override <script> instead of re-reading/re-encoding every asset again
 * (which is what buildPlayableHtml's own `overrides` param would force). Use this
 * for "apply my edits and reload the preview"; use buildPlayableHtml directly
 * only for a fresh upload (or a final export).
 */
export function injectOverrides(baseHtml: string, overrides: OverrideEntry[]): string {
  const doc = new DOMParser().parseFromString(baseHtml, "text/html");
  doc.querySelector(`script[${OVERRIDE_SCRIPT_MARKER}]`)?.remove();
  if (overrides.length > 0) appendOverrideScript(doc, overrides);
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

/**
 * Re-applies user edits made in the live preview to a freshly-booted game — needed
 * because some properties (e.g. a flag only read once in a component's start())
 * only take effect if set before/around boot, not by mutating an already-running
 * instance. Runs self-contained inside the packed page; polls for the scene the
 * same way sceneInspector.waitForSceneReady does, since this script has no access
 * to that module (it only exists as a source string embedded in the output HTML).
 */
export function buildOverrideScript(overrides: OverrideEntry[]): string {
  const json = JSON.stringify(overrides);
  return `
(function(){
  var OVERRIDES = ${json};
  function resolveNode(scene, path){
    var cur = scene;
    for (var i=0;i<path.length;i++){ cur = cur && cur.children && cur.children[path[i]]; if(!cur) return null; }
    return cur;
  }
  function applyOne(scene, o){
    var targetNode = resolveNode(scene, o.path);
    var comp = targetNode && targetNode.components && targetNode.components[o.componentIndex];
    if (!comp) { console.warn('[override] component not found', o); return; }
    if (o.kind === 'spriteFrame') {
      var cc = window['cc'];
      if (!cc || !cc.ImageAsset || !cc.Texture2D) {
        console.warn('[override] cc.ImageAsset/Texture2D missing, skip', o);
        return;
      }
      // Mutate the SpriteFrame object already at comp[propKey] in place (own new
      // Texture2D so we don't corrupt a shared atlas) instead of swapping in a new
      // object — anything else already holding a reference to it (e.g. a
      // SpriteRenderer this field was copied into during start()) needs to see the
      // change on the SAME object, since a plain reassignment here wouldn't reach it.
      var current = comp[o.propKey];
      if (!current || typeof current !== 'object' || !('texture' in current) || !('rect' in current)) {
        console.warn('[override] current value is not a SpriteFrame, skip', o);
        return;
      }
      var img = new Image();
      img.onload = function(){
        try {
          var imageAsset = new cc.ImageAsset(img);
          var texture = new cc.Texture2D();
          texture.image = imageAsset;
          current.texture = texture;
          if (cc.Rect) current.rect = new cc.Rect(0, 0, img.naturalWidth, img.naturalHeight);
          if (cc.Size) current.originalSize = new cc.Size(img.naturalWidth, img.naturalHeight);
        } catch (e) { console.error('[override] spriteFrame apply failed', o, e); }
      };
      img.src = o.imageDataUrl;
    } else {
      try { comp[o.propKey] = o.value; } catch (e) { console.error('[override] set failed', o, e); }
    }
  }
  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    var cc = window['cc'];
    var scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (scene && scene.children && scene.children.length) {
      clearInterval(timer);
      OVERRIDES.forEach(function(o){ applyOne(scene, o); });
    } else if (tries > 200) {
      clearInterval(timer);
      console.warn('[override] gave up waiting for scene');
    }
  }, 150);
})();
`;
}

function buildRuntimeShim(resMap: Record<string, { m: string; d: string }>): string {
  const mapJson = JSON.stringify(resMap);
  return `
(function(){
  var MAP = ${mapJson};
  var DEBUG = true;
  function log(){ if (DEBUG) console.log.apply(console, ['[pack]'].concat(Array.prototype.slice.call(arguments))); }
  log('shim installed,', Object.keys(MAP).length, 'resources');
  function b64ToBuf(b64){
    var bin = atob(b64), len = bin.length, buf = new Uint8Array(len);
    for (var i=0;i<len;i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  function resolve(url){
    if (!url) return null;
    var s = String(url);
    if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0) return null;
    var path;
    try { path = new URL(s, document.baseURI).pathname; } catch(e) { path = s; }
    path = decodeURIComponent(path).replace(/^\\/+/, '');
    if (MAP[path]) return path;
    for (var key in MAP) {
      if (path.length >= key.length && path.slice(path.length - key.length) === key) {
        var before = path.charAt(path.length - key.length - 1);
        if (before === '' || before === '/') return key;
      }
    }
    return null;
  }
  function dataUrl(entry){ return 'data:' + entry.m + ';base64,' + entry.d; }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init){
    var url = (typeof input === 'string') ? input : (input && input.url);
    var key = resolve(url);
    if (key) {
      log('fetch HIT', url, '->', key);
      var entry = MAP[key];
      var body = b64ToBuf(entry.d);
      return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': entry.m } }));
    }
    log('fetch MISS (passthrough to network)', url);
    if (realFetch) return realFetch(input, init);
    return Promise.reject(new Error('fetch not available for ' + url));
  };

  var RealXHR = window.XMLHttpRequest;
  function ShimXHR(){
    this._real = new RealXHR();
    this._key = null;
    this._responseType = '';
    this._status = 0;
    this._readyState = 0;
    this._response = null;
    this._responseText = '';
    this._listeners = {};
    this.onload = null;
    this.onerror = null;
    this.onprogress = null;
    this.onreadystatechange = null;
    this.ontimeout = null;
  }
  function prop(name, real){
    Object.defineProperty(ShimXHR.prototype, name, {
      get: function(){ return this._key ? this['_' + name] : this._real[real || name]; }
    });
  }
  prop('readyState'); prop('status'); prop('response'); prop('responseText');
  Object.defineProperty(ShimXHR.prototype, 'statusText', {
    get: function(){ return this._key ? (this._status === 200 ? 'OK' : '') : this._real.statusText; }
  });
  Object.defineProperty(ShimXHR.prototype, 'responseURL', {
    get: function(){ return this._key ? location.href : this._real.responseURL; }
  });
  Object.defineProperty(ShimXHR.prototype, 'responseType', {
    get: function(){ return this._key ? this._responseType : this._real.responseType; },
    set: function(v){ this._responseType = v; if (!this._key) { try { this._real.responseType = v; } catch(e){} } }
  });
  ShimXHR.prototype.open = function(method, url){
    this._key = resolve(url);
    log('xhr open', url, this._key ? ('HIT -> ' + this._key) : 'MISS (passthrough)');
    if (!this._key) return this._real.open.apply(this._real, arguments);
  };
  ShimXHR.prototype.setRequestHeader = function(){
    if (!this._key) this._real.setRequestHeader.apply(this._real, arguments);
  };
  ShimXHR.prototype.overrideMimeType = function(){
    if (!this._key) this._real.overrideMimeType.apply(this._real, arguments);
  };
  ShimXHR.prototype.getResponseHeader = function(name){
    if (this._key) return (String(name).toLowerCase() === 'content-type') ? MAP[this._key].m : null;
    return this._real.getResponseHeader.apply(this._real, arguments);
  };
  ShimXHR.prototype.getAllResponseHeaders = function(){
    if (this._key) return 'content-type: ' + MAP[this._key].m + '\\r\\n';
    return this._real.getAllResponseHeaders.apply(this._real, arguments);
  };
  ShimXHR.prototype.addEventListener = function(type, fn){
    if (this._key) { (this._listeners[type] = this._listeners[type] || []).push(fn); return; }
    return this._real.addEventListener.apply(this._real, arguments);
  };
  ShimXHR.prototype.removeEventListener = function(type, fn){
    if (this._key) {
      var arr = this._listeners[type];
      if (arr) { var i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
      return;
    }
    return this._real.removeEventListener.apply(this._real, arguments);
  };
  ShimXHR.prototype.abort = function(){ if (!this._key) this._real.abort(); };
  ShimXHR.prototype.send = function(){
    var self = this;
    if (this._key) {
      var entry = MAP[this._key];
      setTimeout(function(){
        self._readyState = 4;
        self._status = 200;
        var rt = self._responseType;
        if (rt === 'arraybuffer') self._response = b64ToBuf(entry.d);
        else if (rt === 'json') self._response = JSON.parse(atob(entry.d));
        else if (rt === 'blob') self._response = new Blob([b64ToBuf(entry.d)], { type: entry.m });
        else {
          var text = atob(entry.d);
          self._response = text;
          self._responseText = text;
        }
        function fire(type, handler){
          if (handler) handler.call(self);
          var arr = self._listeners[type];
          if (arr) arr.slice().forEach(function(fn){ fn.call(self); });
        }
        fire('readystatechange', self.onreadystatechange);
        fire('load', self.onload);
        fire('loadend', null);
      }, 0);
      return;
    }
    return this._real.send.apply(this._real, arguments);
  };
  window.XMLHttpRequest = ShimXHR;

  var imgProto = window.HTMLImageElement && window.HTMLImageElement.prototype;
  if (imgProto) {
    var d = Object.getOwnPropertyDescriptor(imgProto, 'src');
    Object.defineProperty(imgProto, 'src', {
      configurable: true,
      get: d.get,
      set: function(v){
        var key = resolve(v);
        d.set.call(this, key ? dataUrl(MAP[key]) : v);
      }
    });
  }

  var scriptProto = window.HTMLScriptElement && window.HTMLScriptElement.prototype;
  if (scriptProto) {
    var ds = Object.getOwnPropertyDescriptor(scriptProto, 'src');
    Object.defineProperty(scriptProto, 'src', {
      configurable: true,
      get: ds.get,
      set: function(v){
        var key = resolve(v);
        if (key) {
          log('script.src HIT', v, '->', key);
          var entry = MAP[key];
          var blob = new Blob([b64ToBuf(entry.d)], { type: entry.m || 'application/javascript' });
          ds.set.call(this, URL.createObjectURL(blob));
        } else {
          log('script.src MISS', v);
          ds.set.call(this, v);
        }
      }
    });
  }
  var realSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value){
    if (name === 'src' && this.tagName === 'SCRIPT') {
      this.src = value;
      return;
    }
    return realSetAttribute.call(this, name, value);
  };

  if (window.Worker) {
    var RealWorker = window.Worker;
    window.Worker = function(url, opts){
      var key = resolve(url);
      if (key) {
        log('Worker HIT', url, '->', key);
        var entry = MAP[key];
        var blob = new Blob([b64ToBuf(entry.d)], { type: 'application/javascript' });
        var blobUrl = URL.createObjectURL(blob);
        return new RealWorker(blobUrl, opts);
      }
      log('Worker MISS (passthrough)', url);
      return new RealWorker(url, opts);
    };
    window.Worker.prototype = RealWorker.prototype;
  }

  var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
  if (mediaProto) {
    var dm = Object.getOwnPropertyDescriptor(mediaProto, 'src');
    Object.defineProperty(mediaProto, 'src', {
      configurable: true,
      get: dm.get,
      set: function(v){
        var key = resolve(v);
        dm.set.call(this, key ? dataUrl(MAP[key]) : v);
      }
    });
  }
})();
`;
}
