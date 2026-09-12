/**
 * Lightweight, blob-URL-based alternative to packWebMobile.ts's base64 packer —
 * used for the in-browser preview only (not for Export, which posts the original
 * files to the server as-is).
 *
 * Instead of reading every asset into memory and base64-encoding it into one
 * giant HTML string, each uploaded File becomes its own `URL.createObjectURL`
 * blob URL immediately (no read/encode step at all). The runtime shim then just
 * rewrites relative paths to the matching blob URL and lets the browser's native
 * fetch/XHR/Image/script loading handle the rest — no manual Response/data-URL
 * construction needed, since blob: URLs are natively fetchable.
 *
 * Cocos still loads most assets dynamically via computed relative paths, so the
 * shim (path -> blob URL resolution) is still required regardless of packing
 * strategy — only the "how do we get bytes for this path" part changes.
 */

import type { CollectedFile } from "./collectFiles";
import type { OverrideEntry } from "./sceneInspector";

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

export type PreviewResult = {
  html: string;
  /** path -> blob URL. Caller owns these and must revoke them when done. */
  blobUrls: Map<string, string>;
  fileCount: number;
  rawBytes: number;
};

export async function buildPreviewHtml(files: CollectedFile[]): Promise<PreviewResult> {
  const indexEntry = files.find((f) => f.path === "index.html");
  if (!indexEntry) {
    throw new Error("Không tìm thấy index.html ở gốc thư mục đã chọn — thư mục phải là bản build web-mobile của Cocos.");
  }

  const blobUrls = new Map<string, string>();
  let rawBytes = 0;
  for (const { path, file } of files) {
    if (path === "index.html") continue;
    rawBytes += file.size;
    // Wrap in a Blob to force the correct MIME type (File.type is unreliable for
    // Cocos-specific extensions like .cconb/.atlas) — this is just a lazy view
    // over the same bytes, not an eager read, so it stays fast.
    blobUrls.set(path, URL.createObjectURL(new Blob([file], { type: mimeOf(path) })));
  }

  const indexHtml = await indexEntry.file.text();
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");

  const isAbsoluteUrl = (url: string) => /^(https?:)?\/\//.test(url);
  const stripLeading = (url: string) => url.replace(/^\.?\//, "");

  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    const href = el.getAttribute("href");
    if (!href || isAbsoluteUrl(href)) return;
    const url = blobUrls.get(stripLeading(href));
    if (url) el.setAttribute("href", url);
  });

  // Static <script src="..."> — rewritten to their blob URL directly and left for
  // the browser's native script loader; no need to fetch+inline text content the
  // way pack-single-html.js does.
  //
  // type="systemjs-importmap" is the one exception: import map entries can be
  // relative (e.g. "cc": "./../cocos-js/cc.js"), resolved against "the import
  // map's URL" — which for a script with a src is that src's own URL. Pointing
  // src at an opaque blob: URL breaks that relative resolution the same way an
  // opaque location.href did before (see the <base> tag below). Inlining the
  // JSON instead makes it resolve against the document's base URL, which the
  // <base> tag gives a normal, hierarchical value.
  for (const el of Array.from(doc.querySelectorAll("script[src]"))) {
    const src = el.getAttribute("src");
    if (!src || isAbsoluteUrl(src)) continue;
    const rel = stripLeading(src);
    if (el.getAttribute("type") === "systemjs-importmap") {
      const entry = files.find((f) => f.path === rel);
      if (entry) {
        el.removeAttribute("src");
        el.textContent = await entry.file.text();
      }
      continue;
    }
    const url = blobUrls.get(rel);
    if (url) el.setAttribute("src", url);
  }

  // Loading the packed doc via a blob: URL makes `location.href` an opaque/
  // synthetic URL, which breaks relative-URL resolution (both native
  // <script src="..."> loading — e.g. SystemJS — and our own shim below). A
  // <base> tag gives everything a normal, hierarchical URL to resolve against.
  const baseEl = doc.createElement("base");
  baseEl.href = "https://playable.invalid/";
  doc.head.insertBefore(baseEl, doc.head.firstChild);

  const mapObj: Record<string, string> = {};
  blobUrls.forEach((url, path) => {
    mapObj[path] = url;
  });
  const shimEl = doc.createElement("script");
  shimEl.textContent = buildBlobRuntimeShim(mapObj);
  doc.head.insertBefore(shimEl, baseEl.nextSibling);

  const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  return { html, blobUrls, fileCount: files.length, rawBytes };
}

const OVERRIDE_SCRIPT_MARKER = "data-playable-overrides";

/** Cheap re-application of edits onto an already-built preview HTML string. */
export function injectOverrides(baseHtml: string, overrides: OverrideEntry[]): string {
  const doc = new DOMParser().parseFromString(baseHtml, "text/html");
  doc.querySelector(`script[${OVERRIDE_SCRIPT_MARKER}]`)?.remove();
  if (overrides.length > 0) {
    const el = doc.createElement("script");
    el.setAttribute(OVERRIDE_SCRIPT_MARKER, "true");
    el.textContent = buildOverrideScript(overrides);
    doc.body.appendChild(el);
  }
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

/**
 * Re-applies user edits made in the live preview to a freshly-booted game —
 * needed because some properties (e.g. a flag only read once in a component's
 * start()) only take effect if set before/around boot, not by mutating an
 * already-running instance.
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
    } else if (o.kind === 'audioClip') {
      var cc2 = window['cc'];
      if (!cc2 || !cc2.AudioClip) {
        console.warn('[override] cc.AudioClip missing, skip', o);
        return;
      }
      // See src/pipeline/channelOutput.ts's PLAYGROUND_CONFIG_BOOTSTRAP audioClip
      // branch for why this builds the clip directly instead of going through
      // cc.assetManager.loadRemote (its pipeline crashes on ad-hoc runtime URLs),
      // and why duration is read via a plain <audio> element rather than a
      // throwaway AudioContext (which can silently suspend the game's own shared
      // one on several mobile WebViews).
      fetch(o.audioDataUrl).then(function(r){ return r.blob(); }).then(function(blob){
        var blobUrl = URL.createObjectURL(blob);
        var finish = function(duration){
          var clip = new cc2.AudioClip();
          clip._nativeAsset = { url: blobUrl, duration: duration };
          comp[o.propKey] = clip;
        };
        var probe = new Audio();
        probe.preload = 'metadata';
        probe.onloadedmetadata = function(){ finish(isFinite(probe.duration) ? probe.duration : 0); };
        probe.onerror = function(){ finish(0); };
        probe.src = blobUrl;
      }).catch(function(err){ console.error('[override] audioClip fetch failed', o, err); });
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

function buildBlobRuntimeShim(map: Record<string, string>): string {
  const mapJson = JSON.stringify(map);
  return `
(function(){
  var MAP = ${mapJson};
  var DEBUG = true;
  function log(){ if (DEBUG) console.log.apply(console, ['[preview]'].concat(Array.prototype.slice.call(arguments))); }
  log('shim installed,', Object.keys(MAP).length, 'resources');
  function resolve(url){
    if (!url) return null;
    var s = String(url);
    if (s.indexOf('blob:') === 0 || s.indexOf('data:') === 0) return null;
    var path;
    try { path = new URL(s, document.baseURI).pathname; } catch(e) { path = s; }
    path = decodeURIComponent(path).replace(/^\\/+/, '');
    if (MAP[path]) return MAP[path];
    for (var key in MAP) {
      if (path.length >= key.length && path.slice(path.length - key.length) === key) {
        var before = path.charAt(path.length - key.length - 1);
        if (before === '' || before === '/') return MAP[key];
      }
    }
    return null;
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init){
    var url = (typeof input === 'string') ? input : (input && input.url);
    var blobUrl = resolve(url);
    if (blobUrl) { log('fetch HIT', url, '->', blobUrl); return realFetch(blobUrl, init); }
    log('fetch MISS (passthrough to network)', url);
    if (realFetch) return realFetch(input, init);
    return Promise.reject(new Error('fetch not available for ' + url));
  };

  var RealOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    var blobUrl = resolve(url);
    var args = Array.prototype.slice.call(arguments);
    if (blobUrl) { log('xhr HIT', url, '->', blobUrl); args[1] = blobUrl; }
    else log('xhr MISS (passthrough)', url);
    return RealOpen.apply(this, args);
  };

  var imgProto = window.HTMLImageElement && window.HTMLImageElement.prototype;
  if (imgProto) {
    var d = Object.getOwnPropertyDescriptor(imgProto, 'src');
    Object.defineProperty(imgProto, 'src', {
      configurable: true,
      get: d.get,
      set: function(v){ var blobUrl = resolve(v); d.set.call(this, blobUrl || v); }
    });
  }

  var scriptProto = window.HTMLScriptElement && window.HTMLScriptElement.prototype;
  if (scriptProto) {
    var ds = Object.getOwnPropertyDescriptor(scriptProto, 'src');
    Object.defineProperty(scriptProto, 'src', {
      configurable: true,
      get: ds.get,
      set: function(v){
        var blobUrl = resolve(v);
        if (blobUrl) log('script.src HIT', v, '->', blobUrl);
        else log('script.src MISS', v);
        ds.set.call(this, blobUrl || v);
      }
    });
  }
  var realSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value){
    if (name === 'src' && this.tagName === 'SCRIPT') { this.src = value; return; }
    return realSetAttribute.call(this, name, value);
  };

  if (window.Worker) {
    var RealWorker = window.Worker;
    window.Worker = function(url, opts){
      var blobUrl = resolve(url);
      if (blobUrl) log('Worker HIT', url, '->', blobUrl);
      else log('Worker MISS (passthrough)', url);
      return new RealWorker(blobUrl || url, opts);
    };
    window.Worker.prototype = RealWorker.prototype;
  }

  var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
  if (mediaProto) {
    var dm = Object.getOwnPropertyDescriptor(mediaProto, 'src');
    Object.defineProperty(mediaProto, 'src', {
      configurable: true,
      get: dm.get,
      set: function(v){ var blobUrl = resolve(v); dm.set.call(this, blobUrl || v); }
    });
  }
})();
`;
}
