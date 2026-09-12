import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { runCliScript, writeFormFilesToDir, injectPlaygroundConfigIntoOutputDir } from "@/lib/serverBuild";

/**
 * Wraps the sibling playable-builder package's existing dist/cli-ad-networks.js
 * (the real, per-ad-network packer, built from
 * playable-builder/src/pipeline/builder.ts's buildAdNetworks()) rather than
 * reimplementing it. We only materialize an input folder for it to read: the
 * uploaded files as-is.
 *
 * The optional `overrides` form field (JSON `{groupKey,propName,value}[]` —
 * same shape lib/playgroundConfig.ts builds for the live preview, covering
 * both @playgroundField and @playgroundAsset) is applied by injecting a
 * `window.__playgroundConfig = {...}` script into every output file/zip
 * *after* the CLI build finishes — every @playgroundField/@playgroundAsset
 * property in the build already reads from that global (see
 * playable-builder/src/pipeline/playgroundFields.ts and
 * channelOutput.ts's PLAYGROUND_CONFIG_BOOTSTRAP), so this is the whole
 * mechanism, no CLI change needed.
 *
 * NOTE: we previously tried injecting a small "re-apply overrides at boot"
 * script alongside the uploaded *input* files, the same trick used for the
 * in-browser preview reload — verified end-to-end that the old
 * build-single-html.js DOES bundle arbitrary extra .js files it finds in the
 * input folder, but it also silently drops some of them depending on their
 * exact content (confirmed NOT about file size, not about specific
 * identifiers like "cc" or "node", not about cross-function calls alone —
 * each of those individually-plausible theories was contradicted by a later
 * test). That's moot now: patching the *output* files directly (this file)
 * sidesteps the whole problem.
 */

const BUILD_SCRIPT = path.resolve(process.cwd(), "..", "playable-builder", "dist", "cli-ad-networks.js");

interface PlaygroundConfigOverride {
  groupKey: string;
  propName: string;
  value: string | number | boolean;
}

function toConfigObject(overrides: PlaygroundConfigOverride[]): Record<string, Record<string, string | number | boolean>> {
  const config: Record<string, Record<string, string | number | boolean>> = {};
  for (const { groupKey, propName, value } of overrides) {
    config[groupKey] = config[groupKey] || {};
    config[groupKey][propName] = value;
  }
  return config;
}

async function addDirToZip(zip: JSZip, dir: string, base: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      await addDirToZip(zip, full, rel);
    } else {
      zip.file(rel, await fs.readFile(full));
    }
  }
}

export async function POST(request: Request) {
  let inputDir: string | null = null;
  let outputDir: string | null = null;
  try {
    const form = await request.formData();

    let overrides: PlaygroundConfigOverride[] = [];
    const overridesRaw = form.get("overrides");
    if (typeof overridesRaw === "string" && overridesRaw.length > 0) {
      try {
        overrides = JSON.parse(overridesRaw);
      } catch {
        return Response.json({ error: "Trường overrides không phải JSON hợp lệ." }, { status: 400 });
      }
    }

    inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "playable-export-in-"));
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "playable-export-out-"));

    await writeFormFilesToDir(form, inputDir);
    if (!(await fs.stat(path.join(inputDir, "index.html")).catch(() => null))) {
      return Response.json({ error: "Không thấy index.html trong dữ liệu upload." }, { status: 400 });
    }

    await runCliScript(BUILD_SCRIPT, [inputDir, outputDir]);
    await injectPlaygroundConfigIntoOutputDir(outputDir, toConfigObject(overrides));

    const zip = new JSZip();
    await addDirToZip(zip, outputDir, "");
    const zipBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    // jszip types the backing buffer as the generic ArrayBufferLike (which also
    // covers SharedArrayBuffer); it's always a plain ArrayBuffer in practice here.
    const zipArrayBuffer = zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength,
    ) as ArrayBuffer;

    return new Response(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="playable-export.zip"',
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    if (inputDir) await fs.rm(inputDir, { recursive: true, force: true }).catch(() => {});
    if (outputDir) await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  }
}
