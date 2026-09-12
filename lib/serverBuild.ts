/**
 * Server-side helpers shared by app/api/preview and app/api/export: both
 * materialize an uploaded FormData into a temp folder, then shell out to one
 * of the compiled CLI scripts in ../playable-builder/dist (built from
 * playable-builder/src/pipeline/builder.ts).
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

export async function writeFormFilesToDir(form: FormData, dir: string): Promise<void> {
  for (const [key, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    const dest = path.join(dir, key);
    if (!dest.startsWith(dir)) continue; // guard against a path escaping via "../"
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await value.arrayBuffer()));
  }
}

export function runCliScript(scriptPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [scriptPath, ...args],
      { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${path.basename(scriptPath)} failed: ${error.message}\n${stdout}\n${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

/**
 * Splices `window.__playgroundConfig = {...}` right after `<head>` in an html
 * string built by playable-builder's dist/cli-*.js. Every @playgroundField
 * property in such a build already reads from this global (falling back to
 * its own original default when the key is absent — see
 * playable-builder/src/pipeline/playgroundFields.ts), so this is the whole
 * mechanism: no other change to the html is needed.
 */
export function injectPlaygroundConfigIntoHtml(html: string, config: Record<string, Record<string, string | number | boolean>>): string {
  if (Object.keys(config).length === 0) return html;
  const script = `<script>window.__playgroundConfig=${JSON.stringify(config)};</script>`;
  const idx = html.indexOf("<head>");
  if (idx === -1) return html; // unexpected shape — leave untouched rather than guess
  const insertAt = idx + "<head>".length;
  return html.slice(0, insertAt) + script + html.slice(insertAt);
}

/**
 * Walks every file dist/cli-ad-networks.js wrote under `dir` and injects the
 * playground config into each — .html files directly, .zip files (mintegral,
 * google, facebook's split-res variant, tiktok, ...) by unzipping, patching
 * the html entry inside, and re-zipping. No-op (skips this whole pass) when
 * `config` is empty, so builds with no overrides are untouched.
 */
export async function injectPlaygroundConfigIntoOutputDir(dir: string, config: Record<string, Record<string, string | number | boolean>>): Promise<void> {
  if (Object.keys(config).length === 0) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await injectPlaygroundConfigIntoOutputDir(full, config);
      continue;
    }
    if (entry.name.endsWith(".html")) {
      const html = await fs.readFile(full, "utf-8");
      await fs.writeFile(full, injectPlaygroundConfigIntoHtml(html, config));
    } else if (entry.name.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await fs.readFile(full));
      const htmlName = Object.keys(zip.files).find((n) => n.endsWith(".html") && !zip.files[n].dir);
      if (!htmlName) continue;
      const html = await zip.files[htmlName].async("string");
      zip.file(htmlName, injectPlaygroundConfigIntoHtml(html, config), { compression: "DEFLATE" });
      const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      await fs.writeFile(full, buf);
    }
  }
}
